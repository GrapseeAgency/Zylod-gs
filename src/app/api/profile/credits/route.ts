import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/profile/credits — Real wallet/credits balance and transaction history.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id

    // Find or create wallet for user
    let wallet = await db.wallets.findFirst({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!wallet) {
      wallet = await db.wallets.create({
        data: { userId, balance: 0 },
        include: { transactions: true },
      })
    }

    const totalEarned = wallet.transactions
      .filter((t) => t.type === 'credit' || t.amount > 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const totalUsed = wallet.transactions
      .filter((t) => t.type === 'debit' || t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const history = wallet.transactions.map((t) => ({
      id: t.id,
      date: t.createdAt.toISOString().slice(0, 10),
      description: t.description || (t.type === 'credit' ? 'Wallet Top-up' : 'Order Payment'),
      amount: t.amount,
      type: t.type,
      balance: t.balanceAfter,
    }))

    return NextResponse.json({
      success: true,
      data: {
        balance: wallet.balance,
        totalEarned,
        totalUsed,
        currency: 'BDT',
        history,
      },
    })
  } catch (error) {
    console.error('Credits GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}