import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { financialAudit, maskAccount } from '@/lib/financial-audit'

/**
 * DELETE /api/payment-methods/[id] — remove a saved payment method.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'payment-methods-write', 20, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const existing = await db.paymentMethods.findFirst({ where: { id, userId: auth.user.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }
    await db.paymentMethods.delete({ where: { id } })
    financialAudit({
      actorId: auth.user.id,
      action: 'financial_method_removed',
      methodId: id,
      summary: { method: existing.type, label: existing.label, accountMasked: maskAccount(existing.accountNumber) },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Payment method DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 })
  }
}