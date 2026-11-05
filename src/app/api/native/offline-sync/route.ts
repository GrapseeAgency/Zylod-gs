import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/native/offline-sync
 *
 * Ingestion point for the Android app's offline action queue. The native
 * OfflineSyncWorker replays each queued action here once connectivity is
 * restored; actions are persisted to `offlineSyncEvents` for later business
 * processing (processedAt is set downstream).
 *
 * When the replay carries a valid session token (mirrored from the WebView
 * into the app's encrypted store), the event is attributed to that user.
 * Unauthenticated replays are still accepted and stored without a userId.
 *
 * Body: a single event, an array of events, or { items: [...] }.
 * Each event: { actionType, entityType, payloadJson, clientCreatedAt?, retryCount?, eventId? }
 *
 * t280 idempotency: the replay is at-least-once (worker backoff re-POSTs
 * after a lost response), and CREATE_ORDER is money — an event carrying a
 * stable `eventId` is inserted at most once (existing id ⇒ skipped, counted
 * as deduplicated). Events without an eventId keep the legacy behavior.
 */
interface SyncEventInput {
  actionType?: unknown
  entityType?: unknown
  payloadJson?: unknown
  clientCreatedAt?: unknown
  retryCount?: unknown
  eventId?: unknown
}

function normalizeEvent(raw: SyncEventInput) {
  if (typeof raw.actionType !== 'string' || raw.actionType.length === 0) return null
  if (typeof raw.entityType !== 'string' || raw.entityType.length === 0) return null
  if (typeof raw.payloadJson !== 'string' || raw.payloadJson.length === 0) return null

  const createdRaw = raw.clientCreatedAt
  const clientCreatedAt =
    (typeof createdRaw === 'number' && Number.isFinite(createdRaw) && createdRaw > 0
      ? new Date(createdRaw)
      : null) ?? new Date()
  const retryCount =
    typeof raw.retryCount === 'number' && Number.isFinite(raw.retryCount)
      ? Math.max(0, Math.trunc(raw.retryCount))
      : 0

  // t280: stable client event id — capped to keep the indexed column sane;
  // anything that is not a non-empty string is stored as absent (legacy).
  const eventIdRaw = raw.eventId
  const eventId =
    typeof eventIdRaw === 'string' && eventIdRaw.length > 0
      ? eventIdRaw.slice(0, 128)
      : null

  return {
    actionType: raw.actionType,
    entityType: raw.entityType,
    payloadJson: raw.payloadJson,
    clientCreatedAt,
    retryCount,
    eventId,
  }
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, 'native-offline-sync', 60, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json()

    const rawItems: SyncEventInput[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : [body]

    const normalized = rawItems
      .map((item) => normalizeEvent(item ?? {}))
      .filter((item): item is NonNullable<typeof item> => item !== null)

    if (normalized.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid sync events in request' },
        { status: 400 }
      )
    }

    // Attribute the replay to the signed-in user when a valid session is
    // presented; otherwise accept anonymously.
    let userId: string | null = null
    try {
      const auth = await authenticateRequest(request)
      if (auth.authenticated && auth.user) {
        userId = auth.user.id
      }
    } catch {
      // Missing/invalid token — store the event unattributed.
    }

    // t280 idempotency: drop events whose eventId is already ingested — a
    // backoff-replayed CREATE_ORDER must not become a second order. SQLite
    // unique indexes allow multiple NULLs, so legacy id-less events pass.
    const withIds = normalized.filter((event) => event.eventId !== null)
    let deduplicated = 0
    let toInsert = normalized
    if (withIds.length > 0) {
      const existing = await db.offlineSyncEvents.findMany({
        where: { eventId: { in: withIds.map((event) => event.eventId as string) } },
        select: { eventId: true },
      })
      const existingIds = new Set(existing.map((row) => row.eventId))
      const seen = new Set<string>()
      toInsert = normalized.filter((event) => {
        if (event.eventId === null) return true
        if (existingIds.has(event.eventId) || seen.has(event.eventId)) {
          deduplicated++
          return false
        }
        seen.add(event.eventId)
        return true
      })
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          accepted: 0,
          rejected: rawItems.length - normalized.length,
          deduplicated,
        },
      })
    }

    await db.offlineSyncEvents.createMany({
      data: toInsert.map((event) => ({ ...event, userId })),
    })

    return NextResponse.json({
      success: true,
      data: {
        accepted: toInsert.length,
        rejected: rawItems.length - normalized.length,
        deduplicated,
      },
    })
  } catch (error) {
    // t280: a P2002 unique race on eventId between two concurrent replays
    // means the dedupe did its job — report success, not a 400 that would
    // burn the worker's retry budget.
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({
        success: true,
        data: { accepted: 0, rejected: 0, deduplicated: 1, race: 'unique-eventId' },
      })
    }
    const message = error instanceof Error ? error.message : 'Failed to persist sync events'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

/**
 * GET /api/native/offline-sync — recent ingested events, oldest unprocessed
 * first. t194 hardening: ADMIN-ONLY — this queue exposes internal action
 * metadata (action types, user attribution, retry counts) that must never be
 * readable by a random authenticated user, let alone a guest.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user || auth.user.userType !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  try {
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get('limit')) || 50,
      200
    )

    const [events, pendingCount] = await Promise.all([
      db.offlineSyncEvents.findMany({
        orderBy: { receivedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          userId: true,
          actionType: true,
          entityType: true,
          clientCreatedAt: true,
          retryCount: true,
          receivedAt: true,
          processedAt: true,
        },
      }),
      db.offlineSyncEvents.count({ where: { processedAt: null } }),
    ])

    return NextResponse.json({ success: true, data: { events, pendingCount } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load sync events'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
