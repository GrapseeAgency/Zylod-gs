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

    // Find or create user wallet
    let wallet = await db.wallets.findFirst({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!wallet) {
      wallet = await db.wallets.create({
        data: {
          userId,
          balance: 0,
          currency: 'BDT',
        },
        include: {
          transactions: true,
        },
      })
    }

    // Calculate escrow held amount
    const escrowHeld = await db.escrowAccounts.aggregate({
      where: {
        OR: [{ buyerId: userId }, { supplierId: userId }],
        status: 'held',
      },
      _sum: { amount: true },
    })

    // Calculate total deposits
    const deposits = await db.walletTransactions.aggregate({
      where: { walletId: wallet.id, type: 'deposit' },
      _sum: { amount: true },
    })

    // Calculate total withdrawals
    const withdrawals = await db.walletTransactions.aggregate({
      where: { walletId: wallet.id, type: 'withdrawal' },
      _sum: { amount: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: wallet.id,
        balance: wallet.balance,
        currency: wallet.currency,
        escrowBalance: escrowHeld._sum.amount || 0,
        totalDeposits: deposits._sum.amount || 0,
        totalWithdrawals: withdrawals._sum.amount || 0,
        recentTransactions: wallet.transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          balanceAfter: tx.balanceAfter,
          description: tx.description || 'Wallet Transaction',
          date: tx.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('Wallet GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ success: true, data: wallet })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
