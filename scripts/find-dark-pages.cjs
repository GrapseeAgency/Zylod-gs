#!/usr/bin/env node
/**
 * t181a detector: find HARDCODED always-dark designs in src/components/pages/
 * that ignore the theme (broken in light mode) — plus always-light cards
 * broken in dark mode and invisible text-white-on-light combos.
 */
const fs = require('fs')
const path = require('path')

const PAGES_DIR = path.join(__dirname, '..', 'src', 'components', 'pages')

// ---------- dark color vocabulary ----------
const DARK_HEXES = [
  '121212', '1A1A1A', '1E1E1E', '242424', '0F172A', '1C1C1E', '111827',
  '111111', '0A0A0A', '0D0D0D', '181818', '1F2937', '2C2C2C', '2E2E2E',
  '333333', '383838', '202020', '151515', '161616', '171717', '191919',
  '1B1B1B', '090909', '101010', '27272A',
]
const DARK_BG_TOKENS = new Set()
for (const h of DARK_HEXES) DARK_BG_TOKENS.add(`bg-[#${h}]`)
for (const c of ['slate-900', 'slate-950', 'gray-900', 'gray-950', 'zinc-900', 'zinc-950', 'neutral-900', 'neutral-950', 'stone-900', 'stone-950', 'black']) {
  DARK_BG_TOKENS.add(`bg-${c}`)
}
const DARK_GRAD_TOKENS = new Set()
for (const h of DARK_HEXES) {
  DARK_GRAD_TOKENS.add(`from-[#${h}]`)
  DARK_GRAD_TOKENS.add(`via-[#${h}]`)
  DARK_GRAD_TOKENS.add(`to-[#${h}]`)
}
for (const c of ['black', 'slate-900', 'slate-950', 'gray-900', 'gray-950']) {
  DARK_GRAD_TOKENS.add(`from-${c}`)
  DARK_GRAD_TOKENS.add(`via-${c}`)
  DARK_GRAD_TOKENS.add(`to-${c}`)
}

const LIGHT_BG_TOKENS = new Set([
  'bg-white', 'bg-slate-50', 'bg-slate-100', 'bg-gray-50', 'bg-gray-100',
  'bg-neutral-50', 'bg-neutral-100', 'bg-zinc-50', 'bg-zinc-100',
])
const BRAND_HEXES = ['8B0018', 'B30E26', 'C8102E', 'FF4D6D', 'A50034', 'D31F3C', 'E1251B', '9E1B32', 'C62828', 'D32F2F', 'B71C1C', 'AD1F23', 'E11D48', 'BE123C', 'DC2626', 'EF4444']

// ---------- helpers ----------
const hasBrand = (s) => BRAND_HEXES.some((h) => s.toUpperCase().includes(h)) || s.includes('bg-primary') || s.includes('text-primary')
const isOverlay = (s) =>
  /(from|via|to)-black\/\d/.test(s) ||                                  // from-black/90 via-black/40
  (/to-transparent/.test(s) && /(from|via)-black/.test(s)) ||            // fade-to-transparent scrim
  (/absolute/.test(s) && /^bg-black\/\d+$/.test(s.trim()))               // solid scrim on absolute element

function extractClassStrings(code) {
  const out = []
  // className="..."  /  foo="..." class attr
  const attrRe = /(?:className|class)=["']([^"']*)["']/g
  // template literals containing tailwind-ish tokens
  const tplRe = /`([^`]{1,600})`/g
  // plain string literals (ternary branches etc) with tailwind-ish tokens
  const strRe = /["']((?:[^"'\n]{1,400}))["']/g
  let m
  const push = (s, idx) => {
    const toks = s.split(/\s+/).filter(Boolean)
    if (toks.length >= 2 && toks.some((t) => /^(bg|text|border|from|via|to|ring|divide|placeholder|shadow|backdrop)-/.test(t))) {
      out.push({ str: s, idx })
    }
  }
  while ((m = attrRe.exec(code))) push(m[1], m.index)
  while ((m = tplRe.exec(code))) push(m[1], m.index)
  while ((m = strRe.exec(code))) push(m[1], m.index)
  return out
}

function analyze(str) {
  const tokens = str.split(/\s+/).filter(Boolean)
  const findings = []
  const hasDarkBgVariant = tokens.some((t) => /^dark:(bg|from|via|to)-/.test(t))

  for (const tok of tokens) {
    // token must be base or responsive-variant prefixed — NOT dark: prefixed
    const base = tok.replace(/^[a-z]+:/, '') // strips md: lg: dark: hover: etc
    const isDarkPrefixed = /^dark:/.test(tok)
    if (isDarkPrefixed) continue

    // 1/2: always-dark background (opaque)
    if (DARK_BG_TOKENS.has(base) && !base.includes('/')) {
      // bg-black badge/overlay on absolute image layer is intentional
      const overlayScrim = base === 'bg-black' && /absolute/.test(str) && /text-white/.test(str) && tokens.length <= 6
      if (!overlayScrim && !hasDarkBgVariant) {
        findings.push({ type: 'DARK-BG', token: tok })
      } else if (!overlayScrim && hasDarkBgVariant) {
        findings.push({ type: 'DARK-BG+darkvariant', token: tok })
      }
    }

    // 5: dark gradient stops (opaque)
    if (DARK_GRAD_TOKENS.has(base) && !base.includes('/')) {
      if (!isOverlay(str) && !hasBrand(str) && !hasDarkBgVariant) {
        findings.push({ type: 'DARK-GRAD', token: tok })
      }
    }
  }

  // 3: always-light bg with no dark: bg counterpart in the same string
  const hasOpaqueLight = tokens.some((t) => LIGHT_BG_TOKENS.has(t.replace(/^[a-z]+:(?!dark)/, '')) && !t.startsWith('dark:') && !t.includes('/'))
  if (hasOpaqueLight && !hasDarkBgVariant) {
    findings.push({ type: 'LIGHT-BG-NO-DARK', token: tokens.find((t) => LIGHT_BG_TOKENS.has(t)) })
  }

  // 4: text-white paired with light bg, no dark bg variant
  const hasTextWhite = tokens.some((t) => t === 'text-white')
  if (hasTextWhite && hasOpaqueLight && !hasDarkBgVariant) {
    findings.push({ type: 'TEXT-WHITE-ON-LIGHT', token: 'text-white' })
  }

  return findings
}

// ---------- main ----------
const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.tsx')).sort()
const report = []
const counts = {}

for (const file of files) {
  const code = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8')
  const lines = code.split('\n')
  const lineStarts = []
  { let acc = 0; for (const l of lines) { lineStarts.push(acc); acc += l.length + 1 } }
  const lineOf = (idx) => {
    let lo = 0, hi = lineStarts.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1 }
    return lo + 1
  }
  const seen = new Set()
  for (const { str, idx } of extractClassStrings(code)) {
    const key = `${lineOf(idx)}|${str}`
    if (seen.has(key)) continue
    seen.add(key)
    for (const f of analyze(str)) {
      counts[f.type] = (counts[f.type] || 0) + 1
      report.push({ file, line: lineOf(idx), type: f.type, token: f.token, str: str.replace(/\s+/g, ' ').slice(0, 220) })
    }
  }
}

// group by file
const byFile = {}
for (const r of report) (byFile[r.file] = byFile[r.file] || []).push(r)
const order = { 'DARK-BG': 0, 'DARK-BG+darkvariant': 1, 'DARK-GRAD': 2, 'LIGHT-BG-NO-DARK': 3, 'TEXT-WHITE-ON-LIGHT': 4 }
for (const file of Object.keys(byFile).sort()) {
  console.log(`\n### ${file}`)
  for (const r of byFile[file].sort((a, b) => order[a.type] - order[b.type] || a.line - b.line)) {
    console.log(`  L${r.line} [${r.type}] ${r.token}`)
    console.log(`       | ${r.str}`)
  }
}
console.log('\n=== COUNTS ===', JSON.stringify(counts))
console.log('FILES AFFECTED:', Object.keys(byFile).length, '/', files.length)
