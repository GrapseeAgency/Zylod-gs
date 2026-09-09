import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface DealRow {
  id: string
  productId: string
  dealPrice: number
  discountPercent: number
  startAt?: Date
  endAt?: Date
  dayDate?: Date
  totalStock?: number
  soldCount?: number
  maxPerBuyer?: number | null
  isActive: boolean
  createdAt: Date
  product: {
    id: string; name: string; slug: string; thumbnailUrl: string | null
    basePrice: number; unit: string; moq: number; stockQuantity: number
    ratingAvg: number; soldCount: number
    supplier: { id: string; companyName: string; verificationStatus: string }
    category: { name: string; slug: string }
  } | null
}

function formatDeal(deal: DealRow & { dayDate?: Date }, dealType: string) {
  const p = deal.product
  if (!p) return null
  // Daily deals are keyed by dayDate — their window is that calendar day
  const startAt = deal.startAt ?? (deal.dayDate ? new Date(deal.dayDate) : new Date())
  const endAt = deal.endAt ?? (deal.dayDate ? new Date(new Date(deal.dayDate).getTime() + 24 * 60 * 60 * 1000) : new Date())
  return {
    id: deal.id,
    type: dealType,
    productId: p.id,
    productName: p.name,
    productSlug: p.slug,
    productThumbnail: p.thumbnailUrl,
    originalPrice: p.basePrice,
    dealPrice: deal.dealPrice,
    discountPercent: deal.discountPercent,
    moq: p.moq,
    unit: p.unit,
    rating: p.ratingAvg,
    soldCount: deal.soldCount ?? 0,
    totalStock: deal.totalStock ?? p.stockQuantity,
    remainingStock: (deal.totalStock ?? p.stockQuantity) - (deal.soldCount ?? 0),
    supplierName: p.supplier.companyName,
    supplierId: p.supplier.id,
    supplierVerified: p.supplier.verificationStatus === 'approved',
    categoryName: p.category.name,
    categorySlug: p.category.slug,
    startAt,
    endAt,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const type = searchParams.get('type') || 'all'
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const now = new Date()
    const skip = (page - 1) * limit

    const dealWhere = {
      isActive: true,
      startAt: { lte: now },
      endAt: { gte: now },
    }

    const productInclude = {
      select: {
        id: true, name: true, slug: true, thumbnailUrl: true,
        basePrice: true, unit: true, moq: true, stockQuantity: true,
        ratingAvg: true, soldCount: true,
        supplier: { select: { id: true, companyName: true, verificationStatus: true } },
        category: { select: { name: true, slug: true } },
      },
    }

    const result: { flashDeals: ReturnType<typeof formatDeal>[]; dailyDeals: ReturnType<typeof formatDeal>[]; flashTotal: number; dailyTotal: number } = {
      flashDeals: [],
      dailyDeals: [],
      flashTotal: 0,
      dailyTotal: 0,
    }

    if (type !== 'daily') {
      const [flash, flashCount] = await Promise.all([
        db.flashDeals.findMany({
          where: dealWhere,
          orderBy: { discountPercent: 'desc' },
          skip,
          take: limit,
          include: { product: productInclude },
        }),
        db.flashDeals.count({ where: dealWhere }),
      ])
      result.flashDeals = flash.map(d => formatDeal(d as unknown as DealRow, 'flash')).filter(Boolean) as ReturnType<typeof formatDeal>[]
      result.flashTotal = flashCount
    }

    if (type !== 'flash') {
      // dailyDeals are keyed by dayDate — active means today's date
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      const [daily, dailyCount] = await Promise.all([
        db.dailyDeals.findMany({
          where: {
            isActive: true,
            dayDate: { gte: todayStart, lt: tomorrowStart },
          },
          orderBy: { discountPercent: 'desc' },
          skip,
          take: limit,
          include: { product: productInclude },
        }),
        db.dailyDeals.count({
          where: {
            isActive: true,
            dayDate: { gte: todayStart, lt: tomorrowStart },
          },
        }),
      ])
      result.dailyDeals = daily.map(d => formatDeal(d as unknown as DealRow, 'daily')).filter(Boolean) as ReturnType<typeof formatDeal>[]
      result.dailyTotal = dailyCount
    }

    return NextResponse.json({
      success: true,
      data: {
        flashDeals: result.flashDeals,
        dailyDeals: result.dailyDeals,
      },
      pagination: {
        flash: { total: result.flashTotal, page, limit, totalPages: Math.ceil(result.flashTotal / limit) },
        daily: { total: result.dailyTotal, page, limit, totalPages: Math.ceil(result.dailyTotal / limit) },
      },
    })
  } catch (error) {
    console.error('Deals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
