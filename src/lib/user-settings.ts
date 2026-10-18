import { db } from '@/lib/db'
import crypto from 'crypto'

/**
 * Shared helpers for the four userSettings-backed profile surfaces
 * (theme / language / privacy / linked-accounts).
 *
 * Contract (Task 52-c):
 *  - GET never creates a row — unset surfaces report their defaults with
 *    `configured: false` (true once a userSettings row exists).
 *  - Writes are Zod-validated upserts, and every change appends an auditLogs
 *    row (action 'user_settings_updated', metadata { keys: [...] }).
 *  - linkedAccounts is stored as a JSON string; corrupt JSON is treated as []
 *    and self-heals on the next write.
 */

export interface LinkedAccountEntry {
  id: string
  provider: string
  handle: string
  linkedAt: string
}

export const LINKED_ACCOUNTS_LIMIT = 5

/**
 * Parse the stored linkedAccounts JSON defensively. Corrupt or malformed
 * values are treated as an empty list (the next write replaces the stored
 * value entirely, which self-heals the corruption).
 */
export function parseLinkedAccounts(raw: string | null | undefined): LinkedAccountEntry[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const entries: LinkedAccountEntry[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const provider = typeof rec.provider === 'string' ? rec.provider : ''
      const handle = typeof rec.handle === 'string' ? rec.handle : ''
      if (!provider || !handle) continue
      entries.push({
        id: typeof rec.id === 'string' && rec.id ? rec.id : crypto.randomUUID(),
        provider,
        handle,
        linkedAt: typeof rec.linkedAt === 'string' && rec.linkedAt ? rec.linkedAt : new Date(0).toISOString(),
      })
    }
    return entries
  } catch {
    return []
  }
}

export function serializeLinkedAccounts(accounts: LinkedAccountEntry[]): string {
  return JSON.stringify(accounts)
}

/**
 * Audit-log a settings change. Field names match the auditLogs rows written
 * by the sibling routes (actorId / action / entityType / entityId / metadata).
 */
export async function auditSettingsChange(
  actorId: string,
  settingsRowId: string,
  keys: string[],
  extra?: Record<string, unknown>
): Promise<void> {
  await db.auditLogs.create({
    data: {
      actorId,
      action: 'user_settings_updated',
      entityType: 'userSettings',
      entityId: settingsRowId,
      metadata: JSON.stringify({ keys, ...extra }),
    },
  })
}
