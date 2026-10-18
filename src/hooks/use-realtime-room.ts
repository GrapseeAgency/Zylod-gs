'use client'

/**
 * useRealtimeRoom — generic client subscription to the platform's real-time
 * socket.io backbone (mini-services/delivery-service, port 3005 via gateway).
 *
 * Connection options mirror src/hooks/use-live-delivery.ts exactly:
 *   io('/?XTransformPort=3005', { path: '/', transports: ['polling','websocket'],
 *   reconnectionDelay: 2_000 }) — socket.io then reconnects with its own
 *   exponential backoff on top of that base delay, exactly like the delivery
 *   map does.
 *
 * Room rules (server-enforced, mirrored here for honest UX):
 *   product:<id>            — PUBLIC: joins without a token.
 *   order:|seller:|admin:<id> — TOKEN-GATED: the hook first fetches
 *     GET /api/realtime/room-token?room=<room> with credentials:'include'
 *     (order rooms use the delivery room-token endpoint — pass getToken to
 *     override for those). If no token can be obtained, the room is honestly
 *     reported as denied — never a fabricated "connected" state.
 *
 * Tokens expire after 10 minutes; gated rooms are re-subscribed with a fresh
 * token every 8 minutes (same cadence as use-live-delivery) and on every
 * socket reconnect.
 *
 * Server subscribe budget note: the socket service allows 10 subscribes per
 * minute per socket. When subscribing to MANY rooms (e.g. one product room per
 * inventory row) pass at most ~8 — the hook caps arrays at MAX_ROOMS for that
 * reason.
 */

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export interface RealtimeRoomMessage {
  room: string
  event: string
  data: unknown
  receivedAt: Date
}

export interface UseRealtimeRoomOptions {
  /** Override token fetching (e.g. the delivery order-room endpoint). Return null → denied. */
  getToken?: (room: string) => Promise<string | null>
  /** Default true. */
  enabled?: boolean
  /** Called for every event received on any joined room (in addition to lastEvent). */
  onEvent?: (message: RealtimeRoomMessage) => void
}

export interface UseRealtimeRoomResult {
  connected: boolean
  /** True when at least one requested (token-gated) room was denied / could not be joined. */
  denied: boolean
  lastEvent: RealtimeRoomMessage | null
  eventCount: number
}

/** Server allows 10 subscribes/min/socket — keep headroom below it. */
const MAX_ROOMS = 8
const ROOM_TOKEN_REFRESH_MS = 8 * 60 * 1000
const ROOM_PATTERN = /^(order|product|seller|admin):[A-Za-z0-9_-]+$/

function roomsNeedToken(room: string): boolean {
  return !room.startsWith('product:')
}

/** Default mint path: GET /api/realtime/room-token?room=... (cookie session). */
async function fetchRoomToken(room: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/realtime/room-token?room=${encodeURIComponent(room)}`, {
      credentials: 'include',
    })
    if (!res.ok) return null
    const json = (await res.json()) as { success?: boolean; token?: unknown }
    return typeof json.token === 'string' && json.token.length > 0 ? json.token : null
  } catch {
    return null
  }
}

export function useRealtimeRoom(
  rooms: string | string[],
  options: UseRealtimeRoomOptions = {}
): UseRealtimeRoomResult {
  const roomList = (Array.isArray(rooms) ? rooms : [rooms])
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .map((r) => r.trim())
    .filter((r) => {
      if (ROOM_PATTERN.test(r)) return true
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`useRealtimeRoom: ignoring malformed room "${r}"`)
      }
      return false
    })
    .slice(0, MAX_ROOMS)
  const roomKey = roomList.join('|')

  const [connected, setConnected] = useState(false)
  const [denied, setDenied] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeRoomMessage | null>(null)
  const [eventCount, setEventCount] = useState(0)

  // Latest callbacks without resubscribing on every render.
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    if (roomKey === '') {
      setConnected(false)
      setDenied(false)
      return
    }
    const roomsToJoin = roomKey.split('|')
    const gatedRooms = roomsToJoin.filter(roomsNeedToken)

    let disposed = false
    let tokenTimer: ReturnType<typeof setInterval> | null = null

    // Per-room truth for the honest `denied` flag.
    const joinState = new Map<string, 'pending' | 'joined' | 'denied'>()
    const recomputeDenied = () => {
      let anyDenied = false
      for (const room of roomsToJoin) {
        if (joinState.get(room) === 'denied') anyDenied = true
      }
      setDenied(anyDenied)
    }

    const joinRoom = async (room: string, socket: Socket) => {
      if (!roomsNeedToken(room)) {
        joinState.set(room, 'pending')
        socket.emit('subscribe', { room })
        return
      }
      const getToken = optionsRef.current.getToken
      const token = getToken ? await getToken(room) : await fetchRoomToken(room)
      if (disposed) return
      if (!token) {
        // Honest refusal path — no fake push data, same as use-live-delivery.
        joinState.set(room, 'denied')
        recomputeDenied()
        return
      }
      joinState.set(room, 'pending')
      socket.emit('subscribe', { room, token })
    }

    const joinAll = (socket: Socket) => {
      for (const room of roomsToJoin) void joinRoom(room, socket)
    }

    const socket = io('/?XTransformPort=3005', {
      path: '/',
      transports: ['polling', 'websocket'],
      reconnectionDelay: 2_000,
    })

    socket.on('connect', () => {
      if (disposed) return
      setConnected(true)
      joinAll(socket)
    })
    socket.on('disconnect', () => {
      if (disposed) return
      setConnected(false)
      // Rooms are lost server-side on disconnect; rejoin on the next connect.
    })
    socket.on('subscribe:ok', (data: { roomId?: unknown }) => {
      if (disposed) return
      if (typeof data?.roomId === 'string') joinState.set(data.roomId, 'joined')
      recomputeDenied()
    })
    // The server's denial payload carries only { reason } (no roomId) — a
    // denial applies to the room(s) currently awaiting their join result.
    socket.on('subscribe:denied', () => {
      if (disposed) return
      let touched = false
      for (const [room, state] of joinState) {
        if (state === 'pending') {
          joinState.set(room, 'denied')
          touched = true
        }
      }
      if (touched) recomputeDenied()
    })

    // Generic event tap — the hook is room-generic, not event-generic.
    // Control frames (subscribe:ok/denied) are handled above and are NOT
    // reported as room events. socket.io does not tell the client which room
    // an event came from; with a single joined room we can state it honestly,
    // otherwise room stays '' (unknown).
    socket.onAny((event: string, ...args: unknown[]) => {
      if (disposed || event.startsWith('subscribe:')) return
      const message: RealtimeRoomMessage = {
        room: roomsToJoin.length === 1 ? roomsToJoin[0] : '',
        event,
        data: args[0],
        receivedAt: new Date(),
      }
      setLastEvent(message)
      setEventCount((c) => c + 1)
      optionsRef.current.onEvent?.(message)
    })

    // Refresh gated-room tokens before their 10-min expiry (same cadence as
    // use-live-delivery) and on reconnect (handled by the connect handler).
    tokenTimer = setInterval(() => {
      if (disposed || !socket.connected) return
      for (const room of gatedRooms) void joinRoom(room, socket)
    }, ROOM_TOKEN_REFRESH_MS)

    return () => {
      disposed = true
      if (tokenTimer) clearInterval(tokenTimer)
      socket.removeAllListeners()
      socket.disconnect()
      setConnected(false)
    }
     
  }, [roomKey])

  return { connected, denied, lastEvent, eventCount }
}
