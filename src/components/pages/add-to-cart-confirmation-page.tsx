'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore, CartItemData, ClientPriceTier } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store'
import {
  CheckCircle2, X, Plus, ShoppingCart, ArrowRight, Package, Loader2, AlertCircle,
} from 'lucide-react'

/**
 * REAL add-to-cart confirmation — replaces the fabricated "Premium
 * Industrial Safety Helmets" main item and the two phantom upsell addons
 * ("Heavy Duty Leather Work Gloves", "Anti-Fog Safety Goggles" at invented
 * prices) that were pushed into the cart store with FAKE productIds
 * ('addon-1', 'addon-2') — phantom cart lines that real checkout would
 * reject or that would poison cart math.
 *
 * Source of truth:
 *   - The MAIN item is the buyer's actual latest cart line, read from the
 *     real cart store (useCartStore). Empty cart → honest empty state.
 *   - The ADD-ONS rail lists REAL products from the public catalog
 *     (GET /api/products — approved + active only). Adding one uses the
 *     same shape and real fields as the product page: real id, real MOQ,
 *     real tier pricing, real supplier.
 */

interface ApiProduct {
  id: string
  name: string
  slug: string
  basePrice: number
  moq: number
  unit: string
  bundleSize: number | null
  weightKg: number | null
  images?: { url: string }[]
  supplier?: { id: string; companyName: string }
  priceTiers?: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
}

export function AddToCartConfirmationPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const items = useCartStore(s => s.items)
  const addItem = useCartStore(s => s.addItem)

  // The REAL latest cart line (store merge keeps same product+variant in place).
  const lastItem: CartItemData | undefined = items.length > 0 ? items[items.length - 1] : undefined

  const [addons, setAddons] = useState<ApiProduct[]>([])
  const [addonsState, setAddonsState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [addedAddons, setAddedAddons] = useState<Record<string, boolean>>({})

  // Server-cart hydration on mount (the cart page's pattern): a returning
  // buyer's local store is empty while the server holds their lines — without
  // this pull the page would lie "Nothing added yet" over a real server cart.
  // GET /api/cart resolves the buyer from the SESSION cookie (the buyerId
  // query param is ignored server-side), so this works for cookie sessions
  // even before the local auth store hydrates; anon gets an honest 401 no-op.
  useEffect(() => {
    const user = useAuthStore.getState().user
    void useCartStore.getState().syncWithApi(user?.id ?? '')
  }, [])

  useEffect(() => {
    let mounted = true
    fetch('/api/products?limit=4', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (!mounted) return
        const rows: ApiProduct[] = Array.isArray(json?.data) ? json.data : []
        // Never re-offer what is already in the cart.
        const inCart = new Set(useCartStore.getState().items.map(i => i.productId))
        setAddons(rows.filter(p => !inCart.has(p.id)).slice(0, 4))
        setAddonsState('ready')
      })
      .catch(() => { if (mounted) setAddonsState('error') })
    return () => { mounted = false }
  }, [])

  /** The PDP's canonical add shape — real fields only, real ids only. */
  const addAddon = (p: ApiProduct) => {
    const tiers: ClientPriceTier[] = (p.priceTiers ?? []).map(t => ({
      minQty: t.minQty, maxQty: t.maxQty ?? null, pricePerUnit: t.pricePerUnit,
    }))
    const qty = Math.max(1, p.moq || 1)
    const unitPrice = tiers.length > 0
      ? (tiers.find(t => qty >= t.minQty)?.pricePerUnit ?? p.basePrice)
      : p.basePrice
    addItem({
      id: `cart-${p.id}-default-${Date.now()}`,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      productImage: p.images?.[0]?.url ?? '/placeholder.svg',
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity: qty,
      unitPrice,
      totalPrice: unitPrice * qty,
      moq: p.moq || 1,
      maxOrderQty: null,
      supplierId: p.supplier?.id ?? '',
      supplierName: p.supplier?.companyName ?? 'Supplier',
      supplierSlug: '',
      unit: p.unit,
      priceTiers: tiers,
      basePrice: p.basePrice,
      bundleSize: p.bundleSize ?? null,
      weightKg: p.weightKg ?? null,
    })
    setAddedAddons(prev => ({ ...prev, [p.id]: true }))
  }

  return (
    <div className="min-h-[70vh] bg-slate-50 dark:bg-slate-950 flex items-end sm:items-center justify-center p-0 sm:p-4 text-slate-900 dark:text-slate-100">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg md:max-w-2xl bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {lastItem ? 'Added to cart' : 'Your cart'}
            </h2>
          </div>
          <button onClick={goBack} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700" title="Close" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main item — the REAL latest cart line */}
        {lastItem ? (
          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 flex gap-3.5 items-center">
            <div className="w-16 h-16 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
              <img src={lastItem.productImage || '/placeholder.svg'} alt={lastItem.productName} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 leading-snug">{lastItem.productName}</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                {lastItem.supplierName}
                {lastItem.variantName ? ` · ${lastItem.variantName}` : ''}
              </p>
              <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Qty: <strong className="text-slate-900 dark:text-slate-100">{lastItem.quantity}</strong>
                </span>
                <span className="text-xs font-black text-primary">{formatPrice(lastItem.totalPrice)}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                  ({formatPrice(lastItem.unitPrice)}/unit)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 text-center space-y-2">
            <Package className="h-8 w-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Nothing added yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Open a product and add it to your cart — your latest line shows up here.</p>
          </div>
        )}

        {/* Real add-ons from the public catalog */}
        <div className="space-y-3 pt-1">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Frequently bought by wholesale buyers
          </h3>

          {addonsState === 'loading' && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {addonsState === 'error' && (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4 text-center space-y-2">
              <AlertCircle className="h-5 w-5 text-slate-400 dark:text-slate-500 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Couldn't load suggestions right now.</p>
              <Button onClick={() => { setAddonsState('loading'); fetch('/api/products?limit=4', { credentials: 'include' }).then(r => r.json()).then(json => { setAddons((Array.isArray(json?.data) ? json.data : []).slice(0, 4)); setAddonsState('ready') }).catch(() => setAddonsState('error')) }} variant="outline" className="h-8 text-[11px] font-bold">
                Retry
              </Button>
            </div>
          )}
          {addonsState === 'ready' && addons.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">No suggestions available right now.</p>
          )}
          {addonsState === 'ready' && addons.map(p => (
            <div key={p.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex gap-3 items-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0">
                <img src={p.images?.[0]?.url ?? '/placeholder.svg'} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{p.name}</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  MOQ {p.moq} {p.unit} · {formatPrice(p.basePrice)}/{p.unit}
                  {p.supplier?.companyName ? ` · ${p.supplier.companyName}` : ''}
                </p>
              </div>
              {addedAddons[p.id] ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Added
                </span>
              ) : (
                <Button
                  size="sm"
                  onClick={() => addAddon(p)}
                  className="h-8 px-3 text-[11px] font-bold gap-1 shrink-0"
                  aria-label={`Add ${p.name} to cart`}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <Button
            onClick={() => navigate('cart')}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs gap-2"
          >
            <ShoppingCart className="h-4 w-4" /> View cart ({items.length})
          </Button>
          <Button
            onClick={() => navigate('product-list')}
            variant="outline"
            className="flex-1 bg-white dark:bg-gray-900 text-slate-800 dark:text-slate-200 font-bold h-12 rounded-2xl text-xs gap-2"
          >
            Keep shopping <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
export default AddToCartConfirmationPage
