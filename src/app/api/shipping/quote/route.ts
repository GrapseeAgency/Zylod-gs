import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { computeQuote } from '@/lib/shipping'

/**
 * PUBLIC SHIPPING QUOTE (Task 94) — GET /api/shipping/quote
 *   ?district=Dhaka&weightKg=12&subtotal=50000
 *
 * The read half of the shipping configuration circuit: resolves the ACTIVE
 * zone whose districts cover the given district (case-insensitive, whole
 * entry), intersects its rates with ACTIVE methods and the weight band,
 * and returns the options sorted by what the buyer pays — with freeAbove
 * crossings honored honestly (price 0 + freeShipping true + the waived
 * basePrice preserved for display).
 *
 * No auth by design: a shipping estimate is exactly what an anonymous
 * buyer evaluates before the bulk order. An unknown district or a weight
 * outside every band is an HONEST empty list — never a fabricated
 * "standard rate".
 */

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, 'shipping-quote-public', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const district = request.nextUrl.searchParams.get('district')?.trim() ?? ''
    const weightRaw = request.nextUrl.searchParams.get('weightKg')
    const subtotalRaw = request.nextUrl.searchParams.get('subtotal')

    if (!district) {
      return NextResponse.json({ error: 'district query parameter is required' }, { status: 400 })
    }
    const weightKg = Number(weightRaw)
    if (weightRaw === null || !Number.isFinite(weightKg) || weightKg < 0 || weightKg > 100_000) {
      return NextResponse.json({ error: 'weightKg must be a number between 0 and 100000' }, { status: 400 })
    }
    const subtotal = subtotalRaw === null ? 0 : Number(subtotalRaw)
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return NextResponse.json({ error: 'subtotal must be a non-negative number' }, { status: 400 })
    }

    const [zones, methods, rates] = await Promise.all([
      db.shippingZones.findMany(),
      db.shippingMethods.findMany(),
      db.shippingRates.findMany(),
    ])

    const options = computeQuote(zones, methods, rates, district, weightKg, subtotal)
    return NextResponse.json({
      success: true,
      district,
      weightKg,
      subtotal,
      count: options.length,
      data: options,
    })
  } catch (err) {
    console.error('Shipping quote GET failed:', err)
    return NextResponse.json({ error: 'Failed to compute shipping quote' }, { status: 500 })
  }
}
