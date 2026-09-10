import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { id } = await params
    const userId = auth.user.id

    const transaction = await db.walletTransactions.findUnique({
      where: { id },
      include: {
        wallet: true,
      },
    })

    if (!transaction || transaction.wallet.userId !== userId) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description || 'Wallet Transaction',
        relatedEntityId: transaction.relatedEntityId,
        createdAt: transaction.createdAt.toISOString(),
        status: 'settled',
        fee: 0,
        currency: transaction.wallet.currency || 'BDT',
        referenceNumber: `TXN-${transaction.id.slice(-8).toUpperCase()}`,
        paymentMethod: transaction.description?.includes('bKash') ? 'bKash Merchant' :
                       transaction.description?.includes('Nagad') ? 'Nagad Merchant' :
                       transaction.description?.includes('Bank') ? 'Commercial Bank Transfer' : 'Zylod Wholesale Wallet',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
