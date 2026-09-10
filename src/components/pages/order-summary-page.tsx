'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, MapPin, Truck, CreditCard, Lock,
  Package, ShieldCheck
} from 'lucide-react'

export function OrderSummaryPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [submitting, setSubmitting] = useState(false)

  const items = [
    {
      id: 'sum-item-1',
      name: 'Premium Cotton Blank T-Shirts - Bulk Pallet (White, Mixed Sizes)',
      sku: 'TS-WHT-MIX-01',
      qty: '500 pcs',
      price: 75000,
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'sum-item-2',
      name: 'Heavy Duty Industrial Packaging Tape (Clear, 2" x 100m)',
      sku: 'TPE-CLR-2X100',
      qty: '100 rolls',
      price: 5500,
      image: 'https://images.unsplash.com/photo-1586528116493-a029325540fa?w=500&auto=format&fit=crop&q=80',
    },
  ]

  const subtotal = 80500
  const shipping = 2500
  const vat = 12075
  const total = subtotal + shipping + vat

  const handlePlaceOrder = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      navigate('order-confirmation')
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Review Order</h1>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-3.5 max-w-lg mx-auto lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        {/* Shipping, Delivery, Payment, Items */}
        <div className="space-y-3.5 lg:col-span-2">
        {/* Shipping To Card */}
        <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900">Shipping To</h2>
            <button
              onClick={() => navigate('shipping-address')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="flex items-start gap-3 pt-1">
            <MapPin className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-0.5">
              <p className="font-bold text-slate-900">Acme Corp Warehouse</p>
              <p>123 Industrial Parkway, Suite A</p>
              <p>Dhaka, 1212, Bangladesh</p>
              <p className="text-[11px] text-slate-400 pt-0.5">Contact: John Doe (+880 1711 000 000)</p>
            </div>
          </div>
        </div>

        {/* Delivery Method Card */}
        <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900">Delivery Method</h2>
            <button
              onClick={() => navigate('delivery-method')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="flex items-start gap-3 pt-1">
            <Truck className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-0.5">
              <p className="font-bold text-slate-900">Standard Freight</p>
              <p className="text-slate-500">Estimated Delivery: Oct 25 - Oct 28</p>
            </div>
          </div>
        </div>

        {/* Payment Method Card */}
        <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900">Payment Method</h2>
            <button
              onClick={() => navigate('payment-method')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="flex items-start gap-3 pt-1">
            <CreditCard className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-0.5">
              <p className="font-bold text-slate-900">Corporate Visa **** 4242</p>
              <p className="text-slate-400 text-[11px]">Billing address same as shipping</p>
            </div>
          </div>
        </div>

        {/* Items (2) Card */}
        <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold text-slate-900">Items ({items.length})</h2>

          <div className="divide-y divide-slate-100 space-y-3 pt-1">
            {items.map((item, idx) => (
              <div key={item.id} className={`flex gap-3 items-center ${idx > 0 ? 'pt-3' : ''}`}>
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                    {item.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    SKU: {item.sku}
                  </p>
                  <div className="flex justify-between items-baseline mt-1.5">
                    <span className="text-xs font-bold text-slate-600">Qty: {item.qty}</span>
                    <span className="text-xs font-black text-primary">৳ {item.price.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>

        {/* Order Totals Card */}
        <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-2.5 text-xs text-slate-600 lg:self-start">
          <div className="flex justify-between">
            <span>Subtotal (600 items)</span>
            <span className="font-semibold text-slate-900">৳ {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping (Standard Freight)</span>
            <span className="font-semibold text-slate-900">৳ {shipping.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (15%)</span>
            <span className="font-semibold text-slate-900">৳ {vat.toLocaleString()}</span>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
            <span className="text-sm font-bold text-slate-900">Total</span>
            <span className="text-xl md:text-2xl font-black text-primary">৳ {total.toLocaleString()}</span>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg md:max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Total to pay</span>
            <span className="text-base font-black text-primary">৳ {total.toLocaleString()}</span>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={submitting}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <Lock className="h-4 w-4" />
            {submitting ? 'Placing Order...' : 'Place Order'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default OrderSummaryPage
