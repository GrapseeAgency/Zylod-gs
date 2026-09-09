import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    let supplier = await db.supplierProfiles.findFirst({
      where: { userId: auth.user.id }
    })

    const supplierId = supplier ? supplier.id : auth.user.id

    const where: any = {
      OR: [
        { supplierId: supplierId },
        { supplierId: auth.user.id }
      ]
    }

    if (category && category !== 'all') {
      where.categoryId = category
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive' || status === 'draft') {
      where.isActive = false
    } else if (status === 'out_of_stock') {
      where.stockQuantity = { lte: 0 }
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const products = await db.products.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        priceTiers: { orderBy: { minQty: 'asc' } },
        images: true,
        _count: { select: { reviews: true, orderItems: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: products,
      meta: { count: products.length }
    })
  } catch (error) {
    console.error('Supplier products GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      description,
      categoryId,
      basePrice,
      currency = 'BDT',
      unit = 'piece',
      moq = 1,
      stockQuantity = 100,
      thumbnailUrl,
      images = [],
      priceTiers = []
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Product title is required' }, { status: 400 })
    }

    // Default category fallback if none provided
    let targetCategoryId = categoryId
    if (!targetCategoryId) {
      const firstCat = await db.categories.findFirst()
      if (firstCat) targetCategoryId = firstCat.id
    }

    if (!targetCategoryId) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }

    let supplier = await db.supplierProfiles.findFirst({
      where: { userId: auth.user.id }
    })

    if (!supplier) {
      supplier = await db.supplierProfiles.create({
        data: {
          userId: auth.user.id,
          companyName: 'Wholesale Supplier',
          nidNumber: '0000000000',
          nidFrontImageUrl: '',
          nidBackImageUrl: '',
          tradeLicenseNumber: '000000',
          tradeLicenseImageUrl: '',
          tinNumber: '000000',
          bankAccountName: 'Wholesale Supplier',
          bankAccountNumber: '00000000',
          bankName: 'BRAC Bank',
          branch: 'Main'
        }
      })
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36)

    const product = await db.products.create({
      data: {
        supplierId: supplier.id,
        name: name.trim(),
        slug,
        description: description || '',
        categoryId: targetCategoryId,
        basePrice: parseFloat(basePrice) || 0,
        currency,
        unit,
        moq: parseInt(moq) || 1,
        stockQuantity: parseInt(stockQuantity) || 0,
        thumbnailUrl: thumbnailUrl || (images[0]?.url ?? null),
        isActive: true,
        priceTiers: priceTiers.length > 0 ? {
          create: priceTiers.map((t: any) => ({
            minQty: parseInt(t.minQty) || 1,
            maxQty: t.maxQty ? parseInt(t.maxQty) : null,
            unitPrice: parseFloat(t.unitPrice) || parseFloat(basePrice) || 0
          }))
        } : undefined,
        images: images.length > 0 ? {
          create: images.map((img: any, idx: number) => ({
            url: typeof img === 'string' ? img : img.url,
            isPrimary: idx === 0,
            sortOrder: idx
          }))
        } : undefined
      },
      include: {
        priceTiers: true,
        images: true,
        category: true
      }
    })

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Supplier products POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
