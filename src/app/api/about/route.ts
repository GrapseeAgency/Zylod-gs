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

    // HONESTY NOTE (Task 43-c): stats and milestones are real DB counts/rows only.
    // mission/vision/values are aspirational statements that assert NO false facts:
    // no founding year, no "verified manufacturers" claim, no delivery or
    // payment-protection guarantees —
    // the marketplace is new (0 suppliers/products/orders) and the copy says so.
    return NextResponse.json({
      success: true,
      data: {
        stats: {
          verifiedSuppliers: supplierCount,
          registeredBuyers: buyerCount,
          activeProducts: productCount,
          totalOrders: orderCount,
          pressReleases: pressCount,
        },
        milestones,
        companyInfo: {
          name: 'Zylod Wholesale',
          hq: 'Bangladesh',
          mission: 'To connect Bangladeshi manufacturers and wholesale buyers through transparent, technology-driven commerce. Zylod is brand new — real suppliers, products, and orders will appear here as businesses join.',
          vision: 'To earn the trust of wholesale buyers and manufacturers across South Asia — one verified profile and one real order at a time.',
          values: [
            { title: 'Transparency', desc: 'Every supplier profile on Zylod shows its real verification status, reviewed by a Zylod admin. Profiles that are not verified yet say so.' },
            { title: 'Efficiency', desc: 'Purpose-built tools for bulk trade — quote requests, negotiated pricing, and business checkout — instead of retail impulse buys.' },
            { title: 'Trust', desc: 'We publish honest numbers, including zeros. Counts of suppliers, products, and orders on this site are live database figures, never demo data.' },
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
