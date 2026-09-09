import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/payment-methods — list the user's saved payment methods.
 * POST /api/payment-methods — add a method.
 * Body (mobile wallet): { type: 'bKash'|'Nagad'|'Upay'|'Rocket', label, accountNumber }
 * Body (card): { type: 'debit'|'credit', label, accountNumber: last4, holderName, expiry, cardNetwork }
 * Cards are stored locally in Stripe-style tokenized fashion: only the last 4
 * digits, network, and expiry are saved — the raw PAN is never persisted.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const methods = await db.paymentMethods.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ success: true, data: methods })
  } catch (error) {
    console.error('Payment methods GET error:', error)
    return NextResponse.json({ error: 'Failed to load payment methods' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { type, label, accountNumber, holderName, expiry, cardNetwork } = body

    const WALLET_TYPES = ['bKash', 'Nagad', 'Upay', 'Rocket']
    const CARD_TYPES = ['debit', 'credit']

    if (WALLET_TYPES.includes(type)) {
      // Validate Bangladeshi mobile number: +8801XXXXXXXXX or 01XXXXXXXXX
      const phone = String(accountNumber || '').replace(/\s+/g, '')
      if (!/^(\+8801|8801|01)[3-9]\d{8}$/.test(phone)) {
        return NextResponse.json({ error: 'Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX)' }, { status: 400 })
      }
      if (!label) {
        return NextResponse.json({ error: 'A label is required (e.g. My bKash)' }, { status: 400 })
      }
    } else if (CARD_TYPES.includes(type)) {
      const last4 = String(accountNumber || '')
      if (!/^\d{4}$/.test(last4)) {
        return NextResponse.json({ error: 'Card must be tokenized — provide the last 4 digits only' }, { status: 400 })
      }
      if (expiry && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(expiry))) {
        return NextResponse.json({ error: 'Expiry must be in MM/YY format' }, { status: 400 })
      }
      if (!holderName) {
        return NextResponse.json({ error: 'Cardholder name is required' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Unsupported payment method type' }, { status: 400 })
    }

    const isFirst = (await db.paymentMethods.count({ where: { userId: auth.user.id } })) === 0

    const method = await db.paymentMethods.create({
      data: {
        userId: auth.user.id,
        type,
        label: label || type,
        accountNumber: String(accountNumber),
        holderName: holderName || null,
        expiry: expiry || null,
        cardNetwork: cardNetwork || null,
        isDefault: isFirst,
      },
    })

    return NextResponse.json({ success: true, data: method }, { status: 201 })
  } catch (error) {
    console.error('Payment methods POST error:', error)
    return NextResponse.json({ error: 'Failed to save payment method' }, { status: 500 })
  }
}