'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Package, Truck, Tag, TrendingDown,
  Layers, MessageSquare, Shield, ChevronRight, Sliders
} from 'lucide-react'

export function NotificationCategoriesPage() {
  const { navigate, goBack } = useNavigationStore()

  const categories = [
    {
      id: 'order-updates',
      title: 'Order Status Updates',
      desc: 'Purchase confirmations, manufacturing progress, and invoices',
      icon: Package,
      color: 'bg-blue-50 text-blue-600',
      badge: 'High Priority',
    },
    {
      id: 'delivery-updates',
      title: 'Courier & Freight Delivery',
      desc: 'Steadfast/Pathao/RedX tracking numbers and delivery receipts',
      icon: Truck,
      color: 'bg-emerald-50 text-emerald-600',
      badge: 'Live Tracking',
    },
    {
      id: 'price-drop-alerts',
      title: 'Price Drop Watches',
      desc: 'Custom price threshold alerts on watched wholesale products',
      icon: TrendingDown,
      color: 'bg-red-50 text-red-600',
      badge: 'Savings',
    },
    {
      id: 'back-in-stock-alerts',
      title: 'Back in Stock Watches',
      desc: 'Automated restock notifications from verified suppliers',
      icon: Layers,
      color: 'bg-teal-50 text-teal-600',
      badge: 'Inventory',
    },
    {
      id: 'promo-notifications',
      title: 'Promotions & Volume Deals',
      desc: 'Seasonal campaigns, flash discounts, and manufacturer promos',
      icon: Tag,
      color: 'bg-amber-50 text-amber-600',
      badge: 'Deals',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-bold text-gray-900 text-base">Notification Hubs</span>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-2xl mx-auto lg:max-w-5xl w-full space-y-4 md:space-y-6 pb-24 md:pb-8">
        <p className="text-xs text-gray-500 px-1">
          Explore individual notification centers to view history, manage subscriptions, and set real-time triggers.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat, idx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => navigate(cat.id as any)}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-red-200 hover:shadow transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.color}`}>
                  <cat.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">{cat.title}</h3>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                      {cat.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-1">{cat.desc}</p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NotificationCategoriesPage
