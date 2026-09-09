import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/about
 * Returns company overview: milestone count, press release count, supplier/buyer stats, milestones list.
 */
export async function GET(request: NextRequest) {
  try {
    const [
      milestones,
      pressCount,
      supplierCount,
      buyerCount,
      productCount,
      orderCount,
    ] = await Promise.all([
      db.companyMilestones.findMany({
        where: { isPublished: true },
        orderBy: [{ year: 'asc' }, { sortOrder: 'asc' }],
      }),
      db.pressReleases.count({ where: { isPublished: true } }),
      db.supplierProfiles.count(),
      db.buyerProfiles.count(),
      db.products.count({ where: { isActive: true } }),
      db.orders.count(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          verifiedSuppliers: supplierCount,
          registeredBuyers: buyerCount,
          activeProducts: productCount,
          totalOrders: orderCount,
          pressReleases: pressCount,
          yearsOperating: new Date().getFullYear() - 2020,
        },
        milestones,
        companyInfo: {
          name: 'Zylod Wholesale',
          founded: 2020,
          hq: 'Dhaka, Bangladesh',
          mission: 'Connecting Bangladesh\'s verified manufacturers directly with wholesale buyers through transparent, technology-driven commerce.',
          vision: 'To be South Asia\'s most trusted B2B wholesale marketplace by 2027.',
          values: [
            { title: 'Transparency', desc: 'Every supplier is verified. Every price is real.' },
            { title: 'Efficiency', desc: 'From factory floor to buyer warehouse in 72 hours.' },
            { title: 'Trust', desc: 'SafePay escrow protects every transaction.' },
            { title: 'Scale', desc: 'Built for bulk orders, not retail.' },
          ],
        },
      },
    })
  } catch (error) {
    console.error('About GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
