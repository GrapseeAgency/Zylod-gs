/**
 * Task 120 codemod — THE 401-FIRST SWEEP.
 * For every handler where `checkRateLimit` runs BEFORE the auth call
 * (requireUserType / authenticateRequest), swap the two blocks so auth
 * (the 401 return) comes first — the house mandate order. Brace-aware:
 * handles single-line and multi-line `if (!rl.ok) { ... }` and
 * `if (!auth.authenticated || !auth.user) { ... }` blocks, and keeps any
 * middle lines (params awaits, blank lines) between the blocks in place.
 * Usage: node scripts/qa-codemods/auth-first.mjs <file> [<file>...]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const files = process.argv.slice(2)
let totalSwaps = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')

  const blockEnd = (lines, ifLine) => {
    if (!lines[ifLine].trim().endsWith('{')) return ifLine // single-line form
    let depth = 0
    for (let i = ifLine; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') depth++
        else if (ch === '}') depth--
      }
      if (depth === 0) return i
    }
    throw new Error(`unbalanced block at line ${ifLine + 1} in ${file}`)
  }

  const rlBlocks = []
  for (let i = 0; i < lines.length; i++) {
    if (/const rl = checkRateLimit\(request/.test(lines[i])) {
      let ifLine = -1
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        if (/if \(!rl\.ok\)/.test(lines[j])) { ifLine = j; break }
      }
      if (ifLine === -1) throw new Error(`no if (!rl.ok) after line ${i + 1} in ${file}`)
      const end = blockEnd(lines, ifLine)
      rlBlocks.push({ start: i, end })
    }
  }

  const authBlocks = []
  for (let i = 0; i < lines.length; i++) {
    if (/const auth = await (requireUserType|authenticateRequest)\(request/.test(lines[i])) {
      let ifLine = -1
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        if (/if \(!auth\.authenticated \|\| !auth\.user\)/.test(lines[j])) { ifLine = j; break }
      }
      if (ifLine === -1) throw new Error(`no auth guard after line ${i + 1} in ${file}`)
      const end = blockEnd(lines, ifLine)
      authBlocks.push({ start: i, end })
    }
  }

  const pairs = []
  for (const rl of rlBlocks) {
    const auth = authBlocks.find((a) => a.start > rl.end)
    if (auth) pairs.push({ rl, auth })
  }

  pairs.sort((a, b) => b.rl.start - a.rl.start)
  let swaps = 0
  for (const { rl, auth } of pairs) {
    const rlLines = lines.slice(rl.start, rl.end + 1)
    const middle = lines.slice(rl.end + 1, auth.start)
    const authLines = lines.slice(auth.start, auth.end + 1)
    lines.splice(rl.start, auth.end - rl.start + 1, ...authLines, ...middle, ...rlLines)
    swaps++
  }

  if (swaps > 0) {
    writeFileSync(file, lines.join('\n'))
    console.log(`${file}: ${swaps} handler(s) swapped to 401-first`)
    totalSwaps += swaps
  } else {
    console.log(`${file}: no swaps needed`)
  }
}
console.log(`\ntotal swaps: ${totalSwaps}`)
