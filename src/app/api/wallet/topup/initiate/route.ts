import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { createPayment, bkashConfigured } from '@/lib/payments/bkash'
import { initSession, sslcommerzConfigured } from '@/lib/payments/sslcommerz'

/**
 * POST /api/wallet/topup/initiate
 * Body: { amount: number, method: 'bKash' | 'Nagad' | 'Upay' | 'Rocket' | 'card' }
 *
 * Starts a REAL gateway session and returns the redirect URL. The wallet is
 * credited ONLY by the verified callback/IPN — never here.
 *
 * Provider routing:
 *   bKash                  → direct bKash Tokenized Checkout (sandbox creds ship default)
 *   Nagad/Rocket/Upay/card → SSLCommerz EasyCheckout (sandbox creds ship default)
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const amount = Number(body.amount)
    const method = String(body.method || '')

    if (!Number.isFinite(amount) || amount < 10 || amount > 100000) {
      return NextResponse.json({ error: 'Amount must be between ৳10 and ৳100,000' }, { status: 400 })
    }

    // Resolve user contact info for the gateway session
    const user = await db.users.findUnique({
      where: { id: auth.user.id },
      select: {
        email: true, phone: true,
        buyerProfile: { select: { fullName: true, businessName: true } },
        supplierProfile: { select: { companyName: true } },
        addresses: { take: 1, orderBy: { isDefault: 'desc' } },
      },
    })
    const name = user?.buyerProfile?.fullName || user?.supplierProfile?.companyName || user?.buyerProfile?.businessName || 'Zylod User'
    const email = user?.email || 'customer@zylod.com'
    const phone = user?.phone || '01700000000'
    const city = user?.addresses?.[0]?.city || 'Dhaka'
    const address = user?.addresses?.[0]?.addressLine1 || 'Dhaka'

    const origin = process.env.APP_URL || new URL(request.url).origin
    const reference = `WBD-TU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase()

    // ─── bKash direct ───
    if (method === 'bKash') {
      if (!bkashConfigured) {
        return NextResponse.json({ error: 'bKash is not configured' }, { status: 503 })
      }
      const created = await createPayment({
        amount,
        reference,
        callbackURL: `${origin}/api/wallet/callback/bkash`,
      })
      await db.walletTopups.create({
        data: {
          userId: auth.user.id,
          provider: 'bkash',
          sessionId: created.paymentID,
          reference,
          amount,
        },
      })
      return NextResponse.json({ success: true, data: { redirectUrl: created.bkashURL, reference } })
    }

    // ─── SSLCommerz: Nagad / Rocket / Upay / card ───
    if (['Nagad', 'Upay', 'Rocket', 'card'].includes(method)) {
      if (!sslcommerzConfigured) {
        return NextResponse.json({ error: 'SSLCommerz is not configured' }, { status: 503 })
      }
      const session = await initSession({
        amount,
        reference,
        successUrl: `${origin}/api/wallet/callback/sslcommerz`,
        failUrl: `${origin}/api/wallet/callback/sslcommerz?status=FAILED`,
        cancelUrl: `${origin}/api/wallet/callback/sslcommerz?status=CANCELLED`,
        customer: { name, email, phone, city, address },
        productName: `Wallet top-up (${method})`,
      })
      await db.walletTopups.create({
        data: {
          userId: auth.user.id,
          provider: 'sslcommerz',
          sessionId: session.sessionkey,
          reference,
          amount,
        },
      })
      return NextResponse.json({ success: true, data: { redirectUrl: session.gatewayPageURL, reference } })
    }

    return NextResponse.json({ error: 'Unsupported method. Use bKash, Nagad, Upay, Rocket, or card.' }, { status: 400 })
  } catch (error) {
    console.error('Topup initiate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not start payment. Please try again.' },
      { status: 502 },
    )
  }
}
