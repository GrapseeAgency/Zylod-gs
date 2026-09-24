// DE-FAKE CAMPAIGN — DB purge + count tool (Task 36)
// Usage:
//   bun scripts/campaign-db-purge.mjs count   -> print per-table row counts
//   bun scripts/campaign-db-purge.mjs purge   -> delete ALL rows from ALL tables (except infra), vacuum, verify
import { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'

const DB_PATH = new URL('../db/custom.db', import.meta.url).pathname
if (!existsSync(DB_PATH)) {
  console.error(`DB not found: ${DB_PATH}`)
  process.exit(1)
}

// Infrastructure tables that must be preserved (bookkeeping, not business data)
const SKIP = new Set(['_prisma_migrations'])

const db = new Database(DB_PATH)
db.exec('PRAGMA foreign_keys = OFF')
db.exec('PRAGMA journal_mode = WAL')

function businessTables() {
  return db
    .query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'`
    )
    .all()
    .map((r) => r.name)
    .filter((n) => !SKIP.has(n))
}

function counts() {
  const rows = []
  for (const t of businessTables()) {
    const n = db.query(`SELECT COUNT(*) AS n FROM "${t}"`).get().n
    rows.push([t, n])
  }
  return rows
}

const mode = process.argv[2] ?? 'count'

if (mode === 'count') {
  const rows = counts()
  let total = 0
  for (const [t, n] of rows) {
    if (n > 0) console.log(`${n}\t${t}`)
    total += n
  }
  console.log(`---\ntables=${rows.length} nonEmptyRows=${total}`)
  process.exit(0)
}

if (mode === 'purge') {
  const tables = businessTables()
  db.exec('BEGIN IMMEDIATE')
  for (const t of tables) db.exec(`DELETE FROM "${t}"`)
  db.exec('COMMIT')
  db.exec('VACUUM')
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  const rows = counts()
  const nonEmpty = rows.filter(([, n]) => n > 0)
  for (const [t, n] of nonEmpty) console.log(`NONEMPTY ${n}\t${t}`)
  const total = rows.reduce((a, [, n]) => a + n, 0)
  console.log(`PURGE_DONE tables=${rows.length} nonEmptyRows=${total}`)
  db.close()
  process.exit(nonEmpty.length === 0 ? 0 : 2)
}

console.error('usage: purge|count')
process.exit(1)
