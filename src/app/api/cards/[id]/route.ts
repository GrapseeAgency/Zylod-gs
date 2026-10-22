import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { financialAudit, maskAccount } from '@/lib/financial-audit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'cards-write', 20, 60000)

  if (!rl.ok) return rateLimitResponse(rl)


  try {
    const { id } = await params
    const userId = auth.user.id

    const existing = await db.paymentMethods.findFirst({
      where: { id, userId, type: { in: ['card', 'debit', 'credit'] } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    await db.paymentMethods.delete({ where: { id } })

    financialAudit({
      actorId: userId,
      action: 'financial_method_removed',
      methodId: id,
      summary: { method: 'card', network: existing.cardNetwork, accountMasked: maskAccount(existing.accountNumber) },
    })

    return NextResponse.json({
      success: true,
      message: 'Card removed successfully',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'cards-write', 20, 60000)

  if (!rl.ok) return rateLimitResponse(rl)


  try {
    const { id } = await params
    const userId = auth.user.id
    const body = await request.json()

    if (body.isDefault) {
      await db.paymentMethods.updateMany({
        where: { userId, type: { in: ['card', 'debit', 'credit'] } },
        data: { isDefault: false },
      })
      await db.paymentMethods.update({
        where: { id },
        data: { isDefault: true },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Card set as default payment method',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
