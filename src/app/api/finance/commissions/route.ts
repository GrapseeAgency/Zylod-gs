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

    // 🐞 Task 73: subOrders.supplierId stores supplierProfiles.id — the OLD
    // code filtered by users.id, so this list was ALWAYS empty for sellers.
    const profile = await db.supplierProfiles.findUnique({
      where: { userId },
      select: { id: true },
    })
    const supplierId = profile?.id ?? 'none'

    // t187-d: the displayed commission rate must match schema truth. The only
    // commissionRate column is affiliateProfiles.commissionRate (default
    // 0.05 = 5%) — the old hardcoded 0.03 contradicted it. Use the user's
    // real affiliate-profile rate when one exists, else the schema default.
    const affiliateProfile = await db.affiliateProfiles.findUnique({
      where: { userId },
      select: { commissionRate: true },
    })
    const commissionRate = affiliateProfile?.commissionRate ?? 0.05

    const subOrders = await db.subOrders.findMany({
      where: { supplierId },
      include: {
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const commissionItems = subOrders.map((so) => {
      const gmv = so.subtotal + (so.shippingCost || 0)
      const commissionFee = gmv * commissionRate
      const netPayout = gmv - commissionFee
      return {
        id: so.id,
        orderNumber: so.order.orderNumber,
        subOrderNumber: so.id.slice(-6).toUpperCase(),
        grossAmount: gmv,
        ratePercent: `${(commissionRate * 100).toFixed(1)}%`,
        commissionAmount: commissionFee,
        netPayout,
        status: so.status === 'delivered' ? 'settled' : 'in_escrow',
        date: so.createdAt.toISOString(),
      }
    })

    const totalGross = commissionItems.reduce((acc, curr) => acc + curr.grossAmount, 0)
    const totalCommissions = commissionItems.reduce((acc, curr) => acc + curr.commissionAmount, 0)

    return NextResponse.json({
      success: true,
      data: {
        totalGross,
        totalCommissions,
        items: commissionItems,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
