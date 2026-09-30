/**
 * Signed delivery-room tokens for the live delivery socket.io service.
 *
 * ISSUER:  GET /api/delivery/orders/[orderId]/room-token (Next.js API) —
 *          issued only after the same authorization as the /live snapshot.
 * VERIFIER: mini-services/delivery-service/index.ts — the socket service
 *          re-implements the exact same format + secret derivation (the two
 *          processes deliberately share NO import; they agree on the bytes).
 *
 * Token format:
 *   token   = `${payload}.${sig}`
 *   payload = base64url(JSON.stringify({ r: roomId, u: userId, k: userType, exp: unixSeconds }))
 *   sig     = base64url(HMAC-SHA256(payload, secret))
 *
 * Secret (env-derived — NEVER a hardcoded literal):
 *   process.env.DELIVERY_ROOM_SECRET when set, otherwise
 *   sha256(`${AUTH_SECRET || DATABASE_URL}:delivery-rooms`) as hex.
 *   The mini-service derives it identically from the repo-root .env.
 */
import crypto from 'crypto'

export const DELIVERY_ROOM_TOKEN_TTL_SECONDS = 600

export interface DeliveryRoomClaims {
  /** room id the token is bound to, e.g. "order:<orderId>" */
  r: string
  /** user id the token was issued to */
  u: string
  /** user type at issuance (buyer / admin / driver) */
  k: string
  /** expiry as unix seconds */
  exp: number
}

export type DeliveryRoomTokenVerification =
  | { ok: true; claims: DeliveryRoomClaims }
  | {
      ok: false
      reason: 'malformed_token' | 'bad_signature' | 'token_expired' | 'room_mismatch'
    }

export function getDeliveryRoomSecret(): string {
  const explicit = process.env.DELIVERY_ROOM_SECRET
  if (explicit && explicit.trim().length > 0) return explicit.trim()
  const seed = process.env.AUTH_SECRET || process.env.DATABASE_URL || ''
  return crypto.createHash('sha256').update(`${seed}:delivery-rooms`).digest('hex')
}

function b64url(input: Buffer): string {
  return input.toString('base64url')
}

/** Mint a signed room token. Server-side only — the secret never leaves the process. */
export function issueDeliveryRoomToken(input: {
  roomId: string
  userId: string
  userType: string
  ttlSeconds?: number
}): { token: string; expiresIn: number } {
  const ttl = input.ttlSeconds ?? DELIVERY_ROOM_TOKEN_TTL_SECONDS
  const claims: DeliveryRoomClaims = {
    r: input.roomId,
    u: input.userId,
    k: input.userType,
    exp: Math.floor(Date.now() / 1000) + ttl,
  }
  const payload = b64url(Buffer.from(JSON.stringify(claims), 'utf8'))
  const sig = b64url(crypto.createHmac('sha256', getDeliveryRoomSecret()).update(payload).digest())
  return { token: `${payload}.${sig}`, expiresIn: ttl }
}

/**
 * Verify a signed room token against the requested room:
 * constant-time HMAC comparison, then expiry, then room binding.
 */
export function verifyDeliveryRoomToken(
  token: string,
  roomId: string,
  secret: string = getDeliveryRoomSecret()
): DeliveryRoomTokenVerification {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: 'malformed_token' }
  }
  const [payload, sig] = parts as [string, string]

  const expected = crypto.createHmac('sha256', secret).update(payload).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad_signature' }
  }

  let claims: DeliveryRoomClaims
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const obj = parsed as Record<string, unknown> | null
    if (
      typeof obj !== 'object' ||
      obj === null ||
      typeof obj.r !== 'string' ||
      typeof obj.u !== 'string' ||
      typeof obj.k !== 'string' ||
      typeof obj.exp !== 'number'
    ) {
      return { ok: false, reason: 'malformed_token' }
    }
    claims = { r: obj.r, u: obj.u, k: obj.k, exp: obj.exp }
  } catch {
    return { ok: false, reason: 'malformed_token' }
  }

  if (claims.exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'token_expired' }
  }
  if (claims.r !== roomId) {
    return { ok: false, reason: 'room_mismatch' }
  }
  return { ok: true, claims }
}
