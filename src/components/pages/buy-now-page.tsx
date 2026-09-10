'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Truck, CreditCard, CheckCircle2,
  Lock, ShieldCheck, MapPin, Building2, Package
} from 'lucide-react'

export function BuyNowPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}

  const [billingSame, setBillingSame] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)

  const item = {
    name: pageParams.productName || 'Heavy Duty Industrial Safety Gloves - Nitrile Coated, Heavy Grip',
    variant: pageParams.variant || 'L / Black',
    unitPrice: Number(pageParams.unitPrice) || 12.50,
    quantity: Number(pageParams.quantity) || 1000,
    image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop&q=80',
  }

  const subtotal = item.unitPrice * item.quantity
  const shipping = 250.00
  const tax = +(subtotal * 0.08).toFixed(2)
  const total = subtotal + shipping + tax

  const handlePlaceOrder = async () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setOrderPlaced(true)
    }, 1000)
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Order Placed Successfully!</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Order #ZY-89241 has been confirmed with your supplier. Escrow payment is secured via Trade Assurance.
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('orders')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            Track Order
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('home')}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl"
          >
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+150px)] lg:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Checkout</h1>
          </div>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 max-w-lg mx-auto lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
        {/* Order Summary Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold text-slate-900">Order Summary</h2>

          <div className="flex gap-3.5 items-center pt-1">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                {item.name}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Variant: {item.variant}</p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-xs font-bold text-primary">
                  {formatPrice(item.unitPrice)} / unit
                </span>
                <span className="text-xs font-bold text-slate-700">
                  Qty: <strong className="text-slate-900">{item.quantity.toLocaleString()}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Details Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Shipping Details</h2>
            </div>
            <button className="text-xs font-bold text-primary hover:underline">
              Change
            </button>
          </div>

          <div className="text-xs space-y-0.5 text-slate-600 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
            <p className="font-bold text-slate-900">Acme Corp Warehouse (Default)</p>
            <p>123 Industrial Parkway, Suite A</p>
            <p>Metropolis, NY 10001</p>
            <p className="text-slate-400 text-[11px] pt-1">Attn: Receiving Dept. (+1 555-0198)</p>
          </div>

          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Shipping Method
            </span>
            <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full border-4 border-primary bg-white shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Standard Freight (5-7 Days)</p>
                  <p className="text-[10px] text-slate-500">Estimated delivery: Oct 12-14</p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-900">{formatPrice(shipping)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Payment Method</h2>
            </div>
            <button className="text-xs font-bold text-primary hover:underline">
              Change
            </button>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
            <div className="bg-slate-200 text-slate-700 text-[10px] font-black px-2 py-1 rounded-md">
              VISA
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Visa ending in 4242</p>
              <p className="text-[10px] text-slate-400">Expires 12/25</p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 font-medium pt-1">
            <input
              type="checkbox"
              checked={billingSame}
              onChange={(e) => setBillingSame(e.target.checked)}
              className="w-4 h-4 rounded text-primary accent-primary"
            />
            <span>Billing address same as shipping</span>
          </label>
        </div>
        </div>

        {/* Desktop Order Summary */}
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2.5">
            <h2 className="text-xs font-bold text-slate-900">Order Summary</h2>
            <div className="space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Subtotal ({item.quantity.toLocaleString()} items)</span>
                <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-semibold text-slate-800">{formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (Estimated)</span>
                <span className="font-semibold text-slate-800">{formatPrice(tax)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-800">Total</span>
              <div className="text-xl font-black text-primary">
                {formatPrice(total)}
              </div>
            </div>

            <Button
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
            >
              {submitting ? 'Securing Escrow...' : 'Place Order'}
            </Button>

            <p className="text-[10px] text-center text-slate-400">
              By placing your order, you agree to our Terms of B2B Trade.
            </p>
          </div>
        </aside>
      </main>

      {/* Sticky Bottom Order Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30 lg:hidden">
        <div className="max-w-lg mx-auto space-y-2.5">
          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal ({item.quantity.toLocaleString()} items)</span>
              <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="font-semibold text-slate-800">{formatPrice(shipping)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (Estimated)</span>
              <span className="font-semibold text-slate-800">{formatPrice(tax)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-800">Total</span>
            <div className="text-xl font-black text-primary">
              {formatPrice(total)}
            </div>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
          >
            {submitting ? 'Securing Escrow...' : 'Place Order'}
          </Button>

          <p className="text-[10px] text-center text-slate-400">
            By placing your order, you agree to our Terms of B2B Trade.
          </p>
        </div>
      </div>
    </div>
  )
}

export default BuyNowPage
