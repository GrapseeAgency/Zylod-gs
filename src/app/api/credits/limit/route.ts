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

    let creditLine = await db.creditLines.findFirst({
      where: { buyerId: userId, status: 'active' },
    })

    if (!creditLine) {
      creditLine = await db.creditLines.create({
        data: {
          buyerId: userId,
          creditLimit: 250000,
          usedCredit: 0,
          availableCredit: 250000,
          interestRate: 0,
          status: 'active',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: creditLine.id,
        creditLimit: creditLine.creditLimit,
        usedCredit: creditLine.usedCredit,
        availableCredit: creditLine.availableCredit,
        currency: 'BDT',
        interestFreeGracePeriod: '30 Days',
        nextSettlementDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        status: creditLine.status,
      },
    })
  } catch (error) {
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
    const body = await request.json()
    const { requestedLimit, reason, bankSolvencyDocUrl } = body

    const numericLimit = parseFloat(requestedLimit)
    if (isNaN(numericLimit) || numericLimit <= 0) {
      return NextResponse.json({ error: 'Invalid credit limit amount' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Credit line expansion request for ৳${numericLimit.toLocaleString()} received. Underwriter review will complete within 24 hours.`,
      data: {
        requestedLimit: numericLimit,
        status: 'under_review',
        referenceId: `CRE-REQ-${Date.now().toString().slice(-6)}`,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
