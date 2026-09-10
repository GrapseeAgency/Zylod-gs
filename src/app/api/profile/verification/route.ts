import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/profile/verification — Real supplier verification tier and milestone progress.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const supplier = await db.supplierProfiles.findUnique({
      where: { userId },
      include: { verificationDocuments: true },
    })

    const status = supplier?.verificationStatus || 'unverified'
    const tierName = status === 'verified' ? 'Verified Partner' : 'Standard Merchant'

    // Compute sales volume for milestones
    const salesAgg = await db.subOrders.aggregate({
      where: { items: { some: { product: { supplierId: userId } } } },
      _sum: { subtotal: true },
    })
    const totalVolume = salesAgg._sum.subtotal || 0

    return NextResponse.json({
      success: true,
      data: {
        level: status === 'verified' ? 2 : 1,
        levelName: tierName,
        status: status === 'verified' ? 'active_verified' : 'pending',
        description:
          status === 'verified'
            ? 'Your business has completed verification. Verified trust badge is displayed on your storefront.'
            : 'Complete trade license upload to receive the Verified Partner badge.',
        benefits: [
          { icon: 'check', title: 'Verified Trust Badge', description: 'Badge displayed on supplier page' },
          { icon: 'rocket', title: 'Catalog Search Visibility', description: 'Listed in wholesale catalog' },
          { icon: 'headphones', title: 'B2B Chat Support', description: 'Direct messaging with buyers' },
        ],
        nextLevel: {
          level: status === 'verified' ? 3 : 2,
          name: status === 'verified' ? 'Gold Partner' : 'Verified Partner',
          milestones: [
            { label: 'Total Sales Volume', current: totalVolume, target: 50000, unit: '৳' },
          ],
        },
      },
    })
  } catch (error) {
    console.error('Verification GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}