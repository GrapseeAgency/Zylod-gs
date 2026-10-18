import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET / PUT /api/supplier/return-policies — REAL sellerReturnPolicies rows for
 * the signed-in supplier. policyType is the model's real enum (return |
 * exchange | refund | restock). The old invented "warranty / shippingPayer"
 * payload had no backing columns and is gone.
 */

const POLICY_TYPES = ['return', 'exchange', 'refund', 'restock'] as const
const REFUND_METHODS = ['original_payment', 'wallet', 'store_credit'] as const

const policySchema = z.object({
  policyType: z.enum(POLICY_TYPES),
  returnWindowDays: z.coerce.number().int().min(0, 'Return window cannot be negative').max(365),
  exchangeAllowed: z.boolean().default(true),
  refundMethod: z.enum(REFUND_METHODS).default('original_payment'),
  restockingFeePct: z.coerce.number().min(0).max(100, 'Restocking fee cannot exceed 100%').default(0),
  conditions: z.array(z.string().trim().max(200)).max(20).optional(),
  isActive: z.boolean().default(true),
})

const putSchema = z.object({
  policies: z.array(policySchema).min(1, 'At least one policy is required').max(POLICY_TYPES.length),
})

export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-return-policies-get', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const policies = await db.sellerReturnPolicies.findMany({
      where: { supplierId: profile.id },
      orderBy: { policyType: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        policies: policies.map((p) => ({
          ...p,
          conditions: p.conditions ? JSON.parse(p.conditions) : [],
        })),
        policyTypes: POLICY_TYPES,
      },
    })
  } catch (error) {
    console.error('Supplier return policies GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function putHandler(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-return-policies-put', 30, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const parsed = putSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid policy payload' },
        { status: 400 }
      )
    }

    // No DB unique on [supplierId, policyType] — upsert via findFirst/update
    // inside one transaction so a policy type never duplicates.
    const saved = await db.$transaction(async (tx) => {
      const rows: Array<Awaited<ReturnType<typeof tx.sellerReturnPolicies.create>>> = []
      for (const pol of parsed.data.policies) {
        const existing = await tx.sellerReturnPolicies.findFirst({
          where: { supplierId: profile.id, policyType: pol.policyType },
          select: { id: true },
        })
        const data = {
          returnWindowDays: pol.returnWindowDays,
          exchangeAllowed: pol.exchangeAllowed,
          refundMethod: pol.refundMethod,
          restockingFeePct: pol.restockingFeePct,
          conditions: pol.conditions ? JSON.stringify(pol.conditions) : null,
          isActive: pol.isActive,
        }
        const row = existing
          ? await tx.sellerReturnPolicies.update({ where: { id: existing.id }, data })
          : await tx.sellerReturnPolicies.create({
              data: { supplierId: profile.id, policyType: pol.policyType, ...data },
            })
        rows.push(row)
      }
      return rows
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_return_policies_updated',
        entityType: 'sellerReturnPolicies',
        entityId: profile.id,
        metadata: JSON.stringify({ supplierId: profile.id, policyTypes: saved.map((r) => r.policyType) }),
      },
    })

    return NextResponse.json({ success: true, data: { policies: saved } })
  } catch (error) {
    console.error('Supplier return policies PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export { putHandler as PUT }
// The settings UI historically POSTed; keep it on the same real handler.
export { putHandler as POST }
