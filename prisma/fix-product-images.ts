/**
 * Product image repair — the catalog references /images/products/product-N-M.jpg
 * files that were never shipped; only 20 descriptive PNGs exist. This maps every
 * product's images + thumbnailUrl onto real files using name/category keywords,
 * falling back to a deterministic rotation so nothing 404s.
 *
 * Run: npx tsx prisma/fix-product-images.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

/** Keyword → best file match (checked in order). */
const KEYWORD_MAP: [RegExp, string][] = [
  [/basmati|rice|grain|flour|pulse|lentil|sugar|salt|oil\b|ghee|tea\b|coffee/i, 'rice.png'],
  [/spice|turmeric|chili|coriander|cumin|masala|cardamom|pepper/i, 'rice.png'],
  [/denim|jeans/i, 'denim-fabric.png'],
  [/silk|saree|jamdani|jamda|muslin/i, 'silk-fabric.png'],
  [/muslin|linen|khadi|weave|woven|loom/i, 'muslin-fabric.png'],
  [/cotton|fabric|cloth|textile|yarn|knit|hosiery|terry/i, 'cotton-fabric.png'],
  [/tribal|handloom|ethnic|batik|print/i, 'tribal-fabric.png'],
  [/jute|hessian|burlap/i, 'jute-fabric.png'],
  [/bag\b|bags\b|basket|tote|shopping\s*bag|sack/i, 'jute-shopping-bags.png'],
  [/t-?shirt|shirt|polo|apparel|garment|hoodie|trouser|pants|clothing|wear\b/i, 'tshirts.png'],
  [/leather|wallet|belt|shoe|footwear|sandal|hide|boot/i, 'leather-hides.png'],
  [/galaxy|samsung|iphone|smartphone|phone\b|mobile/i, 'galaxy-s24.png'],
  [/iphone/i, 'iphone-15.png'],
  [/powerbank|power bank|battery|charger|cable|solar/i, 'solar-powerbank.png'],
  [/led|panel light|light\b|lamp|bulb|lighting/i, 'led-panel.png'],
  [/ceramic|dinner|tableware|plate\b|bowl|mug|porcelain|stoneware/i, 'ceramic-dinner-set.png'],
  [/terracotta|pottery|clay|craft|handicraft|deco[rn]\b|showpiece|kantha/i, 'terracotta.png'],
  [/towel|bath\b|home\b|kitchen|bedding|carpet|rug/i, 'towels.png'],
]

const FALLBACKS = ['cotton-fabric.png', 'jute-bags.png', 'led-panel.png', 'rice.png', 'terracotta.png', 'towels.png']

function pickImage(name: string, category: string | null, index: number): string {
  const haystack = `${name} ${category ?? ''}`
  for (const [re, file] of KEYWORD_MAP) {
    if (re.test(haystack)) return `/images/products/${file}`
  }
  return `/images/products/${FALLBACKS[Math.abs(index) % FALLBACKS.length]}`
}

async function main() {
  const products = await db.products.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      thumbnailUrl: true,
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: 'asc' }, select: { id: true } },
    },
  })

  let fixedThumbs = 0
  let fixedImages = 0

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    const img = pickImage(p.name, p.category?.name ?? null, i)

    if (p.thumbnailUrl !== img) {
      await db.products.update({ where: { id: p.id }, data: { thumbnailUrl: img } })
      fixedThumbs++
    }

    // Point every image row at the matched file (single real asset per product;
    // sortOrder preserved so the first entry is the card face).
    for (let j = 0; j < p.images.length; j++) {
      await db.productImages.update({
        where: { id: p.images[j].id },
        data: { imageUrl: img },
      })
      fixedImages++
    }
  }

  console.log(`thumbnailUrl updated on ${fixedThumbs} products`)
  console.log(`${fixedImages} productImages rows repointed to real files`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
