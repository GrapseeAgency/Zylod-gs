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
    const mfs = await db.paymentMethods.findMany({
      where: {
        userId,
        type: { in: ['bKash', 'Nagad', 'Rocket', 'Upay'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: mfs.map((item) => ({
        id: item.id,
        provider: item.type,
        accountNumber: item.accountNumber,
        accountType: item.holderName || 'Personal',
        isDefault: item.isDefault,
        verified: true,
        createdAt: item.createdAt.toISOString(),
      })),
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
    const { provider, accountNumber, accountType, isDefault } = body

    if (!provider || !accountNumber) {
      return NextResponse.json({ error: 'Provider and mobile account number are required' }, { status: 400 })
    }

    if (isDefault) {
      await db.paymentMethods.updateMany({
        where: { userId, type: { in: ['bKash', 'Nagad', 'Rocket', 'Upay'] } },
        data: { isDefault: false },
      })
    }

    const newMFS = await db.paymentMethods.create({
      data: {
        userId,
        type: provider,
        label: `${provider} Account`,
        accountNumber,
        holderName: accountType || 'Merchant/Personal',
        isDefault: Boolean(isDefault),
      },
    })

    return NextResponse.json({
      success: true,
      message: `${provider} account linked successfully`,
      data: {
        id: newMFS.id,
        provider: newMFS.type,
        accountNumber: newMFS.accountNumber,
        accountType: newMFS.holderName,
        isDefault: newMFS.isDefault,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
