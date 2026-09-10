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

    // Gross GMV from supplier subOrders
    const salesAgg = await db.subOrders.aggregate({
      where: { supplierId: userId },
      _sum: { subtotal: true, shippingCost: true },
      _count: { id: true },
    })

    const grossGMV = (salesAgg._sum.subtotal || 0) + (salesAgg._sum.shippingCost || 0)
    const totalOrders = salesAgg._count.id || 0

    // Standard platform fee 3% for B2B wholesale
    const platformCommission = grossGMV * 0.03
    const netEarnings = grossGMV - platformCommission

    // Available for payout (wallet balance)
    const wallet = await db.wallets.findFirst({ where: { userId } })
    const availablePayout = wallet?.balance || 0

    // Escrow currently in transit
    const escrowAgg = await db.escrowAccounts.aggregate({
      where: { supplierId: userId, status: 'held' },
      _sum: { amount: true },
    })

    // Monthly breakdown (last 6 months calculation)
    const subOrders = await db.subOrders.findMany({
      where: { supplierId: userId },
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
        pendingEscrow: escrowAgg._sum.amount || 0,
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
