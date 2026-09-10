import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const amount = Number(body.amount)
    const method = String(body.method || '')
    const accountNumber = String(body.accountNumber || '').trim()
    const holderName = String(body.holderName || '').trim()
    const bankName = String(body.bankName || '')

    const ALLOWED = ['bank', 'bKash', 'Nagad', 'Upay', 'Rocket']
    if (!ALLOWED.includes(method)) {
      return NextResponse.json({ error: 'Invalid withdrawal method' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount < 50) {
      return NextResponse.json({ error: 'Minimum withdrawal is ৳50' }, { status: 400 })
    }
    if (accountNumber.length < 6 || holderName.length < 2) {
      return NextResponse.json({ error: 'Account number and holder name are required' }, { status: 400 })
    }

    const userId = auth.user.id

    const result = await db.$transaction(async (tx) => {
      const wallet = await tx.wallets.findFirst({ where: { userId } })
      if (!wallet || wallet.balance < amount) {
        throw new Error('INSUFFICIENT')
      }
      const newBalance = wallet.balance - amount
      await tx.wallets.update({ where: { id: wallet.id }, data: { balance: newBalance } })
      return await tx.walletTransactions.create({
        data: {
          walletId: wallet.id,
          type: 'withdrawal',
          amount: -amount,
          balanceAfter: newBalance,
          description: `Withdrawal to ${bankName ? bankName + ' - ' : ''}${method}: ${accountNumber} (${holderName})`,
        },
      })
    })

    const wallet = await db.wallets.findFirst({ where: { userId } })
    return NextResponse.json({
      success: true,
      message: `Withdrawal request for ৳${amount.toLocaleString()} submitted successfully`,
      data: { transaction: result, balance: wallet?.balance || 0, status: 'processing' },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT') {
      return NextResponse.json({ error: 'Insufficient balance for this withdrawal' }, { status: 400 })
    }
    console.error('Withdrawal error:', error)
    return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 })
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
    if (!wallet) {
      return NextResponse.json({ success: true, data: [] })
    }

    const withdrawals = await db.walletTransactions.findMany({
      where: { walletId: wallet.id, type: 'withdrawal' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      success: true,
      data: withdrawals,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}