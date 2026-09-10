'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, HelpCircle, Check, Package, Truck, Home,
  Download, AlertTriangle, MapPin, CreditCard, Clock, FileText
} from 'lucide-react'

export function OrderDetailPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || 'ORD-88291-B'

  const order = {
    number: `Order #${orderId}`,
    status: 'Shipped',
    estDelivery: 'Oct 24, 2023',
    items: [
      {
        id: 'it-1',
        name: 'Industrial Steel Bearings - 608ZZ Precision Grade',
        sku: 'IB-608ZZ-99',
        price: 450.00,
        unitPrice: 4.50,
        qty: 100,
        image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
      },
      {
        id: 'it-2',
        name: 'High-Tensile Nylon Rope (Orange) - 50m Spool',
        sku: 'NR-ORG-50M',
        price: 1200.00,
        unitPrice: 24.00,
        qty: 50,
        image: 'https://images.unsplash.com/photo-1586528116493-a029325540fa?w=500&auto=format&fit=crop&q=80',
      },
    ],
    subtotal: 1650.00,
    shipping: 125.00,
    tax: 132.00,
    total: 1907.00,
    address: {
      company: 'Acme Manufacturing Corp.',
      dock: 'Warehouse Dock 4',
      street: '123 Industrial Parkway',
      city: 'Chicago, IL 60601',
      country: 'United States',
    },
    billing: {
      card: 'Visa ending in •••• 4242',
      terms: 'Net 30 Terms Applied',
    },
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-bold text-slate-900">{order.number}</h1>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-700" title="Help">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:px-6 md:py-6 md:max-w-2xl lg:max-w-6xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        {/* Status Card & 4-Step Progress */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-5 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm md:text-base font-black text-slate-900">
                Status: {order.status}
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                Estimated Delivery: {order.estDelivery}
              </p>
            </div>
            <Button
              onClick={() => navigate('track-order', { orderId })}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-4 rounded-xl text-xs shadow-xs"
            >
              Track Order
            </Button>
          </div>

          {/* 4-Step Stepper */}
          <div className="flex items-center justify-between px-2 pt-2">
            {/* Step 1: Placed */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                <Check className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">Placed</span>
            </div>

            <div className="flex-1 h-0.5 bg-primary mx-1" />

            {/* Step 2: Packed */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                <Package className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">Packed</span>
            </div>

            <div className="flex-1 h-0.5 bg-primary mx-1" />

            {/* Step 3: Shipped */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                <Truck className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">Shipped</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-1" />

            {/* Step 4: Delivered */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-black">
                <Home className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-1">Delivered</span>
            </div>
          </div>
        </div>

        {/* Items in Order Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 lg:col-span-2">
          <h2 className="text-xs md:text-sm font-bold text-slate-900">
            Items in Order ({order.items.length})
          </h2>

          <div className="divide-y divide-slate-100 space-y-3 pt-1">
            {order.items.map((item, idx) => (
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
                  <div className="flex items-baseline justify-between mt-1.5">
                    <span className="text-xs font-black text-primary">
                      {formatPrice(item.price)}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({formatPrice(item.unitPrice)}/unit)
                      </span>
                    </span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      Qty: {item.qty}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Summary Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 lg:col-start-3 lg:row-start-1 lg:row-span-2">
          <h2 className="text-xs md:text-sm font-bold text-slate-900">Payment Summary</h2>

          <div className="space-y-1.5 text-xs text-slate-500 pt-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping (LTL Freight)</span>
              <span className="font-semibold text-slate-900">{formatPrice(order.shipping)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (8%)</span>
              <span className="font-semibold text-slate-900">{formatPrice(order.tax)}</span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-xl md:text-2xl font-black text-primary">
                {formatPrice(order.total)}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-50 space-y-2">
            <Button
              variant="outline"
              onClick={() => navigate('order-invoice', { orderId })}
              className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Commercial Invoice
            </Button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => navigate('submit-ticket', { orderId })}
                className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Raise Dispute Ticket
              </button>

              <button
                onClick={() => navigate('report-user', { orderId })}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Report Seller
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] md:text-xs text-slate-500 pt-2 px-1 border-t border-slate-100">
              <button
                onClick={() => navigate('escrow-protection-guide')}
                className="hover:text-red-600 hover:underline"
              >
                SafePay Escrow Rules
              </button>
              <button
                onClick={() => navigate('buyer-protection-policy')}
                className="hover:text-red-600 hover:underline"
              >
                48h Inspection Policy
              </button>
            </div>
          </div>
        </div>

        {/* Shipping & Billing Info Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4 lg:col-span-3 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          {/* Shipping */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Truck className="h-4 w-4 text-slate-600" />
              <span>Shipping Address</span>
            </div>
            <div className="text-xs text-slate-600 pl-6 space-y-0.5">
              <p className="font-bold text-slate-800">{order.address.company}</p>
              <p>{order.address.dock}</p>
              <p>{order.address.street}</p>
              <p>{order.address.city}, {order.address.country}</p>
            </div>
          </div>

          {/* Billing */}
          <div className="space-y-1 pt-3 border-t border-slate-100 lg:border-t-0 lg:pt-0">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <CreditCard className="h-4 w-4 text-slate-600" />
              <span>Billing Info</span>
            </div>
            <div className="text-xs text-slate-600 pl-6 space-y-0.5">
              <p className="font-bold text-slate-800">{order.billing.card}</p>
              <p className="text-slate-400 text-[11px]">{order.billing.terms}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default OrderDetailPage
