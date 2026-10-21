import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET / PATCH /api/supplier/shipping — REAL sellerShippingConfigs for the
 * signed-in supplier. Zone values are the model's real enum (dhaka,
 * chittagong, rajshahi, sylhet, khulna, barishal, rangpur, mymensingh, all).
 * The old payload's invented courier toggles and flat "handling time" had no
 * backing model and are gone.
 */

const ZONES = ['dhaka', 'chittagong', 'rajshahi', 'sylhet', 'khulna', 'barishal', 'rangpur', 'mymensingh', 'all'] as const

const zoneConfigSchema = z.object({
  zone: z.enum(ZONES),
  baseRate: z.coerce.number().min(0, 'Base rate cannot be negative'),
  ratePerKg: z.coerce.number().min(0, 'Per-kg rate cannot be negative'),
  freeAboveAmount: z.coerce.number().min(0).nullable().optional(),
  estimatedDays: z.string().trim().max(40).nullable().optional(),
  isActive: z.boolean().default(true),
})

const patchSchema = z.object({
  configs: z.array(zoneConfigSchema).min(1, 'At least one zone config is required').max(ZONES.length),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'supplier-shipping-get', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const configs = await db.sellerShippingConfigs.findMany({
      where: { supplierId: profile.id },
      orderBy: { zone: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        configs,
        zones: ZONES,
      },
    })
  } catch (error) {
    console.error('Supplier shipping GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function patchHandler(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'supplier-shipping-patch', 30, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid shipping payload' },
        { status: 400 }
      )
    }

    // Upsert every submitted zone — the [supplierId, zone] pair is unique.
    const saved = await db.$transaction(async (tx) => {
      const rows: Array<Awaited<ReturnType<typeof tx.sellerShippingConfigs.upsert>>> = []
      for (const cfg of parsed.data.configs) {
        const row = await tx.sellerShippingConfigs.upsert({
          where: { supplierId_zone: { supplierId: profile.id, zone: cfg.zone } },
          create: {
            supplierId: profile.id,
            zone: cfg.zone,
            baseRate: cfg.baseRate,
            ratePerKg: cfg.ratePerKg,
            freeAboveAmount: cfg.freeAboveAmount ?? null,
            estimatedDays: cfg.estimatedDays ?? null,
            isActive: cfg.isActive,
          },
          update: {
            baseRate: cfg.baseRate,
            ratePerKg: cfg.ratePerKg,
            freeAboveAmount: cfg.freeAboveAmount ?? null,
            estimatedDays: cfg.estimatedDays ?? null,
            isActive: cfg.isActive,
          },
        })
        rows.push(row)
      }
      return rows
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_shipping_configs_updated',
        entityType: 'sellerShippingConfigs',
        entityId: profile.id,
        metadata: JSON.stringify({ supplierId: profile.id, zones: saved.map((r) => r.zone) }),
      },
    })

    return NextResponse.json({ success: true, data: { configs: saved } })
  } catch (error) {
    console.error('Supplier shipping PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export { patchHandler as PATCH }
// The settings UI historically POSTed; keep it on the same real handler.
export { patchHandler as POST }
