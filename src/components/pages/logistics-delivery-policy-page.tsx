'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Truck, Package, Clock, ShieldCheck,
  Building2, MapPin, CheckCircle2, ChevronRight
} from 'lucide-react'

export function LogisticsDeliveryPolicyPage() {
  const { navigate, goBack } = useNavigationStore()

  const couriers = [
    { name: 'Steadfast Courier', type: 'Full Countrywide API', time: '24–72 hours', area: '64 Districts' },
    { name: 'Pathao Courier B2B', type: 'Express Dispatch', time: '24–48 hours', area: 'Metro & Sub-districts' },
    { name: 'RedX Wholesale Logistics', type: 'Heavy Cargo & Bulky Parcels', time: '48–72 hours', area: 'Nationwide' },
    { name: 'SA Paribahan / Sundarban', type: 'Station-to-Station Cargo', time: '24–48 hours', area: 'All Branch Hubs' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Shipping & Logistics Policy</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 space-y-6 md:space-y-8 max-w-3xl lg:max-w-4xl mx-auto w-full pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-3xl p-6 shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-200 uppercase tracking-wide">
            <Truck className="w-4 h-4" />
            Nationwide B2B Fulfillment
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Courier Standards & Dispatch SLAs</h1>
          <p className="text-xs text-red-100 leading-relaxed">
            Fast, insured wholesale freight delivery across all 64 districts in Bangladesh.
          </p>
        </div>

        {/* Courier Partners */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
            Integrated Logistics Partners
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {couriers.map((c, idx) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900">{c.name}</h3>
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                    {c.time}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{c.type}</p>
                <p className="text-[11px] text-gray-400">Coverage: {c.area}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Shipping Standards */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2.5">
            Key Delivery Rules
          </h2>
          <ul className="space-y-2.5 text-xs text-gray-600 leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span><strong>Packaging Standards:</strong> All items must be packed in sturdy corrugated cartons with bubble wrap and water-resistant outer taping.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span><strong>Consignment Tracking:</strong> The seller must enter a valid Courier Consignment ID within 48 hours of order confirmation.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span><strong>Self-Pickup Option:</strong> Buyers can opt to inspect and pick up orders directly from the seller&apos;s factory or warehouse.</span>
            </li>
          </ul>
        </div>
        {/* CTA: Track + Report */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('orders')}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition"
          >
            Track Your Order →
          </button>
          <button
            onClick={() => navigate('report-problem')}
            className="px-6 py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-700 rounded-xl text-xs font-bold shadow-sm transition"
          >
            Report a Delivery Problem →
          </button>
        </div>
      </div>
    </div>
  )
}

export default LogisticsDeliveryPolicyPage
