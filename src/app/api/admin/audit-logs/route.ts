import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/admin/audit-logs (Task 139) — the ADMIN reader for the platform's
 * audit trail. Every audited write (orders, products, payments, coupons,
 * campaigns, queries, chat, moderation…) persists a real auditLogs row with
 * before/after metadata — the anti-fake doctrine's evidence — but until this
 * route the trail was INVISIBLE to the admin it was built for (no route, no
 * console). Read-only, 401-first, honest pagination.
 *
 * Query (all optional, Zod-validated):
 *   page, limit (≤100)      — pagination
 *   action                  — case-insensitive CONTAINS match (e.g. 'payment')
 *   entityType              — exact match (e.g. 'products', 'orders', 'payments')
 *   entityId                — exact match (drill into one entity's full history)
 *   actorId                 — exact match (what did THIS user do?)
 */

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  action: z.string().trim().min(1).max(80).optional(),
  entityType: z.string().trim().min(1).max(60).optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
  actorId: z.string().trim().min(1).max(64).optional(),
})

function actorName(user: {
  email: string | null
  userType: string
  buyerProfile?: { fullName: string; businessName: string | null } | null
  supplierProfile?: { companyName: string } | null
} | null | undefined): string {
  if (!user) return 'System / unknown actor'
  return (
    user.buyerProfile?.fullName ||
    user.supplierProfile?.companyName ||
    user.email ||
    'Unknown actor'
  )
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-audit-logs', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = request.nextUrl
    const parsed = QuerySchema.safeParse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      action: searchParams.get('action') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      entityId: searchParams.get('entityId') || undefined,
      actorId: searchParams.get('actorId') || undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { page, limit, action, entityType, entityId, actorId } = parsed.data

    const where: Prisma.auditLogsWhereInput = {}
    if (action) where.action = { contains: action }
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (actorId) where.actorId = actorId

    const [rows, total, typeCounts] = await Promise.all([
      db.auditLogs.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              userType: true,
              buyerProfile: { select: { fullName: true, businessName: true } },
              supplierProfile: { select: { companyName: true } },
            },
          },
        },
      }),
      db.auditLogs.count({ where }),
      db.auditLogs.groupBy({
        by: ['entityType'],
        _count: { _all: true },
        orderBy: { _count: { entityType: 'desc' } },
      }),
    ])

    const data = rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
      actor: r.actor
        ? {
            id: r.actor.id,
            email: r.actor.email,
            userType: r.actor.userType,
            name: actorName(r.actor),
          }
        : null,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      summary: { byEntityType: typeCounts.map((t) => ({ entityType: t.entityType, count: t._count._all })) },
    })
  } catch (error) {
    console.error('Admin audit-logs GET error:', error)
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}
