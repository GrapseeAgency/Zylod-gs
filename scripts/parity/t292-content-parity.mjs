// t292 — content-parity codemod: lift REAL per-page content from the web's
// typed React pages into the Kotlin curated metas (kills the 3-line generic
// filler class on every endpoint-less native page).
//
// For each ui/screens/*.kt meta with `endpoint: String? = null`:
//   pageId -> web component (page-chunks loader maps)
//   -> extract real headings / paragraphs / honest notices / navigate targets
//   -> rewrite `summary`, `bullets`, `related` with VERBATIM web text
//
// Safety: only string literals are rewritten (no structural Kotlin changes);
// `"` -> typographic quotes, `$` and backslashes stripped, length capped.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/home/z/my-project'
const SCREENS = path.join(ROOT, 'android/app/src/main/java/com/zylod/wholesale/ui/screens')
const PAGES = path.join(ROOT, 'src/components/pages')
const CHUNKS = path.join(ROOT, 'src/lib/page-chunks')

// ── 1. web loader map (pageId -> component file) ────────────────────────────
const loaderMap = {}
for (const f of fs.readdirSync(CHUNKS).filter((x) => x.startsWith('chunk-') && x.endsWith('.ts'))) {
  const src = fs.readFileSync(path.join(CHUNKS, f), 'utf8')
  for (const m of src.matchAll(/'([a-z0-9-]+)':\s*\(\)\s*=>\s*import\('@\/components\/pages\/([a-z0-9-]+)'\)/g)) {
    loaderMap[m[1]] = m[2]
  }
}

// ── 2. native registry ids (for related-link validation) ────────────────────
const registrySrc = fs.readFileSync(
  path.join(ROOT, 'android/app/src/main/java/com/zylod/wholesale/ui/nav/NativePageRegistry.kt'),
  'utf8',
)
const registryIds = new Set([...registrySrc.matchAll(/^\s*"([a-z0-9-]+)" to entry/gm)].map((m) => m[1]))

// ── 3. text extraction helpers ──────────────────────────────────────────────
const clean = (s) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[{`]/g, ' ')
    .replace(/\$\{/g, '')
    .replace(/[$\\]/g, '')
    .replace(/"/g, '”')
    .replace(/'/g, '’')
    .replace(/\s*—\s*/g, ' — ')
    .trim()

const clip = (s, n) => {
  s = clean(s)
  if (s.length <= n) return s
  const cut = s.slice(0, n)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:—-]+$/, '') + '…'
}

/** Extract real text content of a `.tsx` file body. */
function extractTextContent(src) {
  const out = []
  const headingRe = /<h[123][^>]*>([\s\S]*?)<\/h[123]>/g
  for (const m of src.matchAll(headingRe)) {
    const t = clean(m[1].replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' '))
    if (t.length >= 6 && t.length <= 90) out.push({ kind: 'h', text: t })
  }
  for (const m of src.matchAll(/<CardTitle[^>]*>([\s\S]*?)<\/CardTitle>/g)) {
    const t = clean(m[1].replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' '))
    if (t.length >= 6 && t.length <= 90) out.push({ kind: 'h', text: t })
  }
  for (const m of src.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = clean(m[1].replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' '))
    if (t.length >= 40) out.push({ kind: 'p', text: t })
  }
  return out
}

function extractNavigateTargets(src) {
  const ids = []
  for (const m of src.matchAll(/navigate\(\s*'([a-z0-9-]+)'/g)) ids.push(m[1])
  for (const m of src.matchAll(/navigate\(\s*"([a-z0-9-]+)"/g)) ids.push(m[1])
  return [...new Set(ids)].filter((id) => registryIds.has(id) && id !== 'home')
}

// ── 4. per-file rewrite ─────────────────────────────────────────────────────
const LABEL_OVERRIDES = { Po: 'PO', Rfq: 'RFQ', Kyc: 'KYC', Sms: 'SMS', Api: 'API', Qr: 'QR', Vat: 'VAT' }
const prettyId = (id) =>
  id
    .split('-')
    .map((w) => (LABEL_OVERRIDES[w] ? LABEL_OVERRIDES[w] : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')

const report = { updated: [], skipped: [], noWebPage: [] }
const files = fs.readdirSync(SCREENS).filter((f) => f.endsWith('Screen.kt'))

for (const file of files) {
  const ktPath = path.join(SCREENS, file)
  const kt = fs.readFileSync(ktPath, 'utf8')
  if (!kt.includes('endpoint: String? = null')) continue // live/typed pages stay
  if (!kt.includes('Curated native content') && !kt.includes('Live data renders from the Zylod API')) {
    report.skipped.push(file)
    continue
  }
  const pageIdM = kt.match(/override val pageId = "([a-z0-9-]+)"/)
  if (!pageIdM) {
    report.skipped.push(file)
    continue
  }
  const pageId = pageIdM[1]
  const component = loaderMap[pageId]
  let webSrc = null
  if (component) {
    const candidate = path.join(PAGES, `${component}.tsx`)
    if (fs.existsSync(candidate)) webSrc = fs.readFileSync(candidate, 'utf8')
  }
  if (!webSrc) {
    report.noWebPage.push(pageId)
    continue
  }

  const text = extractTextContent(webSrc)
  const navTargets = extractNavigateTargets(webSrc)
  if (text.length === 0) {
    report.noWebPage.push(pageId + ' (no extractable text)')
    continue
  }

  const honest = text.filter((t) =>
    /not available|does not (issue|support|offer)|no .{0,24}(yet|codes|open)|coming soon/i.test(t.text),
  )
  const headings = text.filter((t) => t.kind === 'h' && !honest.includes(t))
  const paras = text.filter((t) => t.kind === 'p' && !honest.includes(t))

  const bullets = []
  for (const h of honest.slice(0, 2)) bullets.push(clip(h.text, 190))
  for (const h of headings) {
    if (bullets.length >= 6) break
    const follow = paras.find((p) => p.text.length > 30)
    bullets.push(clip(h.text, 120))
    if (follow && bullets.length < 6) {
      bullets.push(clip(follow.text, 190))
      paras.splice(paras.indexOf(follow), 1)
    }
  }
  for (const p of paras) {
    if (bullets.length >= 6) break
    bullets.push(clip(p.text, 190))
  }
  if (bullets.length === 0) {
    report.noWebPage.push(pageId + ' (empty bullets)')
    continue
  }

  const summarySrc = paras[0]?.text || headings[0]?.text || honest[0]?.text
  const summary = clip(summarySrc || '', 240) || prettyId(pageId)

  const related = navTargets.filter((id) => id !== pageId).slice(0, 4)

  const newKt = rewriteMeta(kt, summary, bullets, related)
  if (newKt !== kt) {
    fs.writeFileSync(ktPath, newKt)
    report.updated.push(pageId)
  } else {
    report.skipped.push(file + ' (no-anchor)')
  }
}

function rewriteMeta(kt, summary, bullets, related) {
  let out = kt

  out = out.replace(/override val summary = "[\s\S]*?"\n/, `override val summary = "${summary}"\n`)

  const bulletStart = out.indexOf('override val bullets = listOf(')
  if (bulletStart >= 0) {
    const openIdx = bulletStart + 'override val bullets = listOf('.length
    let depth = 0
    let end = openIdx
    for (let i = openIdx; i < out.length; i++) {
      if (out[i] === '(') depth++
      else if (out[i] === ')') {
        if (depth === 0) {
          end = i
          break
        }
        depth--
      }
    }
    const body = bullets.map((b) => `        "${b}",`).join('\n')
    out = out.slice(0, bulletStart) + 'override val bullets = listOf(\n' + body + '\n    )' + out.slice(end + 1)
  }

  if (related.length > 0) {
    const relStart = out.indexOf('override val related = listOf(')
    if (relStart >= 0) {
      const openIdx = relStart + 'override val related = listOf('.length
      let depth = 0
      let end = openIdx
      for (let i = openIdx; i < out.length; i++) {
        if (out[i] === '(') depth++
        else if (out[i] === ')') {
          if (depth === 0) {
            end = i
            break
          }
          depth--
        }
      }
      const body = related.map((id) => `        NativePageLink("${id}", "${prettyId(id)}"),`).join('\n')
      out = out.slice(0, relStart) + 'override val related = listOf(\n' + body + '\n    )' + out.slice(end + 1)
    }
  }
  return out
}

fs.writeFileSync('/tmp/t292-parity-report.json', JSON.stringify(report, null, 1))
console.log('updated:', report.updated.length)
console.log('skipped:', report.skipped.length)
console.log('no-web-content:', report.noWebPage.length)
console.log('sample updated:', report.updated.slice(0, 12).join(', '))
