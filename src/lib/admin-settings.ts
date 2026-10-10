import { z } from 'zod'
import { db } from '@/lib/db'
import type { adminSettings as AdminSettingsRow } from '@prisma/client'

/**
 * Admin settings registry — the whitelist of KNOWN setting keys.
 *
 * De-fake charter, applied to settings:
 * - Every key in this registry must have a REAL consumer (stated truthfully
 *   in `description`). Inert settings are fake functionality and forbidden —
 *   do not add a key here unless its behavior is actually wired.
 * - Unknown keys are rejected (404), never blindly written: the adminSettings
 *   KV table can only ever hold keys from this registry.
 * - Values are stored as plain strings (Prisma `value String`) and coerced
 *   back to their typed form through the registry schema. A stored value that
 *   no longer parses falls back to the built-in default (logged, never faked).
 * - "Unset" is honest: no row (or an explicitly saved empty string for text
 *   settings) means the real consumer is using `defaultValue`. The admin API
 *   reports such keys as `value: null` — it never renders a default as if it
 *   were a stored value.
 */

export type AdminSettingValueType = 'int' | 'string' | 'boolean'
export type AdminSettingValue = string | number | boolean

export interface AdminSettingDefinition {
  key: string
  label: string
  category: string
  /** Must truthfully state what really consumes this setting. */
  description: string
  valueType: AdminSettingValueType
  zodSchema: z.ZodType<AdminSettingValue>
  defaultValue: AdminSettingValue
  isPublic: boolean
}

/* ── returns.windowDays ──────────────────────────────────────────────────── */

/**
 * Default buyer return-filing window in days (used until an admin saves a
 * real value and whenever the stored row is absent).
 */
export const RETURNS_WINDOW_DAYS_DEFAULT = 7

const RETURNS_WINDOW_SCHEMA: z.ZodType<AdminSettingValue> = z
  .number()
  .int('Return window must be a whole number of days')
  .min(0, 'Return window cannot be negative (0 disables the window)')
  .max(365, 'Return window cannot exceed 365 days')

/* ── support contact (public) ────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+()\-.\s\d]{6,32}$/

const SUPPORT_EMAIL_SCHEMA: z.ZodType<AdminSettingValue> = z
  .string()
  .trim()
  .max(254, 'Support e-mail must be 254 characters or fewer')
  .refine((v) => v === '' || EMAIL_RE.test(v), {
    message: 'Support e-mail must be a valid e-mail address (or empty to unset)',
  })

const SUPPORT_PHONE_SCHEMA: z.ZodType<AdminSettingValue> = z
  .string()
  .trim()
  .max(32, 'Support phone must be 32 characters or fewer')
  .refine((v) => v === '' || PHONE_RE.test(v), {
    message: 'Support phone must contain only digits, spaces and + ( ) - . characters (or be empty to unset)',
  })

/* ── the registry (order defines API/UI ordering) ────────────────────────── */

export const ADMIN_SETTINGS: readonly AdminSettingDefinition[] = [
  {
    key: 'returns.windowDays',
    label: 'Return filing window (days)',
    category: 'returns',
    description:
      'Enforced by the real buyer return-filing API (POST /api/orders/[id]/return): once a real delivered tracking event (orderTracking.status = "delivered") exists for the order, filing is rejected after this many days from the latest delivery. 0 disables the window. With NO delivered tracking event the window is not enforced — no delivery date is ever invented.',
    valueType: 'int',
    zodSchema: RETURNS_WINDOW_SCHEMA,
    defaultValue: RETURNS_WINDOW_DAYS_DEFAULT,
    isPublic: false,
  },
  {
    key: 'support.email',
    label: 'Support e-mail',
    category: 'support',
    description:
      'Buyer-facing support e-mail address served by the public settings endpoint (GET /api/settings/public), which contact surfaces read. Saving an empty string unsets it — the public endpoint then omits the key entirely instead of serving an empty value.',
    valueType: 'string',
    zodSchema: SUPPORT_EMAIL_SCHEMA,
    defaultValue: '',
    isPublic: true,
  },
  {
    key: 'support.phone',
    label: 'Support phone',
    category: 'support',
    description:
      'Buyer-facing support phone number served by the public settings endpoint (GET /api/settings/public), which contact surfaces read. Saving an empty string unsets it — the public endpoint then omits the key entirely instead of serving an empty value.',
    valueType: 'string',
    zodSchema: SUPPORT_PHONE_SCHEMA,
    defaultValue: '',
    isPublic: true,
  },
]

export const ADMIN_SETTINGS_BY_KEY: Readonly<Record<string, AdminSettingDefinition>> = Object.fromEntries(
  ADMIN_SETTINGS.map((entry) => [entry.key, entry])
)

/** A typed value that counts as "actually set". Empty string = unset for text settings. */
export function isSettingValueSet(value: AdminSettingValue): boolean {
  return !(typeof value === 'string' && value === '')
}

/**
 * Coerce a stored adminSettings string back to its typed form.
 * Returns null when the stored value cannot be honestly interpreted
 * (caller decides: fall back to defaultValue / report as unset).
 */
export function coerceStoredSettingValue(entry: AdminSettingDefinition, stored: string): AdminSettingValue | null {
  let candidate: AdminSettingValue
  if (entry.valueType === 'int') {
    const trimmed = stored.trim()
    if (!/^-?\d+$/.test(trimmed)) return null
    candidate = Number(trimmed)
  } else if (entry.valueType === 'boolean') {
    if (stored !== 'true' && stored !== 'false') return null
    candidate = stored === 'true'
  } else {
    candidate = stored
  }
  const parsed = entry.zodSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

/**
 * Typed value of a row for API responses: null when the key is unset
 * (no row, explicitly empty string, or a stored value that fails the
 * registry schema — the default shown alongside it is what consumers use).
 */
export function extractSettingValue(entry: AdminSettingDefinition, row: AdminSettingsRow | null): AdminSettingValue | null {
  if (!row) return null
  const coerced = coerceStoredSettingValue(entry, row.value)
  if (coerced === null || !isSettingValueSet(coerced)) return null
  return coerced
}

/* ── serialized shape (shared by GET + PUT so both emit identical rows) ──── */

export interface SerializedAdminSetting {
  key: string
  label: string
  category: string
  description: string
  valueType: AdminSettingValueType
  isPublic: boolean
  /** Currently stored typed value — null when unset (default is in effect). */
  value: AdminSettingValue | null
  defaultValue: AdminSettingValue
  /** Row updatedAt in ISO when a row exists, else null. */
  updatedAt: string | null
}

export function serializeAdminSetting(entry: AdminSettingDefinition, row: AdminSettingsRow | null): SerializedAdminSetting {
  return {
    key: entry.key,
    label: entry.label,
    category: entry.category,
    description: entry.description,
    valueType: entry.valueType,
    isPublic: entry.isPublic,
    value: extractSettingValue(entry, row),
    defaultValue: entry.defaultValue,
    updatedAt: row ? row.updatedAt.toISOString() : null,
  }
}

/* ── consumer helper with a small TTL cache ──────────────────────────────── */

const SETTING_CACHE_TTL_MS = 45_000
const settingCache = new Map<string, { value: AdminSettingValue; expiresAt: number }>()

/** Drop the cached value after a successful write so consumers see it immediately. */
export function invalidateSettingCache(key: string): void {
  settingCache.delete(key)
}

/**
 * Read a setting for real consumers (e.g. the return-filing window).
 * - Absent row → the registry defaultValue.
 * - Stored value that fails the registry schema → defaultValue + console.error
 *   (never silently invent a different value).
 * - Cached in memory for 45s to keep hot paths off the database; the PUT
 *   endpoint invalidates the entry it writes.
 * - Unknown key → throws (programmer error; the registry is the whitelist).
 */
export async function getSettingValue(key: string): Promise<AdminSettingValue | null> {
  const entry = ADMIN_SETTINGS_BY_KEY[key]
  if (!entry) {
    throw new Error(`Unknown admin setting key: ${key} — keys must be registered in src/lib/admin-settings.ts`)
  }

  const now = Date.now()
  const hit = settingCache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  const row = await db.adminSettings.findUnique({
    where: { key },
    select: { value: true },
  })

  let value: AdminSettingValue
  if (!row) {
    value = entry.defaultValue
  } else {
    const coerced = coerceStoredSettingValue(entry, row.value)
    if (coerced === null) {
      console.error(
        `adminSettings["${key}"]: stored value does not match the registry schema — falling back to the built-in default`
      )
      value = entry.defaultValue
    } else {
      value = coerced
    }
  }

  settingCache.set(key, { value, expiresAt: now + SETTING_CACHE_TTL_MS })
  return value
}
