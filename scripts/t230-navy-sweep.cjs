#!/usr/bin/env node
/**
 * t230 — Navy→Black theme sweep.
 *
 * Owner complaint: "some of the pages and overlays have NAVY BLUE backgrounds
 * instead of the black theme". Root cause: the dark theme tokens are pure
 * black (#121212 / #1E1E1E card / #C8102E red), but ~200 page components were
 * written with Tailwind's `slate` family for dark-mode surfaces. Slate is a
 * BLUE-GRAY scale (slate-900 = #0f172a — literally navy), so every
 * `dark:bg-slate-900`, `dark:from-slate-800`, `dark:border-slate-800` surface
 * reads as a navy island inside the black theme.
 *
 * Fix: map the slate scale onto the `neutral` scale (same numbers, pure gray:
 * neutral-900 = #171717) for EVERY `dark:` variant, plus the always-dark bare
 * shades (slate-750/780/800/850/900/950) that appear without a dark: prefix
 * (video placeholders, overlay chips, code blocks). Light-mode slate-100..700
 * without dark: stays — cool grays on white are intentional and unreadable
 * complaints were dark-mode only.
 *
 * Idempotent; skips .git, node_modules, quarantine, tool-results.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src')

let filesChanged = 0
let replacements = 0

// 1) any `dark:<utility>-slate-<n>` → `dark:<utility>-neutral-<n>`
//    (utility letters covered: bg, from, via, to, border, text, divide, ring,
//     placeholder, decoration, outline, accent, caret, fill, stroke, shadow)
const DARK_SLATE = /(\bdark:[a-zA-Z-]*?-?)slate-(\d{2,3})/g

// 2) bare always-dark shades for surface utilities (bg/from/via/to/border/
//    divide/ring) — 750+ only. These render navy in BOTH modes but are used
//    as "dark surface" accents (video masks, overlay chips, code blocks).
const BARE_DARK_BG = /(\b(?:bg|from|via|to|border|divide|ring)-)slate-(7[5-9]0|8[0-9]0|9[0-9]0)\b/g

function sweepFile(fp) {
  const original = fs.readFileSync(fp, 'utf8')
  let out = original.replace(DARK_SLATE, (_m, prefix, num) => {
    replacements++
    return `${prefix}neutral-${num}`
  })
  out = out.replace(BARE_DARK_BG, (_m, prefix, num) => {
    replacements++
    return `${prefix}neutral-${num}`
  })
  if (out !== original) {
    fs.writeFileSync(fp, out)
    filesChanged++
    return 1
  }
  return 0
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(fp)
    else if (/\.(tsx|ts)$/.test(entry.name)) sweepFile(fp)
  }
}

walk(SRC)
console.log(`[t230 navy-sweep] files changed: ${filesChanged}, replacements: ${replacements}`)
