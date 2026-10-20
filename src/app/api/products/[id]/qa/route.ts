import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile } from '@/lib/supplier-scope'
import { sendNotification } from '@/lib/notifications'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * THE PRODUCT Q&A RAIL (Task 93 rewrite) — buyers ask, the product's OWN
 * supplier answers, both sides are told, and an open PDP updates live.
 *
 * The rail shipped earlier but was broken at its core: the answer path
 * compared products.supplierId (a supplierProfiles id) against the session
 * users.id — two different id spaces — so NO supplier could ever answer a
 * question on their own product (403 every time). The rewrite:
 *
 * GET /api/products/[id]/qa — PUBLIC read (Q&A is pre-purchase trust
 *      content): rows newest-first with the asker's REAL display name,
 *      plus canAnswer:true only when the CALLER is the product's owning
 *      supplier or an admin (session resolved from cookies; anonymous
 *      callers get canAnswer:false — ownership is decided server-side,
 *      never by client-sent ids).
 *
 * POST /api/products/[id]/qa — 401-first (the old rail answered a valid
 *      body with a naked 403 'Not authorized'):
 *      - ASK  { question }: 'product-qa-ask' 5/min; the product must exist
 *        AND be visible (isActive + isApproved) — invisible/phantom is the
 *        SAME 404; question 5..500; the asker is the SESSION user (the old
 *        client-sent userId is gone). The supplier is TOLD: a durable
 *        notification (preferences-checked) + a live 'qa:new' tap on the
 *        seller room + a public 'product:qa' tap on the product room.
 *      - ANSWER { qaId, answer }: 'product-qa-answer' 10/min; ONLY the
 *        owning supplier (profile.id === product.supplierId — the fix) or
 *        an admin; the question must belong to THIS product (foreign qaId
 *        is the SAME 404 as a phantom one); an already-answered question
 *        is a 409 (answers are immutable — corrections happen by the admin
 *        rail, not by silent overwrite); answer 2..2000. The asker is
 *        TOLD (durable + live), the public product room gets 'product:qa'.
 *      - Both actions are audited (qa_asked / qa_answered).
 */

const QaAskSchema = z
  .object({ question: z.string().trim().min(5).max(500) })
  .strict()

const QaAnswerSchema = z
  .object({ qaId: z.string().trim().min(1).max(64), answer: z.string().trim().min(2).max(2000) })
  .strict()

async function loadProduct(id: string) {
  return db.products.findUnique({
    where: { id },
    select: { id: true, name: true, supplierId: true, isActive: true, isApproved: true },
  })
}

/** Real display name from the actual profile rows — never 'Anonymous' when a profile exists. */
function displayName(user: {
  buyerProfile?: { fullName: string; businessName: string | null } | null
  supplierProfile?: { companyName: string } | null
} | null): string {
  if (!user) return 'Anonymous'
  return user.buyerProfile?.fullName
    || user.buyerProfile?.businessName
    || user.supplierProfile?.companyName
    || 'Anonymous'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = checkRateLimit(request, 'product-qa-public', 120, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const product = await loadProduct(id)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Ownership is decided HERE, server-side, from the caller's cookies.
    let canAnswer = false
    const auth = await authenticateRequest(request)
    if (auth.authenticated && auth.user) {
      if (auth.user.userType === 'admin') {
        canAnswer = true
      } else {
        const profile = await resolveSupplierProfile(auth.user)
        canAnswer = Boolean(profile && profile.id === product.supplierId)
      }
    }

    const qas = await db.productQas.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            buyerProfile: { select: { fullName: true, businessName: true } },
            supplierProfile: { select: { companyName: true } },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      canAnswer,
      count: qas.length,
      data: qas.map((qa) => ({
        id: qa.id,
        question: qa.question,
        askedBy: displayName(qa.user),
        askedAt: qa.createdAt.toISOString(),
        answer: qa.answer,
        answeredAt: qa.answeredAt?.toISOString() || null,
        helpful: qa.helpful,
      })),
    })
  } catch (error) {
    console.error('Product QA GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  try {
    const { id } = await params
    const product = await loadProduct(id)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    /* ── ANSWER ── */
    if ('qaId' in body || 'answer' in body) {
      const rl = checkRateLimit(request, 'product-qa-answer', 10, 60 * 1000)
      if (!rl.ok) return rateLimitResponse(rl)

      const parsed = QaAnswerSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid answer payload', issues: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }

      // THE FIX: products.supplierId is a supplierProfiles id — resolve the
      // caller's PROFILE and compare in the SAME id space. (The old rail
      // compared it against users.id, so no supplier could ever answer.)
      const profile = await resolveSupplierProfile(auth.user)
      const isOwner = Boolean(profile && profile.id === product.supplierId)
      const isAdmin = auth.user.userType === 'admin'
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Only the product\'s supplier can answer questions' }, { status: 403 })
      }

      const qa = await db.productQas.findUnique({ where: { id: parsed.data.qaId } })
      if (!qa || qa.productId !== id) {
        // Same 404 for a foreign question and a phantom one.
        return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      }
      if (qa.answer) {
        return NextResponse.json({ error: 'This question is already answered' }, { status: 409 })
      }

      const updated = await db.productQas.update({
        where: { id: qa.id },
        data: { answer: parsed.data.answer, answeredBy: auth.user.id, answeredAt: new Date() },
      })

      await db.auditLogs.create({
        data: {
          actorId: auth.user.id,
          action: 'qa_answered',
          entityType: 'productQas',
          entityId: qa.id,
          metadata: JSON.stringify({ productId: id, byAdmin: isAdmin && !isOwner }),
        },
      })

      await Promise.allSettled([
        sendNotification({
          userId: qa.userId,
          type: 'chat',
          title: `Your question was answered — ${product.name}`,
          body: parsed.data.answer.slice(0, 200),
          relatedEntityId: id,
        }),
        broadcastToRoom(`product:${id}`, 'product:qa', { productId: id, action: 'answered', qaId: qa.id }),
      ])

      return NextResponse.json({ success: true, data: { id: updated.id, answeredAt: updated.answeredAt?.toISOString() ?? null } })
    }

    /* ── ASK ── */
    const rl = checkRateLimit(request, 'product-qa-ask', 5, 60 * 1000)
    if (!rl.ok) return rateLimitResponse(rl)

    const parsed = QaAskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid question payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Questions are pre-purchase content: only VISIBLE products accept them
    // (an unapproved/hidden listing is the SAME 404 as a phantom one).
    if (!product.isActive || !product.isApproved) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const qa = await db.productQas.create({
      data: { productId: id, userId: auth.user.id, question: parsed.data.question },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'qa_asked',
        entityType: 'productQas',
        entityId: qa.id,
        metadata: JSON.stringify({ productId: id }),
      },
    })

    const supplierProfile = await db.supplierProfiles.findUnique({
      where: { id: product.supplierId },
      select: { id: true, userId: true },
    })

    await Promise.allSettled([
      // Durable, preferences-checked notice to the product's REAL owner.
      supplierProfile
        ? sendNotification({
            userId: supplierProfile.userId,
            type: 'chat',
            title: `New question on ${product.name}`,
            body: parsed.data.question.slice(0, 200),
            relatedEntityId: id,
          })
        : Promise.resolve(),
      // Live tap for the supplier's consoles.
      supplierProfile
        ? broadcastToRoom(`seller:${supplierProfile.id}`, 'qa:new', {
            productId: id,
            qaId: qa.id,
            question: parsed.data.question,
          })
        : Promise.resolve(),
      // Open PDPs refresh their Q&A live.
      broadcastToRoom(`product:${id}`, 'product:qa', { productId: id, action: 'asked', qaId: qa.id }),
    ])

    return NextResponse.json({ success: true, data: { id: qa.id, question: qa.question, askedAt: qa.createdAt.toISOString() } }, { status: 201 })
  } catch (error) {
    console.error('Product QA POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
