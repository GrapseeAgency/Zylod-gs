import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CurrencyCode = 'BDT' | 'USD' | 'EUR' | 'INR' | 'CNY' | 'GBP' | 'SGD' | 'MYR' | 'SAR' | 'AED'

interface CurrencyInfo {
  code: CurrencyCode
  name: string
  symbol: string
  rate: number // Exchange rate from BDT (BDT = 1)
  change24h: number
  lastUpdated: string | null
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  BDT: { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', rate: 1, change24h: 0, lastUpdated: null },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', rate: 0.0083, change24h: 0, lastUpdated: null },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.0077, change24h: 0, lastUpdated: null },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 0.69, change24h: 0, lastUpdated: null },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 0.059, change24h: 0, lastUpdated: null },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.0065, change24h: 0, lastUpdated: null },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rate: 0.011, change24h: 0, lastUpdated: null },
  MYR: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', rate: 0.038, change24h: 0, lastUpdated: null },
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', rate: 0.031, change24h: 0, lastUpdated: null },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate: 0.030, change24h: 0, lastUpdated: null },
}

interface CurrencyState {
  currentCurrency: CurrencyCode
  rates: Record<CurrencyCode, CurrencyInfo>
  ratesLoaded: boolean
  setCurrency: (code: CurrencyCode) => void
  formatPrice: (amountInBDT: number) => string
  convert: (amountInBDT: number) => number
  getCurrencyInfo: () => CurrencyInfo
  fetchLiveRates: () => Promise<void>
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currentCurrency: 'BDT' as CurrencyCode,
      rates: CURRENCIES,
      ratesLoaded: false,

      setCurrency: (code: CurrencyCode) => {
        set({ currentCurrency: code })
      },

      fetchLiveRates: async () => {
        try {
          const res = await fetch('/api/currency/rates')
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.rates) {
              const newRates = { ...CURRENCIES }
              for (const r of data.rates) {
                const code = r.code as CurrencyCode
                if (newRates[code]) {
                  newRates[code] = {
                    ...newRates[code],
                    rate: r.rate,
                    change24h: r.change24h || 0,
                    lastUpdated: r.lastUpdated || null,
                  }
                }
              }
              set({ rates: newRates, ratesLoaded: true })
            }
          }
        } catch {
          // Silently fail, use base rates
          set({ ratesLoaded: true })
        }
      },

      convert: (amountInBDT: number): number => {
        const { currentCurrency, rates } = get()
        const info = rates[currentCurrency]
        if (!info) return amountInBDT
        return amountInBDT * info.rate
      },

      formatPrice: (amountInBDT: number): string => {
        const { currentCurrency, rates } = get()
        const info = rates[currentCurrency]
        if (!info) return `৳${amountInBDT.toLocaleString()}`

        const converted = amountInBDT * info.rate

        // Determine decimal places based on currency
        let formatted: string
        if (currentCurrency === 'BDT') {
          formatted = Math.round(converted).toLocaleString('en-BD')
        } else {
          formatted = converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        }

        return `${info.symbol}${formatted}`
      },

      getCurrencyInfo: (): CurrencyInfo => {
        const { currentCurrency, rates } = get()
        return rates[currentCurrency] || CURRENCIES.BDT
      },
    }),
    {
      name: 'zylod-currency',
      partialize: (state) => ({ currentCurrency: state.currentCurrency }),
    }
  )
)
