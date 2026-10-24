#!/usr/bin/env node
/**
 * Find unthemed bg-white / text-gray-900 / border-gray-100 — tokens that
 * appear in a className string WITHOUT a dark: counterpart in the same string.
 */
const fs = require('fs')
const path = require('path')

const TOKENS = ['bg-white', 'text-gray-900', 'text-gray-800', 'text-gray-700', 'text-gray-600', 'text-gray-500', 'text-gray-400', 'border-gray-100', 'border-gray-200', 'bg-gray-50', 'bg-gray-100', 'bg-slate-50', 'bg-slate-100']

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const leaks = {}
  // Find all className="..." or className={...} strings
  const strRegex = /["'`]([^"'`]*\bbg-white\b[^"'`]*)["'`]/g
  let m
  while ((m = strRegex.exec(content)) !== null) {
    const cls = m[1]
    for (const tok of TOKENS) {
      const tokRegex = new RegExp(`\\b${tok}\\b`)
      if (tokRegex.test(cls) && !/dark:/.test(cls)) {
        leaks[tok] = (leaks[tok] || 0) + 1
      }
    }
  }
  return leaks
}

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.tsx') && !full.includes('/ui/')) out.push(full)
  }
  return out
}

const files = walk(path.join(__dirname, '..', 'src', 'components'))
let totalLeakFiles = 0
const byDir = {}
for (const f of files) {
  const leaks = scanFile(f)
  const total = Object.values(leaks).reduce((a, b) => a + b, 0)
  if (total > 0) {
    totalLeakFiles++
    const dir = path.dirname(f).replace(/.*src\/components\//, '')
    byDir[dir] = (byDir[dir] || 0) + total
    console.log(`  ${total}  ${f.replace(/.*src\/components\//, '')}  ${JSON.stringify(leaks)}`)
  }
}
console.log(`\nTotal files with leaks: ${totalLeakFiles}`)
console.log('\nBy directory:')
for (const [d, c] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c}  ${d}`)
}
