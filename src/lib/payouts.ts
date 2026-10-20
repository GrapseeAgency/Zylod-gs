import { z } from 'zod'

/**
 * Task 107: THE PAYOUT RAIL (shared contracts). Withdrawal requests are a
 * verification queue, not a ledger event: a request creates a PENDING
 * sellerPayouts row and HOLDS the amount (available = wallet balance − the
 * supplier's own pending/processing rows) without touching the wallet;
 * only an admin decision moves money — complete debits for real with a
 * transfer reference on record, reject frees the hold. Terminal states
 * (completed/failed) can never be re-decided.
 */

const METHODS = ['bank', 'bKash', 'Nagad', 'Upay', 'Rocket'] as const

export const withdrawSchema = z
  .object({
    amount: z.number().positive('Amount must be positive'),
    method: z.enum(METHODS),
    accountNumber: z.string().trim().min(6, 'Account number is required').max(40),
    holderName: z.string().trim().min(2, 'Beneficiary name is required').max(80),
    bankName: z.string().trim().max(80).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.amount < 50) ctx.addIssue({ code: 'custom', message: 'Minimum withdrawal is ৳50' })
  })

export const payoutDecisionSchema = z
  .object({
    action: z.enum(['complete', 'reject']),
    reference: z.string().trim().min(3, 'Transfer reference is required to complete a payout (TRXID / bank ref)').max(64).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.action === 'complete' && !d.reference) {
      ctx.addIssue({ code: 'custom', message: 'Transfer reference is required to complete a payout (TRXID / bank ref)' })
    }
  })

export function normalizePayoutMethod(method: string): string {
  const map: Record<string, string> = {
    bank: 'bank_transfer',
    bKash: 'bkash',
    Nagad: 'nagad',
    Upay: 'upay',
    Rocket: 'rocket',
  }
  return map[method] ?? method.toLowerCase()
}

export function shapeAdminPayout(
  row: {
    id: string
    supplierId: string
    amount: number
    method: string
    status: string
    destination: string | null
    reference: string | null
    fee: number
    processedAt: Date | null
    createdAt: Date
  },
  companyName?: string
) {
  return {
    id: row.id,
    supplierId: row.supplierId,
    ...(companyName !== undefined ? { companyName } : {}),
    amount: row.amount,
    method: row.method,
    status: row.status,
    destination: row.destination,
    reference: row.reference,
    fee: row.fee,
    processedAt: row.processedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}
