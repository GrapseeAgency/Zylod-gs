// t305-selective-revert — restore HEAD for repaired files whose ORIGINAL
// meta was parse-safe (the repair was only needed for genuinely broken ones).
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const dir = 'android/app/src/main/java/com/zylod/wholesale/ui/screens'
const repaired = execSync('git diff --name-only', { encoding: 'utf8' })
  .split('\n')
  .filter((l) => l.includes('ui/screens/'))
  .map((l) => l.replace('android/app/src/main/java/com/zylod/wholesale/ui/screens/', ''))

const JUNK = /[\}）]\} |’\}|: ’|\}\)|className|\} : \(|aria-|\.map\(m =>|\}\}|\{\'|\}\",|\)\}\"|\)\} saved|\( \)/

let reverted = 0
const kept = []
for (const f of repaired) {
  const p = path.join(dir, f)
  let head = ''
  try {
    head = execSync(`git show HEAD:${p}`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
  } catch {
    kept.push(f + ' (new file)')
    continue
  }
  const start = head.indexOf('override val bullets = listOf(')
  const relIdx = head.indexOf('override val related = listOf(')
  if (start < 0 || relIdx < 0) {
    console.log('CHECK-MANUAL', f)
    continue
  }
  const region = head.slice(start, relIdx)
  const lines = region.split('\n').map((l) => l.trim()).filter((l) => l.length)
  const bulletLines = lines.filter((l) => /^"/.test(l))
  const nonBullet = lines.filter((l) => !/^"/.test(l) && l !== ')')
  const sumIdx = head.indexOf('override val summary')
  // STRUCTURAL-only breakage: orphan lines between the bullets close and
  // `related`, or unpaired straight quotes inside any meta line. Content
  // quality (parenthesized labels, JSX-derived text) is NOT a parse breaker.
  const closeIdx = region.indexOf('\n    )')
  const orphaned = closeIdx >= 0 && region.slice(closeIdx + 6).trim().length > 0
  const quoteBroken = [head.slice(sumIdx, relIdx)].some((seg) => {
    for (const line of seg.split('\n')) {
      const q = (line.match(/"/g) || []).length
      if (line.trim().length > 0 && q % 2 !== 0) return true
    }
    return false
  })
  const headBroken = orphaned || quoteBroken
  if (!headBroken) {
    execSync(`git checkout HEAD -- ${p}`)
    reverted++
    console.log('REVERTED', f)
  } else {
    kept.push(f)
  }
}
console.log('reverted:', reverted, '| kept repairs:', kept.length)
console.log('kept:', kept.join(', '))
