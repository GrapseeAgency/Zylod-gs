import type { PrismaClient, Prisma } from '@prisma/client'

/**
 * Task 71 — the SafePay ESCROW LEDGER, written for real.
 *
 * Before this module the escrowAccounts table had FOUR readers (wallet
 * balance, wallet page, finance/earnings, support copy) and ZERO writers —
 * every "held in escrow" number on the platform was an honest zero wearing a
 * confident label. The house payment doctrine now has its ledger:
 *
 *   HOLD     — the moment a payment is VERIFIED (seller verify, admin
 *              override, signed webhook, wallet-pay at order time) the
 *              verified funds are held per SUPPLIER (one row per subOrder,
 *              amount = the subOrder's real subtotal).
 *   RELEASE  — when that supplier's shipment is DELIVERED, their row flips
 *              to 'released' (releasedAt set) — the seller has earned it.
 *   REFUND   — when the order is cancelled (buyer self-service or admin
 *              force-cancel) every still-'held' row flips to 'refunded'.
 *
 * All helpers run INSIDE the caller's transaction (same atomicity as the
 * payment/order writes they accompany) and are idempotent: a hold already
 * present for the order is never duplicated, a non-'held' row is never
 * re-flipped.
 */

type Tx = Prisma.TransactionClient

/** Hold one row per supplier subOrder — call when the order's money is first verified. */
export async function holdEscrowInTx(tx: Tx, orderId: string, buyerId: string): Promise<number> {
  const existing = await tx.escrowAccounts.findFirst({ where: { orderId }, select: { id: true } })
  if (existing) return 0 // already held — idempotent (a partial payment holds once)

  const subOrders = await tx.subOrders.findMany({
    where: { orderId },
    select: { supplierId: true, subtotal: true },
  })
  if (subOrders.length === 0) return 0

  await tx.escrowAccounts.createMany({
    data: subOrders.map((so) => ({
      orderId,
      buyerId,
      supplierId: so.supplierId,
      amount: so.subtotal,
      status: 'held',
    })),
  })
  return subOrders.length
}

/** Release a supplier's held escrow when their shipment is DELIVERED. */
export async function releaseEscrowInTx(tx: Tx, orderId: string, supplierId?: string): Promise<number> {
  const result = await tx.escrowAccounts.updateMany({
    where: {
      orderId,
      status: 'held',
      ...(supplierId ? { supplierId } : {}),
    },
    data: { status: 'released', releasedAt: new Date() },
  })
  return result.count
}

/** Refund-mark every still-held row when the order is cancelled. */
export async function refundEscrowInTx(tx: Tx, orderId: string): Promise<number> {
  const result = await tx.escrowAccounts.updateMany({
    where: { orderId, status: 'held' },
    data: { status: 'refunded' },
  })
  return result.count
}

/** Convenience for non-tx callers (fire-and-forget contexts). */
export async function holdEscrow(db: PrismaClient, orderId: string, buyerId: string): Promise<number> {
  return db.$transaction((tx) => holdEscrowInTx(tx, orderId, buyerId))
}
