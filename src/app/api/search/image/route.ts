import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { embedImageUrl, cosineSimilarity, clipAvailable, EMBEDDING_MODEL_TAG } from '@/lib/clip'

/**
 * POST /api/search/image — find products by visual similarity.
 *
 * Real ML matching: the uploaded photo is embedded with a server-side CLIP
 * model and compared (cosine similarity) against product thumbnail embeddings
 * which are computed lazily and cached in products.embedding.
 * Falls back to keyword/category matching if the model or image is unusable.
 */

const MAX_SIZE = 8 * 1024 * 1024
const MAX_PRODUCTS_SCANNED = 500
const MAX_EMBED_PER_REQUEST = 40 // cap cold-start work per search
const TOP_RESULTS = 24

export async function POST(request: NextRequest) {
  try {
    let keywords: string[] = []
    let storedUrl: string | null = null
    let queryEmbedding: number[] | null = null

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('image') as File | null
      const kw = String(formData.get('keywords') || '')
      if (kw) keywords = kw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)

      if (file) {
        if (file.size > MAX_SIZE) {
          return NextResponse.json({ error: 'Image too large (max 8MB)' }, { status: 400 })
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          return NextResponse.json({ error: 'Only JPG, PNG, and WebP images are supported' }, { status: 400 })
        }
        const id = crypto.randomBytes(8).toString('hex')
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
        const filename = `search-${Date.now()}-${id}.${ext}`
        const dir = path.join(process.cwd(), 'public', 'uploads', 'search')
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(path.join(dir, filename), buffer)
        storedUrl = `/uploads/search/${filename}`
      }
    } else {
      const body = await request.json()
      const kw = String(body.keywords || '')
      if (kw) keywords = kw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
      storedUrl = body.imageUrl || null
    }

    // ─── Visual search path (CLIP) ───
    const useClip = storedUrl && await clipAvailable()
    if (useClip && storedUrl) {
      queryEmbedding = await embedImageUrl(storedUrl.startsWith('http')
        ? storedUrl
        : `${process.env.APP_URL || new URL(request.url).origin}${storedUrl}`)

      if (queryEmbedding) {
        // Candidate pool: active, approved products with a thumbnail
        const candidates = await db.products.findMany({
          where: { isActive: true, isApproved: true, thumbnailUrl: { not: null } },
          select: { id: true, thumbnailUrl: true, embedding: true, embeddingModel: true },
          take: MAX_PRODUCTS_SCANNED,
          orderBy: { soldCount: 'desc' },
        })

        const origin = process.env.APP_URL || new URL(request.url).origin
        let embeddedThisRequest = 0
        const scored: { id: string; score: number }[] = []

        for (const p of candidates) {
          let embedding: number[] | null = null

          if (p.embedding && p.embeddingModel === EMBEDDING_MODEL_TAG) {
            try { embedding = JSON.parse(p.embedding) } catch { embedding = null }
          }

          // Lazily compute + persist missing/stale embeddings (bounded work)
          if (!embedding) {
            if (embeddedThisRequest >= MAX_EMBED_PER_REQUEST) continue
            embeddedThisRequest++
            const thumb = p.thumbnailUrl!.startsWith('http')
              ? p.thumbnailUrl!
              : `${origin}${p.thumbnailUrl}`
            embedding = await embedImageUrl(thumb)
            if (embedding) {
              await db.products.update({
                where: { id: p.id },
                data: { embedding: JSON.stringify(embedding), embeddingModel: EMBEDDING_MODEL_TAG },
              }).catch(() => {})
            }
          }

          if (embedding) {
            scored.push({ id: p.id, score: cosineSimilarity(queryEmbedding, embedding) })
          }
        }

        scored.sort((a, b) => b.score - a.score)
        const topIds = scored.slice(0, TOP_RESULTS).map(s => s.id)

        if (topIds.length > 0) {
          const products = await db.products.findMany({
            where: { id: { in: topIds } },
            include: {
              category: { select: { name: true, slug: true } },
              supplier: { select: { companyName: true, ratingAvg: true } },
            },
          })
          const order = new Map(topIds.map((id, i) => [id, i]))
          products.sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0))

          const data = products.map(p => ({
            id: p.id, name: p.name, slug: p.slug, basePrice: p.basePrice,
            thumbnailUrl: p.thumbnailUrl, unit: p.unit, moq: p.moq, sku: p.sku,
            ratingAvg: p.ratingAvg, reviewCount: p.reviewCount, soldCount: p.soldCount,
            category: p.category ? { name: p.category.name, slug: p.category.slug } : null,
            supplier: p.supplier ? { companyName: p.supplier.companyName, ratingAvg: p.supplier.ratingAvg } : null,
            similarity: scored.find(s => s.id === p.id)?.score ?? null,
          }))

          return NextResponse.json({
            success: true,
            data: {
              imageUrl: storedUrl,
              keywords,
              matchedBy: 'visual-clip',
              products: data,
              resultCount: data.length,
            },
          })
        }
      }
    }

    // ─── Keyword fallback ───
    const where: Record<string, unknown> = { isActive: true, isApproved: true }
    if (keywords.length > 0) {
      where.OR = keywords.map(k => ({
        OR: [
          { name: { contains: k } },
          { description: { contains: k } },
          { brand: { contains: k } },
          { category: { name: { contains: k } } },
        ],
      }))
    }

    const products = await db.products.findMany({
      where,
      orderBy: { soldCount: 'desc' },
      take: TOP_RESULTS,
      include: {
        category: { select: { name: true, slug: true } },
        supplier: { select: { companyName: true, ratingAvg: true } },
      },
    })

    const data = products.map(p => ({
      id: p.id, name: p.name, slug: p.slug, basePrice: p.basePrice,
      thumbnailUrl: p.thumbnailUrl, unit: p.unit, moq: p.moq, sku: p.sku,
      ratingAvg: p.ratingAvg, reviewCount: p.reviewCount, soldCount: p.soldCount,
      category: p.category ? { name: p.category.name, slug: p.category.slug } : null,
      supplier: p.supplier ? { companyName: p.supplier.companyName, ratingAvg: p.supplier.ratingAvg } : null,
      similarity: null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: storedUrl,
        keywords,
        matchedBy: keywords.length > 0 ? 'keywords' : 'curated',
        products: data,
        resultCount: data.length,
      },
    })
  } catch (error) {
    console.error('Image search error:', error)
    return NextResponse.json({ error: 'Image search failed' }, { status: 500 })
  }
}
