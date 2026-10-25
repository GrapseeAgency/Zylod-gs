/**
 * Node-only instrumentation body — dynamically imported by
 * src/instrumentation.ts ONLY when NEXT_RUNTIME === 'nodejs'.
 *
 * WHY A SEPARATE FILE: Turbopack compiles instrumentation.ts for BOTH the
 * nodejs and edge runtimes. Static `node:sqlite` / `node:child_process` /
 * `node:path` imports in that file poison the EDGE bundle with
 * "not supported in the Edge Runtime" compile errors, which kills the
 * instrumentation hook entirely — the auto-seed guard then NEVER runs and
 * the marketplace boots as a ghost town (t190/t191 root cause).
 * Keeping every node: import inside this node-only module keeps the edge
 * bundle clean (this file is never even fetched for edge).
 */

/**
 * AUTO-SEED GUARD: the sandbox DB (db/custom.db) has repeatedly been found
 * completely empty after environment restarts (t188, t190, t191) — a
 * ghost-town marketplace for every user until someone reseeded by hand.
 * This guard makes the environment self-healing: on boot, if the products
 * table is empty, the marketplace + content seeds run automatically.
 *
 * Deliberately dependency-free (node:sqlite): it must work even when the
 * Prisma client is stale/regenerated mid-flight. Seed scripts are the same
 * idempotent ones CI uses, so a seed that races a healthy DB is a no-op.
 */
export async function registerNode() {
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const { execFile } = await import('node:child_process')
    const path = await import('node:path')

    const dbPath = path.join(process.cwd(), 'db', 'custom.db')
    const db = new DatabaseSync(dbPath, { readOnly: true })
    const row = db.prepare('SELECT COUNT(*) AS c FROM products').get() as {
      c: number
    }
    db.close()

    if (row.c > 0) return // healthy — nothing to do

    console.log(
      '[instrumentation] products table EMPTY — running marketplace auto-seed…',
    )
    const run = (script: string) =>
      new Promise<void>((resolve) => {
        execFile(
          process.execPath,
          [path.join(process.cwd(), 'scripts', 'qa', script)],
          { cwd: process.cwd(), timeout: 120_000 },
          (err, stdout) => {
            if (err)
              console.error(`[instrumentation] ${script} failed:`, err.message)
            else
              console.log(
                `[instrumentation] ${script} done:`,
                String(stdout).trim().split('\n').slice(-2).join(' | '),
              )
            resolve()
          },
        )
      })

    await run('seed-marketplace.mjs')
    await run('seed-content.mjs')
    console.log('[instrumentation] auto-seed complete.')
  } catch (err) {
    // Never block server boot because of the guard.
    console.error('[instrumentation] auto-seed guard error:', err)
  }
}
