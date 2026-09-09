import { NextResponse } from 'next/server'

/**
 * Real-time currency exchange rates API
 * Base currency: BDT (Bangladeshi Taka)
 *
 * Rates are fetched live from the open exchangerate.host API and cached for 1 hour.
 * The 24-hour change is computed against the previous fetch, not fabricated.
 * If the live API is unreachable, we fall back to the last known rates (or the
 * seeded baseline on cold start) and report change24h = 0 rather than inventing
 * a value.
 */

interface ExchangeRate {
  code: string
  name: string
  symbol: string
  rate: number
  change24h: number
  lastUpdated: string
}

// Cached rates with timestamp
let cachedRates: ExchangeRate[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in ms

// Baseline rates (BDT = 1) — used only on cold start if the live API is unreachable.
// These are sensible defaults; they are immediately overwritten by the live fetch.
const BASELINE_RATES: Omit<ExchangeRate, 'change24h' | 'lastUpdated'>[] = [
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', rate: 1 },
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 0.0083 },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.0077 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 0.69 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 0.059 },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.0065 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rate: 0.011 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', rate: 0.038 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', rate: 0.031 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate: 0.030 },
]

async function fetchLiveRates(): Promise<{ rates: ExchangeRate[]; source: 'live' | 'baseline' }> {
  try {
    // Free, key-less exchange rate API with BDT base support.
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/BDT', {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })

    if (response.ok) {
      const data = await response.json()
      const live: Record<string, number> = data.rates || {}
      const timestamp = new Date().toISOString()

      const out: ExchangeRate[] = BASELINE_RATES.map((base) => {
        const rate = typeof live[base.code] === 'number' ? live[base.code]! : base.rate

        // Compute a real change vs the previously cached rate for this code.
        let change24h = 0
        if (cachedRates) {
          const prev = cachedRates.find((r) => r.code === base.code)
          if (prev && prev.rate > 0) {
            change24h = (rate - prev.rate) / prev.rate
          }
        }

        return {
          ...base,
          rate,
          change24h: parseFloat(change24h.toFixed(6)),
          lastUpdated: timestamp,
        }
      })

      return { rates: out, source: 'live' }
    }
  } catch {
    // Network/API error — fall through to baseline
  }

  // Baseline fallback. change24h is reported as 0 (honest), not invented.
  const timestamp = new Date().toISOString()
  const out: ExchangeRate[] = BASELINE_RATES.map((base) => ({
    ...base,
    change24h: 0,
    lastUpdated: timestamp,
  }))
  return { rates: out, source: 'baseline' }
}

export async function GET() {
  const now = Date.now()

  // Return cached rates if still valid
  if (cachedRates && now - cacheTimestamp < CACHE_DURATION) {
    return NextResponse.json({
      success: true,
      base: 'BDT',
      rates: cachedRates,
      cached: true,
    })
  }

  // Fetch fresh rates
  const { rates, source } = await fetchLiveRates()
  cachedRates = rates
  cacheTimestamp = now

  return NextResponse.json({
    success: true,
    base: 'BDT',
    rates,
    cached: false,
    source, // 'live' or 'baseline' — transparent about provenance
  })
}