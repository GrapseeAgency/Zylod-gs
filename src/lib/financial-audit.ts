import { db } from '@/lib/db'

/**
 * Financial-profile evidence (Task 148): adding, removing, or re-pointing a
 * payout method is the classic withdrawal-hijack vector — t119 pays out to
 * these rows — so every change leaves an auditLogs row. The metadata is
 * REDACTED BY CONSTRUCTION: never the full account number, only the last 4
 * (the cards rail already stores only last4; the bank/wallet rails store the
 * full number on the row, which is exactly why the audit must not).
 */

export function maskAccount(n: string | null | undefined): string {
  if (!n) return 'none'
  const s = String(n)
  return s.length <= 4 ? `****${s}` : `****${s.slice(-4)}`
}

export function financialAudit(params: {
  actorId: string
  action: 'financial_method_added' | 'financial_method_removed' | 'financial_method_updated'
  methodId: string
  summary: Record<string, unknown>
}): void {
  db.auditLogs
    .create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: 'paymentMethods',
        entityId: params.methodId,
        metadata: JSON.stringify(params.summary),
      },
    })
    .catch(() => { /* evidence, not a gate */ })
}
