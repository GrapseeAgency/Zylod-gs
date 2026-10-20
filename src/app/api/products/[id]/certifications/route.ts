import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { CERTIFICATION_CAP, shapeCertification } from '@/lib/certifications'

/**
 * THE PRODUCT CERTIFICATION RAIL (Task 92) — the trust surface.
 * The productCertifications table existed in the schema from day one with
 * NO route, NO writer, and NO reader, while THREE storefront pages shipped
 * FABRICATED certification claims (hardcoded "ISO 9001:2015 / CE Compliant"
 * arrays rendered for every product). That is the platform lying about
 * trust. This rail replaces the lie with the real table:
 *
 * GET  /api/products/[id]/certifications — PUBLIC read (certifications are
 *      exactly what an anonymous buyer evaluates before a bulk order):
 *      the product must exist (404), rows newest-issued first, each carrying
 *      a server-computed status: 'expired' (expiresAt < now),
 *      'expiring_soon' (within 30 days), or 'active'. An expiry date is
 *      NEVER hidden — an expired cert ships with its expired badge.
 *
 * POST (supplier owner) — the product's OWN supplier adds a certification:
 *      - 401-first, 'seller-certifications-write' 20/min.
 *      - A session without a supplier profile → honest 403.
 *      - A product that does not exist OR belongs to another supplier is
 *        the SAME 404 (no existence leak for foreign products).
 *      - Zod STRICT payload: certName 2..120, issuedBy 2..120, issuedAt
 *        required, expiresAt optional but MUST be after issuedAt,
 *        certNumber/documentUrl optional and bounded; documentUrl must be
 *        a real http(s) URL.
 *      - Hard cap of 12 certification rows per product → 409 (a wall of
 *        badges is a trust smell, not a feature).
 *      - Audited (certification_added) and broadcast live: the PUBLIC
 *        product:<id> room gets 'product:certifications' (an open PDP
 *        updates without a refresh) and the seller room gets the same tap.
 */

const CertCreateSchema = z
  .object({
    certName: z.string().trim().min(2).max(120),
    certNumber: z.string().trim().min(1).max(80).optional(),
    issuedBy: z.string().trim().min(2).max(120),
    issuedAt: z.coerce.date(),
    expiresAt: z.coerce.date().optional(),
    documentUrl: z.string().trim().url().max(500).optional(),
  })
  .strict()
  .refine((v) => !v.expiresAt || v.expiresAt.getTime() > v.issuedAt.getTime(), {
    message: 'expiresAt must be after issuedAt',
    path: ['expiresAt'],
  })

async function loadProduct(id: string) {
  return db.products.findUnique({ where: { id }, select: { id: true, name: true, supplierId: true } })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = checkRateLimit(request, 'product-certifications-public', 120, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const product = await loadProduct(id)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    const certs = await db.productCertifications.findMany({
      where: { productId: id },
      // NOTE: this model has no createdAt column — order by the honest
      // issuedAt only.
      orderBy: { issuedAt: 'desc' },
    })
    return NextResponse.json({
      data: certs.map(shapeCertification),
      count: certs.length,
    })
  } catch (err) {
    console.error('GET certifications failed:', err)
    return NextResponse.json({ error: 'Failed to load certifications' }, { status: 500 })
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

  const rl = checkRateLimit(request, 'seller-certifications-write', 20, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const product = await loadProduct(id)
    // Same 404 for a phantom product and a FOREIGN product — a supplier
    // learns nothing about another supplier's catalog from this rail.
    if (!product || product.supplierId !== profile.id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = CertCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid certification payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existingCount = await db.productCertifications.count({ where: { productId: id } })
    if (existingCount >= CERTIFICATION_CAP) {
      return NextResponse.json(
        { error: `This product already carries the maximum of ${CERTIFICATION_CAP} certifications.` },
        { status: 409 }
      )
    }

    const cert = await db.productCertifications.create({
      data: {
        productId: id,
        certName: parsed.data.certName,
        certNumber: parsed.data.certNumber ?? null,
        issuedBy: parsed.data.issuedBy,
        issuedAt: parsed.data.issuedAt,
        expiresAt: parsed.data.expiresAt ?? null,
        documentUrl: parsed.data.documentUrl ?? null,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'certification_added',
        entityType: 'productCertifications',
        entityId: cert.id,
        metadata: JSON.stringify({
          productId: id,
          certName: cert.certName,
          issuedBy: cert.issuedBy,
        }),
      },
    })

    const payload = shapeCertification(cert)
    // Fire-and-forget: the public PDP room refreshes live; the seller's own
    // consoles get the same tap. A dead socket server never fails the API.
    await Promise.allSettled([
      broadcastToRoom(`product:${id}`, 'product:certifications', {
        productId: id,
        action: 'added',
        certification: payload,
      }),
      broadcastToRoom(`seller:${profile.id}`, 'product:certifications', {
        productId: id,
        action: 'added',
        certification: payload,
      }),
    ])

    return NextResponse.json({ data: payload }, { status: 201 })
  } catch (err) {
    console.error('POST certification failed:', err)
    return NextResponse.json({ error: 'Failed to add certification' }, { status: 500 })
  }
}
