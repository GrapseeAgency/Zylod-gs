import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/products/[id]/qa — real Q&A for a product
 * POST /api/products/[id]/qa — ask a question
 * Body: { userId, question } (or with `answer` + `answeredBy` for supplier responses)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = await db.products.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const qas = await db.productQas.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            buyerProfile: { select: { fullName: true, businessName: true } },
            supplierProfile: { select: { companyName: true } },
          },
        },
      },
    })

    const data = qas.map(qa => ({
      id: qa.id,
      question: qa.question,
      askedBy: qa.user?.buyerProfile?.fullName || qa.user?.buyerProfile?.businessName || qa.user?.supplierProfile?.companyName || 'Anonymous',
      askedAt: qa.createdAt.toISOString(),
      answer: qa.answer,
      answeredBy: qa.answeredBy || null,
      answeredAt: qa.answeredAt?.toISOString() || null,
      helpful: qa.helpful,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Product QA GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { userId, question, answer, answeredBy } = body

    if (!userId || (!question && !answer)) {
      return NextResponse.json({ error: 'userId and (question or answer) are required' }, { status: 400 })
    }

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user || auth.user.id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const product = await db.products.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    // Answering an existing question: body must include the qaId
    if (answer) {
      const qaId = body.qaId
      if (!qaId) return NextResponse.json({ error: 'qaId is required to answer' }, { status: 400 })
      // Only the product's supplier (or admin) can answer
      if (product.supplierId !== userId && auth.user.userType !== 'admin') {
        return NextResponse.json({ error: 'Only the supplier can answer questions' }, { status: 403 })
      }
      const updated = await db.productQas.update({
        where: { id: qaId },
        data: { answer, answeredBy: userId, answeredAt: new Date() },
      })
      return NextResponse.json({ success: true, data: updated })
    }

    const qa = await db.productQas.create({
      data: { productId: id, userId, question },
    })
    return NextResponse.json({ success: true, data: qa }, { status: 201 })
  } catch (error) {
    console.error('Product QA POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
