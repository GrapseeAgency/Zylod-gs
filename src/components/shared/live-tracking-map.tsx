'use client'

import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'

// Fix default marker icons (Leaflet's default paths break under bundlers)
const truckIcon = L.divIcon({
  className: '',
  html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#E53935;color:#fff;box-shadow:0 2px 8px rgba(229,57,53,0.5);border:3px solid #fff;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/><path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 18h6"/></svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const destinationIcon = L.divIcon({
  className: '',
  html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#16A34A;color:#fff;box-shadow:0 2px 8px rgba(22,163,74,0.5);border:3px solid #fff;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z"/></svg>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

function FitToBounds({ points, destination }: { points: [number, number][]; destination: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0 && !destination) {
      map.setView([23.8103, 90.4125], 11) // default Dhaka
      return
    }
    const all: [number, number][] = [...points]
    if (destination) all.push(destination)
    if (all.length === 1) {
      map.setView(all[0], 14)
    } else {
      map.fitBounds(L.latLngBounds(all), { padding: [40, 40] })
    }
  }, [points, destination, map])
  return null
}

interface LiveTrackingMapProps {
  points: { lat: number; lng: number; location: string | null; speed: number | null; trackedAt: string }[]
  destination: { lat: number; lng: number } | null
  status: string
}

export default function LiveTrackingMap({ points, destination, status }: LiveTrackingMapProps) {
  const gpsPoints = useMemo(
    () => points.map(p => [p.lat, p.lng] as [number, number]),
    [points]
  )
  const latest = points.length > 0 ? points[points.length - 1] : null
  const dest = destination ? [destination.lat, destination.lng] as [number, number] : null

  return (
    <div className="w-full h-52 rounded-xl overflow-hidden relative z-0" style={{ containerType: 'inline-size' }}>
      <MapContainer
        center={latest ? [latest.lat, latest.lng] : dest ? [dest[0], dest[1]] : [23.8103, 90.4125]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToBounds points={gpsPoints} destination={dest} />

        {/* Route line of GPS pings */}
        {gpsPoints.length >= 2 && (
          <Polyline positions={gpsPoints} pathOptions={{ color: '#E53935', weight: 3, dashArray: '6 4' }} />
        )}

        {/* Destination marker */}
        {dest && <Marker position={dest} icon={destinationIcon}><Popup>Delivery destination</Popup></Marker>}

        {/* Driver marker (latest GPS fix) */}
        {latest && (
          <Marker position={[latest.lat, latest.lng]} icon={truckIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-semibold capitalize">{status.replace(/_/g, ' ')}</p>
                <p className="text-muted-foreground">{latest.location || 'Driver location'}</p>
                {latest.speed != null && <p className="text-muted-foreground">{Math.round(latest.speed)} km/h</p>}
                <p className="text-[10px] text-muted-foreground">{new Date(latest.trackedAt).toLocaleString()}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
