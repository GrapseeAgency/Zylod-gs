#!/usr/bin/env node
/**
 * t182 codemod — add dark: counterparts to pastel card tokens in flagged files.
 * Guard: only strings that don't already contain a dark: variant of the token family.
 */
const fs = require('fs')

const FILES = [
  'admin-content', 'admin-inspections', 'bulk-pricing-guide', 'cookie-policy',
  'customs-clearance', 'link-generator', 'supplier-samples', 'admin-reports',
  'job-detail', 'privacy-policy', 'data-collection', 'data-deletion',
  'orders', 'trust-center', 'bulk-pricing', 'frequently-bought',
  'payment-methods-detail', 'seller-order-cancellation',
]

const MAP = {
  'bg-amber-50/50': 'dark:bg-amber-950/30',
  'bg-green-50/50': 'dark:bg-green-950/30',
  'bg-rose-50/70': 'dark:bg-rose-950/40',
  'bg-rose-50/60': 'dark:bg-rose-950/40',
  'bg-amber-50': 'dark:bg-amber-950/40',
  'bg-red-50': 'dark:bg-red-950/40',
  'bg-emerald-50': 'dark:bg-emerald-950/40',
  'bg-rose-50': 'dark:bg-rose-950/40',
  'bg-violet-50': 'dark:bg-violet-950/40',
  'bg-orange-50': 'dark:bg-orange-950/40',
  'bg-green-50': 'dark:bg-green-950/40',
  'bg-gray-200': 'dark:bg-gray-800',
  'border-amber-200': 'dark:border-amber-900/60',
  'border-red-200': 'dark:border-red-900/60',
  'border-green-200': 'dark:border-green-900/60',
  'border-violet-100': 'dark:border-violet-900/60',
  'border-orange-200': 'dark:border-orange-900/60',
  'border-rose-100': 'dark:border-rose-900/60',
  'border-rose-200': 'dark:border-rose-900/60',
  'border-violet-200': 'dark:border-violet-900/60',
  'border-emerald-200': 'dark:border-emerald-900/60',
  'text-amber-900': 'dark:text-amber-100',
  'text-amber-800': 'dark:text-amber-200',
  'text-amber-700': 'dark:text-amber-300',
  'text-amber-600': 'dark:text-amber-400',
  'text-red-900': 'dark:text-red-100',
  'text-red-800': 'dark:text-red-200',
  'text-red-700': 'dark:text-red-300',
  'text-emerald-900': 'dark:text-emerald-100',
  'text-emerald-800': 'dark:text-emerald-200',
  'text-emerald-700': 'dark:text-emerald-300',
  'text-emerald-600': 'dark:text-emerald-400',
  'text-rose-900': 'dark:text-rose-100',
  'text-rose-800': 'dark:text-rose-200',
  'text-rose-700': 'dark:text-rose-300',
  'text-violet-900': 'dark:text-violet-100',
  'text-violet-800': 'dark:text-violet-200',
  'text-violet-700': 'dark:text-violet-300',
  'text-orange-900': 'dark:text-orange-100',
  'text-orange-800': 'dark:text-orange-200',
  'text-orange-700': 'dark:text-orange-300',
  'text-green-800': 'dark:text-green-200',
  'text-green-700': 'dark:text-green-300',
  'text-green-600': 'dark:text-green-400',
}

// order tokens longest-first so bg-amber-50/50 matches before bg-amber-50
const TOKENS = Object.keys(MAP).sort((a, b) => b.length - a.length)

let totalEdits = 0
for (const name of FILES) {
  const p = `src/components/pages/${name}-page.tsx`
  if (!fs.existsSync(p)) { console.log('MISSING ' + p); continue }
  let content = fs.readFileSync(p, 'utf8')
  let fileEdits = 0
  // process each quoted class-like string
  content = content.replace(/(["'`])([^"'`\n]*\b(?:bg|text|border)-[a-z]+-\d{2,3}[^"'`\n]*)\1/g, (full, q, cls) => {
    let out = cls
    for (const tok of TOKENS) {
      const re = new RegExp(`(^|\\s)${tok.replace(/\//g, '\\/')}(?=\\s|$)`)
      if (re.test(out) && !out.includes(MAP[tok])) {
        out = out.replace(re, (m, pre) => `${pre}${tok} ${MAP[tok]}`)
        fileEdits++
      }
    }
    return q + out + q
  })
  if (fileEdits > 0) {
    fs.writeFileSync(p, content)
    console.log(`${name}: ${fileEdits} tokens given dark: variants`)
    totalEdits += fileEdits
  } else {
    console.log(`${name}: 0 changes`)
  }
}
console.log(`TOTAL: ${totalEdits} tokens fixed`)
