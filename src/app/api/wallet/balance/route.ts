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

    let wallet = await db.wallets.findFirst({ where: { userId } })
    if (!wallet) {
      wallet = await db.wallets.create({
        data: { userId, balance: 0, currency: 'BDT' },
      })
    }

    // Escrow Breakdown
    const heldEscrow = await db.escrowAccounts.aggregate({
      where: { OR: [{ buyerId: userId }, { supplierId: userId }], status: 'held' },
      _sum: { amount: true },
    })

    const releasedEscrow = await db.escrowAccounts.aggregate({
      where: { OR: [{ buyerId: userId }, { supplierId: userId }], status: 'released' },
      _sum: { amount: true },
    })

    // Transaction breakdown
    const txAgg = await db.walletTransactions.groupBy({
      by: ['type'],
      where: { walletId: wallet.id },
      _sum: { amount: true },
      _count: { id: true },
    })

    let totalDeposits = 0
    let totalWithdrawals = 0
    let totalPayments = 0
    let totalRefunds = 0
    let totalCashback = 0

    txAgg.forEach((item) => {
      const sum = item._sum.amount || 0
      if (item.type === 'deposit') totalDeposits = sum
      else if (item.type === 'withdrawal') totalWithdrawals = sum
      else if (item.type === 'payment') totalPayments = sum
      else if (item.type === 'refund') totalRefunds = sum
      else if (item.type === 'cashback') totalCashback = sum
    })

    return NextResponse.json({
      success: true,
      data: {
        availableBalance: wallet.balance,
        currency: wallet.currency,
        heldInEscrow: heldEscrow._sum.amount || 0,
        releasedEscrow: releasedEscrow._sum.amount || 0,
        totalInflow: totalDeposits + totalRefunds + totalCashback,
        totalOutflow: totalWithdrawals + totalPayments,
        totalDeposits,
        totalWithdrawals,
        totalPayments,
        totalRefunds,
        totalCashback,
      },
    })
  } catch (error) {
    console.error('Balance GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
