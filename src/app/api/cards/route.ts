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
    const cards = await db.paymentMethods.findMany({
      where: {
        userId,
        type: { in: ['card', 'debit', 'credit'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: cards.map((c) => ({
        id: c.id,
        cardType: c.type === 'debit' ? 'Debit Card' : 'Credit Card',
        brand: c.cardNetwork || 'Visa',
        last4: c.accountNumber.slice(-4),
        holderName: c.holderName || 'Commercial Cardholder',
        expiry: c.expiry || '12/28',
        isDefault: c.isDefault,
        createdAt: c.createdAt.toISOString(),
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
    const { cardNumber, holderName, expiry, cardType, brand, isDefault } = body

    if (!cardNumber || !holderName || !expiry) {
      return NextResponse.json({ error: 'Card number, holder name, and expiry are required' }, { status: 400 })
    }

    const cleanNumber = String(cardNumber).replace(/\s+/g, '')
    const last4 = cleanNumber.slice(-4)

    if (isDefault) {
      await db.paymentMethods.updateMany({
        where: { userId, type: { in: ['card', 'debit', 'credit'] } },
        data: { isDefault: false },
      })
    }

    const card = await db.paymentMethods.create({
      data: {
        userId,
        type: cardType || 'credit',
        label: `${brand || 'Visa'} ending in ${last4}`,
        accountNumber: last4,
        holderName,
        expiry,
        cardNetwork: brand || 'Visa',
        isDefault: Boolean(isDefault),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Card added securely',
      data: {
        id: card.id,
        cardType: card.type,
        brand: card.cardNetwork,
        last4: card.accountNumber,
        holderName: card.holderName,
        expiry: card.expiry,
        isDefault: card.isDefault,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
