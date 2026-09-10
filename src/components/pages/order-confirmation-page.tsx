'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Check, CheckCircle2, Truck, Package, ArrowRight, ShoppingBag
} from 'lucide-react'

export function OrderConfirmationPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}

  const orderNumber = pageParams.orderNumber || '#ZY-8472-X9'
  const estDelivery = pageParams.estDelivery || 'Oct 24 - Oct 26'

  const items = [
    {
      id: 'item-1',
      name: 'Premium Industrial Steel Ball Bearings - 10mm (Box of 500)',
      sku: 'BB-10M-PRO',
      qty: '20 boxes',
      price: 1250.00,
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'item-2',
      name: 'Heavy Duty Corrugated Shipping Boxes - 12×12×12',
      sku: 'BOX-HD-12',
      qty: '5 pallets',
      price: 450.00,
      image: 'https://images.unsplash.com/photo-1586528116493-a029325540fa?w=500&auto=format&fit=crop&q=80',
    },
  ]

  const subtotal = 1700.00
  const freightShipping = 120.00
  const tax = 0.00
  const total = subtotal + freightShipping + tax

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs text-center md:hidden">
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
      </header>

      <main className="px-4 md:px-6 py-6 md:py-10 space-y-6 md:space-y-8 max-w-lg mx-auto lg:max-w-2xl">
        {/* Success Icon & Heading */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center">
              <Check className="h-7 w-7 stroke-[3]" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Order Confirmed!</h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1.5 leading-relaxed">
              Thank you for your purchase. We&apos;ve received your order and are currently processing it in our warehouse.
            </p>
          </div>
        </div>

        {/* Order Details Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden divide-y divide-slate-100">
          {/* Header Strip */}
          <div className="p-4 bg-slate-50/70 flex justify-between items-center">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Order Number</span>
              <span className="text-xs font-black text-slate-900">{orderNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Est. Delivery</span>
              <span className="text-xs font-black text-primary">{estDelivery}</span>
            </div>
          </div>

          {/* Items Ordered List */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Package className="h-4 w-4 text-slate-600" />
              <span>Items Ordered</span>
            </div>

            <div className="space-y-3 pt-1 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                      {item.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Qty: {item.qty} | SKU: {item.sku}
                    </p>
                    <p className="text-xs font-black text-primary mt-1">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="p-4 space-y-2 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Freight Shipping</span>
              <span className="font-semibold text-slate-800">{formatPrice(freightShipping)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span className="font-semibold text-slate-800">{formatPrice(tax)}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-xl font-black text-primary">{formatPrice(total)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2 md:flex md:justify-center md:gap-3 md:space-y-0">
          <Button
            onClick={() => navigate('orders')}
            className="w-full md:w-auto md:px-8 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <Truck className="h-4 w-4" />
            Track Order
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('home')}
            className="w-full md:w-auto md:px-8 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 md:h-12 rounded-2xl text-xs"
          >
            Continue Sourcing
          </Button>
        </div>
      </main>
    </div>
  )
}

export default OrderConfirmationPage
