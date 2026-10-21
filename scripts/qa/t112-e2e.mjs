/**
 * Task 112 E2E — THE REAL GAMES on the real miniGameScores / gameChallenges /
 * buyerRewards / rewardTransactions tables. The old surface was fake by
 * design: "Play" hardcoded score 85 client-side and POST /api/mini-games
 * accepted any {gameType, score} at unlimited rate — a points farm
 * redeemable into ৳ vouchers. This drill proves the rewritten circuit:
 *   the farm endpoint is GONE → the quiz deals real papers whose answer map
 *   never leaves the server and grades exactly (perfect paper 100 pts,
 *   all-wrong paper 0 pts still recorded) → challenges are consumed exactly
 *   once (replay 409) and expire (410) → memory is graded position-by-
 *   position on a server-dealt sequence → the crate is server-rolled with a
 *   2/day cap → every game's daily cap refuses honestly → points land in
 *   the buyerRewards ledger exactly once each.
 *
 * Run: node scripts/qa/wipe.mjs && bun scripts/qa/t112-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
function ok(cond, label, extra = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.112.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    for (let attempt = 0; attempt < 7; attempt++) {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          'X-Forwarded-For': ip,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      const setCookie = res.headers.getSetCookie?.() ?? []
      for (const c of setCookie) {
        const pair = c.split(';')[0]
        if (pair) cookie = cookie ? `${cookie}; ${pair}` : pair
      }
      const json = await res.json().catch(() => null)
      if (res.status !== 429) return { status: res.status, json }
      // only the real rate limiter says "Too many requests" — honest daily
      // caps also answer 429 with their own message and must pass through
      if (!(json?.error ?? '').includes('Too many requests')) return { status: res.status, json }
      await sleep(10_000 * (attempt + 1))
    }
    throw new Error('rate limited beyond back-off window: ' + path)
  }
}

async function registerAndLogin(session, userType, email, password, businessName) {
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA112 ${userType}`, ...(businessName ? { businessName } : {}) }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json).slice(0, 200)}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await sleep(4000 * (attempt + 1))
  }
}

const STAMP = Date.now()
const buyer = makeSession()
const B1 = `qa112-buyer-${STAMP}@t112.test`
await registerAndLogin(buyer, 'buyer', B1, 'Passw0rd!112')
const buyerRow = await db.users.findUnique({ where: { email: B1 } })

console.log('── A. HONEST CATALOG + THE FARM IS DEAD ─────────────────')
{
  const guest = makeSession()
  const g = await guest('GET', '/api/mini-games')
  ok(g.status === 200 && g.json?.data?.games?.length === 3, 'catalog serves the three real games')
  ok(g.json?.data?.games?.every((x) => typeof x.dailyLimit === 'number'), 'each game declares its real daily limit')
  ok(Array.isArray(g.json?.data?.recentScores) && g.json.data.recentScores.length === 0, 'guest sees an honest empty score history')
  ok(g.json?.data?.usage === null && g.json?.data?.signedIn === false, 'guest usage is null and signedIn false')

  const farm = await buyer('POST', '/api/mini-games', { gameType: 'wholesale_trivia', score: 9999 })
  ok(farm.status === 405, 'the old self-declared score POST is GONE (405 — the money printer is dead)', String(farm.status))

  const au = await buyer('GET', '/api/mini-games')
  ok(au.json?.data?.signedIn === true && au.json?.data?.usage?.wholesale_trivia === 0 && au.json?.data?.usage?.memory_match === 0 && au.json?.data?.usage?.box_picker === 0, 'authed GET shows zero usage before play')
}

console.log('── B. TRIVIA — real papers, server-graded exactly ───────')
let balanceAfterTriviaPerfect = 0
{
  ok((await makeSession()('POST', '/api/mini-games/trivia/start')).status === 401, 'guest paper deal → 401')
  ok((await makeSession()('POST', '/api/mini-games/trivia/submit', { challengeId: 'aaaaaaaaaaaaaaaaaaaaaaaa', answers: [] })).status === 401, 'guest submit → 401')

  const p1 = await buyer('POST', '/api/mini-games/trivia/start')
  ok(p1.status === 200 && p1.json?.data?.questions?.length === 10, 'paper dealt: 10 questions')
  ok(p1.json?.data?.questions?.every((q) => q.options?.length === 4 && !('answer' in q) && !('_answerPosition' in q) && !('answerKey' in q)), 'the answer map NEVER leaves the server (no answer fields on the wire)')
  const attempt1Left = p1.json?.data?.attemptsLeft
  ok(attempt1Left === 2, 'attemptsLeft honestly decrements (3 → 2)', String(attempt1Left))

  // white-box: the drill reads the stored deal to compute the PERFECT sheet
  const ch1 = await db.gameChallenges.findUnique({ where: { id: p1.json.data.challengeId } })
  const deal1 = JSON.parse(ch1.payload).deal
  const perfect = deal1.map((d) => ({ id: d.id, choice: d._answerPosition }))

  ok((await buyer('POST', '/api/mini-games/trivia/submit', { challengeId: p1.json.data.challengeId, answers: perfect.slice(0, 9) })).status === 400, 'a 9-answer sheet refused (exactly 10 required)')
  ok((await buyer('POST', '/api/mini-games/trivia/submit', { challengeId: p1.json.data.challengeId, answers: perfect, cheat: 1 })).status === 400, 'unknown key refused (strict body)')
  ok((await buyer('POST', '/api/mini-games/trivia/submit', { challengeId: 'nonexistent-challenge', answers: perfect })).status === 404, 'phantom paper → 404')

  const sub1 = await buyer('POST', '/api/mini-games/trivia/submit', { challengeId: p1.json.data.challengeId, answers: perfect })
  ok(sub1.status === 200 && sub1.json?.data?.correct === 10 && sub1.json?.data?.pointsWon === 100, 'PERFECT paper grades exactly 10/10 → 100 pts', JSON.stringify(sub1.json?.data).slice(0, 120))
  balanceAfterTriviaPerfect = 100

  const replay = await buyer('POST', '/api/mini-games/trivia/submit', { challengeId: p1.json.data.challengeId, answers: perfect })
  ok(replay.status === 409, 'replayed paper refused (consumed exactly once)')

  // paper 2: every answer deliberately wrong — a real 0
  const p2 = await buyer('POST', '/api/mini-games/trivia/start')
  const ch2 = await db.gameChallenges.findUnique({ where: { id: p2.json.data.challengeId } })
  const deal2 = JSON.parse(ch2.payload).deal
  const allWrong = deal2.map((d) => ({ id: d.id, choice: (d._answerPosition + 1) % 4 }))
  const sub2 = await buyer('POST', '/api/mini-games/trivia/submit', { challengeId: p2.json.data.challengeId, answers: allWrong })
  ok(sub2.status === 200 && sub2.json?.data?.correct === 0 && sub2.json?.data?.pointsWon === 0, 'all-wrong paper grades 0/0 — still a real recorded attempt', JSON.stringify(sub2.json?.data).slice(0, 100))
  const row2 = await db.miniGameScores.findFirst({ where: { userId: buyerRow.id, gameType: 'wholesale_trivia', pointsWon: 0 }, orderBy: { playedAt: 'desc' } })
  ok(!!row2 && row2.score === 0, 'the zero attempt lives in the score history (honest misses are real rows)')

  const p3 = await buyer('POST', '/api/mini-games/trivia/start')
  const ch3 = await db.gameChallenges.findUnique({ where: { id: p3.json.data.challengeId } })
  const deal3 = JSON.parse(ch3.payload).deal
  const half = deal3.slice(0, 5).map((d) => ({ id: d.id, choice: d._answerPosition })).concat(deal3.slice(5).map((d) => ({ id: d.id, choice: (d._answerPosition + 1) % 4 })))
  const sub3 = await buyer('POST', '/api/mini-games/trivia/submit', { challengeId: p3.json.data.challengeId, answers: half })
  ok(sub3.status === 200 && sub3.json?.data?.correct === 5 && sub3.json?.data?.pointsWon === 50, 'half-right paper grades exactly 5/10 → 50 pts')

  const p4 = await buyer('POST', '/api/mini-games/trivia/start')
  ok(p4.status === 429 && /3 quiz attempts/.test(p4.json?.error ?? ''), '4th attempt refused with the honest daily cap message', JSON.stringify(p4.json).slice(0, 120))
}

console.log('── C. MEMORY — server-dealt, position-graded, one-shot ──')
{
  const s1 = await buyer('POST', '/api/mini-games/memory/start')
  ok(s1.status === 200 && s1.json?.data?.sequence?.length === 6, 'server deals a 6-symbol sequence')
  const V = ['truck', 'container', 'crate', 'pallet', 'forklift', 'vessel', 'scale', 'warehouse']
  ok(s1.json?.data?.sequence?.every((s) => V.includes(s)), 'every dealt symbol is from the real cargo vocabulary')

  const bad1 = await buyer('POST', '/api/mini-games/memory/submit', { challengeId: s1.json.data.challengeId, sequence: ['truck'] })
  ok(bad1.status === 400, 'a 1-symbol reproduction refused (exactly 6 required)')
  const bad2 = await buyer('POST', '/api/mini-games/memory/submit', { challengeId: s1.json.data.challengeId, sequence: s1.json.data.sequence.map(() => 'ufo') })
  ok(bad2.status === 400, 'invented symbols refused (enum-locked)')

  const perfect = await buyer('POST', '/api/mini-games/memory/submit', { challengeId: s1.json.data.challengeId, sequence: s1.json.data.sequence })
  ok(perfect.status === 200 && perfect.json?.data?.correct === 6 && perfect.json?.data?.pointsWon === 120, 'perfect reproduction 6/6 → 120 pts', JSON.stringify(perfect.json?.data).slice(0, 120))
  const replay = await buyer('POST', '/api/mini-games/memory/submit', { challengeId: s1.json.data.challengeId, sequence: s1.json.data.sequence })
  ok(replay.status === 409, 'replayed round refused (consumed exactly once)')

  const s2 = await buyer('POST', '/api/mini-games/memory/start')
  const chal = await db.gameChallenges.findUnique({ where: { id: s2.json.data.challengeId } })
  await db.gameChallenges.update({ where: { id: chal.id }, data: { expiresAt: new Date(Date.now() - 5000) } })
  const late = await buyer('POST', '/api/mini-games/memory/submit', { challengeId: chal.id, sequence: s2.json.data.sequence })
  ok(late.status === 410, 'expired deal refused — the clock is part of the game', String(late.status))

  const s3 = await buyer('POST', '/api/mini-games/memory/start')
  const seq3 = s3.json.data.sequence
  const partial = [...seq3]
  partial[2] = partial[2] === 'truck' ? 'crate' : 'truck'
  const sub3 = await buyer('POST', '/api/mini-games/memory/submit', { challengeId: s3.json.data.challengeId, sequence: partial })
  ok(sub3.status === 200 && sub3.json?.data?.correct === 5 && sub3.json?.data?.pointsWon === 100, 'one wrong position grades 5/6 → 100 pts (position-by-position)', JSON.stringify(sub3.json?.data).slice(0, 100))
  ok(sub3.json?.data?.dealtSequence?.length === 6, 'the reveal shows the dealt order after grading')

  // the expired round (s2) burned NO daily attempt — caps count real scored
  // rows, so this 3rd scored round is allowed; the 4th scored round is not
  const s4 = await buyer('POST', '/api/mini-games/memory/start')
  ok(s4.status === 200, 'the expired round did not burn the daily budget (cap counts real scored rows)')
  const sub4 = await buyer('POST', '/api/mini-games/memory/submit', { challengeId: s4.json.data.challengeId, sequence: s4.json.data.sequence })
  ok(sub4.status === 200 && sub4.json?.data?.pointsWon === 120, 'third scored round pays 6/6 → 120 pts')
  const s5 = await buyer('POST', '/api/mini-games/memory/start')
  ok(s5.status === 429 && /memory rounds/.test(s5.json?.error ?? ''), 'beyond the 3 scored rounds the honest cap refuses')
}

console.log('── D. CRATE — the server rolled before you clicked ──────')
let crateWins = 0
{
  ok((await makeSession()('POST', '/api/mini-games/box/open', {})).status === 401, 'guest crate → 401')
  const cheat = await buyer('POST', '/api/mini-games/box/open', { prize: 'voucher' })
  ok(cheat.status === 400 && /sealed/.test(cheat.json?.error ?? ''), 'a client-declared prize refused — the crates are sealed server-side')

  for (let i = 0; i < 2; i++) {
    const r = await buyer('POST', '/api/mini-games/box/open', {})
    ok(r.status === 200 && typeof r.json?.data?.won === 'boolean' && !!r.json?.data?.message, `crate ${i + 1}: a real rolled result came back`)
    if (r.json?.data?.won) {
      crateWins++
      ok(r.json?.data?.prize?.code?.startsWith('CRATE-') && [20, 35, 50, 80].includes(r.json.data.prize.value), 'the win carries a real CRATE voucher', JSON.stringify(r.json.data.prize))
      const coupon = await db.userCoupons.findFirst({ where: { userId: buyerRow.id, code: r.json.data.prize.code } })
      ok(!!coupon && coupon.categoryLabel === 'Mystery Crate' && coupon.savingsBDT === r.json.data.prize.value, 'the voucher row is real in the vault (category Mystery Crate)')
    } else {
      ok(/straw/.test(r.json?.data?.message ?? ''), 'the empty crate says so honestly')
    }
  }
  const third = await buyer('POST', '/api/mini-games/box/open', {})
  ok(third.status === 429 && /crates for today/.test(third.json?.error ?? ''), '3rd crate refused with the honest daily cap message')
  const crateRows = await db.miniGameScores.count({ where: { userId: buyerRow.id, gameType: 'box_picker' } })
  ok(crateRows === 2, 'exactly 2 crate attempts recorded (wins and straw both)', String(crateRows))
  const winRows = await db.userCoupons.count({ where: { userId: buyerRow.id, couponId: 'mystery-crate' } })
  ok(winRows === crateWins, 'vouchers in the vault match the wins exactly', `wins ${crateWins} / rows ${winRows}`)
}

console.log('── E. THE LEDGER — points landed exactly once each ──────')
{
  const scores = await db.miniGameScores.findMany({ where: { userId: buyerRow.id } })
  const expectedEarned = scores.reduce((sum, s) => sum + s.pointsWon, 0)
  ok(scores.length === 8, `exactly 8 real attempts recorded across all games`, String(scores.length))
  const ledger = await db.rewardTransactions.findMany({ where: { buyerId: buyerRow.id, type: 'earn' } })
  const ledgerSum = ledger.reduce((sum, t) => sum + t.points, 0)
  ok(ledger.length === scores.filter((s) => s.pointsWon > 0).length, 'one ledger row per point-positive attempt (zeros write no ledger noise)', `ledger ${ledger.length} vs positive ${scores.filter((s) => s.pointsWon > 0).length}`)
  ok(ledgerSum === expectedEarned, 'ledger sum equals the score rows sum exactly', `${ledgerSum} vs ${expectedEarned}`)

  const loyalty = await buyer('GET', '/api/rewards/loyalty')
  ok(loyalty.status === 200 && loyalty.json?.data?.pointsBalance === expectedEarned, 'buyerRewards balance equals every point the games provably awarded (no double-count, no self-award)', `${loyalty.json?.data?.pointsBalance} vs ${expectedEarned}`)

  const hist = await buyer('GET', '/api/mini-games')
  ok(hist.json?.data?.recentScores?.length === 8, 'game history serves all 8 real attempts')
  ok(hist.json?.data?.usage?.wholesale_trivia === 3 && hist.json?.data?.usage?.memory_match === 3 && hist.json?.data?.usage?.box_picker === 2, 'usage mirrors the caps exactly (3/3/2)')
  const notifs = await db.notifications.count({ where: { userId: buyerRow.id, type: 'promotion' } })
  ok(notifs === scores.filter((s) => s.pointsWon > 0).length + crateWins, 'notifications fired for point wins and crate wins only', String(notifs))
}

console.log('─────────────────────────────────────────────────────────')
console.log(`t112 RESULT: ${PASS} PASS / ${FAIL} FAIL`)
process.exit(FAIL === 0 ? 0 : 1)
