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
 * AUTO-SEED GUARD v2 — the sandbox DB (db/custom.db) has repeatedly been
 * found completely empty after environment restarts (t188, t190, t191).
 *
 * v1 lessons (why it never worked in production sandboxes):
 *  1. node: imports in instrumentation.ts poisoned the edge bundle → the
 *     hook failed to compile and NEVER ran. Fixed by this file split.
 *  2. The seed scripts are HTTP-driven (they call the running API), but
 *     register() fires BEFORE the HTTP listener accepts connections →
 *     every fetch failed instantly. Fixed by polling /api/products until
 *     the listener is up (up to 120s) BEFORE spawning the seeds.
 *  3. next dev spawns TWO workers that both run register() → both seeded
 *     simultaneously and raced. Fixed by an O_CREAT|O_EXCL lockfile with a
 *     staleness steal (10 min).
 *  4. A dirty DB (users present, products wiped) made seed-marketplace
 *     abort on duplicate-email registration. Fixed by wiping first when
 *     any users exist — a marketplace with users but zero products is
 *     still a ghost town, so the honest rebuild is wipe → seed → seed.
 *
 * The healing chain runs DETACHED from register() (void promise) so it can
 * never delay or deadlock server boot — the HTTP poll is only safe because
 * it happens after register() returns.
 */
export async function registerNode() {
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const { execFile } = await import('node:child_process')
    const path = await import('node:path')
    const fs = await import('node:fs')

    const cwd = process.cwd()
    const dbPath = path.join(cwd, 'db', 'custom.db')

    const count = (table: string): number => {
      const db = new DatabaseSync(dbPath, { readOnly: true })
      try {
        const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }
        return row.c
      } catch {
        return -1 // table missing — treat as unhealthy
      } finally {
        db.close()
      }
    }

    const products = count('products')

    // Shared script runner + sleep — declared BEFORE every consumer so no
    // branch can hit a temporal-dead-zone binding (t229f refactor: the
    // content-only branch also needs `run`).
    const run = (script: string) =>
      new Promise<void>((resolve) => {
        execFile(
          process.execPath,
          [path.join(cwd, 'scripts', 'qa', script)],
          { cwd, timeout: 180_000 },
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

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    if (products > 0) {
      // t229f: products-healthy is NOT content-healthy. The t229 DB rebuild
      // (wipe + seed-marketplace) restored the catalog but skipped
      // seed-content.mjs — every legal footer page (terms, privacy, payment
      // terms, DMCA…) rendered "document unavailable" for 9 dead-looking
      // links while the products-only guard called the DB healthy. The
      // content gap heals NON-destructively: seed-content.mjs is pure
      // idempotent upserts, so a live marketplace (orders, users) is never
      // wiped for a missing legal table.
      const legal = count('legalDocuments')
      if (legal === 0) {
        console.log('[instrumentation] legalDocuments EMPTY — content-only reseed starting…')
        void (async () => {
          try {
            let up = false
            for (let i = 0; i < 120; i++) {
              try {
                const res = await fetch('http://127.0.0.1:3000/api/products?limit=1')
                if (res.ok || res.status === 401 || res.status === 429) { up = true; break }
              } catch { /* not listening yet */ }
              await sleep(1000)
            }
            if (!up) return
            await run('seed-content.mjs')
            console.log('[instrumentation] content-only reseed complete.')
          } catch (err) {
            console.error('[instrumentation] content reseed error:', err)
          }
        })()
      }
      return
    }

    // ── cross-worker lock (O_CREAT|O_EXCL is atomic on POSIX) ──
    // Lock content = `${pid}:${now}`. A lock is ONLY respected while its PID
    // is alive AND the stamp is within 10 min. t193 lesson: a boot that dies
    // on EADDRINUSE left a fresh lock behind; the next healthy boot then saw
    // a "fresh" lock and skipped seeding forever (ghost town again). A dead
    // PID proves the lock is orphaned → steal it. Math.abs guards against
    // clock jumps making the diff negative.
    const lockPath = path.join(cwd, 'db', '.auto-seed.lock')
    const now = Date.now()
    const pidAlive = (pid: number): boolean => {
      try {
        process.kill(pid, 0) // signal 0 = existence probe
        return true
      } catch {
        return false
      }
    }
    const writeLock = () => fs.writeFileSync(lockPath, `${process.pid}:${now}`)
    try {
      writeLock()
    } catch {
      try {
        const raw = fs.readFileSync(lockPath, 'utf8').trim()
        const [lockPidStr, stampStr] = raw.split(':')
        const lockPid = Number(lockPidStr)
        const stamp = Number(stampStr)
        const fresh = Number.isFinite(stamp) && Math.abs(now - stamp) < 600_000
        if (Number.isFinite(lockPid) && pidAlive(lockPid) && fresh) return // sibling worker is on it
        fs.writeFileSync(lockPath, `${process.pid}:${now}`) // orphaned/stale — steal it
      } catch {
        /* unreadable — proceed */
      }
    }

    const dirty = count('users') > 0
    console.log(
      `[instrumentation] products table EMPTY${dirty ? ' (dirty DB — wipe first)' : ''} — auto-seed chain starting…`,
    )

    // DETACHED healing chain — never awaited by register().
    void (async () => {
      try {
        // 1) Wait for the HTTP listener (the seeds are API-driven).
        let up = false
        for (let i = 0; i < 120; i++) {
          try {
            const res = await fetch('http://127.0.0.1:3000/api/products?limit=1')
            if (res.ok || res.status === 401 || res.status === 429) {
              up = true
              break
            }
          } catch {
            /* not listening yet */
          }
          await sleep(1000)
        }
        if (!up) {
          console.error('[instrumentation] HTTP listener never came up — seed chain aborted')
          return
        }

        // 2) Dirty DB → wipe before seeding (duplicate emails would abort it).
        if (dirty) await run('wipe.mjs')

        // 3) Rebuild the marketplace + content.
        await run('seed-marketplace.mjs')
        await run('seed-content.mjs')
        console.log('[instrumentation] auto-seed complete.')
      } finally {
        try {
          fs.rmSync(lockPath, { force: true })
        } catch {
          /* best effort */
        }
      }
    })()
  } catch (err) {
    // Never block server boot because of the guard.
    console.error('[instrumentation] auto-seed guard error:', err)
  }
}
