import { NextRequest, NextResponse } from 'next/server'
import { requireUserType, authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { issueDeliveryRoomToken } from '@/lib/delivery-room-token'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { REALTIME_ROOM_PATTERN } from '@/lib/realtime-broadcast'

/**
 * GET /api/realtime/room-token?room=... — mint a short-lived signed token for
 * the platform's generalized real-time rooms (Task 51-a).
 *
 * The socket service (mini-services/delivery-service) verifies the HMAC
 * signature, expiry and room binding itself (claims.r === room), so a token
 * can neither be minted client-side nor replayed into another room.
 *
 * Rules (in mandate order — authentication 401 FIRST, then rate limit):
 *   room=order:<id>      → 404: order rooms are minted by the EXISTING
 *                          GET /api/delivery/orders/[orderId]/room-token
 *                          (buyer-owner / admin / assigned-driver semantics
 *                          live there — never duplicated here).
 *   room=product:<id>    → 404: product rooms are PUBLIC by design (product
 *                          stock is already public on the PDP) — they need
 *                          no token at all.
 *   room=seller:<id>     → requireUserType(['supplier','admin']); a supplier
 *                          may only mint for their OWN supplierProfiles id
 *                          (mismatch → 403); admin may mint for any.
 *   room=admin:<id>      → requireUserType(['admin']); the id must equal the
 *                          session user id (403 otherwise).
 *
 * Read-only: no DB writes (tokens are stateless and self-verifying).
 */

const RATE_LIMIT = { limit: 30, windowMs: 60_000 }

export async function GET(request: NextRequest) {
  // 1) Auth first — 401 before anything else is revealed (any session type;
  //    room-specific type checks come after the rate limit below).
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  // 2) Rate limit second (mandated order — matches the admin-route convention).
  const rl = checkRateLimit(request, 'realtime-room-token', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const room = (request.nextUrl.searchParams.get('room') || '').trim()
    if (!room || !REALTIME_ROOM_PATTERN.test(room)) {
      return NextResponse.json(
        { error: 'room query parameter must match room:<id> with prefixes order|product|seller|admin' },
        { status: 400 }
      )
    }

    const prefix = room.slice(0, room.indexOf(':'))
    const targetId = room.slice(room.indexOf(':') + 1)

    // order: rooms — the dedicated delivery endpoint owns their authorization.
    if (prefix === 'order') {
      return NextResponse.json(
        {
          error:
            'Order room tokens are issued by GET /api/delivery/orders/[orderId]/room-token — use that endpoint with the orderId.',
        },
        { status: 404 }
      )
    }

    // product: rooms are public — subscribing needs no token at all.
    if (prefix === 'product') {
      return NextResponse.json(
        {
          error:
            'Product rooms are public and need no token — subscribe with { room } directly.',
        },
        { status: 404 }
      )
    }

    if (prefix === 'seller') {
      const sellerAuth = await requireUserType(request, ['supplier', 'admin'])
      if (!sellerAuth.authenticated || !sellerAuth.user) {
        return NextResponse.json(
          { error: sellerAuth.error || 'Supplier authentication required' },
          { status: 401 }
        )
      }

      let scopedId: string
      if (sellerAuth.user.userType === 'admin') {
        // Admin is a trusted role — may mint for any seller room.
        scopedId = targetId
      } else {
        const profile = await resolveSupplierProfile(sellerAuth.user)
        if (!profile) {
          return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
        }
        if (profile.id !== targetId) {
          return NextResponse.json(
            { error: 'You may only mint room tokens for your own supplier profile.' },
            { status: 403 }
          )
        }
        scopedId = profile.id
      }

      const { token, expiresIn } = issueDeliveryRoomToken({
        roomId: `seller:${scopedId}`,
        userId: sellerAuth.user.id,
        userType: sellerAuth.user.userType,
      })
      return NextResponse.json({ success: true, token, roomId: `seller:${scopedId}`, expiresIn })
    }

    // prefix === 'admin' (the pattern allows nothing else)
    const adminAuth = await requireUserType(request, ['admin'])
    if (!adminAuth.authenticated || !adminAuth.user) {
      return NextResponse.json(
        { error: adminAuth.error || 'Admin authentication required' },
        { status: 401 }
      )
    }
    if (adminAuth.user.id !== targetId) {
      return NextResponse.json(
        { error: 'You may only mint a room token for your own admin feed.' },
        { status: 403 }
      )
    }

    const { token, expiresIn } = issueDeliveryRoomToken({
      roomId: `admin:${targetId}`,
      userId: adminAuth.user.id,
      userType: adminAuth.user.userType,
    })
    return NextResponse.json({ success: true, token, roomId: `admin:${targetId}`, expiresIn })
  } catch (err) {
    console.error('Realtime room-token GET error:', err)
    return NextResponse.json(
      { error: 'Failed to issue realtime room token' },
      { status: 500 }
    )
  }
}
