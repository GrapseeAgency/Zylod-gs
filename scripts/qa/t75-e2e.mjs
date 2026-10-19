/**
 * Task 75 E2E — SUPPORT THREADS get their responder.
 *
 * Doctrine under test:
 *   • The buyer support ticket system had a responder-less half: buyers
 *     threaded messages with THEMSELVES and rated answers nobody could give.
 *     Admins now see every thread (with the filer's identity), reply as
 *     senderType 'admin' (a real notification row goes to the buyer), and
 *     drive the status lifecycle with assignedTo set on first response.
 *   • No-leak: a buyer's PATCH/message on a stranger's ticket stays 404; a
 *     buyer's ticket LIST stays own-only while the admin's is global.
 *
 * Run: bun scripts/qa/t75-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
const failures = []
function ok(cond, label, extra) {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; failures.push(label + (extra ? ` — ${extra}` : '')); console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
function section(name) { console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.86.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  const call = async function call(method, path_, body) {
    const res = await fetch(`${BASE}${path_}`, {
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
    call.cookie = cookie
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
  }
  call.cookie = ''
  return call
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA75 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA75 Shop ${email.slice(5, 12)}` } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} -> ${login.status}`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

const main = async () => {
  const PASSWORD = 't75-Support-Qa1!'
  const admin = makeSession(), buyer = makeSession(), stranger = makeSession()
  await registerAndLogin(admin, 'admin', `qa75-admin@qa.local`, PASSWORD)
  await registerAndLogin(buyer, 'buyer', `qa75-buyer@qa.local`, PASSWORD)
  await registerAndLogin(stranger, 'buyer', `qa75-stranger@qa.local`, PASSWORD)
  ok(true, 'admin + buyer + stranger registered')

  section('A) buyer opens a ticket; admin SEES it (the responder half)')
  const t1 = await buyer('POST', '/api/support/tickets', {
    category: 'order_issue', subject: 'QA75 consignment stuck at hub',
    description: 'My wholesale consignment has been sitting at the Dhaka hub for nine days with no tracking updates at all.',
    priority: 'high',
  })
  ok(t1.status === 201, 'buyer creates a ticket')
  const ticketId = t1.json?.data?.id

  const adminList = await admin('GET', '/api/support/tickets')
  ok(adminList.status === 200 && (adminList.json?.data ?? []).some((t) => t.id === ticketId), 'admin ticket LIST includes the buyer thread')
  const seen = (adminList.json.data ?? []).find((t) => t.id === ticketId)
  ok(Boolean(seen?.user?.email), 'admin list carries the filer identity', seen?.user?.email)
  ok(seen?.priority === 'high' && seen?.status === 'open', 'priority + status render truthfully')

  const strangerList = await stranger('GET', '/api/support/tickets')
  ok((strangerList.json?.data ?? []).length === 0, "a buyer's list stays OWN-ONLY (no global leak)")

  section('B) admin replies — senderType admin + buyer notification + assignment')
  const reply = await admin('POST', `/api/support/tickets/${ticketId}/messages`, {
    message: 'QA75: we located the consignment — the hub scan was missed. Rescheduling dispatch today.',
  })
  ok(reply.status === 201, 'admin reply posted')
  const msgRow = await db.supportTicketMessages.findUnique({ where: { id: reply.json?.data?.id } })
  ok(msgRow?.senderType === 'admin', "message persisted with senderType 'admin'")

  const tAfter = await db.supportTickets.findUnique({ where: { id: ticketId } })
  ok(tAfter?.status === 'in_progress', 'ticket flipped to in_progress on the reply')
  ok(tAfter?.assignedTo !== null, 'assignedTo set to the responding admin')

  await sleep(300)
  const notifs = await buyer('GET', '/api/notifications?limit=50')
  const nRow = (notifs.json?.data ?? []).find((n) => /Support replied: QA75 consignment/.test(n.title ?? ''))
  ok(Boolean(nRow), 'buyer got the Support-replied notification row (bell + list)')
  ok(nRow?.relatedId === ticketId, 'notification carries the ticket deep-link id')

  const buyerView = await buyer('GET', `/api/support/tickets/${ticketId}`)
  const threadMsgs = buyerView.json?.data?.messages ?? []
  ok(threadMsgs.length === 1 && threadMsgs[0].senderType === 'admin', 'buyer sees the admin reply in their thread')

  section('C) lifecycle: buyer follows up, admin resolves, buyer rates')
  await buyer('POST', `/api/support/tickets/${ticketId}/messages`, { message: 'Thank you — tracking shows movement now.' })
  const resolved = await admin('PATCH', `/api/support/tickets/${ticketId}`, { status: 'resolved' })
  ok(resolved.status === 200 && resolved.json?.data?.status === 'resolved', 'admin resolves the thread')
  const rate = await buyer('POST', `/api/support/tickets/${ticketId}/rate`, { rating: 5, ratingComment: 'Fast, real answer' })
  ok(rate.status === 200, 'buyer rates the resolved thread')

  section('D) no-leak guards intact')
  const sPatch = await stranger('PATCH', `/api/support/tickets/${ticketId}`, { status: 'closed' })
  ok(sPatch.status === 404, "stranger's status change on someone else's ticket → 404 (no-leak)")
  const sMsg = await stranger('POST', `/api/support/tickets/${ticketId}/messages`, { message: 'injection attempt' })
  ok(sMsg.status === 404, "stranger's message into someone else's thread → 404")
  const sGet = await stranger('GET', `/api/support/tickets/${ticketId}`)
  ok(sGet.status === 404, "stranger's thread view → 404")
  const badStatus = await admin('PATCH', `/api/support/tickets/${ticketId}`, { status: 'make_it_broke' })
  ok(badStatus.status === 400, 'admin invalid status → 400 with the allowed list')

  section('E) DB audit')
  const msgCount = await db.supportTicketMessages.count({ where: { ticketId } })
  ok(msgCount === 2, 'exactly 2 thread messages (1 admin + 1 buyer)', `${msgCount}`)
  const final = await db.supportTickets.findUnique({ where: { id: ticketId } })
  ok(final?.status === 'resolved' && final?.rating === 5 && final?.assignedTo !== null, 'final truth: resolved, rated 5, assigned')

  console.log(`\n════════════════════════════════════════`)
  console.log(`PASS ${PASS}  FAIL ${FAIL}`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log(`  - ${f}`)
  }
  process.exitCode = FAIL ? 1 : 0
  await db.$disconnect()
}

main().catch(async (e) => { console.error('HARNESS CRASH:', e); process.exitCode = 1; await db.$disconnect() })
