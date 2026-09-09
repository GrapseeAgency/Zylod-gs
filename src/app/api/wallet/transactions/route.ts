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
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const wallet = await db.wallets.findFirst({ where: { userId } })
    if (!wallet) {
      return NextResponse.json({ success: true, data: { transactions: [], total: 0 } })
    }

    const whereClause: any = { walletId: wallet.id }
    if (type && type !== 'all') {
      whereClause.type = type
    }
    if (search) {
      whereClause.description = { contains: search, mode: 'insensitive' }
    }

    const [transactions, total] = await Promise.all([
      db.walletTransactions.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.walletTransactions.count({ where: whereClause }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          balanceAfter: t.balanceAfter,
          description: t.description || 'Transaction',
          relatedEntityId: t.relatedEntityId,
          createdAt: t.createdAt.toISOString(),
          status: 'completed',
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Transactions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
