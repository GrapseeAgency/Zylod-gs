import { db } from '@/lib/db'

/**
 * Financial-profile evidence (Task 148): adding, removing, or re-pointing a
 * payout method is the classic withdrawal-hijack vector — t119 pays out to
 * these rows — so every change leaves an auditLogs row. The metadata is
 * REDACTED BY CONSTRUCTION: never the full account number, only the last 4
 * (the cards rail already stores only last4; the bank/wallet rails store the
 * full number on the row, which is exactly why the audit must not).
 *
 * Task 153 audit fix: this write used to be fire-and-forget with a SILENT
 * catch — under SQLite contention the evidence could vanish with no trace,
 * and the 201 response raced the row's commit (t148's cross-actor pin
 * flaked on exactly that). The write is now awaited by every call site
 * (evidence is durable BEFORE the response lands) and failures are LOUD —
 * still never a gate for the business operation, never silent.
 */

export function maskAccount(n: string | null | undefined): string {
  if (!n) return 'none'
  const s = String(n)
  return s.length <= 4 ? `****${s}` : `****${s.slice(-4)}`
}

export async function financialAudit(params: {
  actorId: string
  action: 'financial_method_added' | 'financial_method_removed' | 'financial_method_updated'
  methodId: string
  summary: Record<string, unknown>
}): Promise<void> {
  try {
    await db.auditLogs.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: 'paymentMethods',
        entityId: params.methodId,
        metadata: JSON.stringify(params.summary),
      },
    })
  } catch (e) {
    console.error('financial-audit: evidence write FAILED —', params.action, params.methodId, e)
  }
}
