import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id

    // 🐞 Task 73: subOrders.supplierId and escrowAccounts.supplierId store
    // supplierProfiles.id — filtering them by users.id (the OLD code) matched
    // NOTHING: grossGMV, monthly sales and pendingEscrow all read zero for
    // every seller. Resolve the caller's real profile id first.
    const profile = await db.supplierProfiles.findUnique({
      where: { userId },
      select: { id: true },
    })
    const supplierId = profile?.id ?? 'none'

    // Gross GMV from supplier subOrders
    const salesAgg = await db.subOrders.aggregate({
      where: { supplierId },
      _sum: { subtotal: true, shippingCost: true },
      _count: { id: true },
    })

    const grossGMV = (salesAgg._sum.subtotal || 0) + (salesAgg._sum.shippingCost || 0)
    const totalOrders = salesAgg._count.id || 0

    // Standard platform fee 3% for B2B wholesale
    const platformCommission = grossGMV * 0.03
    const netEarnings = grossGMV - platformCommission

    // Available for payout (wallet balance minus the seller's own pending
    // withdrawal requests — Task 107: requests HOLD their amount until an
    // admin decides, so the same ৳ can never be double-spent)
    const wallet = await db.wallets.findFirst({ where: { userId } })
    const openPayouts = profile
      ? await db.sellerPayouts.findMany({
          where: { supplierId: profile.id, status: { in: ['pending', 'processing'] } },
          select: { amount: true },
        })
      : []
    const onHold = openPayouts.reduce((s, r) => s + r.amount, 0)
    const availablePayout = Math.max(0, (wallet?.balance || 0) - onHold)

    // Escrow currently in transit
    const escrowAgg = await db.escrowAccounts.aggregate({
      where: { supplierId, status: 'held' },
      _sum: { amount: true },
    })

    // Task 73: money ACTUALLY paid out — the Task 72 payout ledger rows.
    const payoutAgg = await db.walletTransactions.aggregate({
      where: { wallet: { userId }, type: 'payout' },
      _sum: { amount: true },
    })

    // Monthly breakdown (last 6 months calculation)
    const subOrders = await db.subOrders.findMany({
      where: { supplierId },
      select: { subtotal: true, shippingCost: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      success: true,
      data: {
        grossGMV,
        netEarnings,
        platformCommission,
        availablePayout,
        onHoldForPayouts: onHold,
        pendingEscrow: escrowAgg._sum.amount || 0,
        totalPaidOut: payoutAgg._sum.amount || 0,
        totalOrders,
        commissionRate: '3.0%',
        currency: 'BDT',
        recentSales: subOrders.slice(0, 10).map((s) => ({
          total: s.subtotal + (s.shippingCost || 0),
          date: s.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('Earnings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
