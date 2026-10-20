/**
 * THE SHIPPING CONFIG RAIL (Task 94) — shared server helpers for the
 * shippingZones / shippingMethods / shippingRates trio.
 *
 * The trio models the wholesale reality — a rate is the price of moving
 * a WEIGHT BAND to a DISTRICT by a METHOD, with an optional free-above
 * subtotal threshold. These helpers keep the matching vocabulary in ONE
 * place so the admin CRUD, the public quote rail and the future checkout
 * wiring all compute shipping the same way:
 *
 *   - Districts live in the schema as a CSV string (shippingZones.districts);
 *     matching is case-insensitive on trimmed entries, never substring
 *     ('Dhaka' must not match 'Dhaka Division' by accident).
 *   - A weight band matches when weightMin <= w AND (weightMax is null
 *     [open-ended] OR w < weightMax) — the standard half-open interval,
 *     so [0,10] and [10,50] TILE cleanly: 9.9kg prices into the first
 *     band, 10kg into the second, and no weight is ever priced twice.
 *   - freeAbove is compared against the ORDER SUBTOTAL (goods value only,
 *     pre-shipping) — crossing it makes the option free and carries the
 *     original price for honest display.
 */

export interface ZoneLike {
  id: string
  name: string
  districts: string
  isActive: boolean
}

export interface RateLike {
  id: string
  zoneId: string
  methodId: string
  weightMin: number
  weightMax: number | null
  price: number
  freeAbove: number | null
}

export interface MethodLike {
  id: string
  name: string
  description: string | null
  estimatedDays: string | null
  isActive: boolean
}

/** Parse the CSV districts column into trimmed unique entries. */
export function parseDistricts(csv: string): string[] {
  return Array.from(
    new Set(
      csv
        .split(',')
        .map((d) => d.trim())
        .filter((d) => d.length > 0)
    )
  )
}

/** Case-insensitive, whole-entry district match (never substring). */
export function zoneCoversDistrict(zone: ZoneLike, district: string): boolean {
  const needle = district.trim().toLowerCase()
  if (!needle) return false
  return parseDistricts(zone.districts).some((d) => d.toLowerCase() === needle)
}

/** A weight band matches when min <= w < max (null max = open-ended). */
export function rateCoversWeight(rate: RateLike, weightKg: number): boolean {
  if (weightKg < rate.weightMin) return false
  if (rate.weightMax !== null && weightKg >= rate.weightMax) return false
  return true
}

export interface QuoteOption {
  rateId: string
  zoneId: string
  zoneName: string
  methodId: string
  methodName: string
  methodDescription: string | null
  estimatedDays: string | null
  /** The rate's own price — what freeAbove crossing waived. */
  basePrice: number
  /** What the buyer actually pays for shipping on this option. */
  price: number
  freeShipping: boolean
  freeAbove: number | null
}

/**
 * Compute the honest quote: active zones covering the district × active
 * methods × weight-matching rates, sorted by what the buyer pays. When
 * subtotal >= freeAbove the option is free (basePrice preserved for
 * display), never silently dropped.
 */
export function computeQuote(
  zones: ZoneLike[],
  methods: MethodLike[],
  rates: RateLike[],
  district: string,
  weightKg: number,
  subtotal: number
): QuoteOption[] {
  const options: QuoteOption[] = []
  const methodById = new Map(methods.map((m) => [m.id, m]))

  for (const zone of zones) {
    if (!zone.isActive || !zoneCoversDistrict(zone, district)) continue
    for (const rate of rates) {
      if (rate.zoneId !== zone.id) continue
      const method = methodById.get(rate.methodId)
      if (!method || !method.isActive) continue
      if (!rateCoversWeight(rate, weightKg)) continue
      const free = rate.freeAbove !== null && subtotal >= rate.freeAbove
      options.push({
        rateId: rate.id,
        zoneId: zone.id,
        zoneName: zone.name,
        methodId: method.id,
        methodName: method.name,
        methodDescription: method.description,
        estimatedDays: method.estimatedDays,
        basePrice: rate.price,
        price: free ? 0 : rate.price,
        freeShipping: free,
        freeAbove: rate.freeAbove,
      })
    }
  }

  return options.sort((a, b) => a.price - b.price || a.basePrice - b.basePrice)
}

/**
 * Task 95: weigh a shipment from its order lines. `weightKg` is filed per
 * ONE purchasable unit (a bundle when bundleSize > 1) and `quantity` is in
 * purchasable units, so the line weight is a straight multiply — no bundle
 * double-count, no client-side math. Returns null when ANY line lacks a
 * filed weight: the caller must treat that shipment as UNQUOTABLE (settle
 * with the supplier), never price it as 0 kg.
 */
export function shipmentWeightKg(
  lines: Array<{ quantity: number; weightKg: number | null }>
): number | null {
  let total = 0
  for (const line of lines) {
    if (line.weightKg === null || line.weightKg === undefined) return null
    total += line.quantity * line.weightKg
  }
  return total
}

/**
 * True when [minA, maxA) overlaps [minB, maxB) (null max = open-ended).
 * Half-open, so adjacent bands [0,10] and [10,50] are a legal TILING, not
 * a conflict — 10kg belongs to the second band alone. Used to refuse two
 * rates of the same zone+method genuinely fighting over the same weight
 * — a buyer must never see two prices for one weight.
 */
export function weightWindowsOverlap(
  a: { weightMin: number; weightMax: number | null },
  b: { weightMin: number; weightMax: number | null }
): boolean {
  const aMax = a.weightMax ?? Number.POSITIVE_INFINITY
  const bMax = b.weightMax ?? Number.POSITIVE_INFINITY
  return a.weightMin < bMax && b.weightMin < aMax
}
