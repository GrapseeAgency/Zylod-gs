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
    const { amount, method, senderNumber, transactionReference } = body

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Invalid topup amount' }, { status: 400 })
    }

    // Find or create user wallet
    let wallet = await db.wallets.findFirst({ where: { userId } })
    if (!wallet) {
      wallet = await db.wallets.create({
        data: { userId, balance: 0, currency: 'BDT' },
      })
    }

    const ref = transactionReference || `TOPUP-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // Create walletTopups record
    const topup = await db.walletTopups.create({
      data: {
        userId,
        provider: method || 'bKash',
        reference: ref,
        amount: numericAmount,
        currency: 'BDT',
        status: 'credited',
        gatewayTrxId: ref,
        creditedAt: new Date(),
      },
    })

    // Update wallet balance
    const updatedWallet = await db.wallets.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: numericAmount },
      },
    })

    // Log transaction
    const tx = await db.walletTransactions.create({
      data: {
        walletId: wallet.id,
        type: 'deposit',
        amount: numericAmount,
        balanceAfter: updatedWallet.balance,
        description: `Wallet topup via ${method || 'Mobile Banking'} (${ref})`,
        relatedEntityId: topup.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully added ৳${numericAmount.toLocaleString()} to your wallet`,
      data: {
        topupId: topup.id,
        transactionId: tx.id,
        newBalance: updatedWallet.balance,
        reference: ref,
      },
    })
  } catch (error) {
    console.error('Topup POST error:', error)
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
    const topups = await db.walletTopups.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      success: true,
      data: topups,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
