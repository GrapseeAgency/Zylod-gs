#!/usr/bin/env node
/** t181a money/hero gradient card themer.
 *  For each listed file: finds the dark gradient card container, computes its
 *  <div> nesting extent, then rewrites the container to a light/dark gradient
 *  and re-maps inner always-dark/white tokens to theme-aware pairs (scoped to
 *  the card block only). */
const fs = require('fs')
const path = require('path')
const PAGES = '/home/z/my-project/src/components/pages'

// container gradient fixes (applied to the container line)
const CONTAINER_MAPS = [
  [/from-slate-900 to-rose-950/g, 'from-slate-100 to-rose-100 dark:from-slate-900 dark:to-rose-950'],
  [/from-slate-950 via-slate-900 to-rose-950/g, 'from-slate-200 via-slate-100 to-rose-100 dark:from-slate-950 dark:via-slate-900 dark:to-rose-950'],
  [/from-slate-900 via-rose-950 to-slate-900/g, 'from-slate-100 via-rose-100 to-slate-100 dark:from-slate-900 dark:via-rose-950 dark:to-slate-900'],
  [/from-slate-900 via-rose-950 to-slate-950/g, 'from-slate-100 via-rose-100 to-slate-200 dark:from-slate-900 dark:via-rose-950 dark:to-slate-950'],
  [/from-slate-900 via-slate-800 to-rose-950/g, 'from-slate-200 via-slate-300 to-rose-200 dark:from-slate-900 dark:via-slate-800 dark:to-rose-950'],
  [/from-slate-900 to-slate-800/g, 'from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800'],
  [/from-slate-900 via-slate-800 to-slate-900/g, 'from-slate-100 via-slate-200 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900'],
  [/from-slate-900 via-slate-900 to-slate-900/g, 'from-slate-100 via-slate-100 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900'],
  [/from-slate-900 to-amber-950/g, 'from-slate-100 to-amber-100 dark:from-slate-900 dark:to-amber-950'],
  [/from-slate-900 to-slate-900/g, 'from-slate-100 to-slate-100 dark:from-slate-900 dark:to-slate-900'],
]

// inner token maps (regex, guarded so dark:/hover: prefixed tokens are untouched)
const INNER_MAPS = [
  [/text-slate-400 dark:text-slate-500/g, 'text-slate-500 dark:text-slate-400'],
  [/text-slate-400 dark:text-slate-500 dark:text-slate-400/g, 'text-slate-500 dark:text-slate-400'],
  [/text-slate-500 dark:text-slate-400 dark:text-slate-400/g, 'text-slate-500 dark:text-slate-400'],
  [/(?<![a-z-]:)hover:text-white(?=[\s"'\`]|$)/g, 'hover:text-gray-900 dark:hover:text-white'],
  [/bg-white dark:bg-gray-900\/5/g, 'bg-black/5 dark:bg-gray-900/5'],
  [/(?<![a-z-]:)border-white\/5(?=[\s"'\`]|$)/g, 'border-black/5 dark:border-white/5'],
  [/(?<![a-z-]:)text-sky-300(?=[\s"'\`]|$)/g, 'text-sky-600 dark:text-sky-300'],
  [/(?<![a-z-]:)text-white(?=[\s"'\`]|$)/g, 'text-gray-900 dark:text-white'],
  [/(?<![a-z-]:)text-white\/80(?=[\s"'\`]|$)/g, 'text-gray-700 dark:text-white/80'],
  [/(?<![a-z-]:)text-white\/70(?=[\s"'\`]|$)/g, 'text-gray-600 dark:text-white/70'],
  [/(?<![a-z-]:)text-white\/60(?=[\s"'\`]|$)/g, 'text-gray-500 dark:text-white/60'],
  [/(?<![a-z-]:)text-rose-300(?=[\s"'\`]|$)/g, 'text-rose-600 dark:text-rose-300'],
  [/(?<![a-z-]:)text-rose-200(?=[\s"'\`]|$)/g, 'text-rose-700 dark:text-rose-200'],
  [/(?<![a-z-]:)text-rose-100\/80(?=[\s"'\`]|$)/g, 'text-rose-700 dark:text-rose-100/80'],
  [/(?<![a-z-]:)text-rose-100(?=[\s"'\`]|$)/g, 'text-rose-700 dark:text-rose-100'],
  [/(?<![a-z-]:)text-slate-300(?=[\s"'\`]|$)/g, 'text-slate-600 dark:text-slate-300'],
  [/(?<![a-z-]:)text-slate-400(?=[\s"'\`]|$)/g, 'text-slate-500 dark:text-slate-400'],
  [/(?<![a-z-]:)text-slate-100(?=[\s"'\`]|$)/g, 'text-slate-800 dark:text-slate-100'],
  [/(?<![a-z-]:)text-slate-200(?=[\s"'\`]|$)/g, 'text-slate-700 dark:text-slate-200'],
  [/(?<![a-z-]:)text-amber-300(?=[\s"'\`]|$)/g, 'text-amber-600 dark:text-amber-300'],
  [/(?<![a-z-]:)text-amber-400(?=[\s"'\`]|$)/g, 'text-amber-600 dark:text-amber-400'],
  [/(?<![a-z-]:)text-emerald-300(?=[\s"'\`]|$)/g, 'text-emerald-600 dark:text-emerald-300'],
  [/(?<![a-z-]:)text-red-300(?=[\s"'\`]|$)/g, 'text-red-600 dark:text-red-300'],
  [/(?<![a-z-]:)text-red-400(?=[\s"'\`]|$)/g, 'text-red-600 dark:text-red-400'],
  [/(?<![a-z-]:)bg-white\/10(?=[\s"'\`]|$)/g, 'bg-black/5 dark:bg-white/10'],
  [/(?<![a-z-]:)bg-white\/15(?=[\s"'\`]|$)/g, 'bg-black/10 dark:bg-white/15'],
  [/(?<![a-z-]:)bg-white\/20(?=[\s"'\`]|$)/g, 'bg-black/10 dark:bg-white/20'],
  [/bg-white dark:bg-gray-900\/10/g, 'bg-black/5 dark:bg-gray-900/10'],
  [/(?<![a-z-]:)border-white\/10(?=[\s"'\`]|$)/g, 'border-black/10 dark:border-white/10'],
  [/(?<![a-z-]:)border-white\/20(?=[\s"'\`]|$)/g, 'border-black/10 dark:border-white/20'],
  [/(?<![a-z-]:)border-white\/30(?=[\s"'\`]|$)/g, 'border-black/10 dark:border-white/30'],
  [/(?<![a-z-]:)divide-white\/10(?=[\s"'\`]|$)/g, 'divide-black/10 dark:divide-white/10'],
]

const files = process.argv.slice(2)
const MAX_CARD_LINES = 80
const COVER_WINDOW = 24

// cover banners: overlay chips (bg-black/40 + text-white) stay as-is (readable on any gradient);
// only the inner placeholder surface gets themed
const COVER_INNER_MAPS = [
  [/(?<![a-z-]:)bg-slate-800(?=[\s"'\`]|$)/g, 'bg-slate-200 dark:bg-slate-800'],
]

for (const file of files) {
  const full = path.join(PAGES, file)
  let lines = fs.readFileSync(full, 'utf8').split('\n')
  let containersFixed = 0, innerFixed = 0, warnings = []
  // find container lines (gradient + text-white card, or cover banner)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isCard = /from-slate-9\d\d/.test(line) && /text-white/.test(line) && !/aspect-video/.test(line)
    const isCover = /from-slate-9\d\d/.test(line) && !/text-white/.test(line) && /h-\d+|aspect/.test(line)
    if (!isCard && !isCover) continue

    // container fix
    let newline = line
    for (const [re, rep] of CONTAINER_MAPS) newline = newline.replace(re, rep)
    if (isCard) newline = newline.replace(/(?<![a-z-]:)text-white(?=[\s"'\`]|$)/, 'text-gray-900 dark:text-white')
    if (newline !== line) { lines[i] = newline; containersFixed++ }

    // compute block extent via div nesting depth (only for cards; covers: fixed window)
    let end = i
    let maps = INNER_MAPS
    if (isCard) {
      let depth = 1
      for (let j = i; j < Math.min(lines.length, i + MAX_CARD_LINES) && depth > 0; j++) {
        if (j > i) {
          const opens = (lines[j].match(/<div[\s>]/g) || []).length
          const selfCloses = (lines[j].match(/<div[^>]*\/>/g) || []).length
          const closes = (lines[j].match(/<\/div>/g) || []).length
          depth += opens - selfCloses - closes
        } else {
          // container line itself: it opened the div; if self-closing, block is just this line
          const selfCloses = (lines[j].match(/<div[^>]*\/>/g) || []).length
          const opens = (lines[j].match(/<div[\s>]/g) || []).length
          const closes = (lines[j].match(/<\/div>/g) || []).length
          depth += opens - selfCloses - closes - 1
        }
        end = j
        if (depth <= 0) break
      }
      if (depth > 0) { warnings.push(`L${i + 1}: card block did not close within ${MAX_CARD_LINES} lines — inner maps skipped`); end = i }
    } else {
      end = Math.min(i + COVER_WINDOW, lines.length - 1)
      maps = COVER_INNER_MAPS
    }

    // inner token maps scoped to block (skip container line for text-white already done)
    for (let j = i + 1; j <= Math.min(end, lines.length - 1); j++) {
      let l = lines[j]
      // lines with dark overlay chips (bg-black/xx, backdrop-blur) keep white text in both modes
      const hasOverlay = /bg-black\/|backdrop-blur/.test(l)
      for (const [re, rep] of maps) {
        if (hasOverlay && /text-white|hover:text-white/.test(rep)) continue
        l = l.replace(re, rep)
      }
      if (l !== lines[j]) { lines[j] = l; innerFixed++ }
    }
    i = end // continue scanning after the block
  }
  fs.writeFileSync(full, lines.join('\n'))
  console.log(`${file}: containers=${containersFixed} innerLines=${innerFixed}${warnings.length ? ' WARN: ' + warnings.join('; ') : ''}`)
}
