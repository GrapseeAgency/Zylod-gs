import crypto from 'crypto'

/**
 * Minimal standards-compliant TOTP (RFC 6238) implementation using Node's built-in crypto.
 * No external dependency — works everywhere and interoperates with Google Authenticator / Authy.
 */

/** Generate a random base32 secret (160 bits = 32 chars, standard for TOTP). */
export function generateTOTPSecret(): string {
  const bytes = crypto.randomBytes(20)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let secret = ''
  for (const b of bytes) {
    secret += alphabet[b & 31]
  }
  return secret
}

/** Build an otpauth:// URI for QR-code scanning. */
export function buildOTPAuthURI(secret: string, accountName: string, issuer = 'Zylod'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

/** Compute the current 6-digit TOTP code for a secret. */
export function generateTOTPCode(secret: string, timeStepMs = 30000): string {
  const counter = Math.floor(Date.now() / timeStepMs)
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(BigInt(counter), 0)

  // Decode base32 secret
  const secretBuf = Buffer.from(base32Decode(secret))

  const hmac = crypto.createHmac('sha1', secretBuf)
  hmac.update(counterBuf)
  const digest = hmac.digest()

  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return (binary % 1000000).toString().padStart(6, '0')
}

/** Verify a TOTP code with a window of ±1 time step (allows slight clock drift). */
export function verifyTOTPCode(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false
  for (let offset = -1; offset <= 1; offset++) {
    const counter = Math.floor(Date.now() / 30000) + offset
    if (generateTOTPCodeForCounter(secret, counter) === token) return true
  }
  return false
}

function generateTOTPCodeForCounter(secret: string, counter: number): string {
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(BigInt(counter), 0)
  const secretBuf = Buffer.from(base32Decode(secret))
  const hmac = crypto.createHmac('sha1', secretBuf)
  hmac.update(counterBuf)
  const digest = hmac.digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return (binary % 1000000).toString().padStart(6, '0')
}

/** RFC 4648 base32 decoder. */
function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  const bits: number[] = []
  for (const ch of cleaned) {
    const val = alphabet.indexOf(ch)
    if (val < 0) continue
    for (let i = 4; i >= 0; i--) {
      bits.push((val >> i) & 1)
    }
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i * 8 + j]
    }
    bytes[i] = byte
  }
  return bytes
}
