# Maps at Zylod — Libraries, Tile Licensing & Production Checklist

Covers both surfaces:

| Surface | Library | Status |
| --- | --- | --- |
| **Website (this repo)** | **MapLibre GL JS** (`maplibre-gl@6`, BSD-2-Clause) | Live — token-driven style in `src/lib/map-style.ts` |
| **Mobile app (PanelUI/Expo)** | PanelUI `Map` (wraps `@maplibre/maplibre-react-native`) | Per app docs — needs a dev build (`npx expo prebuild --clean`), guard with `hasMapLibre` |

## Why MapLibre for the website

- **BSD-2-Clause, free, no API key, no billing account** — zero risk of a surprise map bill.
- Full vector-tile renderer with a **style-as-code** API — which is what lets us assemble the
  basemap from our own theme tokens (`readThemeTokens()` + `buildMapStyle()`), so a new theme
  gets a matching map with nobody redrawing one. This is the same philosophy as PanelUI's Map.
- Fork of Mapbox GL JS v1 (before their license change) — battle-tested renderer.
- Alternatives considered: Leaflet (raster-only, no token-driven vector styling),
  Google/Mapbox JS SDKs (key + usage billing, closed styles — the "two finished maps" problem).

## Tile licensing (check before launch — MANDATE)

| Provider | License / cost | Commercial use | Verdict |
| --- | --- | --- | --- |
| **OpenFreeMap** *(current default)* | Free, unlimited, no key; funds itself by donation | ✅ Yes | **OK for launch.** Attribution required (rendered automatically). |
| CARTO basemaps *(PanelUI Map's default on mobile)* | Free **only for non-commercial** | ❌ Needs paid licence | **Not OK for Zylod as-is.** On mobile, pass PanelUI's `source` prop with OpenFreeMap's TileJSON (`https://tiles.openfreemap.org/planet`) — the token-built layers are kept. |
| OpenStreetMap raster tiles (tile.openstreetmap.org) | ODbL attribution + heavy-usage policy | ⚠️ Discouraged for apps | Avoid for production apps. |
| MapTiler / Stadia / Mapbox | Paid tiers after free quota | ✅ With key | Fine fallbacks — set the env vars below. |

**Data attribution (all providers):** map data © OpenStreetMap contributors (ODbL).
MapLibre renders the attribution string from the style — do not remove or cover it.

### Environment variables (all optional — defaults are launch-safe)

```bash
# Web map (website)
NEXT_PUBLIC_MAP_TILE_URL=https://tiles.openfreemap.org/planet   # any OpenMapTiles TileJSON
NEXT_PUBLIC_MAP_GLYPHS_URL=https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf
NEXT_PUBLIC_MAP_ATTRIBUTION=© OpenStreetMap contributors · © OpenFreeMap

# Routing (distance/ETA for live delivery)
OSRM_BASE_URL=https://router.project-osrm.org   # ⚠ public DEMO — see below

# Live delivery socket.io mini-service (mini-services/delivery-service)
DELIVERY_SOCKET_URL=http://127.0.0.1:3006       # internal /broadcast endpoint

# Delivery room auth (signed socket-room tokens) — set EXPLICITLY on Railway.
# If unset, BOTH processes derive the same secret as
# sha256("${AUTH_SECRET || DATABASE_URL}:delivery-rooms") — a dev-only default
# that changes whenever the DB URL changes; pin a real random secret in prod.
DELIVERY_ROOM_SECRET=<64-hex random string>
```

## Routing (distance / ETA)

- Distance/ETA come from an **OSRM-compatible** `/route/v1/driving` service
  (`src/lib/delivery-routing.ts`, 30 s cache, honest degradation).
- **The public demo `router.project-osrm.org` is NOT contracted for production traffic.**
  Before launch: self-host OSRM (`docker osrm/osrm-backend` + a Bangladesh/India extract from
  Geofabrik — ~1 GB, one machine handles this load easily) or use a commercialDirections API
  that mirrors the contract. Set `OSRM_BASE_URL` accordingly.
- When routing is down the API returns the **straight-line distance explicitly labeled** and
  **no ETA** — never a made-up duration.

## Live delivery pipeline (how a customer sees the driver move)

```
driver phone ──POST /api/delivery/suborders/[subOrderId]/location──▶ Next.js API
               (driver session + ACTIVE deliveryAssignments row + Zod + 120/min rate limit)
Next.js API ──Prisma write: orderTracking row (status 'gps_ping', grouped by driverSessionId)
Next.js API ──POST 127.0.0.1:3006/broadcast──▶ delivery-service (socket.io, port 3005)
delivery-service ──io.to('order:<id>').emit('delivery:ping')──▶ customer's map (instant)
customer (fallback) ──GET /api/delivery/orders/[orderId]/live every 20 s──▶ full snapshot
```

- Customer access: buyer owner, admin, or the assigned driver. Snapshot includes destination
  (only if the address has lat/lng), road route + ETA (only if the router answers), and honest
  notes (stale ping > 5 min, un-geocoded address, routing outage).
- `gps_ping` rows are filtered OUT of all customer-facing tracking-history endpoints
  (orders/[id], /track, /timeline) — they are positions, not status events.

### Delivery room auth (signed-room tokens)

Joining the live delivery socket room is authenticated — there is no anonymous join.
The browser first calls `GET /api/delivery/orders/[orderId]/room-token` (same
authorization as the `/live` snapshot: buyer-owner, admin, or driver with an ACTIVE
assignment; 30 req/min rate limit) and gets a 10-minute token:
`${payload}.${sig}` where `payload = base64url(JSON {r:"order:<id>", u, k, exp})` and
`sig = base64url(HMAC-SHA256(payload, DELIVERY_ROOM_SECRET))`. The client emits
`subscribe {orderId, token}`; the delivery service recomputes the HMAC
(constant-time compare), checks `exp > now` and that the token's `r` matches the
requested room, then joins. Failure emits `subscribe:denied {reason: invalid_token |
token_expired | room_mismatch | invalid_request}` and the socket joins NOTHING — no
room, no pings. Verified clients get `subscribe:ok {roomId}`, re-subscribe with a
fresh token on reconnect and every ~8 min, and >10 subscribe attempts/min from one
socket gets it disconnected (brute-force blunting). On denial the UI shows an honest
"live feed unavailable" note and keeps polling the authed REST snapshot every 20 s.
Both sides derive the secret identically — `src/lib/delivery-room-token.ts` (issuer)
and `mini-services/delivery-service/index.ts` (verifier) share no imports, only the
format + derivation. Set `DELIVERY_ROOM_SECRET` explicitly on Railway (same value
for both services).

### Ops runbook (admin, all ADMIN-gated)

1. **Create a driver account:** `POST /api/admin/deliveries/drivers` `{email, password(≥10), phone?}`.
   (Public registration never creates drivers.)
2. **Assign driver to a sub-order:** `POST /api/admin/deliveries/assignments` `{subOrderId, driverId}`.
   One active driver per sub-order; assignment is what authorizes the driver's phone to push pings.
3. Driver app pushes pings to `POST /api/delivery/suborders/[subOrderId]/location`
   `{lat, lng, accuracy?, speed?, heading?}` while the sub-order is being delivered.
4. Customer opens **Track Order** → live map appears while any sub-order status is `shipped`.

### Production checklist (Railway)

- [ ] Set `DELIVERY_ROOM_SECRET` explicitly (same value on the Next app and the
      delivery service). The unset default derives it from
      `${AUTH_SECRET || DATABASE_URL}:delivery-rooms` — fine for local dev, not for
      production (it silently changes whenever the DB URL changes).
- [ ] Deploy `mini-services/delivery-service` as its own service; set `DELIVERY_SOCKET_URL`
      to its internal URL; expose its 3005 via the gateway/proxy for browser sockets.
- [ ] Self-host OSRM or contract a routing provider (`OSRM_BASE_URL`).
- [ ] Keep OpenFreeMap, or sign a tile provider if projected traffic outgrows it
      (MapTiler/Protomaps) — one env-var swap, style code untouched.
- [ ] Mobile: replace PanelUI's CARTO default source (commercial licence!) and rebuild the
      dev client (`expo prebuild --clean`).
- [ ] Verify attribution is visible on both platforms.
