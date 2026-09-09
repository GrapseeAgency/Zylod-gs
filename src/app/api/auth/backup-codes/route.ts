import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

const CODE_COUNT = 10

function formatCode(raw: string): string {
  return raw.toUpperCase().match(/.{1,5}/g)!.join('-')
}

/**
 * POST /api/auth/backup-codes — generate a fresh set of one-time recovery codes.
 * Requires an authenticated session (Bearer token). Any existing unused codes
 * are invalidated so only the newest set works.
 * Returns the plaintext codes exactly once; only SHA-256 hashes are stored.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userId = auth.user.id

    // Invalidate any previous unused codes
    await db.backupCodes.deleteMany({
      where: { userId, usedAt: null },
    })

    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
    const codes: string[] = []

    for (let i = 0; i < CODE_COUNT; i++) {
      const bytes = crypto.randomBytes(10)
      let raw = ''
      for (const b of bytes) raw += alphabet[b % alphabet.length]
      codes.push(formatCode(raw))
    }

    await db.backupCodes.createMany({
      data: codes.map((code) => ({
        userId,
        codeHash: crypto.createHash('sha256').update(code).digest('hex'),
      })),
    })

    return NextResponse.json({
      success: true,
      codes,
      message: 'Store these codes securely — they are shown only once.',
    })
  } catch (error) {
    console.error('Backup codes generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/auth/backup-codes — report how many unused codes remain.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const remaining = await db.backupCodes.count({
      where: { userId: auth.user.id, usedAt: null },
    })

    return NextResponse.json({ success: true, remaining })
  } catch (error) {
    console.error('Backup codes status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
