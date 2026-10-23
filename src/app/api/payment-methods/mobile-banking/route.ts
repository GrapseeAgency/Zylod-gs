import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
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

  const rl = checkRateLimit(request, 'payment-methods-create', 10, 60000)

  if (!rl.ok) return rateLimitResponse(rl)


  try {
    const userId = auth.user.id
    const body = await request.json()
    const { provider, accountNumber, accountType, isDefault } = body

    if (!provider || !accountNumber) {
      return NextResponse.json({ error: 'Provider and mobile account number are required' }, { status: 400 })
    }

    // Audit unit 22: the unified /api/payment-methods rail validates the
    // Bangladeshi mobile format; this rail silently accepted anything
    // ("12345" became a wallet row). Same contract here — and a provider
    // whitelist so the type column only ever holds real MFS brands.
    const PROVIDERS = ['bKash', 'Nagad', 'Rocket', 'Upay']
    const providerKey = String(provider).toLowerCase()
    const providerName = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', upay: 'Upay' }[providerKey]
    if (!providerName || !PROVIDERS.includes(providerName)) {
      return NextResponse.json({ error: 'Provider must be one of bKash, Nagad, Rocket, Upay' }, { status: 400 })
    }
    const phone = String(accountNumber || '').replace(/\s+/g, '')
    if (!/^(\+8801|8801|01)[3-9]\d{8}$/.test(phone)) {
      return NextResponse.json({ error: 'Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX)' }, { status: 400 })
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
        type: providerName,
        label: `${providerName} Account`,
        accountNumber: phone,
        holderName: accountType || 'Merchant/Personal',
        isDefault: Boolean(isDefault),
      },
    })

    return NextResponse.json({
      success: true,
      message: `${providerName} account linked successfully`,
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
