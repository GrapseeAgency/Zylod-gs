import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/vip
 * Retrieve VIP membership tiers, user's current status, and privilege matrix.
 */

const VIP_TIERS = [
  {
    id: 'standard',
    name: 'Standard Wholesale',
    minSpendBDT: 0,
    badge: 'Bronze',
    color: '#78716C',
    benefits: [
      'Standard Escrow Protection',
      'Regular Factory Direct Rates',
      'Community Ticket Support',
    ],
  },
  {
    id: 'silver',
    name: 'Silver Merchant',
    minSpendBDT: 100000,
    badge: 'Silver',
    color: '#94A3B8',
    benefits: [
      '2% Extra Volume Discount',
      'Priority Carrier Dispatch',
      'Dedicated RM Support Line',
      'Early Access to Narayanganj Textile Flash Sales',
    ],
  },
  {
    id: 'gold',
    name: 'Gold Enterprise',
    minSpendBDT: 500000,
    badge: 'Gold',
    color: '#F59E0B',
    benefits: [
      '5% Direct Mill Volume Rebate',
      'Free Quality Control (QC) Pre-Shipment Inspection',
      'Customs & Cross-Border Clearing Concierge',
      'Extended 7-day Escrow Inspection Window',
      'Net-15 B2B Credit Line Eligibility',
    ],
  },
  {
    id: 'platinum',
    name: 'Platinum Conglomerate',
    minSpendBDT: 2000000,
    badge: 'Platinum',
    color: '#6366F1',
    benefits: [
      '8% Unconditional Mill Rate Subsidy',
      'Personal Key Account Director & WhatsApp Hotline',
      'Guaranteed Zero-Cost Return Freight',
      'Net-30 B2B Invoice Credit Financing',
      'Exclusive Annual Factory Tour & Supplier Summits',
    ],
  },
]

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)

    let userTier = 'standard'
    let totalSpend = 0

    if (auth.authenticated && auth.user) {
      const orders = await db.orders.findMany({
        where: { buyerId: auth.user.id, paymentStatus: 'paid' },
        select: { totalAmount: true },
      })
      totalSpend = orders.reduce((sum, o) => sum + o.totalAmount, 0)

      if (totalSpend >= 2000000) userTier = 'platinum'
      else if (totalSpend >= 500000) userTier = 'gold'
      else if (totalSpend >= 100000) userTier = 'silver'
    }

    return NextResponse.json({
      success: true,
      data: {
        currentTier: userTier,
        totalSpendBDT: totalSpend,
        tiers: VIP_TIERS,
      },
    })
  } catch (error) {
    console.error('VIP GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
