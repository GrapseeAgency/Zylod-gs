#!/usr/bin/env node
/**
 * Theme bulk-fix v3 (Task 176).
 *
 * Operates per-quote-string: for each className="..." string, if it contains
 * a light token AND no dark: variant for that token's category, append the
 * dark variant. This is the correct granularity — the v1/v2 scripts operated
 * per-file which missed strings that already had SOME dark: classes.
 */
const fs = require('fs')
const path = require('path')

const PAIRS = [
  ['bg-white', 'dark:bg-gray-900'],
  ['bg-slate-50', 'dark:bg-slate-950'],
  ['bg-gray-50', 'dark:bg-gray-950'],
  ['bg-slate-100', 'dark:bg-slate-900'],
  ['bg-gray-100', 'dark:bg-gray-900'],
  ['text-gray-900', 'dark:text-gray-100'],
  ['text-slate-900', 'dark:text-slate-100'],
  ['text-gray-800', 'dark:text-gray-200'],
  ['text-slate-800', 'dark:text-slate-200'],
  ['text-gray-700', 'dark:text-gray-300'],
  ['text-slate-700', 'dark:text-slate-300'],
  ['text-gray-600', 'dark:text-gray-400'],
  ['text-slate-600', 'dark:text-slate-400'],
  ['text-gray-500', 'dark:text-gray-400'],
  ['text-slate-500', 'dark:text-slate-400'],
  ['text-gray-400', 'dark:text-gray-500'],
  ['text-slate-400', 'dark:text-slate-500'],
  ['border-gray-100', 'dark:border-gray-800'],
  ['border-gray-200', 'dark:border-gray-800'],
  ['border-slate-100', 'dark:border-slate-800'],
  ['border-slate-200', 'dark:border-slate-800'],
  ['divide-gray-100', 'dark:divide-gray-800'],
  ['divide-gray-200', 'dark:divide-gray-800'],
  ['divide-slate-100', 'dark:divide-slate-800'],
  ['divide-slate-200', 'dark:divide-slate-800'],
  ['hover:bg-gray-50', 'dark:hover:bg-gray-800'],
  ['hover:bg-gray-100', 'dark:hover:bg-gray-800'],
  ['hover:bg-slate-50', 'dark:hover:bg-slate-800'],
  ['hover:bg-slate-100', 'dark:hover:bg-slate-800'],
  ['ring-gray-100', 'dark:ring-gray-800'],
  ['ring-gray-200', 'dark:ring-gray-800'],
  ['ring-slate-100', 'dark:ring-slate-800'],
  ['ring-slate-200', 'dark:ring-slate-800'],
]

function fixString(str) {
  let result = str
  let changed = 0
  for (const [light, dark] of PAIRS) {
    // Does this string contain the light token?
    const lightRe = new RegExp(`\\b${light.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (!lightRe.test(result)) continue
    // Does it already have ANY dark: variant? If the dark counterpart is present, skip.
    const darkRe = new RegExp(`\\b${dark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (darkRe.test(result)) continue
    // Append the dark variant right after the light token
    const replaceRe = new RegExp(`(\\b${light.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b)`, 'g')
    result = result.replace(replaceRe, `$1 ${dark}`)
    changed++
  }
  return { result, changed }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  let totalChanges = 0
  // Match className="..." (double quote), className='...' (single), className={`...`} (template)
  // We process each quoted string individually.
  // Use a function replacer that handles all three quote types.
  const patterns = [
    /className=(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g,
    /class=(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g,
  ]
  for (const pattern of patterns) {
    content = content.replace(pattern, (match, ...groups) => {
      // groups[0..2] are the three alternatives; find which matched
      const original = groups[0] ?? groups[1] ?? groups[2]
      if (!original) return match
      const { result, changed } = fixString(original)
      if (changed === 0) return match
      totalChanges += changed
      // Reconstruct with the same quote style
      if (groups[0] !== undefined) return `className="${result}"`
      if (groups[1] !== undefined) return `className='${result}'`
      return `className={\`${result}\`}`
    })
  }
  if (totalChanges === 0) return { skipped: true }
  fs.writeFileSync(filePath, content, 'utf8')
  return { changes: totalChanges }
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

const dirs = ['components', 'app'].map(d => path.join(__dirname, '..', 'src', d)).filter(p => fs.existsSync(p))
let allFiles = []
for (const d of dirs) allFiles.push(...walk(d))

let fixed = 0
for (const f of allFiles) {
  const r = processFile(f)
  if (!r.skipped) {
    fixed++
    console.log(`  FIXED ${f.replace(/.*src\//, '')} — ${r.changes} strings`)
  }
}
console.log(`\nDone: ${fixed} files fixed`)
