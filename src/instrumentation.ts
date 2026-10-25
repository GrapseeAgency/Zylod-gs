/**
 * Server instrumentation — runs once per server process boot (nodejs runtime).
 *
 * AUTO-SEED GUARD: the sandbox DB (db/custom.db) has twice been found
 * completely empty after environment restarts (t188, t190) — a ghost-town
 * marketplace for every user until someone noticed and reseeded by hand.
 * This guard makes the environment self-healing: on boot, if the products
 * table is empty, the marketplace + content seeds run automatically.
 *
 * Deliberately dependency-free (node:sqlite): it must work even when the
 * Prisma client is stale/regenerated mid-flight. Seed scripts are the same
 * idempotent ones CI uses, so a seed that races a healthy DB is a no-op.
 */
export async function register() {
  // Only in the real server runtime — never on edge or during static work.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

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
