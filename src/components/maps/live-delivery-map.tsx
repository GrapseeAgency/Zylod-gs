'use client'

/**
 * LiveDeliveryMap — customer-facing live delivery map (web).
 *
 * Renders the driver's latest persisted GPS position, the delivery
 * destination, and the road route between them — all on a basemap assembled
 * from the site's own theme tokens (src/lib/map-style.ts), so it matches
 * every theme without a designer redrawing one.
 *
 * Honesty rules:
 *  - No driver ping yet → message, not a fake pin.
 *  - Destination without coordinates → note, not an invented point.
 *  - No road route (routing service down) → straight dashed line labeled as
 *    straight-line distance; ETA omitted entirely.
 *  - Attribution (OSM / OpenFreeMap) always visible via MapLibre control.
 *
 * This component is imported through next/dynamic with ssr:false —
 * maplibre-gl touches window at module scope.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  AttributionControl,
  ScaleControl,
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle, readThemeTokens } from '@/lib/map-style'
import type { LiveDeliveryData } from '@/hooks/use-live-delivery'
import { Navigation, MapPin, Radio } from 'lucide-react'

interface Props {
  data: LiveDeliveryData
  className?: string
}

function formatDistance(m: number | null): string | null {
  if (m == null || !isFinite(m)) return null
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

function formatEta(s: number | null): string | null {
  if (s == null || !isFinite(s) || s <= 0) return null
  const min = Math.max(1, Math.round(s / 60))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

export default function LiveDeliveryMap({ data, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const latestPing = useMemo(() => {
    const withPings = data.legs.filter((l) => l.latestPing)
    if (withPings.length === 0) return null
    return withPings.reduce((a, b) =>
      new Date(b.latestPing!.recordedAt) > new Date(a.latestPing!.recordedAt) ? b : a
    )
  }, [data.legs])

  const ping = latestPing?.latestPing ?? null
  const dest = data.destination
  const routeGeometry = data.routing?.geometry ?? null
  const straightLine = data.routing?.straightLineM ?? null

  // Build the map once per mount; rebuild style when the document theme flips
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const themeAttr = document.documentElement.getAttribute('data-theme') || document.documentElement.className
    const currentTheme = themeAttr.includes('dark') ? 'dark' : 'light'

    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildMapStyle(readThemeTokens()) as StyleSpecification,
      center: ping ? [ping.lng, ping.lat] : dest ? [dest.lng, dest.lat] : [90.4, 23.8],
      zoom: ping ? 13 : 11,
      attributionControl: false,
      interactive: true,
    })
    mapRef.current = map

    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    map.addControl(
      new NavigationControl({ showCompass: false, visualizePitch: false }),
      'top-right'
    )

    map.on('load', () => setMapReady(true))

    const observer = new MutationObserver(() => {
      const attr = document.documentElement.getAttribute('data-theme') || document.documentElement.className
      const nextTheme = attr.includes('dark') ? 'dark' : 'light'
      if (nextTheme !== currentTheme) {
        observer.disconnect()
        // Rebuild the whole style from freshly-read tokens
        map.setStyle(buildMapStyle(readThemeTokens()) as StyleSpecification)
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  // Data layers: destination, driver, route
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const apply = () => {
      /* ── Route line (real geometry or honest straight fallback) ── */
      const lineCoords: [number, number][] | null =
        routeGeometry && routeGeometry.length >= 2
          ? routeGeometry
          : ping && dest
            ? [
                [ping.lng, ping.lat],
                [dest.lng, dest.lat],
              ]
            : null

      if (map.getSource('delivery-line')) {
        ;(map.getSource('delivery-line') as GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: lineCoords ?? [] },
        })
      } else if (lineCoords) {
        map.addSource('delivery-line', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lineCoords } },
        })
        map.addLayer({
          id: 'delivery-line',
          type: 'line',
          source: 'delivery-line',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': routeGeometry ? readThemeTokens().primary : readThemeTokens().mutedForeground,
            'line-width': 4,
            'line-opacity': routeGeometry ? 0.9 : 0.5,
            ...(routeGeometry ? {} : { 'line-dasharray': [2, 2] }),
          },
        })
      }

      /* ── Driver marker (pulsing dot at the real ping) ── */
      const driverEl = document.createElement('div')
      driverEl.className = 'live-driver-marker'
      driverEl.innerHTML =
        '<span class="live-driver-marker__ring"></span><span class="live-driver-marker__dot"></span>'
      if (ping) {
        new Marker({ element: driverEl, anchor: 'center' })
          .setLngLat([ping.lng, ping.lat])
          .addTo(map)
      }

      /* ── Destination pin ── */
      if (dest) {
        const destEl = document.createElement('div')
        destEl.className = 'live-dest-marker'
        destEl.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="currentColor" stroke="none"/></svg>'
        new Marker({ element: destEl, anchor: 'bottom' })
          .setLngLat([dest.lng, dest.lat])
          .addTo(map)
      }

      /* ── Fit both points ── */
      const points: [number, number][] = []
      if (ping) points.push([ping.lng, ping.lat])
      if (dest) points.push([dest.lng, dest.lat])
      if (points.length === 2) {
        map.fitBounds(
          [
            [Math.min(points[0][0], points[1][0]), Math.min(points[0][1], points[1][1])],
            [Math.max(points[0][0], points[1][0]), Math.max(points[0][1], points[1][1])],
          ],
          { padding: { top: 70, bottom: 90, left: 40, right: 40 }, maxZoom: 15, duration: 900 }
        )
      } else if (points.length === 1) {
        map.flyTo({ center: points[0], zoom: 14, duration: 900 })
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('styledata', apply)
  }, [mapReady, ping?.lat, ping?.lng, dest?.lat, dest?.lng, routeGeometry?.length])

  const roadDistance = formatDistance(data.routing?.distanceM ?? null)
  const shownDistance = roadDistance ?? formatDistance(straightLine)
  const eta = formatEta(data.routing?.durationS ?? null)
  const isStraight = !roadDistance && shownDistance !== null
  const driverName = latestPing?.driver.name ?? null

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 ${className ?? ''}`}>
      {/* Map canvas — honest empty states render inside the same frame */}
      <div
        ref={containerRef}
        className="h-[300px] md:h-[420px] w-full"
        role="application"
        aria-label="Live delivery map showing the driver's current position"
      />

      <style jsx global>{`
        .live-driver-marker {
          position: relative;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .live-driver-marker__dot {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: var(--primary, #c0392b);
          border: 2.5px solid var(--background, #fff);
          box-shadow: 0 1px 6px rgb(0 0 0 / 0.35);
          z-index: 1;
        }
        .live-driver-marker__ring {
          position: absolute;
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: var(--primary, #c0392b);
          opacity: 0.35;
          animation: live-driver-pulse 1.8s ease-out infinite;
        }
        @keyframes live-driver-pulse {
          0% { transform: scale(0.55); opacity: 0.5; }
          80% { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .live-dest-marker {
          width: 30px;
          height: 30px;
          color: var(--primary, #c0392b);
          filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.3));
        }
        .live-dest-marker svg { width: 100%; height: 100%; }
        .maplibregl-ctrl-attrib {
          font-size: 10px !important;
          background: rgb(255 255 255 / 0.75) !important;
        }
        .dark .maplibregl-ctrl-attrib {
          background: rgb(18 18 18 / 0.75) !important;
        }
        .dark .maplibregl-ctrl-attrib a { color: #a3a3a3 !important; }
        .maplibregl-ctrl-scale {
          background: rgb(255 255 255 / 0.6);
          border-color: #999;
          font-size: 10px;
        }
      `}</style>

      {/* ── Status overlay card ── */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
        {/* Live badge + driver */}
        <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 px-3 py-2 shadow-sm">
          {ping ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <div className="leading-tight">
                <p className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  Live
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                  {driverName ? `Driver ${driverName}` : 'Driver on the way'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Waiting for driver location…
              </p>
            </div>
          )}
        </div>

        {/* Distance / ETA chip */}
        {(shownDistance || eta || isStraight) && (
          <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 px-3 py-2 shadow-sm text-right">
            {eta ? (
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight">{eta}</p>
            ) : (
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-tight uppercase tracking-wide">
                No ETA
              </p>
            )}
            {shownDistance && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {isStraight ? 'straight-line ' : ''}
                {shownDistance}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Honest footnote for degraded states */}
      {(isStraight || !ping || !dest) && (
        <div className="absolute inset-x-3 bottom-9 z-10">
          <p className="rounded-lg bg-white/92 dark:bg-slate-900/92 backdrop-blur border border-slate-200 dark:border-slate-700 px-3 py-2 text-[10.5px] leading-snug text-slate-600 dark:text-slate-300">
            {!ping && 'The driver has not sent a location yet — the map shows no driver position.'}
            {!dest && ping && ' The delivery address has no map coordinates, so only the driver position is shown.'}
            {isStraight && ' Road routing is unavailable — the dashed line is a straight-line distance, not a route, and no ETA is shown.'}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 bottom-9 z-10 hidden md:flex flex-col gap-1 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 px-3 py-2 shadow-sm">
        <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-[var(--primary,#c0392b)]" /> Driver
        </span>
        <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          <MapPin className="h-2.5 w-2.5 text-[var(--primary,#c0392b)]" /> Delivery address
        </span>
        <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          <Navigation className="h-2.5 w-2.5 text-[var(--primary,#c0392b)]" /> Route to you
        </span>
      </div>
    </div>
  )
}
