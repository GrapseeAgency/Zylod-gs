'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  ArrowLeft, Minus, Plus, ShoppingCart,
  Package, AlertCircle, Loader2
} from 'lucide-react'

/**
 * REAL quick order — items are added ONLY by looking up a real product via
 * GET /api/products?search=<sku>. No demo rows, no invented names/prices.
 * If the SKU does not match a real product, an honest error is shown.
 */

interface ApiProduct {
  id: string
  name: string
  slug: string
  sku?: string | null
  basePrice: number
  unit?: string | null
  thumbnailUrl?: string | null
  moq?: number
  maxOrderQty?: number | null
  supplier?: { id: string; companyName: string } | null
  priceTiers?: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
}

interface QuickOrderItem {
  productId: string
  sku: string
  name: string
  slug: string
  price: number
  unit: string
  quantity: number
  image: string | null
  supplierId: string
  supplierName: string
  moq: number
  maxOrderQty: number | null
  priceTiers: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
}

/** Real tier pricing for the current quantity (falls back to base price). */
function priceForQty(product: ApiProduct, qty: number): number {
  const tiers = Array.isArray(product.priceTiers) ? product.priceTiers : []
  let price = product.basePrice
  for (const t of tiers) {
    if (qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)) {
      price = t.pricePerUnit
    }
  }
  return price
}

export function QuickOrderPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const [inputSku, setInputSku] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [orderItems, setOrderItems] = useState<QuickOrderItem[]>([])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    const sku = inputSku.trim()
    if (!sku || lookingUp) return

    setLookingUp(true)
    setLookupError('')
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(sku)}&limit=20`)
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setLookupError(json?.error || `SKU lookup failed (HTTP ${res.status}).`)
        return
      }

      const products: ApiProduct[] = Array.isArray(json.data) ? json.data : []
      const exact = products.find(
        (p) => (p.sku || '').trim().toLowerCase() === sku.toLowerCase()
      )

      if (!exact) {
        setLookupError(`No product found with SKU "${sku}". Check the code and try again.`)
        return
      }

      if (orderItems.some((i) => i.productId === exact.id)) {
        setLookupError(`"${exact.name}" is already on this order — adjust its quantity below.`)
        return
      }

      const newItem: QuickOrderItem = {
        productId: exact.id,
        sku: exact.sku || sku,
        name: exact.name,
        slug: exact.slug || '',
        price: priceForQty(exact, exact.moq || 1),
        unit: exact.unit || 'pcs',
        quantity: exact.moq || 1,
        image: exact.thumbnailUrl || null,
        supplierId: exact.supplier?.id || '',
        supplierName: exact.supplier?.companyName || '',
        moq: exact.moq || 1,
        maxOrderQty: exact.maxOrderQty ?? null,
        priceTiers: (exact.priceTiers || []).map((t) => ({
          minQty: t.minQty,
          maxQty: t.maxQty,
          pricePerUnit: t.pricePerUnit,
        })),
      }

      setOrderItems((prev) => [newItem, ...prev])
      setInputSku('')
    } catch {
      setLookupError('Network error while looking up the SKU. Check your connection and retry.')
    } finally {
      setLookingUp(false)
    }
  }

  const handleQtyChange = (productId: string, delta: number) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const newQty = Math.max(1, item.quantity + delta)
          // Re-apply real tier pricing for the new quantity
          const tier = item.priceTiers.find(
            (t) => newQty >= t.minQty && (t.maxQty === null || newQty <= t.maxQty)
          )
          return { ...item, quantity: newQty, price: tier ? tier.pricePerUnit : item.price }
        }
        return item
      })
    )
  }

  const handleRemoveItem = (productId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const subtotal = useMemo(() => {
    return orderItems.reduce((acc, i) => acc + i.price * i.quantity, 0)
  }, [orderItems])

  const handleAddToCart = useCallback(() => {
    if (orderItems.length === 0) return
    orderItems.forEach((item) => {
      addItem({
        id: `cart-${item.productId}-${Date.now()}`,
        productId: item.productId,
        productName: item.name,
        productSlug: item.slug,
        productImage: item.image,
        variantId: null,
        variantName: item.sku,
        variantValue: null,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity,
        moq: item.moq,
        maxOrderQty: item.maxOrderQty,
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        supplierSlug: '',
        unit: item.unit,
        priceTiers: item.priceTiers,
      })
    })
    navigate('cart')
  }, [orderItems, addItem, navigate])

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-8 md:space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">Quick Order</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add real catalog products by their SKU code.
          </p>
        </div>

        {/* SKU Input Box */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <form onSubmit={handleAddItem} className="flex gap-2">
            <Input
              value={inputSku}
              onChange={(e) => setInputSku(e.target.value)}
              placeholder="Enter product SKU"
              className="h-11 pl-4 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
            />

            <Button
              type="submit"
              disabled={lookingUp || !inputSku.trim()}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-5 rounded-2xl text-xs shadow-sm flex items-center gap-1.5"
            >
              {lookingUp && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {lookingUp ? 'Looking up…' : 'Add'}
            </Button>
          </form>

          {lookupError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2" role="alert">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-[11px] font-bold text-red-700">{lookupError}</p>
            </div>
          )}
        </div>

        {/* Current Order Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900">
              Current Order ({orderItems.length} item{orderItems.length === 1 ? '' : 's'})
            </h2>
            {orderItems.length > 0 && (
              <button
                onClick={() => setOrderItems([])}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Item Cards */}
          <div className="space-y-3">
            {orderItems.length === 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Package className="h-7 w-7 text-slate-400" />
                </div>
                <h3 className="text-sm font-black text-slate-900">No items on this order yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Enter a real product SKU above — products are looked up live from
                  the catalog and added with their actual price.
                </p>
              </div>
            )}

            {orderItems.map((item) => (
              <div
                key={item.productId}
                className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Thumbnail / neutral placeholder */}
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      SKU: {item.sku}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                      {item.name}
                    </h3>
                    <p className="text-xs font-black text-primary mt-0.5">
                      {formatPrice(item.price)} / {item.unit}
                    </p>
                    <button
                      onClick={() => handleRemoveItem(item.productId)}
                      className="text-[10px] font-semibold text-slate-400 hover:text-red-600 mt-0.5"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Stepper */}
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50/80 p-1 shrink-0">
                  <button
                    onClick={() => handleQtyChange(item.productId, -1)}
                    className="w-6 h-6 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-95"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-slate-800 tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleQtyChange(item.productId, 1)}
                    className="w-6 h-6 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-95"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Sticky Bottom Summary Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg md:max-w-3xl mx-auto space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-500">
              Subtotal ({orderItems.length} item{orderItems.length === 1 ? '' : 's'})
            </span>
            <div className="text-lg font-black text-primary">
              {formatPrice(subtotal)}
            </div>
          </div>

          <Button
            onClick={handleAddToCart}
            disabled={orderItems.length === 0}
            className="w-full h-12 rounded-2xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShoppingCart className="h-4 w-4" />
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  )
}

export default QuickOrderPage
