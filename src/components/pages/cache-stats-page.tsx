'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Activity, ArrowLeft, AlertTriangle, RefreshCw, Database, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'

/**
 * Task 78 — REAL cache telemetry. The old page INVENTED its numbers
 * ("94.2% Cloudflare hit ratio", "1.42 GB saved" — metrics collected
 * nowhere). Now it renders the actual in-memory API cache counters from
 * GET /api/admin/cache-stats: what this server process really served, hit,
 * invalidated, and holds right now. Counters reset on restart (stated).
 */

interface CacheStats {
  counters: { freshHits: number; staleServed: number; dbLoads: number; invalidated: number }
  entries: number
  inFlight: number
  byPrefix: Array<{ prefix: string; keys: number }>
  hitRatio: number | null
  note: string
}

export function CacheStatsPage() {
  const { navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/admin/cache-stats', { headers })
      if (res.status === 401) { setNeedsAuth(true); setStats(null); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Couldn't load cache stats (HTTP ${res.status})`)
        setStats(null)
        return
      }
      setStats(json.data)
    } catch {
      setError('Network error while loading cache stats.')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load(); }, [load])

  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : n.toLocaleString('en-US')

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('cache-settings')} className="gap-2 text-xs font-semibold">
          <ArrowLeft className="h-4 w-4" /> Back to Cache Settings
        </Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 text-xs font-semibold rounded-xl">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> API Cache Telemetry
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          The in-memory API cache of THIS server process — real counters, not estimates. They reset on restart.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
          <div className="h-28 bg-muted rounded-2xl" />
          <div className="h-28 bg-muted rounded-2xl" />
        </div>
      ) : needsAuth ? (
        <div className="border rounded-2xl p-8 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
          <p className="text-sm font-bold">Admin access required</p>
          <p className="text-xs text-muted-foreground">Cache telemetry is admin-only — sign in with an admin account.</p>
        </div>
      ) : error ? (
        <div className="border rounded-2xl p-8 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-red-300 mx-auto" />
          <p className="text-sm font-bold">{error}</p>
          <Button variant="outline" onClick={load} className="rounded-xl text-xs font-bold">Retry</Button>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                <Zap className="h-3.5 w-3.5 text-emerald-500" /> Fresh hits
              </div>
              <div className="text-2xl font-black font-mono text-emerald-600">{fmt(stats.counters.freshHits)}</div>
              <p className="text-[10px] text-muted-foreground">Responses served from memory without touching the DB.</p>
            </div>
            <div className="border rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                <Database className="h-3.5 w-3.5 text-sky-500" /> DB loads
              </div>
              <div className="text-2xl font-black font-mono text-sky-600">{fmt(stats.counters.dbLoads)}</div>
              <p className="text-[10px] text-muted-foreground">Real database round-trips (misses + background refreshes).</p>
            </div>
            <div className="border rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                <Activity className="h-3.5 w-3.5 text-amber-500" /> Stale served
              </div>
              <div className="text-2xl font-black font-mono text-amber-600">{fmt(stats.counters.staleServed)}</div>
              <p className="text-[10px] text-muted-foreground">Stale-while-revalidate answers (kept truth during refresh/DB failure).</p>
            </div>
            <div className="border rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                <RefreshCw className="h-3.5 w-3.5 text-rose-500" /> Invalidated
              </div>
              <div className="text-2xl font-black font-mono text-rose-600">{fmt(stats.counters.invalidated)}</div>
              <p className="text-[10px] text-muted-foreground">Entries dropped by write-side invalidation (Task 68 coherence).</p>
            </div>
          </div>

          <div className="border rounded-2xl p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Hit ratio</div>
              <div className="text-xl font-black font-mono">{stats.hitRatio == null ? '—' : `${stats.hitRatio}%`}</div>
              <p className="text-[10px] text-muted-foreground">(fresh + stale) ÷ total requests</p>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Live entries</div>
              <div className="text-xl font-black font-mono">{fmt(stats.entries)}</div>
              <p className="text-[10px] text-muted-foreground">keys in memory right now</p>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">In-flight loads</div>
              <div className="text-xl font-black font-mono">{fmt(stats.inFlight)}</div>
              <p className="text-[10px] text-muted-foreground">single-flight DB round-trips running</p>
            </div>
          </div>

          <div className="border rounded-2xl p-4">
            <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground mb-3">Entries by cache family</h2>
            {stats.byPrefix.length === 0 ? (
              <p className="text-xs text-muted-foreground">The cache is empty right now — make a few catalog requests and refresh.</p>
            ) : (
              <div className="space-y-2">
                {stats.byPrefix.map((p) => (
                  <div key={p.prefix} className="flex items-center gap-3">
                    <span className="text-xs font-bold font-mono w-40 truncate">{p.prefix}</span>
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full"
                        style={{ width: `${Math.min(100, (p.keys / Math.max(1, stats.entries)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-black tabular-nums w-10 text-right">{p.keys}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed">{stats.note}</p>
        </>
      ) : null}
    </div>
  )
}
export default CacheStatsPage
