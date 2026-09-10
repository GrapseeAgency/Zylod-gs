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
 * Each event: { actionType, entityType, payloadJson, clientCreatedAt?, retryCount? }
 */
interface SyncEventInput {
  actionType?: unknown
  entityType?: unknown
  payloadJson?: unknown
  clientCreatedAt?: unknown
  retryCount?: unknown
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

  return {
    actionType: raw.actionType,
    entityType: raw.entityType,
    payloadJson: raw.payloadJson,
    clientCreatedAt,
    retryCount,
  }
}

export async function POST(request: NextRequest) {
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

    await db.offlineSyncEvents.createMany({
      data: normalized.map((event) => ({ ...event, userId })),
    })

    return NextResponse.json({
      success: true,
      data: { accepted: normalized.length, rejected: rawItems.length - normalized.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to persist sync events'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

/**
 * GET /api/native/offline-sync — recent ingested events, oldest unprocessed
 * first. Intended for admin/back-office monitoring of the offline queue.
 */
export async function GET(request: NextRequest) {
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
