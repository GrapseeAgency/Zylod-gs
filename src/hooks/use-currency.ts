/**
 * Utility hook for currency formatting across the app.
 * Re-exports useCurrencyStore for convenient access to formatPrice().
 *
 * Usage:
 *   const { formatPrice } = useCurrency()
 *   <span>{formatPrice(1250)}</span>  // "৳1,250" or "$10.38" etc.
 */
export { useCurrencyStore as useCurrency } from '@/store/currency-store'
