'use client'

/**
 * LiveDeliverySection — the customer-facing live tracking block on the
 * order tracking page. Renders ONLY honest states:
 *  - while a sub-order is shipped but no driver is assigned yet → an honest
 *    "live tracking not active" note (no fake map, no fake pins);
 *  - with an active delivery → the real map (driver ping + route + ETA);
 *  - errors → what went wrong, with a retry.
 */

import dynamic from 'next/dynamic'
import { AlertTriangle, RefreshCw, Satellite } from 'lucide-react'
import { useLiveDelivery } from '@/hooks/use-live-delivery'

// maplibre-gl requires window — client-only chunk
const LiveDeliveryMap = dynamic(() => import('@/components/maps/live-delivery-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] md:h-[420px] w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 animate-pulse" />
  ),
})

interface Props {
  orderId: string
  /** true when at least one sub-order is out for delivery (status 'shipped') */
  orderInTransit: boolean
}

export default function LiveDeliverySection({ orderId, orderInTransit }: Props) {
  const { data, loading, error, lastUpdated, socketConnected, refresh } =
    useLiveDelivery(orderId, orderInTransit)

  // Order not in transit → live tracking is simply not applicable; the
  // page's own progress stepper already tells the story. Render nothing.
  if (!orderInTransit) return null

  if (loading && !data) {
    return (
      <section aria-busy="true" className="space-y-2">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Satellite className="h-4 w-4 text-[var(--primary)]" /> Live Delivery Tracking
        </h3>
        <div className="h-[300px] md:h-[420px] w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 animate-pulse" />
      </section>
    )
  }

  if (error && !data) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Satellite className="h-4 w-4 text-[var(--primary)]" /> Live Delivery Tracking
        </h3>
        <div className="rounded-2xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{error}</p>
            <button
              onClick={refresh}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Try again
            </button>
          </div>
        </div>
      </section>
    )
  }

  // Real answer from the API: no live delivery on this order (yet)
  if (data && !data.live) {
    return (
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start gap-3">
        <Satellite className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Live driver tracking is not active for this order yet.
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {data.message}
          </p>
        </div>
      </section>
    )
  }

  if (!data || !data.live) return null

  const newestPing = data.legs
    .map((l) => l.latestPing?.recordedAt)
    .filter((t): t is string => !!t)
    .sort()
    .at(-1)

  return (
    <section className="space-y-2" aria-label="Live delivery tracking">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Satellite className="h-4 w-4 text-[var(--primary)]" /> Live Delivery Tracking
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
              socketConnected
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
            title={
              socketConnected
                ? 'Connected to the live delivery channel — driver positions arrive instantly'
                : 'Live channel offline — refreshing every 20 seconds instead'
            }
          >
            <span className={`h-1.5 w-1.5 rounded-full ${socketConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {socketConnected ? 'Realtime' : 'Polling'}
          </span>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            title="Refresh now"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-US', { hour12: false })}` : 'Refresh'}
          </button>
        </div>
      </div>

      <LiveDeliveryMap data={data} />

      {/* Honest notes from the backend (stale ping, un-geocoded address, routing outage) */}
      {data.notes.length > 0 && (
        <ul className="space-y-1">
          {data.notes.map((note, i) => (
            <li key={i} className="text-[10.5px] leading-snug text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
              {note}
            </li>
          ))}
        </ul>
      )}

      {newestPing && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          Driver position last received {new Date(newestPing).toLocaleTimeString('en-US', { hour12: false })} ·
          positions are sent by the driver&apos;s own phone while the delivery is in progress.
        </p>
      )}
    </section>
  )
}
