import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const body = await request.json()
    const { orderId, amount, reason } = body

    const refundAmount = parseFloat(amount)
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return NextResponse.json({ error: 'Invalid refund amount' }, { status: 400 })
    }

    // Atomic transaction for wallet credit
    const result = await db.$transaction(async (tx) => {
      let wallet = await tx.wallets.findFirst({ where: { userId } })
      if (!wallet) {
        wallet = await tx.wallets.create({ data: { userId, balance: 0, currency: 'BDT' } })
      }

      const newBalance = wallet.balance + refundAmount
      await tx.wallets.update({ where: { id: wallet.id }, data: { balance: newBalance } })

      const txRecord = await tx.walletTransactions.create({
        data: {
          walletId: wallet.id,
          type: 'refund',
          amount: refundAmount,
          balanceAfter: newBalance,
          description: `Order Refund: ${orderId ? 'PO #' + orderId : 'Dispute Settlement'} (${reason || 'Standard Refund'})`,
          relatedEntityId: orderId,
        },
      })

      return { walletId: wallet.id, newBalance, txRecord }
    })

    return NextResponse.json({
      success: true,
      message: `৳${refundAmount.toLocaleString()} credited to your wallet instantly`,
      data: result,
    })
  } catch (error) {
    console.error('Refund POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const wallet = await db.wallets.findFirst({ where: { userId } })
    if (!wallet) return NextResponse.json({ success: true, data: [] })

    const refunds = await db.walletTransactions.findMany({
      where: { walletId: wallet.id, type: 'refund' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      success: true,
      data: refunds.map((r) => ({
        id: r.id,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        description: r.description,
        relatedEntityId: r.relatedEntityId,
        createdAt: r.createdAt.toISOString(),
        status: 'credited',
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
