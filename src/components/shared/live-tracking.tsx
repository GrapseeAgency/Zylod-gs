'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { Truck, Navigation } from 'lucide-react'

// react-leaflet must be loaded client-side only (SSR-safe)
const LeafletMap = dynamic(() => import('./live-tracking-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-48 bg-gray-100 rounded-xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-1.5">
        <Truck className="h-6 w-6 text-[#E53935] animate-pulse" />
        <span className="text-xs text-muted-foreground">Loading live map...</span>
      </div>
    </div>
  ),
})

export interface LiveTrackingPoint {
  id: string
  status: string
  location: string | null
  note: string | null
  lat: number | null
  lng: number | null
  speed: number | null
  trackedAt: string
}

export interface LiveTrackingProps {
  points: LiveTrackingPoint[]
  /** Optional destination lat/lng — draws the last-mile route line */
  destination?: { lat: number; lng: number } | null
  status: string
  estimatedDelivery?: string | null
}

export default function LiveTracking({
  points,
  destination,
  status,
  estimatedDelivery,
}: LiveTrackingProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  // Filter to points that actually have GPS coords
  const gpsPoints = points.filter((p): p is LiveTrackingPoint & { lat: number; lng: number } => p.lat != null && p.lng != null)

  // Live badge
  const isLive = gpsPoints.length > 0 && !['delivered', 'cancelled', 'returned'].includes(status)

  return (
    <div className="relative">
      <LeafletMap points={gpsPoints as { lat: number; lng: number; location: string | null; speed: number | null; trackedAt: string }[]} destination={destination || null} status={status} />

      {/* Overlay: status + ETA */}
      <div className="absolute bottom-3 left-3 right-3 z-[500] flex items-center gap-3 bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isLive && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
            <p className="text-xs font-semibold capitalize truncate">
              {status.replace(/_/g, ' ')}
            </p>
          </div>
          {isLive && gpsPoints.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              <Navigation className="h-2.5 w-2.5 inline mr-1 text-[#E53935]" />
              {gpsPoints[gpsPoints.length - 1].location || 'Driver en route'}
              {gpsPoints[gpsPoints.length - 1].speed != null && ` · ${Math.round(gpsPoints[gpsPoints.length - 1].speed!)} km/h`}
            </p>
          )}
          {!isLive && estimatedDelivery && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Est. delivery: {new Date(estimatedDelivery).toLocaleDateString()}</p>
          )}
        </div>
        {isLive && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </div>
        )}
      </div>
    </div>
  )
}
