// Backfill SKUs: seeded products shipped with sku=null so the barcode
// scanner had no match key. Deterministic unique SKU per product/variant.
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

function skuFromId(id, prefix) {
  return `${prefix}-${id.slice(-8).toUpperCase()}`
}

async function main() {
  const products = await db.products.findMany({ where: { sku: null }, select: { id: true } })
  for (const p of products) {
    await db.products.update({ where: { id: p.id }, data: { sku: skuFromId(p.id, 'ZL') } })
  }
  const variants = await db.productVariants.findMany({ where: { sku: null }, select: { id: true } })
  for (const v of variants) {
    await db.productVariants.update({ where: { id: v.id }, data: { sku: skuFromId(v.id, 'ZLV') } })
  }
  const remaining = await db.products.count({ where: { sku: null } })
  console.log(`Backfilled products: ${products.length}, variants: ${variants.length}, products still null: ${remaining}`)
  const sample = await db.products.findFirst({ where: { sku: { not: null } }, select: { id: true, sku: true, name: true } })
  console.log('Sample:', sample)
}

main().finally(() => db.$disconnect())
