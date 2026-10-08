/**
 * Road routing for live delivery tracking.
 *
 * Distance/ETA come from an OSRM-compatible HTTP routing service:
 *   OSRM_BASE_URL (default: the public demo router https://router.project-osrm.org)
 *
 * The public demo server is fine for development but is rate-limited and
 * NOT contracted for production traffic — see MAPS.md. For production set
 * OSRM_BASE_URL to a self-hosted OSRM instance or a commercial equivalent
 * that speaks the same /route/v1/driving contract.
 *
 * When the routing service is unavailable we degrade honestly: the API
 * returns a straight-line (haversine) distance explicitly labeled as such
 * and no ETA at all — never a fabricated duration.
 */

const OSRM_BASE = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org'

export interface RouteResult {
  /** metres along the road network */
  distanceM: number
  /** seconds along the road network */
  durationS: number
  /** [lng, lat][] polyline of the route */
  geometry: [number, number][]
  provider: string
}

export interface RoutingOutcome {
  route: RouteResult | null
  /** straight-line distance in metres (always computable) */
  straightLineM: number
  /** set when the road route is unavailable and why */
  routingNote: string | null
}

/* ── 30s in-process cache per origin→destination pair ─────────────────── */
interface CacheEntry {
  at: number
  outcome: RoutingOutcome
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30_000
const CACHE_MAX = 500

export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * Route from a driver's current position to the delivery destination.
 * Never throws — failures are reported via routingNote so the UI can say
 * exactly what is and is not known.
 */
export async function routeDriverToDestination(
  driverLat: number,
  driverLng: number,
  destLat: number,
  destLng: number
): Promise<RoutingOutcome> {
  const straightLineM = haversineM(driverLat, driverLng, destLat, destLng)

  const key = `${driverLat.toFixed(4)},${driverLng.toFixed(4)}> ${destLat.toFixed(4)},${destLng.toFixed(4)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    // Recompute straight-line fresh (the driver may have moved metres since)
    return { ...hit.outcome, straightLineM }
  }

  let outcome: RoutingOutcome
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${driverLng},${driverLat};${destLng},${destLat}?overview=full&geometries=geojson`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4_000),
      headers: { 'User-Agent': 'zylod-delivery/1.0' },
    })
    if (!res.ok) {
      outcome = {
        route: null,
        straightLineM,
        routingNote: `Routing service responded ${res.status} — showing straight-line distance, no ETA.`,
      }
    } else {
      const json = (await res.json()) as {
        code?: string
        routes?: Array<{
          distance: number
          duration: number
          geometry?: { coordinates: [number, number][] }
        }>
      }
      const r = json.routes?.[0]
      if (json.code !== 'Ok' || !r) {
        outcome = {
          route: null,
          straightLineM,
          routingNote: `Routing service could not find a road route (${json.code || 'no route'}) — showing straight-line distance, no ETA.`,
        }
      } else {
        outcome = {
          route: {
            distanceM: r.distance,
            durationS: r.duration,
            geometry: r.geometry?.coordinates ?? [],
            provider: OSRM_BASE,
          },
          straightLineM,
          routingNote: null,
        }
      }
    }
  } catch {
    outcome = {
      route: null,
      straightLineM,
      routingNote:
        'Routing service unreachable — showing straight-line distance, no ETA.',
    }
  }

  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, { at: Date.now(), outcome })
  return outcome
}
