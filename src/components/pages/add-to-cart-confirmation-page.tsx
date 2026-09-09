'use client'

import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  CheckCircle2, X, Plus, ShoppingCart, ArrowRight,
  Package, Check
} from 'lucide-react'

export function AddToCartConfirmationPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const pageParams = _pageParams || storeParams || {}

  const [addedAddons, setAddedAddons] = useState<Record<string, boolean>>({})

  const mainItem = {
    id: pageParams.productId || 'helm-1',
    name: pageParams.productName || 'Premium Industrial Safety Helmets - ANSI Z89.1...',
    color: 'Hi-Vis Yellow',
    size: 'Adjustable',
    qty: Number(pageParams.quantity) || 500,
    unitPrice: 4.90,
    totalPrice: 2450.00,
    image: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=500&auto=format&fit=crop&q=80',
  }

  const addonItems = [
    {
      id: 'addon-1',
      name: 'Heavy Duty Leather Work Gloves, Reinforced Palm',
      price: 1.20,
      unit: 'unit',
      image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'addon-2',
      name: 'Anti-Fog Safety Goggles, Impact Resistant',
      price: 0.85,
      unit: 'unit',
      image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=500&auto=format&fit=crop&q=80',
    },
  ]

  const handleAddAddon = useCallback((item: typeof addonItems[0]) => {
    addItem({
      id: `cart-${item.id}-${Date.now()}`,
      productId: item.id,
      productName: item.name,
      productSlug: item.id,
      productImage: item.image,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity: 50,
      unitPrice: item.price,
      totalPrice: item.price * 50,
      moq: 50,
      maxOrderQty: null,
      supplierId: '',
      supplierName: 'Verified Supplier',
      supplierSlug: '',
      unit: item.unit,
      priceTiers: [],
    })
    setAddedAddons((prev) => ({ ...prev, [item.id]: true }))
  }, [addItem])

  return (
    <div className="min-h-screen bg-slate-900/40 backdrop-blur-2xs flex items-end sm:items-center justify-center p-0 sm:p-4 text-slate-900">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="w-full max-w-lg md:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Top Confirmation Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Added to Cart Successfully</h2>
          </div>
          <button
            onClick={goBack}
            className="p-1 text-slate-400 hover:text-slate-700"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Added Product Summary Card */}
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex gap-3.5 items-center">
          <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
            <img src={mainItem.image} alt={mainItem.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
              {mainItem.name}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Color: {mainItem.color} | Size: {mainItem.size}
            </p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xs font-bold text-slate-700">
                Qty: <strong className="text-slate-900">{mainItem.qty}</strong>
              </span>
              <span className="text-xs font-black text-primary">
                {formatPrice(mainItem.totalPrice)}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({formatPrice(mainItem.unitPrice)}/unit)
              </span>
            </div>
          </div>
        </div>

        {/* Frequently Bought Together Add-on Section */}
        <div className="space-y-2.5 pt-1">
          <h3 className="text-xs font-bold text-slate-900">Frequently Bought Together</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {addonItems.map((addon) => {
              const isAdded = addedAddons[addon.id]

              return (
                <div
                  key={addon.id}
                  className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                      <img src={addon.image} alt={addon.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                        {addon.name}
                      </h4>
                      <p className="text-xs font-black text-primary mt-0.5">
                        {formatPrice(addon.price)}/{addon.unit}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddAddon(addon)}
                    disabled={isAdded}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                      isAdded
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                        : 'border-primary text-primary hover:bg-primary hover:text-white'
                    }`}
                  >
                    {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            onClick={() => navigate('cart')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
          >
            <ShoppingCart className="h-4 w-4" />
            View Cart &amp; Checkout
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('product-list')}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
          >
            Continue Sourcing
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

export default AddToCartConfirmationPage
