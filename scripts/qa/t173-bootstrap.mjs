// t173 — one-time role + data bootstrap for the mass sweep (fresh DB).
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:3000'
const STAMP = process.env.T173_STAMP || String(Date.now())
const PW = 't173-Qa-Str0ng1!'
fs.writeFileSync('/tmp/t173-stamp.txt', STAMP)

function call(method, path, body, cookie = '') {
  const out = execSync(
    `curl -s -o /tmp/t173-res.json -w '%{http_code}' -X ${method} ${BASE}${path} -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.173.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}' ${cookie ? `-H 'Cookie: ${cookie}'` : ''} ${body ? `-d '${JSON.stringify(body).replace(/'/g, "'\\''")}'` : ''}`,
    { encoding: 'utf8' })
  let json = null
  try { json = JSON.parse(require('fs').readFileSync('/tmp/t173-res.json', 'utf8')) } catch {}
  return { status: Number(out), json }
}
function reg(userType, email) {
  for (let a = 0; a < 4; a++) {
    const r = call('POST', '/api/auth/register', { userType, authProvider: 'email', email, password: PW, fullName: 'T173 ' + userType })
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) break
    execSync('sleep 3')
  }
  return call('POST', '/api/auth/login', { email, password: PW }).status === 200
}
function loginCookie(email) {
  const out = execSync(`curl -s -i -X POST ${BASE}/api/auth/login -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.173.9.9' -d '{"email":"${email}","password":"${PW}"}'`, { encoding: 'utf8' })
  const m = out.match(/set-cookie: ([^;\r\n]+)/i)
  return m ? m[1] : ''
}

const admin = loginCookie(`t173-admin-${STAMP}@t173.test`) || (reg('admin', `t173-admin-${STAMP}@t173.test`) ? loginCookie(`t173-admin-${STAMP}@t173.test`) : '')
const buyer = loginCookie(`t173-buyer-${STAMP}@t173.test`) || (reg('buyer', `t173-buyer-${STAMP}@t173.test`) ? loginCookie(`t173-buyer-${STAMP}@t173.test`) : '')
const supp = loginCookie(`t173-supp-${STAMP}@t173.test`) || (reg('supplier', `t173-supp-${STAMP}@t173.test`) ? loginCookie(`t173-supp-${STAMP}@t173.test`) : '')
console.log('roles:', { admin: !!admin, buyer: !!buyer, supp: !!supp })

// category + 2 approved products + 1 order (so seller/buyer surfaces render real content)
let cat = call('GET', '/api/categories').json?.data?.find?.((c) => c.slug === 'garments')?.id
if (!cat) { call('POST', '/api/admin/categories', { name: 'Garments', isActive: true }, admin); cat = call('GET', '/api/categories').json?.data?.find?.((c) => c.slug === 'garments')?.id }
console.log('category:', !!cat)

const mk = (n, p) => call('POST', '/api/supplier/products', { name: n, description: 't173 sweep fixture', categoryId: cat, unit: 'pcs', moq: 10, basePrice: p, currency: 'BDT', stockQuantity: 500, priceTiers: [{ minQty: 10, pricePerUnit: p }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] }, supp)
mk('T173 Sweep Fabric A', 500)
mk('T173 Sweep Fabric B', 400)
const prods = call('GET', '/api/products?limit=2').json?.data?.items || []
const pid = prods[0]?.id
console.log('products:', prods.length, 'pid:', pid ? 'yes' : 'no')

if (pid) {
  const o = call('POST', '/api/orders', { items: [{ productId: pid, quantity: 10 }] }, buyer)
  console.log('order:', o.status)
}
console.log('BOOTSTRAP DONE')
