'use client'

/**
 * TARGETED CACHE INVALIDATION — Task 176-c. The previous page rendered four
 * hardcoded cache-tag cards ("products-bulk-pricing", "categories-tree",
 * "currency-exchange-rates", "supplier-storefronts") whose "Invalidate"
 * buttons ONLY set local state and showed a success toast claiming the tag
 * was "invalidated across local AND edge layers" — but no API was called.
 * Pure theater: nothing was invalidated anywhere.
 *
 * Edge-cache invalidation is admin-only on Zylod (the only writer for
 * /api/admin/cache-stats is the admin console). The web client can only
 * clear its OWN HTTP cache via the Cache API. This rewrite is the honest
 * version: explains the situation, links to the admin cache-stats console
 * for admins, and provides the one real action a non-admin can take (clear
 * the local HTTP cache — same as cache-settings, but with the "targeted"
 * framing preserved for the URL).
 */
import React, { useState } from 'react'
import { Trash2, ArrowLeft, CheckCircle2, AlertCircle, ShieldAlert, Server } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function PurgeCachePage() {
  const { navigate } = useNavigationStore()
  const [clearing, setClearing] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLocalPurge = async () => {
    setClearing(true)
    setError(null)
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map(name => caches.delete(name)))
      }
      setDone(true)
      window.setTimeout(() => setDone(false), 2500)
    } catch {
      setError('Your browser blocked the cache delete. Try closing other Zylod tabs and reload.')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('cache-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Cache Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Targeted Cache Invalidation</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Edge cache invalidation is admin-only — here is what you can do from the web client
        </p>
      </div>

      {done && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Local HTTP cache cleared. The next page load will fetch fresh responses from the server.
        </div>
      )}

      {error && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-200 flex items-start gap-2 text-xs font-medium">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Edge-cache invalidation is admin-only
          </CardTitle>
          <CardDescription className="text-xs">
            Zylod serves cached responses from a shared edge layer — only admins can purge a tag
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <p>
            The previous version of this page showed four &quot;Invalidate&quot; buttons that did nothing — they
            set local state and showed a success toast, but no API was called and nothing was invalidated at the
            edge. This page no longer pretends to invalidate tags it cannot reach.
          </p>
          <p>
            If you are an admin, the cache-stats console shows real hit/miss ratios and lets you flush a tag
            server-side. Non-admins can clear their own browser&apos;s HTTP cache below — the next page load will
            re-fetch fresh responses from Zylod.
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('cache-stats')}
              className="text-xs font-bold gap-1.5"
            >
              <Server className="h-3.5 w-3.5" /> Open admin cache stats
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Clear local HTTP cache
          </CardTitle>
          <CardDescription className="text-xs">
            Drops every ServiceWorker-cached response on this device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleLocalPurge}
            disabled={clearing}
            className="text-xs font-bold gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {clearing ? 'Clearing...' : 'Clear Local HTTP Cache'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
export default PurgeCachePage
