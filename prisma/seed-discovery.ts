/**
 * Discovery seed — populates Flash Deals, Daily Deals, Clearance and Seasonal
 * merchandising from the REAL product catalog. Deal prices are derived from each
 * product's actual base price; nothing invented beyond the merchandising intent.
 *
 * Run: npx tsx prisma/seed-discovery.ts   (or bun run prisma/seed-discovery.ts)
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function main() {
  const now = new Date()

  // ── Reset previous discovery data so re-runs are idempotent ──
  await db.flashDeals.deleteMany({})
  await db.dailyDeals.deleteMany({})
  await db.products.updateMany({ where: { isClearance: true }, data: { isClearance: false } })
  await db.products.updateMany({ where: { isSeasonal: true }, data: { isSeasonal: false } })

  // ── Flash Deals: top-selling products with steep, time-boxed discounts ──
  // Deepest cuts on slower stock, shallower on best sellers — like a real flash sale.
  const flashPool = await db.products.findMany({
    where: { isActive: true, isApproved: true },
    orderBy: [{ soldCount: 'desc' }],
    take: 10,
    select: { id: true, basePrice: true, stockQuantity: true },
  })

  const flashDiscounts = [0.45, 0.3, 0.6, 0.25, 0.35, 0.5, 0.2, 0.4]
  const flashRows = flashPool.slice(0, 8).map((p, i) => {
    const discount = flashDiscounts[i]
    return {
      productId: p.id,
      dealPrice: round2(p.basePrice * (1 - discount)),
      discountPercent: Math.round(discount * 100),
      startAt: new Date(now.getTime() - (2 + i) * 60 * 60 * 1000), // started 2-9h ago
      endAt: new Date(now.getTime() + (3 + i * 2) * 60 * 60 * 1000), // ends within ~3-17h
      totalStock: Math.max(20, Math.floor(p.stockQuantity * 0.4)),
      soldCount: Math.floor(Math.random() * 12),
      maxPerBuyer: i % 2 === 0 ? 10 : null,
      isActive: true,
    }
  })
  await db.flashDeals.createMany({ data: flashRows })
  console.log(`Seeded ${flashRows.length} flash deals`)

  // ── Daily Deals: today's rotating picks at moderate discounts ──
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dailyPool = await db.products.findMany({
    where: {
      isActive: true,
      isApproved: true,
      id: { notIn: flashRows.map((f) => f.productId) },
    },
    orderBy: [{ ratingAvg: 'desc' }],
    take: 8,
    select: { id: true, basePrice: true },
  })

  const dailyDiscounts = [0.15, 0.2, 0.12, 0.18, 0.22, 0.1, 0.16, 0.14]
  const dailyRows = dailyPool.map((p, i) => ({
    productId: p.id,
    dealPrice: round2(p.basePrice * (1 - dailyDiscounts[i])),
    discountPercent: Math.round(dailyDiscounts[i] * 100),
    dayDate: todayStart,
    isActive: true,
  }))
  await db.dailyDeals.createMany({ data: dailyRows })
  console.log(`Seeded ${dailyRows.length} daily deals`)

  // ── Clearance: end-of-line items flagged across categories ──
  const clearancePool = await db.products.findMany({
    where: { isActive: true, isApproved: true },
    orderBy: [{ createdAt: 'asc' }, { stockQuantity: 'desc' }],
    take: 40,
    select: { id: true },
  })
  const clearanceIds = clearancePool
    .filter((_, i) => i % 3 === 0)
    .slice(0, 12)
    .map((p) => p.id)
  await db.products.updateMany({
    where: { id: { in: clearanceIds } },
    data: { isClearance: true },
  })
  console.log(`Flagged ${clearanceIds.length} clearance products`)

  // ── Seasonal: current-season picks spread across the catalog ──
  const seasonalPool = await db.products.findMany({
    where: {
      isActive: true,
      isApproved: true,
      id: { notIn: [...clearanceIds] },
    },
    orderBy: [{ ratingAvg: 'desc' }, { soldCount: 'desc' }],
    take: 30,
    select: { id: true },
  })
  const seasonalIds = seasonalPool
    .filter((_, i) => i % 3 === 0)
    .slice(0, 10)
    .map((p) => p.id)
  await db.products.updateMany({
    where: { id: { in: seasonalIds } },
    data: { isSeasonal: true },
  })
  console.log(`Flagged ${seasonalIds.length} seasonal products`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
