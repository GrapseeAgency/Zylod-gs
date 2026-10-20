/**
 * QA wipe — TRUNCATE every user table in the SQLite DB (custom.db) and
 * checkpoint the WAL so the emptiness is durable on disk.
 *
 * Provenance: /home/z/.qa/wipe.js from earlier tasks was lost with the
 * sandbox home cleanup — recreated here, inside the repo, so it survives.
 *
 * Rules:
 *  - sqlite internal tables start with '_' (sqlite_sequence, _cf_...) and are
 *    SKIPPED — the earlier inline LIKE-'_' filter bug (underscore is a LIKE
 *    wildcard that matches EVERYTHING) is exactly what this substr() guard
 *    prevents.
 *  - foreign keys OFF during the sweep, WAL checkpointed after, verified 0.
 *
 * Run: node scripts/qa/wipe.mjs
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'db', 'custom.db')

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA foreign_keys = OFF;')

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND substr(name,1,1) != '_'")
  .all()

for (const { name } of tables) {
  db.exec(`DELETE FROM "${name}";`)
}

db.exec('PRAGMA wal_checkpoint(TRUNCATE);')
db.exec('PRAGMA foreign_keys = ON;')

let remaining = 0
for (const { name } of tables) {
  const c = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c
  if (c > 0) { remaining += c; console.log(`NOT EMPTY: ${name} = ${c}`) }
}
console.log(`wiped ${tables.length} tables — ${remaining} rows remain`)
db.close()
if (remaining > 0) process.exit(1)
