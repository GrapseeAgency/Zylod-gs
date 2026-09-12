/**
 * SQLite-compatible seed (pure Prisma client calls — NO raw SQL).
 *
 * Why this exists: prisma/seed.ts starts with a Postgres-only cleanup
 * (`DO $$ ... TRUNCATE ... pg_tables`) that crashes on SQLite. This file
 * reuses the structured catalog data arrays from seed.ts and swaps the
 * raw-SQL cleanup for FK-safe `deleteMany` calls in child→parent order.
 *
 * Run: node prisma/seed-sqlite.mjs   (or bun prisma/seed-sqlite.mjs)
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

process.env.DATABASE_URL ||= 'file:/home/z/my-project/db/custom.db'

const db = new PrismaClient()

/* ────────────────────────────────────────────────────────────
 * Data reused from prisma/seed.ts (categoriesData / productsData)
 * ──────────────────────────────────────────────────────────── */
const categoriesData = [
  { name: 'Textiles & Fabrics', slug: 'textiles-fabrics', iconUrl: '/icons/textiles.svg', sortOrder: 1 },
  { name: 'Agriculture & Food', slug: 'agriculture-food', iconUrl: '/icons/agriculture.svg', sortOrder: 2 },
  { name: 'Electronics', slug: 'electronics', iconUrl: '/icons/electronics.svg', sortOrder: 3 },
  { name: 'Construction & Hardware', slug: 'construction-hardware', iconUrl: '/icons/construction.svg', sortOrder: 4 },
  { name: 'Packaging & Printing', slug: 'packaging-printing', iconUrl: '/icons/packaging.svg', sortOrder: 5 },
  { name: 'Home & Garden', slug: 'home-garden', iconUrl: '/icons/home.svg', sortOrder: 6 },
  { name: 'Gifts & Crafts', slug: 'gifts-crafts', iconUrl: '/icons/gifts.svg', sortOrder: 7 },
  { name: 'Automotive & Transport', slug: 'automotive-transport', iconUrl: '/icons/automotive.svg', sortOrder: 10 },
  { name: 'Health & Medical', slug: 'health-medical', iconUrl: '/icons/health.svg', sortOrder: 11 },
  { name: 'Mobile Accessories', slug: 'mobile-accessories', iconUrl: '/icons/mobile.svg', sortOrder: 12 },
  { name: 'LED & Lighting', slug: 'led-lighting', iconUrl: '/icons/lighting.svg', sortOrder: 13 },
  { name: 'Spices & Condiments', slug: 'spices-condiments', iconUrl: '/icons/spices.svg', sortOrder: 14 },
  { name: 'Garments & Apparel', slug: 'garments-apparel', iconUrl: '/icons/garments.svg', sortOrder: 15 },
  { name: 'Jute & Jute Products', slug: 'jute-products', iconUrl: '/icons/jute.svg', sortOrder: 16 },
  { name: 'Leather & Footwear', slug: 'leather-footwear', iconUrl: '/icons/leather.svg', sortOrder: 17 },
]

// Curated subset of productsData from prisma/seed.ts (verbatim rows).
const productsData = [
  // Textiles & Fabrics
  { name: 'Cotton Fabric - White', slug: 'cotton-fabric-white', description: 'Premium quality 100% cotton fabric, suitable for garments and home textiles. Soft hand feel, breathable.', brand: 'Dhaka Weave', unit: 'meter', moq: 50, maxOrderQty: 5000, basePrice: 450, stockQuantity: 10000, categorySlug: 'textiles-fabrics',
    priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 450 }, { minQty: 201, maxQty: 1000, pricePerUnit: 420 }, { minQty: 1001, maxQty: null, pricePerUnit: 390 }] },
  { name: 'Silk Saree - Traditional Jamdani', slug: 'silk-saree-jamdani', description: 'Handwoven Jamdani silk saree with traditional motifs. Perfect for festive occasions.', brand: 'Tangail Weave', unit: 'pcs', moq: 5, maxOrderQty: 200, basePrice: 2500, stockQuantity: 500, categorySlug: 'textiles-fabrics',
    priceTiers: [{ minQty: 5, maxQty: 20, pricePerUnit: 2500 }, { minQty: 21, maxQty: 100, pricePerUnit: 2300 }, { minQty: 101, maxQty: null, pricePerUnit: 2100 }] },
  { name: 'Denim Fabric - Indigo', slug: 'denim-fabric-indigo', description: 'Heavy-weight indigo denim fabric, 12oz. Ideal for jeans manufacturing.', brand: 'BD Denim', unit: 'meter', moq: 100, maxOrderQty: 10000, basePrice: 380, stockQuantity: 15000, categorySlug: 'textiles-fabrics',
    priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 380 }, { minQty: 501, maxQty: 2000, pricePerUnit: 355 }, { minQty: 2001, maxQty: null, pricePerUnit: 330 }] },
  // Agriculture & Food
  { name: 'Basmati Rice - Premium', slug: 'basmati-rice-premium', description: 'Long-grain premium basmati rice. Aged for 2 years for optimal flavor.', brand: 'Bogra Gold', unit: 'kg', moq: 50, maxOrderQty: 50000, basePrice: 85, stockQuantity: 50000, categorySlug: 'agriculture-food',
    priceTiers: [{ minQty: 50, maxQty: 500, pricePerUnit: 85 }, { minQty: 501, maxQty: 5000, pricePerUnit: 80 }, { minQty: 5001, maxQty: null, pricePerUnit: 75 }] },
  { name: 'Miniket Rice - Fine', slug: 'miniket-rice-fine', description: 'Fine quality Miniket rice. Daily staple for Bangladeshi households.', brand: 'Bogra Gold', unit: 'kg', moq: 100, maxOrderQty: 100000, basePrice: 65, stockQuantity: 80000, categorySlug: 'agriculture-food',
    priceTiers: [{ minQty: 100, maxQty: 1000, pricePerUnit: 65 }, { minQty: 1001, maxQty: 10000, pricePerUnit: 60 }, { minQty: 10001, maxQty: null, pricePerUnit: 55 }] },
  { name: 'Mustard Oil - Pure', slug: 'mustard-oil-pure', description: 'Cold-pressed pure mustard oil. Traditional cooking oil of Bangladesh.', brand: 'Fresh Oil', unit: 'liter', moq: 20, maxOrderQty: 5000, basePrice: 180, stockQuantity: 15000, categorySlug: 'agriculture-food',
    priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 180 }, { minQty: 101, maxQty: 500, pricePerUnit: 170 }, { minQty: 501, maxQty: null, pricePerUnit: 160 }] },
  // Electronics
  { name: 'LED Bulb 12W - Warm White', slug: 'led-bulb-12w-warm', description: 'Energy-efficient 12W LED bulb with warm white light. BESI certified.', brand: 'BD LED', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 85, stockQuantity: 25000, categorySlug: 'electronics',
    priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 85 }, { minQty: 501, maxQty: 2000, pricePerUnit: 75 }, { minQty: 2001, maxQty: null, pricePerUnit: 68 }] },
  { name: 'Mobile Charger - USB-C 18W', slug: 'mobile-charger-usbc-18w', description: 'Fast USB-C charger 18W with BTR certification. Compatible with most smartphones.', brand: 'Gulshan Tech', unit: 'pcs', moq: 200, maxOrderQty: 20000, basePrice: 35, stockQuantity: 40000, categorySlug: 'electronics',
    priceTiers: [{ minQty: 200, maxQty: 1000, pricePerUnit: 35 }, { minQty: 1001, maxQty: 5000, pricePerUnit: 30 }, { minQty: 5001, maxQty: null, pricePerUnit: 26 }] },
  { name: 'Power Bank 10000mAh', slug: 'power-bank-10000mah', description: 'Portable power bank 10000mAh with dual USB output.', brand: 'BD Power', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 350, stockQuantity: 8000, categorySlug: 'electronics',
    priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 350 }, { minQty: 201, maxQty: 1000, pricePerUnit: 320 }, { minQty: 1001, maxQty: null, pricePerUnit: 290 }] },
  // Construction & Hardware
  { name: 'Cement - OPC 50kg', slug: 'cement-opc-50kg', description: 'Ordinary Portland Cement 50kg bag. Grade-42.5, BSTI certified.', brand: 'Shah Cement', unit: 'bag', moq: 100, maxOrderQty: 50000, basePrice: 450, stockQuantity: 30000, categorySlug: 'construction-hardware',
    priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 450 }, { minQty: 501, maxQty: 5000, pricePerUnit: 435 }, { minQty: 5001, maxQty: null, pricePerUnit: 420 }] },
  { name: 'PVC Pipe - 4 inch', slug: 'pvc-pipe-4inch', description: '4-inch PVC pipe for plumbing and drainage. 10 feet length.', brand: 'Partex Pipe', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 280, stockQuantity: 8000, categorySlug: 'construction-hardware',
    priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 280 }, { minQty: 201, maxQty: 1000, pricePerUnit: 265 }, { minQty: 1001, maxQty: null, pricePerUnit: 250 }] },
  // Spices & Condiments
  { name: 'Turmeric Powder', slug: 'turmeric-powder', description: 'Pure turmeric powder from Rangamati hills. No artificial color.', brand: 'PRAN Spice', unit: 'kg', moq: 10, maxOrderQty: 5000, basePrice: 220, stockQuantity: 8000, categorySlug: 'spices-condiments',
    priceTiers: [{ minQty: 10, maxQty: 100, pricePerUnit: 220 }, { minQty: 101, maxQty: 500, pricePerUnit: 205 }, { minQty: 501, maxQty: null, pricePerUnit: 190 }] },
  { name: 'Red Chili Powder', slug: 'red-chili-powder', description: 'Hot red chili powder. Premium grade with rich color.', brand: 'PRAN Spice', unit: 'kg', moq: 10, maxOrderQty: 3000, basePrice: 350, stockQuantity: 5000, categorySlug: 'spices-condiments',
    priceTiers: [{ minQty: 10, maxQty: 100, pricePerUnit: 350 }, { minQty: 101, maxQty: 500, pricePerUnit: 330 }, { minQty: 501, maxQty: null, pricePerUnit: 310 }] },
  // Garments & Apparel
  { name: 'T-Shirt Blank - Round Neck', slug: 'tshirt-blank-round-neck', description: 'Blank round neck t-shirt for printing/branding. 100% cotton, 180 GSM.', brand: 'BD Knit', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 180, stockQuantity: 25000, categorySlug: 'garments-apparel',
    priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 180 }, { minQty: 501, maxQty: 2000, pricePerUnit: 165 }, { minQty: 2001, maxQty: null, pricePerUnit: 150 }],
    variants: [{ name: 'Size', value: 'S', sku: 'TSHIRT-RN-S', stock: 6000, priceOverride: 180 }, { name: 'Size', value: 'M', sku: 'TSHIRT-RN-M', stock: 8000, priceOverride: 180 }, { name: 'Size', value: 'L', sku: 'TSHIRT-RN-L', stock: 7000, priceOverride: 185 }, { name: 'Size', value: 'XL', sku: 'TSHIRT-RN-XL', stock: 4000, priceOverride: 195 }] },
  { name: 'Polo Shirt - Pique Cotton', slug: 'polo-shirt-pique', description: 'Pique cotton polo shirt with collar. Ideal for corporate branding.', brand: 'BD Knit', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 280, stockQuantity: 10000, categorySlug: 'garments-apparel',
    priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 280 }, { minQty: 201, maxQty: 1000, pricePerUnit: 260 }, { minQty: 1001, maxQty: null, pricePerUnit: 240 }] },
  { name: 'Jeans - Denim Straight Fit', slug: 'jeans-denim-straight', description: 'Straight fit denim jeans. 32 waist standard. Pre-washed.', brand: 'BD Denim Wear', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 650, stockQuantity: 8000, categorySlug: 'garments-apparel',
    priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 650 }, { minQty: 201, maxQty: 1000, pricePerUnit: 610 }, { minQty: 1001, maxQty: null, pricePerUnit: 570 }] },
  // Beauty & Personal Care
  { name: 'Hair Oil - Coconut', slug: 'hair-oil-coconut', description: 'Pure coconut hair oil. Traditional hair care of Bangladesh.', brand: 'Parachute', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 95, stockQuantity: 15000, categorySlug: 'beauty-personal-care', extraCategory: true,
    priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 95 }, { minQty: 501, maxQty: 2000, pricePerUnit: 85 }, { minQty: 2001, maxQty: null, pricePerUnit: 78 }] },
  { name: 'Soap - Neem Bath', slug: 'soap-neem-bath', description: 'Neem bath soap 125g. Antibacterial and skin-friendly.', brand: 'Neem BD', unit: 'pcs', moq: 200, maxOrderQty: 20000, basePrice: 45, stockQuantity: 25000, categorySlug: 'beauty-personal-care', extraCategory: true,
    priceTiers: [{ minQty: 200, maxQty: 1000, pricePerUnit: 45 }, { minQty: 1001, maxQty: 5000, pricePerUnit: 40 }, { minQty: 5001, maxQty: null, pricePerUnit: 36 }] },
  // Mobile Accessories
  { name: 'Tempered Glass - Universal', slug: 'tempered-glass-universal', description: '9H hardness tempered glass screen protector. Universal fit.', brand: 'BD Mobile', unit: 'pcs', moq: 500, maxOrderQty: 50000, basePrice: 20, stockQuantity: 50000, categorySlug: 'mobile-accessories',
    priceTiers: [{ minQty: 500, maxQty: 2000, pricePerUnit: 20 }, { minQty: 2001, maxQty: 10000, pricePerUnit: 16 }, { minQty: 10001, maxQty: null, pricePerUnit: 12 }] },
  { name: 'Bluetooth Earbuds - TWS', slug: 'bluetooth-earbuds-tws', description: 'True Wireless Stereo earbuds with charging case.', brand: 'BD Sound', unit: 'pcs', moq: 50, maxOrderQty: 3000, basePrice: 450, stockQuantity: 5000, categorySlug: 'mobile-accessories',
    priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 450 }, { minQty: 201, maxQty: 1000, pricePerUnit: 410 }, { minQty: 1001, maxQty: null, pricePerUnit: 380 }] },
  // LED & Lighting
  { name: 'LED Panel Light - 18W', slug: 'led-panel-light-18w', description: 'Slim LED panel light 18W. For office and commercial false ceiling.', brand: 'BD LED', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 650, stockQuantity: 3000, categorySlug: 'led-lighting',
    priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 650 }, { minQty: 201, maxQty: 1000, pricePerUnit: 600 }, { minQty: 1001, maxQty: null, pricePerUnit: 560 }] },
  { name: 'LED Tube Light - 4ft 20W', slug: 'led-tube-light-4ft', description: '4ft LED tube light 20W. Replaces traditional 40W fluorescent tube.', brand: 'BD LED', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 250, stockQuantity: 12000, categorySlug: 'led-lighting',
    priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 250 }, { minQty: 501, maxQty: 2000, pricePerUnit: 230 }, { minQty: 2001, maxQty: null, pricePerUnit: 210 }] },
  // Jute & Jute Products
  { name: 'Raw Jute - Tossa', slug: 'raw-jute-tossa', description: 'Raw tossa jute fiber. Grade-A quality for jute product manufacturing.', brand: 'BJMC', unit: 'kg', moq: 500, maxOrderQty: 100000, basePrice: 45, stockQuantity: 80000, categorySlug: 'jute-products',
    priceTiers: [{ minQty: 500, maxQty: 5000, pricePerUnit: 45 }, { minQty: 5001, maxQty: 20000, pricePerUnit: 42 }, { minQty: 20001, maxQty: null, pricePerUnit: 39 }] },
  { name: 'Jute Bag - Shopping', slug: 'jute-bag-shopping', description: 'Eco-friendly jute shopping bag. Customizable printing.', brand: 'BJMC', unit: 'pcs', moq: 500, maxOrderQty: 50000, basePrice: 25, stockQuantity: 40000, categorySlug: 'jute-products',
    priceTiers: [{ minQty: 500, maxQty: 2000, pricePerUnit: 25 }, { minQty: 2001, maxQty: 10000, pricePerUnit: 22 }, { minQty: 10001, maxQty: null, pricePerUnit: 19 }] },
  { name: 'Jute Sack - 50kg', slug: 'jute-sack-50kg', description: 'Standard 50kg jute sack for rice/potato/pulse storage.', brand: 'BJMC', unit: 'pcs', moq: 1000, maxOrderQty: 100000, basePrice: 15, stockQuantity: 60000, categorySlug: 'jute-products',
    priceTiers: [{ minQty: 1000, maxQty: 10000, pricePerUnit: 15 }, { minQty: 10001, maxQty: 50000, pricePerUnit: 13 }, { minQty: 50001, maxQty: null, pricePerUnit: 11 }] },
  // Packaging & Printing
  { name: 'Corrugated Box - Standard', slug: 'corrugated-box-standard', description: '3-ply corrugated box. Various sizes for packaging.', brand: 'BD Pack', unit: 'pcs', moq: 500, maxOrderQty: 50000, basePrice: 15, stockQuantity: 50000, categorySlug: 'packaging-printing',
    priceTiers: [{ minQty: 500, maxQty: 2000, pricePerUnit: 15 }, { minQty: 2001, maxQty: 10000, pricePerUnit: 13 }, { minQty: 10001, maxQty: null, pricePerUnit: 11 }] },
  { name: 'Paper Bag - Kraft', slug: 'paper-bag-kraft', description: 'Kraft paper bag for retail packaging. Eco-friendly alternative.', brand: 'BD Pack', unit: 'pcs', moq: 1000, maxOrderQty: 100000, basePrice: 5, stockQuantity: 80000, categorySlug: 'packaging-printing',
    priceTiers: [{ minQty: 1000, maxQty: 5000, pricePerUnit: 5 }, { minQty: 5001, maxQty: 20000, pricePerUnit: 4.5 }, { minQty: 20001, maxQty: null, pricePerUnit: 4 }] },
  // Home & Garden
  { name: 'Aluminum Cookware Set', slug: 'aluminum-cookware-set', description: '5-piece aluminum cookware set. Durable and lightweight.', brand: 'BD Kitchen', unit: 'set', moq: 10, maxOrderQty: 1000, basePrice: 2800, stockQuantity: 1500, categorySlug: 'home-garden',
    priceTiers: [{ minQty: 10, maxQty: 50, pricePerUnit: 2800 }, { minQty: 51, maxQty: 200, pricePerUnit: 2600 }, { minQty: 201, maxQty: null, pricePerUnit: 2400 }] },
  { name: 'Flower Pot - Ceramic', slug: 'flower-pot-ceramic', description: 'Ceramic flower pot. Available in multiple sizes and colors.', brand: 'BD Ceramic', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 180, stockQuantity: 6000, categorySlug: 'home-garden',
    priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 180 }, { minQty: 201, maxQty: 1000, pricePerUnit: 165 }, { minQty: 1001, maxQty: null, pricePerUnit: 150 }] },
  // Gifts & Crafts
  { name: 'Nakshi Kantha - Embroidered', slug: 'nakshi-kantha-embroidered', description: 'Traditional Nakshi Kantha embroidered quilt. Handcrafted by rural women.', brand: 'Rajshahi Craft', unit: 'pcs', moq: 5, maxOrderQty: 200, basePrice: 1800, stockQuantity: 300, categorySlug: 'gifts-crafts',
    priceTiers: [{ minQty: 5, maxQty: 20, pricePerUnit: 1800 }, { minQty: 21, maxQty: 100, pricePerUnit: 1650 }, { minQty: 101, maxQty: null, pricePerUnit: 1500 }] },
  { name: 'Terracotta Pot - Decorative', slug: 'terracotta-pot-decorative', description: 'Decorative terracotta pot. Traditional Bengali design.', brand: 'Rajshahi Craft', unit: 'pcs', moq: 20, maxOrderQty: 1000, basePrice: 280, stockQuantity: 2000, categorySlug: 'gifts-crafts',
    priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 280 }, { minQty: 101, maxQty: 500, pricePerUnit: 255 }, { minQty: 501, maxQty: null, pricePerUnit: 230 }] },
  // Health & Medical
  { name: 'Surgical Mask - 3 Ply', slug: 'surgical-mask-3ply', description: '3-ply surgical mask. BFE > 95%. For medical and general use.', brand: 'BD Med', unit: 'pcs', moq: 1000, maxOrderQty: 100000, basePrice: 5, stockQuantity: 100000, categorySlug: 'health-medical',
    priceTiers: [{ minQty: 1000, maxQty: 10000, pricePerUnit: 5 }, { minQty: 10001, maxQty: 50000, pricePerUnit: 4.2 }, { minQty: 50001, maxQty: null, pricePerUnit: 3.5 }] },
  // Automotive & Transport
  { name: 'Engine Oil - 20W50 4L', slug: 'engine-oil-20w50', description: 'Multi-grade engine oil 20W50 4L can. For petrol and diesel engines.', brand: 'BD Lube', unit: 'pcs', moq: 20, maxOrderQty: 2000, basePrice: 650, stockQuantity: 3000, categorySlug: 'automotive-transport',
    priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 650 }, { minQty: 101, maxQty: 500, pricePerUnit: 600 }, { minQty: 501, maxQty: null, pricePerUnit: 560 }] },
  // Leather & Footwear
  { name: 'Leather Wallet - Bi-fold', slug: 'leather-wallet-bifold', description: 'Genuine leather bi-fold wallet. Card slots and cash compartment.', brand: 'BD Leather', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 350, stockQuantity: 5000, categorySlug: 'leather-footwear',
    priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 350 }, { minQty: 201, maxQty: 1000, pricePerUnit: 320 }, { minQty: 1001, maxQty: null, pricePerUnit: 290 }] },
  { name: 'Sandals - PVC Sole', slug: 'sandals-pvc-sole', description: 'PVC sole sandals with synthetic leather upper. Comfortable daily wear.', brand: 'Apex', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 220, stockQuantity: 10000, categorySlug: 'leather-footwear',
    priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 220 }, { minQty: 501, maxQty: 2000, pricePerUnit: 200 }, { minQty: 2001, maxQty: null, pricePerUnit: 180 }] },
  // Promotional Items
  { name: 'Custom Mug - Ceramic', slug: 'custom-mug-ceramic', description: 'Ceramic mug with custom logo printing. 11oz standard.', brand: 'BD Promo', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 65, stockQuantity: 15000, categorySlug: 'gifts-crafts',
    priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 65 }, { minQty: 501, maxQty: 2000, pricePerUnit: 55 }, { minQty: 2001, maxQty: null, pricePerUnit: 48 }] },
]

/* ────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────── */
const hash = (s) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
const picsum = (seed, size = 600) => `https://picsum.photos/seed/${seed}/${size}/${size}`

// Real images that exist in /public/images/products — else picsum placeholder.
const localImageMap = {
  'cotton-fabric-white': '/images/products/cotton-fabric.png',
  'silk-saree-jamdani': '/images/products/silk-fabric.png',
  'denim-fabric-indigo': '/images/products/denim-fabric.png',
  'jeans-denim-straight': '/images/products/denim-fabric.png',
  'basmati-rice-premium': '/images/products/basmati-rice.png',
  'miniket-rice-fine': '/images/products/rice.png',
  'tshirt-blank-round-neck': '/images/products/tshirts.png',
  'polo-shirt-pique': '/images/products/tshirts.png',
  'raw-jute-tossa': '/images/products/jute-fabric.png',
  'jute-bag-shopping': '/images/products/jute-shopping-bags.png',
  'jute-sack-50kg': '/images/products/jute-bags.png',
  'leather-wallet-bifold': '/images/products/leather-hides.png',
  'sandals-pvc-sole': '/images/products/leather-hides.png',
  'led-panel-light-18w': '/images/products/led-panel.png',
  'led-tube-light-4ft': '/images/products/led-panel.png',
  'power-bank-10000mah': '/images/products/solar-powerbank.png',
  'mobile-charger-usbc-18w': '/images/products/iphone-15.png',
  'bluetooth-earbuds-tws': '/images/products/galaxy-s24.png',
  'aluminum-cookware-set': '/images/products/ceramic-dinner-set.png',
  'custom-mug-ceramic': '/images/products/ceramic-dinner-set.png',
  'terracotta-pot-decorative': '/images/products/terracotta.png',
  'flower-pot-ceramic': '/images/products/terracotta.png',
  'nakshi-kantha-embroidered': '/images/products/tribal-fabric.png',
}

const tagDefs = [
  { name: 'Wholesale', slug: 'wholesale' },
  { name: 'Bangladesh Made', slug: 'bangladesh-made' },
  { name: 'Export Quality', slug: 'export-quality' },
  { name: 'Eco Friendly', slug: 'eco-friendly' },
  { name: 'Bulk Buy', slug: 'bulk-buy' },
]

async function cleanup() {
  // FK-safe child→parent order (SQLite enforces foreign keys).
  await db.flashDeals.deleteMany({})
  await db.dailyDeals.deleteMany({})
  await db.productTagRelations.deleteMany({})
  await db.productVariants.deleteMany({})
  await db.productPriceTiers.deleteMany({})
  await db.productImages.deleteMany({})
  await db.products.deleteMany({})
  await db.productTags.deleteMany({})
  await db.categories.deleteMany({})
  await db.supplierProfiles.deleteMany({})
  await db.users.deleteMany({})
}

async function main() {
  console.log('🧹 Cleaning existing data (FK-safe order)...')
  await cleanup()

  /* ── Suppliers: 2 demo users + profiles ── */
  console.log('👥 Seeding supplier users...')
  const passwordHash = await bcrypt.hash('supplier123', 10)
  const supplierDefs = [
    { email: 'supplier1@zylod.com', phone: '+8801810000001', companyName: 'Zylod Trading Co. (Demo)', rating: 4.6 },
    { email: 'supplier2@zylod.com', phone: '+8801810000002', companyName: 'Bengal Wholesale Hub (Demo)', rating: 4.4 },
  ]
  const suppliers = []
  for (const s of supplierDefs) {
    const user = await db.users.create({
      data: {
        userType: 'supplier',
        email: s.email,
        phone: s.phone,
        passwordHash,
        authProvider: 'email',
        accountStatus: 'active',
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    })
    const profile = await db.supplierProfiles.create({
      data: {
        userId: user.id,
        companyName: s.companyName,
        nidNumber: `1990123456${suppliers.length + 1}`,
        nidFrontImageUrl: picsum(`nid-front-${suppliers.length + 1}`),
        nidBackImageUrl: picsum(`nid-back-${suppliers.length + 1}`),
        tradeLicenseNumber: `TRAD/DSCC/00${suppliers.length + 1}2345`,
        tradeLicenseImageUrl: picsum(`trade-license-${suppliers.length + 1}`),
        tinNumber: `123-456-78${suppliers.length + 1}`,
        bankAccountName: s.companyName,
        bankAccountNumber: `1234567890${suppliers.length + 1}01`,
        bankName: 'Dutch-Bangla Bank',
        branch: 'Gulshan Branch, Dhaka',
        verificationStatus: 'approved',
        ratingAvg: s.rating,
        ratingCount: 40 + suppliers.length * 12,
      },
    })
    suppliers.push(profile)
  }
  console.log(`  ✅ ${suppliers.length} supplier users + profiles (login: supplier1@zylod.com / supplier123)`)

  /* ── Categories ── */
  console.log('📂 Seeding categories...')
  const categoryMap = new Map()
  for (const cat of categoriesData) {
    const created = await db.categories.create({
      data: { name: cat.name, slug: cat.slug, iconUrl: cat.iconUrl, isActive: true, sortOrder: cat.sortOrder },
    })
    categoryMap.set(cat.slug, created.id)
  }
  // Extra category used by a couple of beauty products (present in seed.ts full array).
  const beauty = await db.categories.create({
    data: { name: 'Beauty & Personal Care', slug: 'beauty-personal-care', iconUrl: '/icons/beauty.svg', isActive: true, sortOrder: 18 },
  })
  categoryMap.set(beauty.slug, beauty.id)
  console.log(`  ✅ ${categoryMap.size} categories`)

  /* ── Product tags ── */
  const tagMap = new Map()
  for (const t of tagDefs) {
    const created = await db.productTags.create({ data: { name: t.name, slug: t.slug } })
    tagMap.set(t.slug, created.id)
  }

  /* ── Products ── */
  console.log(`📦 Seeding ${productsData.length} products...`)
  let productCount = 0
  for (let i = 0; i < productsData.length; i++) {
    const p = productsData[i]
    const h = hash(p.slug)
    const thumbnail = localImageMap[p.slug] ?? picsum(p.slug)
    const tagSlugs = [...new Set(['wholesale', p.slug.includes('jute') ? 'eco-friendly' : (h % 3 === 0 ? 'export-quality' : 'bangladesh-made'), h % 2 === 0 ? 'bulk-buy' : 'export-quality'])]
    await db.products.create({
      data: {
        supplierId: suppliers[i % suppliers.length].id,
        categoryId: categoryMap.get(p.categorySlug),
        name: p.name,
        slug: p.slug,
        sku: `ZY-${p.slug.replace(/-/g, '').slice(0, 10).toUpperCase()}-${1000 + i}`,
        description: p.description,
        brand: p.brand,
        unit: p.unit,
        moq: p.moq,
        maxOrderQty: p.maxOrderQty,
        basePrice: p.basePrice,
        currency: 'BDT',
        stockQuantity: p.stockQuantity,
        isActive: true,
        isApproved: true,
        isClearance: i % 7 === 3,
        isSeasonal: i % 9 === 5,
        thumbnailUrl: thumbnail,
        soldCount: 50 + (h % 3000),
        ratingAvg: 3.6 + ((h % 13) / 10), // 3.6 – 4.8
        reviewCount: 5 + (h % 120),
        images: {
          create: [
            { imageUrl: thumbnail, sortOrder: 0 },
            { imageUrl: picsum(`${p.slug}-2`), sortOrder: 1 },
            { imageUrl: picsum(`${p.slug}-3`), sortOrder: 2 },
          ],
        },
        priceTiers: { create: p.priceTiers },
        variants: p.variants
          ? { create: p.variants.map((v) => ({ variantName: v.name, variantValue: v.value, sku: v.sku, stockQuantity: v.stock, priceOverride: v.priceOverride ?? null })) }
          : undefined,
        tagRelations: { create: tagSlugs.map((ts) => ({ tagId: tagMap.get(ts) })) },
      },
    })
    productCount++
    if (productCount % 10 === 0) console.log(`  ... ${productCount}/${productsData.length}`)
  }
  console.log(`  ✅ ${productCount} products with images, price tiers, SKUs, tags`)

  /* ── Flash Deals (Hot Deals) & Daily Deals ── */
  console.log('🔥 Seeding flash & daily deals...')
  const now = new Date()
  const createdProducts = await db.products.findMany({
    select: { id: true, slug: true, basePrice: true, stockQuantity: true },
    orderBy: { createdAt: 'asc' },
  })
  const flashPicks = [0, 3, 6, 9, 13, 16, 20, 24].map((i) => createdProducts[i % createdProducts.length]).filter(Boolean)
  for (const p of flashPicks) {
    const discount = 20 + (hash(p.slug) % 21) // 20–40%
    await db.flashDeals.create({
      data: {
        productId: p.id,
        dealPrice: Math.round(p.basePrice * (1 - discount / 100) * 100) / 100,
        discountPercent: discount,
        startAt: new Date(now.getTime() - 60 * 60 * 1000),
        endAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        totalStock: Math.min(1000, p.stockQuantity),
        soldCount: hash(p.slug) % 200,
        maxPerBuyer: 50,
        isActive: true,
      },
    })
  }
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dailyPicks = [1, 5, 11, 21].map((i) => createdProducts[i % createdProducts.length]).filter(Boolean)
  for (const p of dailyPicks) {
    const discount = 15 + (hash(p.slug) % 16) // 15–30%
    await db.dailyDeals.create({
      data: {
        productId: p.id,
        dealPrice: Math.round(p.basePrice * (1 - discount / 100) * 100) / 100,
        discountPercent: discount,
        dayDate: todayStart,
        isActive: true,
      },
    })
  }
  console.log(`  ✅ ${flashPicks.length} flash deals, ${dailyPicks.length} daily deals`)

  /* ── Summary ── */
  const [catCount, prodCount, imgCount, tierCount, flashCount, dailyCount, userCount] = await Promise.all([
    db.categories.count(),
    db.products.count(),
    db.productImages.count(),
    db.productPriceTiers.count(),
    db.flashDeals.count(),
    db.dailyDeals.count(),
    db.users.count(),
  ])
  console.log('🎉 SQLite seed complete:')
  console.log(`   categories: ${catCount} | products: ${prodCount} | images: ${imgCount} | priceTiers: ${tierCount}`)
  console.log(`   flashDeals: ${flashCount} | dailyDeals: ${dailyCount} | users: ${userCount}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
