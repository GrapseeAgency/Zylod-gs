#!/usr/bin/env node
/** t181a fixer: applies ordered replacements to a single file.
 *  Plain-string rules are escaped and wrapped with boundary guards
 *  (?<![a-z-]:)X(?=[\s"'`]|$) so they never corrupt variant-prefixed tokens
 *  and are idempotent on re-runs. Rules with "regex": true are used as-is.
 *  Usage: node scripts/fix-one.cjs <file> <rules-json-file>
 */
const fs = require('fs')

const [file, rulesFile] = process.argv.slice(2)
const rules = JSON.parse(fs.readFileSync(rulesFile, 'utf8'))
let code = fs.readFileSync(file, 'utf8')
let applied = 0
const missed = []

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

for (const r of rules) {
  let source
  if (r.regex) {
    source = r.pattern
  } else {
    source = `(?<![a-z-]:)${escapeRe(r.pattern)}(?=[\\s"'\`]|$)`
  }
  const re = new RegExp(source, 'g')
  const countRe = new RegExp(source, 'g')
  const count = (code.match(countRe) || []).length
  if (count === 0) {
    missed.push(r.note || r.pattern)
    continue
  }
  code = code.replace(re, r.replacement)
  applied += count
}

fs.writeFileSync(file, code)
console.log(`applied ${applied} replacement(s) across ${rules.length - missed.length}/${rules.length} rules`)
if (missed.length) {
  console.log('MISSED RULES:')
  for (const m of missed) console.log('  - ' + m)
  process.exit(2)
}
