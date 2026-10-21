import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * Task 118 — THE WALLET DOCTRINE. POST /api/wallet/topup is the MANUAL
 * top-up CLAIM route. It used to credit the wallet instantly with zero
 * verification — a self-service money printer that poisoned escrow and
 * payouts. It is now the exact Task 56 symmetry for the wallet:
 *
 *   A manual claim NEVER moves money. It creates a walletTopups row with
 *   status 'pending' and nothing else. ONLY the admin decision route
 *   (POST /api/admin/topups/[id]/verify) can flip pending → credited and
 *   write the deposit row. Gateway top-ups (POST /api/wallet/topup/initiate)
 *   are the other honest leg: credited only by the verified callback/IPN.
 *
 * Mandate order (house contract):
 *   1) authenticateRequest → 401 FIRST.
 *   2) rate limit 10/min 'wallet-topup-claim'.
 *   3) Zod STRICT:
 *      amount               10..100000 (same bounds as the gateway initiate)
 *      method               bKash | Nagad | Rocket | Upay | bank_transfer
 *      transactionReference /^[A-Za-z0-9\-_]{6,64}$/ (REQUIRED — an
 *                           unverifiable claim is not accepted)
 *      senderNumber?        /^[0-9+\-]{6,20}$/
 *      note?                ≤300
 *   4) transactionReference uniqueness across walletTopups (the reference
 *      column is @@unique): same-user reuse or ANY other user → 409 with a
 *      distinguishable message; a P2002 race surfaces the same 409.
 *   5) ONE create: walletTopups {status:'pending', provider mapped from
 *      method, reference = transactionReference, claimDetails JSON
 *      {method, senderNumber?, note?, submittedAt}} + auditLogs
 *      'wallet_topup_claimed'. NO wallets mutation, NO walletTransactions
 *      row — the balance only moves at admin verification.
 *   6) AFTER commit, fire-and-forget 'wallet:topup-submitted' to every
 *      admin's own admin:<adminUserId> room (the house admin-room
 *      convention).
 *
 * GET /api/wallet/topup — the caller's OWN claims, newest first (take 50).
 * Never credits anything; exists so the wallet/add-money UIs can show the
 * claim ledger with honest statuses (pending | credited | rejected | …).
 */

const RATE_LIMIT = { limit: 10, windowMs: 60_000 }

const METHOD_TO_PROVIDER: Record<string, string> = {
  bKash: 'bkash',
  Nagad: 'nagad',
  Rocket: 'rocket',
  Upay: 'upay',
  bank_transfer: 'bank_transfer',
}

const claimSchema = z
  .object({
    amount: z.coerce.number().min(10, 'Amount must be at least ৳10').max(100000, 'Amount must not exceed ৳100,000'),
    method: z.enum(['bKash', 'Nagad', 'Rocket', 'Upay', 'bank_transfer']),
    transactionReference: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9\-_]{6,64}$/, 'transactionReference must be 6-64 characters (letters, numbers, dash, underscore)'),
    senderNumber: z
      .string()
      .trim()
      .regex(/^[0-9+\-]{6,20}$/, 'senderNumber must be 6-20 digits (may start with +)')
      .optional(),
    note: z.string().trim().max(300).optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  // 1) Auth first — 401 before anything else.
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  // 2) Rate limit second (mandated order).
  const rl = checkRateLimit(request, 'wallet-topup-claim', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    // 3) Zod strict — verbatim issue on failure.
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = claimSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }
    const { amount, method, transactionReference, senderNumber, note } = parsed.data
    const provider = METHOD_TO_PROVIDER[method]

    // 4) Reference uniqueness across the WHOLE table — a claim reference is
    // a receipt number; the same receipt cannot fund two wallets.
    const existing = await db.walletTopups.findUnique({ where: { reference: transactionReference } })
    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.userId === auth.user.id
              ? 'This transaction reference was already submitted by you'
              : 'This transaction reference is already used by another claim',
        },
        { status: 409 }
      )
    }

    // 5) The claim itself — pending, and NOTHING else. No wallet row is
    // created or touched here; no ledger row is written here.
    const claimDetails: Record<string, unknown> = {
      method,
      submittedAt: new Date().toISOString(),
    }
    if (senderNumber) claimDetails.senderNumber = senderNumber
    if (note) claimDetails.note = note

    let topup
    try {
      topup = await db.walletTopups.create({
        data: {
          userId: auth.user.id,
          provider,
          reference: transactionReference,
          amount,
          currency: 'BDT',
          status: 'pending',
          claimDetails: claimDetails as Prisma.InputJsonObject,
        },
      })
    } catch (error) {
      // Unique-reference race: another request inserted the same reference
      // between the check and this create — surface the same honest 409.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { error: 'This transaction reference is already used by another claim' },
          { status: 409 }
        )
      }
      throw error
    }

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'wallet_topup_claimed',
        entityType: 'walletTopups',
        entityId: topup.id,
        metadata: JSON.stringify({
          amount,
          provider,
          method,
          reference: transactionReference,
          status: 'pending',
          note: 'manual claim — wallet balance NOT changed; awaiting admin verification',
        }),
      },
    })

    // 6) Live tap on every admin's own room (fire-and-forget).
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    void Promise.allSettled(
      admins.map((admin) =>
        broadcastToRoom(`admin:${admin.id}`, 'wallet:topup-submitted', {
          topupId: topup.id,
          amount,
          provider,
          reference: transactionReference,
        })
      )
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          topupId: topup.id,
          status: 'pending',
          reference: transactionReference,
          amount,
          message:
            'Claim received. Your wallet balance does NOT change until a Zylod admin verifies the payment — the same rule as order payments.',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Wallet topup claim POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const topups = await db.walletTopups.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        provider: true,
        reference: true,
        amount: true,
        currency: true,
        status: true,
        gatewayTrxId: true,
        claimDetails: true,
        creditedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: topups })
  } catch (error) {
    console.error('Wallet topup GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
