'use client'

/**
 * useLiveDelivery — feeds the customer's live delivery map.
 *
 * Transport strategy (real-time only via socket.io, per project rules):
 *  1. REST: GET /api/delivery/orders/[orderId]/live gives the full snapshot
 *     (latest persisted ping, destination, OSRM route/ETA, honest notes).
 *  2. PUSH: fetches a short-lived signed room token from
 *     GET /api/delivery/orders/[orderId]/room-token (same authorization as
 *     the /live endpoint), then subscribes to the delivery socket.io room
 *     with it; every driver ping triggers an immediate snapshot refresh so
 *     route/ETA stay consistent. The token is refreshed ~8 min (it expires
 *     after 10) and re-fetched on every socket reconnect.
 *  3. FALLBACK: while the socket is disconnected OR the room join was
 *     denied, the hook polls the REST snapshot every 20s — live data never
 *     depends on the push channel and denied state is rendered honestly.
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
// Room tokens expire after 10 min (DELIVERY_ROOM_TOKEN_TTL_SECONDS) —
// re-subscribe with a fresh token before that.
const ROOM_TOKEN_REFRESH_MS = 8 * 60 * 1000

/**
 * Push-channel authorization state:
 *  - 'connecting' → socket up, token fetch / room join in flight;
 *  - 'live'       → joined the signed room, push is active;
 *  - 'denied'     → the server refused the join (missing/invalid/expired
 *    token, not signed in, or token endpoint unreachable) — NO fake push
 *    data; the 20s REST polling keeps the map honest instead.
 */
export type LiveFeedStatus = 'connecting' | 'live' | 'denied'

export function useLiveDelivery(orderId: string, enabled = true) {
  const [data, setData] = useState<LiveDeliveryResponse | null>(null)
  const [loading, setLoading] = useState(enabled && !!orderId)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [liveFeed, setLiveFeed] = useState<LiveFeedStatus>('connecting')

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

  // Signed room token: same auth pattern as the /live snapshot fetch
  // (credentials: 'include'); 401/403 → null → honest polling-only state.
  const fetchRoomToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(
        `/api/delivery/orders/${encodeURIComponent(orderId)}/room-token`,
        { credentials: 'include' }
      )
      if (!mountedRef.current || !res.ok) return null
      const json = (await res.json()) as { success?: boolean; token?: unknown }
      return typeof json.token === 'string' && json.token.length > 0 ? json.token : null
    } catch {
      return null
    }
  }, [orderId])

  // socket.io push channel (signed room tokens required by the server)
  useEffect(() => {
    if (!orderId || !enabled) return
    let disposed = false
    let tokenTimer: ReturnType<typeof setInterval> | null = null

    const subscribeWithToken = async () => {
      const token = await fetchRoomToken()
      if (disposed) return
      if (!token) {
        // No token → the server would (and must) refuse the join. Polling
        // via the authed REST API keeps the data honest; no fake push.
        setLiveFeed('denied')
        return
      }
      socket.emit('subscribe', { orderId, token })
    }

    const socket = io('/?XTransformPort=3005', {
      path: '/',
      transports: ['polling', 'websocket'],
      reconnectionDelay: 2_000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      if (disposed) return
      setSocketConnected(true)
      void subscribeWithToken()
    })
    socket.on('disconnect', () => {
      if (!disposed) setSocketConnected(false)
    })
    socket.on('subscribe:ok', () => {
      if (disposed) return
      setSocketConnected(true)
      setLiveFeed('live')
    })
    socket.on('subscribe:denied', () => {
      if (disposed) return
      setLiveFeed('denied')
    })
    // A fresh driver ping arrived → pull a full snapshot (route/ETA included)
    socket.on('delivery:ping', () => {
      if (!disposed) refresh()
    })

    // Re-subscribe with a fresh token before the 10-min token expiry.
    tokenTimer = setInterval(() => {
      if (disposed || !socket.connected) return
      void subscribeWithToken()
    }, ROOM_TOKEN_REFRESH_MS)

    return () => {
      disposed = true
      if (tokenTimer) clearInterval(tokenTimer)
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
      setSocketConnected(false)
    }
  }, [orderId, enabled, refresh, fetchRoomToken])

  return { data, loading, error, lastUpdated, socketConnected, liveFeed, refresh }
}
