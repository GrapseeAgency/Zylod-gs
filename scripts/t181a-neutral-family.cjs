#!/usr/bin/env node
/** t181a: neutral-950 dark-page family → theme-aware.
 *  Generates + applies the shared rule set for each fully-dark neutral page. */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const PAGES = '/home/z/my-project/src/components/pages'
const RULES_DIR = '/home/z/my-project/scripts/t181a-rules'

// shared core: the neutral-950/900 design system used by these pages
const core = [
  { pattern: 'min-h-screen bg-neutral-950 text-neutral-100', replacement: 'min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100', note: 'root' },
  { pattern: 'bg-neutral-900/90 backdrop-blur border-b border-neutral-800', replacement: 'bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b border-neutral-200 dark:border-neutral-800', note: 'sticky header' },
  { pattern: 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200', replacement: 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200', note: 'back button' },
  { pattern: 'bg-neutral-900 border-neutral-800 shadow-xl', replacement: 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm', note: 'main card' },
  { pattern: 'bg-neutral-900 border border-neutral-800 rounded-2xl p-6', replacement: 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm', note: 'success card' },
  { pattern: 'bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]', replacement: 'bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-primary', note: 'inputs' },
  { pattern: 'bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-primary', replacement: 'bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-primary', note: 'inputs2' },
  { pattern: 'bg-neutral-950 rounded-xl p-4 space-y-2 text-xs border border-neutral-800', replacement: 'bg-neutral-100 dark:bg-neutral-950 rounded-xl p-4 space-y-2 text-xs border border-neutral-200 dark:border-neutral-800', note: 'review box' },
  { pattern: 'border-neutral-700 bg-neutral-900 text-[#C8102E] focus:ring-[#C8102E]', replacement: 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-primary focus:ring-primary', note: 'checkbox' },
  { pattern: 'border-neutral-700 text-neutral-300 hover:bg-neutral-800', replacement: 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800', note: 'outline button' },
  { pattern: 'bg-neutral-900 border-neutral-800 hover:border-neutral-700', replacement: 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700', note: 'input-like bordered' },
  { pattern: 'bg-neutral-900 border-neutral-800', replacement: 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm', note: 'generic 900 card' },
  { pattern: 'bg-neutral-900/60 border border-neutral-800 hover:bg-neutral-900', replacement: 'bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900', note: 'hoverable 900/60' },
  { pattern: 'border-b border-neutral-800', replacement: 'border-b border-neutral-200 dark:border-neutral-800', note: 'divider b' },
  { pattern: 'border-t border-neutral-800', replacement: 'border-t border-neutral-200 dark:border-neutral-800', note: 'divider t' },
  { pattern: 'bg-[#C8102E]', replacement: 'bg-primary', note: 'brand red bg' },
  { pattern: 'hover:bg-[#A00D24]', replacement: 'hover:bg-primary/90', note: 'brand red hover' },
  { pattern: 'text-[#C8102E]', replacement: 'text-primary', note: 'brand red text' },
  { pattern: 'focus-visible:ring-[#C8102E]', replacement: 'focus-visible:ring-primary', note: 'brand ring' },
  { pattern: 'text-emerald-400', replacement: 'text-emerald-500 dark:text-emerald-400', note: 'emerald icon' },
  { pattern: 'text-amber-400', replacement: 'text-amber-500 dark:text-amber-400', note: 'amber icon' },
  { pattern: 'text-purple-400', replacement: 'text-purple-500 dark:text-purple-400', note: 'purple icon' },
  { pattern: '(?<![a-z-]:)text-neutral-100(?=[\\s"\'`])', regex: true, replacement: 'text-neutral-900 dark:text-neutral-100', note: 'bare neutral-100' },
  { pattern: '(?<![a-z-]:)text-neutral-200(?=[\\s"\'`])', regex: true, replacement: 'text-neutral-800 dark:text-neutral-200', note: 'bare neutral-200' },
  { pattern: '(?<![a-z-]:)text-neutral-300(?=[\\s"\'`])', regex: true, replacement: 'text-neutral-700 dark:text-neutral-300', note: 'bare neutral-300' },
  { pattern: '(?<![a-z-]:)text-neutral-400(?=[\\s"\'`])', regex: true, replacement: 'text-neutral-500 dark:text-neutral-400', note: 'bare neutral-400' },
  { pattern: '(?<![a-z-]:)bg-neutral-800(?=[\\s"\'`])', regex: true, replacement: 'bg-neutral-200 dark:bg-neutral-800', note: 'bare neutral-800 bg' },
]

const extras = {
  'seller-registration-page.tsx': [
    { pattern: 'bg-red-950/40 border border-red-800/60 rounded-xl p-3 flex items-center gap-2.5 text-red-300', replacement: 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl p-3 flex items-center gap-2.5 text-red-600 dark:text-red-300', note: 'error box' },
    { pattern: 'text-red-400', replacement: 'text-red-500 dark:text-red-400', note: 'error icon' },
  ],
  'seller-verification-page.tsx': [
    { pattern: 'w-16 h-16 rounded-full bg-neutral-950 border-2 border-sky-500/40', replacement: 'w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-950 border-2 border-sky-500/40', note: 'sky icon disc' },
    { pattern: 'w-9 h-9 rounded-lg bg-neutral-950 border border-neutral-800', replacement: 'w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800', note: 'step icon chip' },
  ],
  'store-banner-editor-page.tsx': [
    { pattern: 'flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl p-3', replacement: 'flex items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 shadow-sm', note: 'toolbar' },
    { pattern: 'flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800', replacement: 'flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-1 rounded-lg border border-neutral-200 dark:border-neutral-800', note: 'seg control' },
    { pattern: 'bg-neutral-900 border-neutral-800 pl-10 text-sm focus-visible:ring-primary', replacement: 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 pl-10 text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-primary', note: 'search input' },
  ],
  'store-featured-products-page.tsx': [
    { pattern: 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900', replacement: 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900', note: 'icon buttons' },
    { pattern: 'h-20 w-full bg-neutral-900 rounded-xl', replacement: 'h-20 w-full bg-neutral-200 dark:bg-neutral-900 rounded-xl', note: 'image placeholder' },
    { pattern: 'bg-neutral-900 border-neutral-800 hover:border-neutral-700', replacement: 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm', note: 'product rows' },
    { pattern: 'bg-neutral-900 border-neutral-800 pl-10 text-sm focus-visible:ring-primary', replacement: 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 pl-10 text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-primary', note: 'search input' },
  ],
  'store-story-about-page.tsx': [
    { pattern: 'flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-neutral-300', replacement: 'flex items-center justify-between bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300', note: 'field rows' },
  ],
}

const targets = process.argv.slice(2)
for (const file of targets) {
  const rules = [...(extras[file] || []), ...core]
  const ruleFile = path.join(RULES_DIR, file.replace('.tsx', '.json'))
  fs.writeFileSync(ruleFile, JSON.stringify(rules, null, 2))
  console.log(`=== ${file} (${rules.length} rules)`)
  try {
    execFileSync('node', ['scripts/fix-one.cjs', `src/components/pages/${file}`, ruleFile], { stdio: 'inherit' })
  } catch (e) {
    console.log(`  !! fixer exited nonzero for ${file} — check missed rules`)
  }
}
