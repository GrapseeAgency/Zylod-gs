import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * DELETE /api/supplier/certifications/[id] — the product's OWN supplier
 * removes a certification row. Trust claims are the supplier's
 * responsibility, so removal follows the same ownership rule as addition:
 * the cert's product must belong to the caller's supplier profile, and a
 * foreign cert is the SAME 404 as a phantom one (no existence leak).
 *
 * 401-first, 'seller-certifications-write' 20/min, audited
 * (certification_removed with the removed row's key fields in metadata so
 * the audit trail keeps what the public rail lost), and broadcast live to
 * the PUBLIC product room + the seller room (same 'product:certifications'
 * event, action 'removed').
 */
export async function DELETE(
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

    const cert = await db.productCertifications.findUnique({
      where: { id },
      include: { product: { select: { id: true, name: true, supplierId: true } } },
    })
    if (!cert || cert.product.supplierId !== profile.id) {
      return NextResponse.json({ error: 'Certification not found' }, { status: 404 })
    }

    await db.productCertifications.delete({ where: { id } })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'certification_removed',
        entityType: 'productCertifications',
        entityId: cert.id,
        metadata: JSON.stringify({
          productId: cert.productId,
          certName: cert.certName,
          certNumber: cert.certNumber,
          issuedBy: cert.issuedBy,
        }),
      },
    })

    await Promise.allSettled([
      broadcastToRoom(`product:${cert.productId}`, 'product:certifications', {
        productId: cert.productId,
        action: 'removed',
        certificationId: cert.id,
      }),
      broadcastToRoom(`seller:${profile.id}`, 'product:certifications', {
        productId: cert.productId,
        action: 'removed',
        certificationId: cert.id,
      }),
    ])

    return NextResponse.json({ data: { id: cert.id, removed: true } })
  } catch (err) {
    console.error('DELETE certification failed:', err)
    return NextResponse.json({ error: 'Failed to remove certification' }, { status: 500 })
  }
}
