import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Size guide reference data for garments/textiles categories
const sizeGuideData: Record<string, {
  category: string
  unit: string
  sizes: Array<Record<string, string | number>>
  measurementGuide: Array<{ step: number; instruction: string }>
  tips: string[]
}> = {
  garments: {
    category: 'Garments / Apparel',
    unit: 'cm',
    sizes: [
      { size: 'XS', chest: '86', waist: '71', hip: '91', shoulder: '40', length: '66', sleeve: '58' },
      { size: 'S', chest: '91', waist: '76', hip: '96', shoulder: '42', length: '68', sleeve: '60' },
      { size: 'M', chest: '96', waist: '81', hip: '101', shoulder: '44', length: '70', sleeve: '62' },
      { size: 'L', chest: '101', waist: '86', hip: '106', shoulder: '46', length: '72', sleeve: '64' },
      { size: 'XL', chest: '106', waist: '91', hip: '111', shoulder: '48', length: '74', sleeve: '66' },
      { size: 'XXL', chest: '112', waist: '97', hip: '117', shoulder: '50', length: '76', sleeve: '68' },
      { size: '3XL', chest: '118', waist: '103', hip: '123', shoulder: '52', length: '78', sleeve: '70' },
    ],
    measurementGuide: [
      { step: 1, instruction: 'Chest: Measure around the fullest part of your chest, keeping the tape horizontal.' },
      { step: 2, instruction: 'Waist: Measure around your natural waistline, keeping the tape comfortably loose.' },
      { step: 3, instruction: 'Hip: Measure around the fullest part of your hips, keeping the tape horizontal.' },
      { step: 4, instruction: 'Shoulder: Measure from one shoulder seam to the other across the back.' },
      { step: 5, instruction: 'Length: Measure from the highest point of the shoulder to the bottom hem.' },
      { step: 6, instruction: 'Sleeve: Measure from the shoulder seam to the wrist bone.' },
    ],
    tips: [
      'All measurements are in centimeters (cm). Add 2-4 cm for a comfortable fit.',
      'For bulk orders, we recommend ordering a sample first to verify sizing.',
      'Sizes may vary by ±2 cm due to manufacturing tolerances.',
      'B2B customers can request custom sizing for orders above 500 units.',
    ],
  },
  textiles: {
    category: 'Textiles / Fabrics',
    unit: 'yards / meters',
    sizes: [
      { type: 'Cotton Fabric', width: '45 inches', standardCut: '1 yard', bulkCut: '100 yards', weight: '120-150 GSM' },
      { type: 'Silk Fabric', width: '44 inches', standardCut: '1 yard', bulkCut: '50 yards', weight: '80-100 GSM' },
      { type: 'Linen Fabric', width: '54 inches', standardCut: '1 yard', bulkCut: '80 yards', weight: '150-200 GSM' },
      { type: 'Denim Fabric', width: '58-60 inches', standardCut: '1 yard', bulkCut: '100 yards', weight: '250-350 GSM' },
      { type: 'Jersey Knit', width: '58-60 inches', standardCut: '1 yard', bulkCut: '80 yards', weight: '140-180 GSM' },
      { type: 'Muslin Cloth', width: '45-48 inches', standardCut: '1 yard', bulkCut: '200 yards', weight: '90-120 GSM' },
    ],
    measurementGuide: [
      { step: 1, instruction: 'Width: Measure the fabric width from selvage to selvage.' },
      { step: 2, instruction: 'Length: Measure along the selvage edge in yards or meters.' },
      { step: 3, instruction: 'Weight: GSM (grams per square meter) indicates fabric thickness and quality.' },
    ],
    tips: [
      'Fabric widths are measured from selvage to selvage (usable width may be 1-2 inches less).',
      'For garment production, add 5-10% extra for cutting wastage.',
      'Bulk orders are typically sold in rolls of 50-100 yards.',
      'Color may vary slightly between dye lots — order enough for your entire production run.',
    ],
  },
  footwear: {
    category: 'Footwear',
    unit: 'EU / BD sizing',
    sizes: [
      { eu: '38', bd: '6', uk: '5', us: '6.5', footLength: '24.0' },
      { eu: '39', bd: '7', uk: '6', us: '7', footLength: '24.5' },
      { eu: '40', bd: '7.5', uk: '6.5', us: '7.5', footLength: '25.0' },
      { eu: '41', bd: '8', uk: '7', us: '8', footLength: '25.5' },
      { eu: '42', bd: '9', uk: '8', us: '9', footLength: '26.0' },
      { eu: '43', bd: '9.5', uk: '9', us: '9.5', footLength: '26.5' },
      { eu: '44', bd: '10', uk: '9.5', us: '10', footLength: '27.0' },
      { eu: '45', bd: '11', uk: '10.5', us: '11', footLength: '27.5' },
    ],
    measurementGuide: [
      { step: 1, instruction: 'Stand on a piece of paper and trace your foot outline.' },
      { step: 2, instruction: 'Measure the length from heel to the longest toe in centimeters.' },
      { step: 3, instruction: 'Measure the width at the widest part of the foot.' },
      { step: 4, instruction: 'Use the foot length to find your corresponding EU size.' },
    ],
    tips: [
      'Measure your feet at the end of the day when they are at their largest.',
      'Wear the type of socks you intend to use with the shoes when measuring.',
      'If between sizes, go up to the next size for comfort.',
      'For bulk/institutional orders, we provide size assortment packs.',
    ],
  },
  home_textiles: {
    category: 'Home Textiles',
    unit: 'inches / cm',
    sizes: [
      { type: 'Bed Sheet (Single)', dimensions: '152 × 228 cm (60" × 90")', fabric: 'Cotton / Poly-Cotton' },
      { type: 'Bed Sheet (Double)', dimensions: '228 × 254 cm (90" × 100")', fabric: 'Cotton / Poly-Cotton' },
      { type: 'Bed Sheet (King)', dimensions: '274 × 274 cm (108" × 108")', fabric: 'Cotton / Poly-Cotton' },
      { type: 'Pillow Cover (Standard)', dimensions: '51 × 76 cm (20" × 30")', fabric: 'Cotton / Poly-Cotton' },
      { type: 'Towel (Hand)', dimensions: '40 × 60 cm (16" × 24")', fabric: 'Cotton Terry' },
      { type: 'Towel (Bath)', dimensions: '70 × 140 cm (28" × 55")', fabric: 'Cotton Terry' },
      { type: 'Curtain (Standard)', dimensions: '137 × 213 cm (54" × 84")', fabric: 'Various' },
      { type: 'Table Cloth (Standard)', dimensions: '137 × 183 cm (54" × 72")', fabric: 'Cotton / Linen' },
    ],
    measurementGuide: [
      { step: 1, instruction: 'For bed sheets: Measure your mattress length, width, and depth.' },
      { step: 2, instruction: 'For curtains: Measure the width of the window and add 4-8 inches for gathering.' },
      { step: 3, instruction: 'For towels: Standard sizes are suitable for most hospitality needs.' },
    ],
    tips: [
      'Hospitality bulk orders: Standard sizes are available in case packs of 12-24.',
      'Custom sizes available for orders above 200 units.',
      'Pre-shrunk fabrics: Allow 2-3% shrinkage after first wash for non-pre-shrunk items.',
      'Thread count: Higher thread count (200+) indicates better quality for hotel/upscale use.',
    ],
  },
}

// Map category slugs to size guide types
const categorySlugToGuide: Record<string, string> = {
  'garments': 'garments',
  'apparel': 'garments',
  'clothing': 'garments',
  't-shirts': 'garments',
  'shirts': 'garments',
  'pants': 'garments',
  'trousers': 'garments',
  'textiles': 'textiles',
  'fabrics': 'textiles',
  'fabric': 'textiles',
  'footwear': 'footwear',
  'shoes': 'footwear',
  'sandals': 'footwear',
  'home-textiles': 'home_textiles',
  'bedding': 'home_textiles',
  'towels': 'home_textiles',
  'curtains': 'home_textiles',
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const categorySlug = searchParams.get('category')
    const productId = searchParams.get('productId')

    // If productId is provided, look up the product's category
    let resolvedCategory = categorySlug

    if (productId && !resolvedCategory) {
      const product = await db.products.findUnique({
        where: { id: productId },
        include: {
          category: {
            select: { slug: true, name: true },
          },
        },
      })

      if (product) {
        resolvedCategory = product.category.slug
      }
    }

    // If a specific category is requested, return that guide
    if (resolvedCategory) {
      const guideKey = categorySlugToGuide[resolvedCategory.toLowerCase()]
      if (guideKey && sizeGuideData[guideKey]) {
        return NextResponse.json({
          success: true,
          data: {
            guide: sizeGuideData[guideKey],
            category: resolvedCategory,
          },
        })
      }

      // If no specific guide found, return general guide
      return NextResponse.json({
        success: true,
        data: {
          guide: sizeGuideData.garments,
          category: resolvedCategory,
          note: 'Specific size guide not available for this category. Showing general garment sizing as reference.',
        },
      })
    }

    // Return all available size guides
    return NextResponse.json({
      success: true,
      data: {
        availableGuides: Object.entries(sizeGuideData).map(([key, value]) => ({
          key,
          category: value.category,
          unit: value.unit,
          sizeCount: value.sizes.length,
          hasMeasurementGuide: value.measurementGuide.length > 0,
          tipCount: value.tips.length,
        })),
        guides: sizeGuideData,
      },
    })
  } catch (error) {
    console.error('Size guide GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
