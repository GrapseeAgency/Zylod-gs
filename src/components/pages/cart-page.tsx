'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore, CartItemData } from '@/store/cart-store'
import { toast } from 'sonner'
import {
  ArrowLeft, Minus, Plus, Lock, ShoppingBag,
  Trash2, CheckCircle2, Circle, Zap
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════
   CART PAGE
   • Select / deselect items (checkbox per card + select all)
   • Cancel (remove) any item from the cart
   • Edit quantity per item (MOQ-aware stepper + direct input)
   • Buy ONE item only — skips the rest
   • Accurate order summary computed from SELECTED items using
     tier-priced totals (item.totalPrice), not naive qty × unit
   ══════════════════════════════════════════════════════════════ */
export function CartPage() {
  const { navigate, goBack } = useNavigationStore()
  const { items, removeItem, updateQuantity } = useCartStore()
  const { formatPrice } = useCurrencyStore()

  /* ─── Selection state: everything selected by default ─── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const isSelected = (id: string) =>
    selectedIds.size === 0 ? true : selectedIds.has(id)

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev.size === 0 ? items.map((i) => i.id) : prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = items.length > 0 && items.every((i) => isSelected(i.id))

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  /* ─── Selected items drive the summary ─── */
  const selectedItems = useMemo(
    () => items.filter((i) => isSelected(i.id)),
    [items, selectedIds]
  )

  /* Tier-accurate line totals come straight from the store */
  const subtotal = useMemo(
    () => selectedItems.reduce((acc, i) => acc + i.totalPrice, 0),
    [selectedItems]
  )
  const totalUnits = useMemo(
    () => selectedItems.reduce((acc, i) => acc + i.quantity, 0),
    [selectedItems]
  )

  const handleQtyChange = (item: CartItemData, delta: number) => {
    const step = delta < 0 ? -Math.max(1, Math.round(item.moq / 5)) : Math.max(1, Math.round(item.moq / 5))
    const newQty = Math.max(item.moq || 1, item.quantity + step)
    updateQuantity(item.id, newQty)
  }

  const handleQtyInput = (item: CartItemData, value: string) => {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(parsed)) updateQuantity(item.id, Math.max(item.moq || 1, parsed))
  }

  const handleRemove = (item: CartItemData) => {
    removeItem(item.id)
    toast.success('Removed from cart', { description: item.productName })
  }

  /* Buy a single product — bypasses everything else in the cart */
  const buyThisOnly = (item: CartItemData) => {
    navigate('buy-now', {
      productId: item.productId,
      productName: item.productName,
      unitPrice: String(item.unitPrice),
      quantity: String(item.quantity),
      image: item.productImage || '',
      supplierName: item.supplierName,
    })
  }

  /* ─── Empty state ─── */
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3 md:hidden">
          <button onClick={goBack} className="p-1 text-muted-foreground hover:text-foreground" title="Back">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <span className="text-lg font-black tracking-tight text-primary">Your Cart</span>
        </header>
        <main className="max-w-lg mx-auto px-4 py-16 md:py-24 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
            <ShoppingBag className="h-9 w-9 text-muted-foreground" />
          </div>
          <h2 className="text-base font-black">Your cart is empty</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-6">Browse wholesale deals and add products to get started.</p>
          <Button
            onClick={() => navigate('home')}
            className="w-full max-w-xs h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm"
          >
            Start Shopping
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-48 lg:pb-10 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 md:hidden">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={goBack} className="p-1 text-muted-foreground hover:text-foreground" title="Back">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <span className="text-lg font-black tracking-tight text-primary">Your Cart</span>
          {/* Select all */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-[11px] font-bold text-primary active:scale-95 transition-transform"
          >
            {allSelected ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            {allSelected ? 'All' : 'All'}
          </button>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-3 max-w-lg mx-auto lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        <div className="space-y-3 lg:col-span-2">
        {/* Title row */}
        <div className="flex items-baseline justify-between">
          <p className="text-xs md:text-sm text-muted-foreground">
            {items.length} product{items.length !== 1 ? 's' : ''} · {selectedItems.length} selected
          </p>
          {selectedIds.size > 0 && selectedItems.length < items.length && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[11px] font-semibold text-primary"
            >
              Select all for checkout
            </button>
          )}
        </div>

        {/* ─── Cart Items ─── */}
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const checked = isSelected(item.id)
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -60, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`bg-card rounded-2xl border overflow-hidden transition-colors ${
                    checked ? 'border-primary/40' : 'border-border opacity-70'
                  }`}
                >
                  <div className="flex">
                    {/* Select checkbox strip */}
                    <button
                      onClick={() => toggleItem(item.id)}
                      className={`w-11 shrink-0 flex items-start justify-center pt-4 transition-colors ${
                        checked ? 'text-primary' : 'text-muted-foreground'
                      }`}
                      aria-label={checked ? 'Deselect item' : 'Select item'}
                    >
                      {checked ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                    </button>

                    <div className="flex-1 py-4 pr-4 space-y-3 min-w-0">
                      {/* Product row */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => navigate('product-detail', { productId: item.productId })}
                          className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0"
                        >
                          {item.productImage ? (
                            <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="h-7 w-7 text-muted-foreground/50" />
                            </div>
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-bold line-clamp-2 leading-snug">{item.productName}</h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {item.supplierName} · MOQ {item.moq} {item.unit || 'units'}
                          </p>
                          <div className="mt-1.5 flex items-baseline gap-1.5">
                            <span className="text-sm font-black text-primary">{formatPrice(item.unitPrice)}</span>
                            <span className="text-[10px] text-muted-foreground">/ {item.unit || 'unit'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Controls: qty stepper · line total · actions */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Stepper */}
                        <div className="flex items-center border border-border rounded-xl bg-background p-1">
                          <button
                            onClick={() => handleQtyChange(item, -1)}
                            className="w-7 h-7 rounded-lg bg-card flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            value={item.quantity}
                            onChange={(e) => handleQtyInput(item, e.target.value)}
                            inputMode="numeric"
                            className="w-12 text-center text-xs font-bold tabular-nums bg-transparent outline-none"
                            aria-label="Quantity"
                          />
                          <button
                            onClick={() => handleQtyChange(item, 1)}
                            className="w-7 h-7 rounded-lg bg-card flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Line total — tier priced */}
                        <div className="text-right">
                          <div className="text-sm font-black">{formatPrice(item.totalPrice)}</div>
                          <div className="text-[10px] text-muted-foreground">{item.quantity} {item.unit || 'units'}</div>
                        </div>
                      </div>

                      {/* Actions: cancel + buy this only */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleRemove(item)}
                          className="flex items-center gap-1 h-8 px-3 rounded-lg border border-destructive/30 text-destructive text-[11px] font-bold hover:bg-destructive/10 transition-colors active:scale-95"
                        >
                          <Trash2 className="h-3 w-3" />
                          Cancel
                        </button>
                        <button
                          onClick={() => buyThisOnly(item)}
                          className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg border border-primary/40 text-primary text-[11px] font-bold hover:bg-primary/5 transition-colors active:scale-95"
                        >
                          <Zap className="h-3 w-3" />
                          Buy This Only
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
        </div>

        {/* ─── Desktop Order Summary (selected items only) ─── */}
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h2 className="text-sm font-bold">Order Summary</h2>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({selectedItems.length} product{selectedItems.length !== 1 ? 's' : ''}, {totalUnits} units)</span>
                <span className="font-semibold text-foreground">{formatPrice(subtotal)}</span>
              </div>
              {items.length !== selectedItems.length && (
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{items.length - selectedItems.length} unselected item(s) stay in your cart</span>
                  <span />
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
            </div>
            <div className="pt-2 border-t border-border flex items-center gap-3">
              <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground font-medium">Total</div>
                <div className="text-lg font-black text-primary leading-none">{formatPrice(subtotal)}</div>
              </div>
              <Button
                onClick={() => selectedItems.length > 0 ? navigate('checkout') : toast.error('Select at least one item')}
                disabled={selectedItems.length === 0}
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Proceed to Checkout ({selectedItems.length})
              </Button>
            </div>
          </div>
        </aside>
      </main>

      {/* ─── Sticky Order Summary (selected items only) ─── */}
      <motion.div
        layout
        className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:hidden"
      >
        <div className="max-w-lg mx-auto px-4 py-3 space-y-2.5">
          {/* Summary lines */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({selectedItems.length} product{selectedItems.length !== 1 ? 's' : ''}, {totalUnits} units)</span>
              <span className="font-semibold text-foreground">{formatPrice(subtotal)}</span>
            </div>
            {items.length !== selectedItems.length && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{items.length - selectedItems.length} unselected item(s) stay in your cart</span>
                <span />
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
          </div>

          {/* Total + CTA */}
          <div className="flex items-center gap-3 pt-1">
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground font-medium">Total</div>
              <div className="text-lg font-black text-primary leading-none">{formatPrice(subtotal)}</div>
            </div>
            <Button
              onClick={() => selectedItems.length > 0 ? navigate('checkout') : toast.error('Select at least one item')}
              disabled={selectedItems.length === 0}
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <Lock className="h-4 w-4" />
              Proceed to Checkout ({selectedItems.length})
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default CartPage
