'use client'

/**
 * useLiveDelivery — feeds the customer's live delivery map.
 *
 * Transport strategy (real-time only via socket.io, per project rules):
 *  1. REST: GET /api/delivery/orders/[orderId]/live gives the full snapshot
 *     (latest persisted ping, destination, OSRM route/ETA, honest notes).
 *  2. PUSH: subscribes to the delivery socket.io service room for this
 *     order; every driver ping triggers an immediate snapshot refresh so
 *     route/ETA stay consistent.
 *  3. FALLBACK: while the socket is disconnected the hook polls the REST
 *     snapshot every 20s — live data never depends on the push channel.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export interface LivePing {
  lat: number
  lng: number
  accuracy: number | null
  speed: number | null
  heading: number | null
  recordedAt: string
}

export interface LiveLeg {
  subOrderId: string
  status: string
  driver: { id: string; name: string }
  latestPing: LivePing | null
}

export interface LiveRouting {
  distanceM: number | null
  durationS: number | null
  geometry: [number, number][] | null
  straightLineM: number
  provider: string | null
}

export interface LiveDestination {
  lat: number
  lng: number
  label: string
  city: string
  district: string
  addressLine1: string
}

export interface LiveDeliveryData {
  live: true
  orderNumber: string
  legs: LiveLeg[]
  destination: LiveDestination | null
  routing: LiveRouting | null
  notes: string[]
}

export interface LiveDeliveryUnavailable {
  live: false
  reason: string
  message: string
  orderNumber?: string
}

export type LiveDeliveryResponse = LiveDeliveryData | LiveDeliveryUnavailable

const POLL_MS = 20_000

export function useLiveDelivery(orderId: string, enabled = true) {
  const [data, setData] = useState<LiveDeliveryResponse | null>(null)
  const [loading, setLoading] = useState(enabled && !!orderId)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await fetch(
        `/api/delivery/orders/${encodeURIComponent(orderId)}/live`,
        { credentials: 'include' }
      )
      if (!mountedRef.current) return
      if (res.status === 401) {
        setError('Sign in to view live delivery tracking.')
      } else if (res.status === 403) {
        setError('You do not have access to this delivery.')
      } else if (res.status === 429) {
        setError('Too many refresh requests — waiting a moment.')
      } else if (!res.ok) {
        setError(`Live delivery service error (${res.status}).`)
      } else {
        const json = (await res.json()) as LiveDeliveryResponse
        setData(json)
        setError(null)
        setLastUpdated(new Date())
      }
    } catch {
      if (mountedRef.current) setError('Could not reach the delivery service.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [orderId])

  // Initial fetch + polling fallback while socket is down
  useEffect(() => {
    mountedRef.current = true
    if (!orderId || !enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    refresh()

    const interval = setInterval(() => {
      if (!document.hidden) refresh()
    }, POLL_MS)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [orderId, enabled, refresh])

  // socket.io push channel
  useEffect(() => {
    if (!orderId || !enabled) return
    let disposed = false

    const socket = io('/?XTransformPort=3005', {
      path: '/',
      transports: ['polling', 'websocket'],
      reconnectionDelay: 2_000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      if (disposed) return
      setSocketConnected(true)
      socket.emit('subscribe', { orderId })
    })
    socket.on('disconnect', () => {
      if (!disposed) setSocketConnected(false)
    })
    socket.on('delivery:subscribed', () => {
      if (!disposed) setSocketConnected(true)
    })
    // A fresh driver ping arrived → pull a full snapshot (route/ETA included)
    socket.on('delivery:ping', () => {
      if (!disposed) refresh()
    })

    return () => {
      disposed = true
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
      setSocketConnected(false)
    }
  }, [orderId, enabled, refresh])

  return { data, loading, error, lastUpdated, socketConnected, refresh }
}
