/**
 * Full DB wipe — banked INSIDE the repo so it survives (the /home/z/.qa copy
 * was lost). Deletes every row from every user table (Prisma internal tables
 * starting with '_' are kept), then truncates the WAL so the empty state is
 * durable, then verifies 0 rows everywhere.
 *
 * Run: bun scripts/qa/wipe.mjs
 * Doctrine: the DB stays TRULY EMPTY between proofs — no seeds, no fakes.
 */
import { DatabaseSync } from 'node:sqlite'

const DB_PATH = '/home/z/my-project/db/custom.db'
const s = new DatabaseSync(DB_PATH)

s.exec('PRAGMA foreign_keys = OFF;')
const tables = s
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all()
  .map((r) => r.name)
  .filter((n) => n.length > 0 && n[0] !== '_')

let totalDeleted = 0
for (const t of tables) {
  // Bracket-quote every identifier — tables come from sqlite_master, but be strict anyway.
  const del = s.prepare(`DELETE FROM "${t.replace(/"/g, '""')}"`)
  const n = del.run().changes
  if (n > 0) console.log(`  ${t}: ${n} rows deleted`)
  totalDeleted += n
}

s.exec('PRAGMA wal_checkpoint(TRUNCATE);')
s.exec('PRAGMA foreign_keys = ON;')

// Verify zero.
let nonzero = []
for (const t of tables) {
  const c = s.prepare(`SELECT COUNT(*) AS c FROM "${t.replace(/"/g, '""')}"`).get().c
  if (c !== 0) nonzero.push(`${t}=${c}`)
}

console.log(`\ntables: ${tables.length}, rows deleted: ${totalDeleted}`)
console.log(nonzero.length === 0 ? 'VERIFY: all tables EMPTY (0 rows)' : `VERIFY FAILED: ${nonzero.join(', ')}`)
s.close()
process.exit(nonzero.length === 0 ? 0 : 1)
