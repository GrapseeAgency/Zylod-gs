import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/admin/deliveries/drivers — ADMIN ONLY
 *
 * Creates a `driver` user account. Public registration only ever creates
 * buyer/supplier accounts, so this endpoint is the one real path for the
 * owner to mint drivers (who then get assigned to sub-orders via
 * POST /api/admin/deliveries/assignments and start pushing GPS pings from
 * the driver app). Credentials are hashed with bcrypt (12 rounds), exactly
 * like public registration.
 */

const CreateDriverSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  phone: z
    .string()
    .regex(/^01[3-9]\d{8}$/, 'Bangladeshi mobile number expected, e.g. 01712345678')
    .optional(),
})

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Admin authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'admin-driver-create', 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = CreateDriverSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }
  const { email, password, phone } = parsed.data

  try {
    const existing = await db.users.findFirst({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
      select: { id: true, email: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: `An account already exists for ${existing.email || phone}.` },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const driver = await db.users.create({
      data: {
        userType: 'driver',
        email,
        phone: phone ?? null,
        passwordHash,
        authProvider: 'email',
        accountStatus: 'active',
      },
      select: { id: true, email: true, phone: true, userType: true, createdAt: true },
    })

    await db.auditLogs
      .create({
        data: {
          actorId: auth.user.id,
          action: 'delivery.driver.create',
          entityType: 'users',
          entityId: driver.id,
          metadata: JSON.stringify({ email }),
        },
      })
      .catch(() => {/* audit logging must never break creation */})

    return NextResponse.json(
      {
        ok: true,
        driver: {
          id: driver.id,
          email: driver.email,
          phone: driver.phone,
          userType: driver.userType,
          createdAt: driver.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Driver create error:', err)
    return NextResponse.json({ error: 'Failed to create driver account' }, { status: 500 })
  }
}

/**
 * GET /api/admin/deliveries/drivers — list existing driver accounts.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Admin authentication required' },
      { status: 401 }
    )
  }

  try {
    const drivers = await db.users.findMany({
      where: { userType: 'driver' },
      select: { id: true, email: true, phone: true, accountStatus: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      drivers: drivers.map((d) => ({
        id: d.id,
        email: d.email,
        phone: d.phone,
        accountStatus: d.accountStatus,
        createdAt: d.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('Driver list error:', err)
    return NextResponse.json({ error: 'Failed to list drivers' }, { status: 500 })
  }
}
