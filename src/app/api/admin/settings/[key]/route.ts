import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import {
  ADMIN_SETTINGS_BY_KEY,
  coerceStoredSettingValue,
  invalidateSettingCache,
  isSettingValueSet,
  serializeAdminSetting,
  type AdminSettingDefinition,
} from '@/lib/admin-settings'

/**
 * PUT /api/admin/settings/[key] — upsert ONE known admin setting (ADMIN ONLY).
 *
 * Real behavior (no fake data):
 * - Guard chain: admin auth FIRST (401) → rate limit (30/min) → unknown key
 *   404 (the registry is a whitelist — there are deliberately NO blind KV
 *   writes: a key that is not registered cannot be created) → Zod validation
 *   of the body per the registry entry (400 with fieldErrors).
 * - Upserts the real adminSettings row {key, value: String(coerced), category,
 *   description} and invalidates the in-memory consumer cache so behavior
 *   changes immediately (e.g. the buyer return-filing window).
 * - Every write is audit-logged (action "setting_updated") with the
 *   authenticated admin's id as actor (never client-supplied) and real
 *   before/after typed values (null = was/is unset).
 */
const BodySchema = z.object({
  value: z.unknown(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-settings-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { key } = await params

    // Registry whitelist: unknown keys 404, never blind KV writes.
    const entry = ADMIN_SETTINGS_BY_KEY[key]
    if (!entry) {
      return NextResponse.json(
        { error: `Unknown setting key: ${key} — only registered setting keys can be written.` },
        { status: 404 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsedBody = BodySchema.safeParse(body)
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsedBody.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Validate the value against the registry schema for this key's type.
    const parsedValue = entry.zodSchema.safeParse(parsedBody.data.value)
    if (!parsedValue.success) {
      // The value schema is a scalar schema, so issues land in formErrors
      // (fieldErrors stays empty) — surface the first real Zod message.
      const flattened = parsedValue.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      const message: string | undefined = flattened.formErrors[0] ?? firstFieldIssue
      return NextResponse.json(
        {
          error: message || `Invalid value for "${entry.label}"`,
          issues: flattened.fieldErrors,
        },
        { status: 400 }
      )
    }
    const coerced = parsedValue.data
    const valueString = String(coerced)

    // Typed value of a stored string for the audit trail — null = unset.
    const typedOrNull = (def: AdminSettingDefinition, stored: string): (string | number | boolean) | null => {
      const parsed = coerceStoredSettingValue(def, stored)
      return parsed !== null && isSettingValueSet(parsed) ? parsed : null
    }

    const existing = await db.adminSettings.findUnique({ where: { key } })
    // Real typed before/after for the audit trail — null = unset on that side.
    const before = existing ? typedOrNull(entry, existing.value) : null
    const after = typedOrNull(entry, valueString)

    const saved = await db.adminSettings.upsert({
      where: { key },
      update: { value: valueString, category: entry.category, description: entry.description },
      create: { key, value: valueString, category: entry.category, description: entry.description },
    })

    // Consumers (e.g. the return-filing window) read through a TTL cache —
    // bust it immediately so the new value takes effect right away.
    invalidateSettingCache(key)

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'setting_updated',
        entityType: 'adminSettings',
        entityId: key,
        metadata: JSON.stringify({
          key,
          before,
          after,
          adminId: auth.user.id,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: serializeAdminSetting(entry, saved),
      message: `Setting "${entry.label}" updated.`,
    })
  } catch (error) {
    console.error('Admin settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
