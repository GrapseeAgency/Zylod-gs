'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  ArrowLeft, MapPin, Truck, CreditCard, Check,
  CheckCircle2, Package, Lock, ShieldCheck
} from 'lucide-react'

export function CheckoutPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { items, clearCart } = useCartStore()

  const [submitting, setSubmitting] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)

  const checkoutItem = useMemo(() => {
    if (items.length > 0) {
      const first = items[0]
      return {
        name: first.productName,
        qty: first.quantity,
        moq: first.moq,
        price: first.totalPrice || first.unitPrice * first.quantity,
        image: first.productImage || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
      }
    }
    return {
      name: 'Industrial Grade LED High-Bay Fixtures (150W)',
      qty: 50,
      moq: 10,
      price: 1250.00,
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
    }
  }, [items])

  const subtotal = checkoutItem.price
  const shipping = 150.00
  const tax = +(subtotal * 0.10).toFixed(2)
  const total = subtotal + shipping + tax

  const handleConfirmAndPay = () => {
    setSubmitting(true)
    setTimeout(() => {
      clearCart()
      setSubmitting(false)
      setOrderPlaced(true)
    }, 1200)
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 md:p-10 text-center text-slate-900">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10 md:h-12 md:w-12" />
        </div>
        <h1 className="text-xl md:text-2xl font-black text-slate-900">Order Confirmed!</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Order #ZY-77402 has been placed with the supplier. Escrow payment is secured via Trade Assurance.
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('orders')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            View My Orders
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('home')}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl"
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <div className="w-5" />
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 max-w-lg mx-auto lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
        {/* 4-Step Progress Bar */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between relative px-2">
            {/* Step 1: Cart (Done) */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                <Check className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">Cart</span>
            </div>

            <div className="flex-1 h-0.5 bg-primary mx-2" />

            {/* Step 2: Details (Done) */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                <Check className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">Details</span>
            </div>

            <div className="flex-1 h-0.5 bg-primary mx-2" />

            {/* Step 3: Review (Active) */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                3
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">Review</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-2" />

            {/* Step 4: Pay (Pending) */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-black">
                4
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-1">Pay</span>
            </div>
          </div>
        </div>

        {/* Page Title */}
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Review Order
        </h1>

        {/* Card 1: Shipping Address */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Shipping Address</h2>
            </div>
            <button
              onClick={() => navigate('shipping-address')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="text-xs text-slate-600 space-y-0.5 pt-1 pl-6">
            <p className="font-bold text-slate-900">Warehouse 4B - Logistics Hub</p>
            <p>123 Industrial Parkway, Suite 100</p>
            <p>Commerce City, CA 90210</p>
            <p className="text-slate-400 text-[11px] pt-0.5">Attn: Receiving Dept (+1 555-0198)</p>
          </div>
        </div>

        {/* Card 2: Delivery Method */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Delivery Method</h2>
            </div>
            <button
              onClick={() => navigate('delivery-method')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="text-xs text-slate-600 space-y-0.5 pt-1 pl-6">
            <p className="font-bold text-slate-900">Standard Freight Delivery</p>
            <p className="text-slate-500">Estimated delivery: Oct 24 - Oct 26</p>
          </div>
        </div>

        {/* Card 3: Payment Method */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Payment Method</h2>
            </div>
            <button
              onClick={() => navigate('payment-method')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="flex items-center gap-3 pt-1 pl-6">
            <div className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-1 rounded-md border border-slate-200">
              VISA
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Visa ending in 4242</p>
              <p className="text-[10px] text-slate-400">Billing address same as shipping</p>
            </div>
          </div>
        </div>

        </div>

        {/* Card 4: Order Summary (sticky sidebar on desktop) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs md:text-sm font-bold text-slate-900">Order Summary</h2>

          {/* Item Row */}
          <div className="flex items-center justify-between gap-3 pt-1 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                <img src={checkoutItem.image} alt={checkoutItem.name} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                  {checkoutItem.name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Qty: {checkoutItem.qty} (MOQ {checkoutItem.moq})
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-slate-900 shrink-0">
              {formatPrice(checkoutItem.price)}
            </span>
          </div>

          {/* Pricing Breakdown */}
          <div className="space-y-1.5 text-xs text-slate-500 pt-1">
            <div className="flex justify-between">
              <span>Subtotal (1 item)</span>
              <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="font-semibold text-slate-800">{formatPrice(shipping)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (10%)</span>
              <span className="font-semibold text-slate-800">{formatPrice(tax)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-800">Total</span>
            <div className="text-xl md:text-2xl font-black text-primary">
              {formatPrice(total)}
            </div>
          </div>
        </div>
        </aside>

        {/* Confirm & Pay CTA */}
        <div className="lg:col-span-2">
        <Button
          onClick={handleConfirmAndPay}
          disabled={submitting}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md mt-2 lg:mt-0"
        >
          {submitting ? 'Processing Payment...' : 'Confirm & Pay'}
        </Button>
        </div>
      </main>
    </div>
  )
}

export default CheckoutPage
