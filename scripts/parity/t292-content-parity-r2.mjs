// t292-r2 — content-parity round 2:
//  1. fixes the round-1 summary bug (paragraphs were consumed by bullet
//     building before the summary was computed)
//  2. adds INFO_CONFIGS coverage (web generic-info pages) for ids the typed
//     loader map does not cover
//  3. adds list-item + prose-string extraction for data-driven pages whose
//     copy lives in JSX expressions / string literals
//  4. strips markdown artifacts (** `), dedupes bullets against the summary
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/home/z/my-project'
const SCREENS = path.join(ROOT, 'android/app/src/main/java/com/zylod/wholesale/ui/screens')
const PAGES = path.join(ROOT, 'src/components/pages')
const CHUNKS = path.join(ROOT, 'src/lib/page-chunks')
const INFO_PAGE = path.join(ROOT, 'src/components/pages/generic-info-page.tsx')

// ── web loader map ──────────────────────────────────────────────────────────
const loaderMap = {}
for (const f of fs.readdirSync(CHUNKS).filter((x) => x.startsWith('chunk-') && x.endsWith('.ts'))) {
  const src = fs.readFileSync(path.join(CHUNKS, f), 'utf8')
  for (const m of src.matchAll(/'([a-z0-9-]+)':\s*\(\)\s*=>\s*import\('@\/components\/pages\/([a-z0-9-]+)'\)/g)) {
    loaderMap[m[1]] = m[2]
  }
}

// ── INFO_CONFIGS parse (generic-info-page.tsx) ─────────────────────────────
const infoConfigs = {}
{
  const src = fs.readFileSync(INFO_PAGE, 'utf8')
  const mapStart = src.indexOf("'terms': {")
  // brute-force: scan for `'id': {` starts after the interface definitions
  const starts = []
  for (const m of src.matchAll(/(?:^|\n)\s{2}'([a-z0-9-]+)': \{/g)) {
    starts.push({ id: m[1], idx: m.index + m[0].length - 1 })
  }
  for (let i = 0; i < starts.length; i++) {
    const { id, idx } = starts[i]
    const end = i + 1 < starts.length ? starts[i + 1].idx : src.length
    const body = src.slice(idx, end)
    if (body.length > 6000) continue // not an info entry (stray match)
    const name = body.match(/name: ['"`]([^'"`]+)['"`]/)
    const description = body.match(/description: ['"`]([^'"`]+)['"`]/)
    const sections = []
    for (const s of body.matchAll(/title: ['"`]([^'"`]+)['"`],\s*\n\s*content: ([^,]+?),\s*\n/g)) {
      sections.push({ title: s[1], content: s[2] })
    }
    const quickLinks = []
    for (const q of body.matchAll(/label: ['"`]([^'"`]+)['"`], pageId: ['"`]([a-z0-9-]+)['"`]/g)) {
      quickLinks.push({ label: q[1], pageId: q[2] })
    }
    const special = body.match(/specialType: ['"`]([a-z-]+)['"`]/)
    if (name || description) {
      infoConfigs[id] = {
        name: name?.[1] || id,
        description: description?.[1] || '',
        sections,
        quickLinks,
        specialType: special?.[1] || null,
      }
    }
  }
}

// ── native registry ids ────────────────────────────────────────────────────
const registrySrc = fs.readFileSync(
  path.join(ROOT, 'android/app/src/main/java/com/zylod/wholesale/ui/nav/NativePageRegistry.kt'),
  'utf8',
)
const registryIds = new Set([...registrySrc.matchAll(/^\s*"([a-z0-9-]+)" to entry/gm)].map((m) => m[1]))

// ── extraction ─────────────────────────────────────────────────────────────
const clean = (s) =>
  s
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\$\{[^}]*\}/g, '')
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

function extractFromWeb(src) {
  const honest = []
  const headings = []
  const paras = []
  const items = []
  const push = (arr, t) => {
    const c = clean(t)
    if (c.length) arr.push(c)
  }
  for (const m of src.matchAll(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/g)) {
    const t = m[1].replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ')
    const c = clean(t)
    if (c.length >= 6 && c.length <= 90) headings.push(c)
  }
  for (const m of src.matchAll(/<CardTitle[^>]*>([\s\S]*?)<\/CardTitle>/g)) {
    const c = clean(m[1].replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' '))
    if (c.length >= 6 && c.length <= 90) headings.push(c)
  }
  for (const m of src.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = m[1].replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ')
    const c = clean(t)
    if (c.length >= 40) paras.push(c)
  }
  for (const m of src.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
    const t = m[1].replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ')
    const c = clean(t)
    if (c.length >= 25 && c.length <= 190) items.push(c)
  }
  for (const t of [...headings, ...paras, ...items]) {
    if (/not available|does not (issue|support|offer)|coming soon|did not come from/i.test(t)) honest.push(t)
  }
  return { honest, headings, paras, items }
}

/** Prose string literals (supplement — for copy that lives in expressions). */
function extractProseStrings(src) {
  const out = []
  const body = src.replace(/^import[\s\S]*?from ['"][^'"]+['"]$/gm, '')
  for (const m of body.matchAll(/['"`]([^'"`\n]{40,190})['"`]/g)) {
    const t = clean(m[1])
    if (t.length < 40) continue
    if (!t.includes(' ')) continue
    if (/[=:{<>]|className|href|api\//.test(t)) continue
    if (!/^[A-Z]/.test(t) && !/ yet$|here|your |Zylod/.test(t)) continue
    out.push(t)
  }
  return [...new Set(out)].slice(0, 8)
}

function extractNavigateTargets(src) {
  const ids = []
  for (const m of src.matchAll(/navigate\(\s*['"`]([a-z0-9-]+)['"`]/g)) ids.push(m[1])
  return [...new Set(ids)].filter((id) => registryIds.has(id) && id !== 'home')
}

const LABEL_OVERRIDES = { Po: 'PO', Rfq: 'RFQ', Kyc: 'KYC', Sms: 'SMS', Api: 'API', Qr: 'QR', Vat: 'VAT' }
const prettyId = (id) =>
  id
    .split('-')
    .map((w) => (LABEL_OVERRIDES[w] ? LABEL_OVERRIDES[w] : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')

// ── Kotlin meta rewriting ──────────────────────────────────────────────────
function replaceListBlock(kt, anchor, body) {
  const start = kt.indexOf(anchor)
  if (start < 0) return kt
  const openIdx = start + anchor.length
  let depth = 0
  let end = openIdx
  for (let i = openIdx; i < kt.length; i++) {
    if (kt[i] === '(') depth++
    else if (kt[i] === ')') {
      if (depth === 0) {
        end = i
        break
      }
      depth--
    }
  }
  return kt.slice(0, start) + anchor + '\n' + body + '\n    )' + kt.slice(end + 1)
}

function rewriteMeta(kt, summary, bullets, related) {
  let out = kt
  if (summary) {
    out = out.replace(/override val summary = "[\s\S]*?"\n/, `override val summary = "${summary}"\n`)
  }
  const bulletBody = bullets.map((b) => `        "${b}",`).join('\n')
  out = replaceListBlock(out, 'override val bullets = listOf(', bulletBody)
  if (related.length > 0) {
    const relBody = related.map((id) => `        NativePageLink("${id}", "${prettyId(id)}"),`).join('\n')
    out = replaceListBlock(out, 'override val related = listOf(', relBody)
  }
  return out
}

// ── main ───────────────────────────────────────────────────────────────────
const report = { updated: [], summaryFixed: [], stillFiller: [], skipped: [] }
const files = fs.readdirSync(SCREENS).filter((f) => f.endsWith('Screen.kt'))
const FILLER1 = 'Curated native content — no fabricated server data, ever.'
const FILLER2 = 'Live data renders from the Zylod API when an endpoint feeds this page.'

for (const file of files) {
  const ktPath = path.join(SCREENS, file)
  const kt0 = fs.readFileSync(ktPath, 'utf8')
  if (!kt0.includes('endpoint: String? = null')) continue
  const pageIdM = kt0.match(/override val pageId = "([a-z0-9-]+)"/)
  if (!pageIdM) continue
  const pageId = pageIdM[1]
  const isFiller = kt0.includes(FILLER1) || kt0.includes(FILLER2)

  let summary = null
  let bullets = []
  let related = []

  const component = loaderMap[pageId]
  const webPath = component ? path.join(PAGES, `${component}.tsx`) : null
  const webSrc = webPath && fs.existsSync(webPath) ? fs.readFileSync(webPath, 'utf8') : null

  if (webSrc) {
    const { honest, headings, paras, items } = extractFromWeb(webSrc)
    related = extractNavigateTargets(webSrc).filter((id) => id !== pageId).slice(0, 4)
    const prose = paras.length + headings.length < 2 ? extractProseStrings(webSrc) : []

    const unique = (arr) => [...new Set(arr)]
    const summaryCand =
      paras.find((p) => p.length >= 70 && p.length <= 240) ||
      paras[0] ||
      headings.find((h) => h.length >= 25) ||
      honest[0] ||
      prose[0] ||
      null
    summary = summaryCand ? clip(summaryCand, 240) : null

    const b = []
    for (const h of unique(honest).slice(0, 1)) b.push(clip(h, 190))
    const paraPool = unique(paras).filter((p) => p !== summary)
    const headPool = unique(headings).filter((h) => h !== summary && h.length >= 8)
    for (const h of headPool) {
      if (b.length >= 6) break
      b.push(clip(h, 120))
      const follow = paraPool.shift()
      if (follow && b.length < 6) b.push(clip(follow, 190))
    }
    for (const p of paraPool) {
      if (b.length >= 6) break
      b.push(clip(p, 190))
    }
    for (const it of unique(items)) {
      if (b.length >= 6) break
      b.push(clip(it, 190))
    }
    for (const pr of prose) {
      if (b.length >= 6) break
      b.push(clip(pr, 190))
    }
    bullets = unique(b).filter((x) => x !== summary).slice(0, 6)
  } else if (infoConfigs[pageId]) {
    const cfg = infoConfigs[pageId]
    summary = clip(cfg.description || cfg.name, 240)
    bullets = []
    if (cfg.description && cfg.description !== summary) bullets.push(clip(cfg.description, 190))
    for (const s of cfg.sections) {
      if (bullets.length >= 6) break
      const content = clean(s.content.replace(/^["'`]|["'`]$/g, '').replace(/^\(supportEmail\) => .*?['"`]([^'"`]+)['"`]\s*\)?$/, '$1'))
      if (content.length >= 25) bullets.push(clip(`${s.title}: ${content}`, 190))
      else bullets.push(clip(s.title, 120))
    }
    related = cfg.quickLinks.map((q) => q.pageId).filter((id) => registryIds.has(id)).slice(0, 4)
  }

  if (bullets.length === 0) {
    if (isFiller) report.stillFiller.push(pageId)
    continue
  }

  const kt1 = rewriteMeta(kt0, summary, bullets, related)
  if (kt1 !== kt0) {
    fs.writeFileSync(ktPath, kt1)
    report.updated.push(pageId)
    if (!isFiller) report.summaryFixed.push(pageId)
  } else {
    report.skipped.push(pageId)
  }
}

fs.writeFileSync('/tmp/t292-r2-report.json', JSON.stringify(report, null, 1))
console.log('updated:', report.updated.length)
console.log('  of which summary-only fixes on r1 content:', report.summaryFixed.length)
console.log('still filler (no content source):', report.stillFiller.length, '->', report.stillFiller.slice(0, 20).join(', '))
console.log('skipped:', report.skipped.length)
