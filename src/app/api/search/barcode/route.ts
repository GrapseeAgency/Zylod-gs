import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

/**
 * GET /api/search/barcode?code=...
 * Finds a product by exact SKU, variant SKU, or product id.
 */

const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  brand: true,
  basePrice: true,
  currency: true,
  unit: true,
  moq: true,
  stockQuantity: true,
  thumbnailUrl: true,
  supplier: {
    select: {
      id: true,
      companyName: true,
      verificationStatus: true
    }
  },
  category: {
    select: {
      id: true,
      name: true
    }
  }
} as const

/** Shared catalog lookup used by the GET endpoint and the image-scan path. */
async function lookupProductByCode(code: string) {
  // 1) Product SKU / id match
  const product = await db.products.findFirst({
    where: {
      isActive: true,
      OR: [
        { sku: { equals: code } },
        { sku: { contains: code } },
        { id: { equals: code } }
      ]
    },
    select: PRODUCT_SELECT
  })
  if (product) return product

  // 2) Variant SKU match
  const variant = await db.productVariants.findFirst({
    where: { sku: { equals: code } },
    include: { product: { select: PRODUCT_SELECT } }
  })
  return variant?.product ?? null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || '').trim()

    if (!code) {
      return NextResponse.json({ error: 'Code parameter is required' }, { status: 400 })
    }

    const product = await lookupProductByCode(code)

    if (!product) {
      return NextResponse.json({ success: true, data: null, message: 'No product matches this barcode' })
    }

    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    console.error('Barcode search error:', error)
    return NextResponse.json({ error: 'Barcode lookup failed' }, { status: 500 })
  }
}

/**
 * POST /api/search/barcode — scan an uploaded photo of a barcode / QR code.
 *
 * REAL decode: the photo is sent to the vision model which reads the actual
 * printed digits (1D barcode) or the encoded payload (QR). The extracted code
 * is then matched against the catalog by SKU / variant SKU / product id.
 * When the photo contains no legible code, or the code matches nothing, the
 * response is an honest null — an arbitrary product is NEVER returned.
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, 'search-barcode', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const formData = await request.formData()
    const image = formData.get('image')

    if (!image || !(image instanceof File)) {
      return NextResponse.json({ error: 'An image file is required' }, { status: 400 })
    }

    if (image.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 8MB)' }, { status: 400 })
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, and WebP images are supported' }, { status: 400 })
    }

    // Read the photo and hand it to the vision model as a data URL.
    const buffer = Buffer.from(await image.arrayBuffer())
    const mime = image.type
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`

    const zai = await ZAI.create()
    const vision = await zai.chat.completions.createVision({
      model: 'glm-5v-turbo',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'This photo should contain a product barcode or QR code. ' +
                'For a 1D barcode, read the digits printed UNDER the bars (not the product name). ' +
                'For a QR code, report the exact encoded text. ' +
                'Reply with the code value ONLY — no explanation, no quotes, no spaces, no punctuation added. ' +
                'If the photo contains no legible barcode or QR code, reply with exactly: NONE'
            },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    let raw = (vision.choices[0]?.message?.content || '').trim()

    // Normalise the model output: strip wrapping quotes/backticks/whitespace.
    raw = raw.replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, '')

    if (!raw || /^NONE$/i.test(raw) || raw.length > 300) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No legible barcode or QR code found in the photo'
      })
    }

    // A QR payload may be a full product link — pull the code out of it.
    let code = raw
    const urlMatch = raw.match(/[?&](?:code|sku)=([A-Za-z0-9._-]+)/i)
    if (urlMatch) code = urlMatch[1]

    const product = await lookupProductByCode(code)

    if (!product) {
      return NextResponse.json({
        success: true,
        data: null,
        code,
        message: `No product matches the scanned code: ${code}`
      })
    }

    return NextResponse.json({
      success: true,
      data: { code, product }
    })
  } catch (error) {
    console.error('Barcode image scan error:', error)
    return NextResponse.json({ error: 'Failed to process barcode image' }, { status: 500 })
  }
}
