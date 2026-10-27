// t173 — finish bootstrap: 2 approved products + 1 buyer order (category exists).
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:3000'
const STAMP = fs.readFileSync('/tmp/t173-stamp.txt', 'utf8').trim()
const PW = 't173-Qa-Str0ng1!'
const ip = () => `10.173.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
function loginCookie(email) {
  const out = execSync(`curl -s -i -X POST ${BASE}/api/auth/login -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.173.9.9' -d '{"email":"${email}","password":"${PW}"}'`, { encoding: 'utf8' })
  return (out.match(/set-cookie: ([^;\r\n]+)/i) || [])[1] || ''
}
function call(method, path, body, cookie = '') {
  const code = execSync(
    `curl -s -o /tmp/t173-res.json -w '%{http_code}' -X ${method} ${BASE}${path} -H 'Content-Type: application/json' -H 'X-Forwarded-For: ${ip()}' ${cookie ? `-H 'Cookie: ${cookie}'` : ''} ${body ? `-d '${JSON.stringify(body).replace(/'/g, "'\\''")}'` : ''}`,
    { encoding: 'utf8' })
  let json = null
  try { json = JSON.parse(fs.readFileSync('/tmp/t173-res.json', 'utf8')) } catch {}
  return { status: Number(code), json }
}

const supp = loginCookie(`t173-supp-${STAMP}@t173.test`)
const buyer = loginCookie(`t173-buyer-${STAMP}@t173.test`)
const admin = loginCookie(`t173-admin-${STAMP}@t173.test`)
const cat = (call('GET', '/api/categories').json?.data || []).find((c) => c.slug === 'garments')?.id
console.log('supp:', !!supp, 'buyer:', !!buyer, 'admin:', !!admin, 'cat:', !!cat)

const ids = []
for (const [n, p] of [['T173 Sweep Fabric A', 500], ['T173 Sweep Fabric B', 400]]) {
  const r = call('POST', '/api/supplier/products', { name: n, description: 't173 sweep fixture', categoryId: cat, unit: 'pcs', moq: 10, basePrice: p, currency: 'BDT', stockQuantity: 500, priceTiers: [{ minQty: 10, pricePerUnit: p }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] }, supp)
  const id = r.json?.data?.id ?? r.json?.id
  if (id) { call('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'T173' }, admin); ids.push(id) }
  console.log('product', n, r.status, 'approved:', !!id)
}
const prods = call('GET', '/api/products?limit=4').json?.data?.items || call('GET', '/api/products?limit=4').json?.data || []
console.log('catalog:', prods.length)
if (prods[0]?.id) console.log('order:', call('POST', '/api/orders', { items: [{ productId: prods[0].id, quantity: 10 }] }, buyer).status)
console.log('DONE')
