import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/affiliate/dashboard
 * Detailed conversion analytics, pending payouts, clicks, and conversion rates.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const profile = await db.affiliateProfiles.findUnique({
      where: { userId: auth.user.id },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Affiliate profile not found' }, { status: 404 })
    }

    const conversionRate = profile.totalClicks > 0
      ? ((profile.totalOrders / profile.totalClicks) * 100).toFixed(1) + '%'
      : '0.0%'

    return NextResponse.json({
      success: true,
      data: {
        affiliateCode: profile.affiliateCode,
        trackingUrl: `https://zylod.com/?aff=${profile.affiliateCode}`,
        stats: {
          totalClicks: profile.totalClicks,
          totalOrders: profile.totalOrders,
          conversionRate,
          commissionRate: `${(profile.commissionRate * 100).toFixed(0)}%`,
          totalEarningsBDT: profile.totalEarnings,
          pendingPayoutBDT: profile.pendingPayout,
          paidPayoutBDT: profile.paidPayout,
        },
        // t220 honesty fix: this list used to return two HARDCODED fake
        // conversion rows. No per-conversion ledger exists yet (the affiliate
        // profile only keeps aggregate counters) — serve the real empty list
        // until a conversions table ships.
        recentConversions: [],
      },
    })
  } catch (error) {
    console.error('Affiliate dashboard GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
