#!/usr/bin/env node
/**
 * find-dark-in-light.cjs — the INVERSE of find-theme-leaks.cjs
 * Hunts the flash-deals bug class: className strings containing a DARK
 * background token with NO `dark:` prefix — meaning the element renders
 * dark in BOTH themes (a black bar/body under a white header in light mode).
 *
 * Flagged dark bg tokens:
 *   - bg-slate-900/800/700, bg-gray-900/800/700, bg-zinc-*, bg-neutral-*, bg-stone-*
 *   - bg-black, bg-[#RRGGBB] (and /opacity variants) with rel-luminance < 0.25
 *   - bg-gradient-to-* where EVERY from/via/to stop is dark (no dark: variant)
 *
 * Secondary check (flag, lower priority):
 *   - text-white with no dark: and no colored bg in the SAME string
 *     (risk: invisible white-on-white in light mode)
 *
 * Known-intentional patterns are skipped:
 *   - strings containing dark: (theme-aware already)
 *   - bg-black on video/camera containers (from-black gradients, camera viewfinder)
 */
const fs = require('fs')
const path = require('path')

const DARK_BG_TOKENS = [
  'bg-slate-900', 'bg-slate-800', 'bg-slate-700',
  'bg-gray-900', 'bg-gray-800', 'bg-gray-700',
  'bg-zinc-900', 'bg-zinc-800', 'bg-zinc-700',
  'bg-neutral-900', 'bg-neutral-800', 'bg-neutral-700',
  'bg-stone-900', 'bg-stone-800', 'bg-stone-700',
]

function hexLuma(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6)
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const COLORED_BG = /bg-(primary|secondary|destructive|red|rose|amber|orange|emerald|green|yellow|pink|purple|fuchsia)\b/

function scanDarkBg(cls) {
  // string already has a dark: variant somewhere → theme-aware, skip
  if (/dark:/.test(cls)) return null
  for (const tok of DARK_BG_TOKENS) {
    if (new RegExp(`\\b${tok}\\b`).test(cls)) return tok
  }
  if (/\bbg-black\b/.test(cls)) {
    // intentional pure-black backdrops: video, camera, image overlay
    if (/from-black|video|camera|viewfinder|qr|barcode|poster/i.test(cls)) return null
    return 'bg-black'
  }
  // arbitrary hex bg — check luminance
  const hexM = cls.match(/bg-\[(#[0-9a-fA-F]{3,8})(?:\/\d+)?\]/)
  if (hexM && hexLuma(hexM[1]) < 0.25) {
    if (/from-|video|camera|viewfinder|qr|barcode|poster|mask/i.test(cls)) return null
    return `bg-[${hexM[1]}]`
  }
  // gradient where all stops are dark hexes and no dark: variant
  const grad = cls.match(/bg-gradient-to-\w+[^"']*/)
  if (grad) {
    const g = grad[0]
    if (/dark:/.test(g)) return null
    const stops = [...g.matchAll(/(?:from|via|to)-(\[#[0-9a-fA-F]{3,8}\])/g)].map(m => m[1])
    if (stops.length > 0 && stops.every(s => hexLuma(s) < 0.25)) return 'dark-gradient'
    if (/from-black|to-black|from-gray-900|to-gray-900|from-slate-900|to-slate-900/.test(g) && !/via-white/.test(g)) {
      if (!/video|camera|poster/i.test(cls)) return 'dark-gradient-token'
    }
  }
  return null
}

function scanWhiteText(cls) {
  if (/dark:/.test(cls)) return false
  if (COLORED_BG.test(cls)) return false
  if (/bg-\[#([0-9a-fA-F]{3,8})/.test(cls)) {
    const hexM = cls.match(/bg-\[(#[0-9a-fA-F]{3,8})(?:\/\d+)?\]/)
    if (hexM && hexLuma(hexM[1]) < 0.25) return false // white text on dark bg = fine
  }
  return /\btext-white\b/.test(cls)
}

function walk(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && !full.includes('/ui/') && entry.name !== 'node_modules') out.push(...walk(full))
    else if (entry.name.endsWith('.tsx') && !full.includes('/ui/')) out.push(full)
  }
  return out
}

const roots = [
  path.join(__dirname, '..', 'src', 'components'),
  path.join(__dirname, '..', 'src', 'app'),
]

let darkCount = 0, whiteTextCount = 0
const byDir = {}
for (const root of roots) {
  for (const f of walk(root)) {
    const content = fs.readFileSync(f, 'utf8')
    const lines = content.split('\n')
    let fileDark = 0, fileWhite = 0
    const hits = []
    lines.forEach((line, i) => {
      // capture className="..." / className={`...`} / '...' strings containing class-like content
      const strRegex = /["'`]([^"'`\n]*\b(?:bg-|text-white\b)[^"'`\n]*)["'`]/g
      let m
      while ((m = strRegex.exec(line)) !== null) {
        const cls = m[1]
        if (!/bg-|text-white/.test(cls)) continue
        const dark = scanDarkBg(cls)
        if (dark) { fileDark++; hits.push(`  L${i + 1} DARKBG ${dark}  ::  ${cls.trim().slice(0, 110)}`) }
        else if (scanWhiteText(cls)) { fileWhite++; hits.push(`  L${i + 1} WHITETXT        ::  ${cls.trim().slice(0, 110)}`) }
      }
    })
    if (fileDark + fileWhite > 0) {
      darkCount += fileDark; whiteTextCount += fileWhite
      const rel = f.replace(/.*src\//, '')
      const dir = path.dirname(rel)
      byDir[dir] = (byDir[dir] || 0) + fileDark + fileWhite
      console.log(`\n${rel}  (${fileDark} darkbg, ${fileWhite} whitetext)`)
      hits.forEach(h => console.log(h))
    }
  }
}
console.log(`\n=== TOTAL: ${darkCount} dark-bg-no-light-counterpart, ${whiteTextCount} white-text-no-colored-bg ===`)
console.log('\nBy directory:')
for (const [d, c] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log(`  ${c}  ${d}`)
