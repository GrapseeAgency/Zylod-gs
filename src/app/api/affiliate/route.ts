import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/affiliate
 * Get user's affiliate profile & tracking links.
 *
 * POST /api/affiliate
 * Enroll in the Zylod B2B Wholesale Affiliate Program.
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
      return NextResponse.json({
        enrolled: false,
        message: 'User is not yet enrolled in the affiliate program',
      })
    }

    return NextResponse.json({
      enrolled: true,
      data: {
        ...profile,
        trackingLink: `https://zylod.com/?aff=${profile.affiliateCode}`,
        commissionPercent: `${(profile.commissionRate * 100).toFixed(0)}%`,
      },
    })
  } catch (error) {
    console.error('Affiliate GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const existing = await db.affiliateProfiles.findUnique({
      where: { userId: auth.user.id },
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Already enrolled',
        data: existing,
      })
    }

    const affiliateCode = 'AFF-' + auth.user.id.slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()

    const profile = await db.affiliateProfiles.create({
      data: {
        userId: auth.user.id,
        affiliateCode,
        commissionRate: 0.05, // 5% default on wholesale orders
        status: 'active',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully enrolled in the Zylod Wholesale Affiliate Partner Program!',
      data: profile,
    }, { status: 201 })
  } catch (error) {
    console.error('Affiliate POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
