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
    const accounts = await db.paymentMethods.findMany({
      where: { userId, type: 'bank' },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: accounts.map((acc) => ({
        id: acc.id,
        bankName: acc.label,
        accountNumber: acc.accountNumber,
        accountHolderName: acc.holderName,
        branchName: acc.cardNetwork || 'Corporate Branch',
        routingNumber: acc.expiry || 'N/A',
        isDefault: acc.isDefault,
        verified: true,
        createdAt: acc.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Bank accounts GET error:', error)
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
    const { bankName, accountNumber, accountHolderName, branchName, routingNumber, isDefault } = body

    if (!bankName || !accountNumber || !accountHolderName) {
      return NextResponse.json({ error: 'Bank name, account number, and holder name are required' }, { status: 400 })
    }

    if (isDefault) {
      await db.paymentMethods.updateMany({
        where: { userId, type: 'bank' },
        data: { isDefault: false },
      })
    }

    const newAccount = await db.paymentMethods.create({
      data: {
        userId,
        type: 'bank',
        label: bankName,
        accountNumber,
        holderName: accountHolderName,
        cardNetwork: branchName || 'Principal Branch',
        expiry: routingNumber || 'N/A',
        isDefault: Boolean(isDefault),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Bank account added successfully',
      data: {
        id: newAccount.id,
        bankName: newAccount.label,
        accountNumber: newAccount.accountNumber,
        accountHolderName: newAccount.holderName,
        branchName: newAccount.cardNetwork,
        routingNumber: newAccount.expiry,
        isDefault: newAccount.isDefault,
        verified: true,
      },
    })
  } catch (error) {
    console.error('Bank accounts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
