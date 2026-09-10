'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, ShieldCheck, Lock, CheckCircle2, Clock,
  CreditCard, Building2, HelpCircle, ChevronRight
} from 'lucide-react'

export function EscrowProtectionGuidePage() {
  const { navigate, goBack } = useNavigationStore()

  const features = [
    {
      title: '1. Vault Lock Upon Checkout',
      desc: 'When you pay for a wholesale order, your payment is placed in Zylod SafePay Escrow. The supplier cannot withdraw or access these funds yet.',
      icon: Lock,
    },
    {
      title: '2. Safe Courier Dispatch',
      desc: 'The manufacturer packages the goods and dispatches via approved logistics partners with real-time consignment GPS tracking.',
      icon: ShieldCheck,
    },
    {
      title: '3. 48-Hour Quality Inspection',
      desc: 'You receive the delivery, inspect carton counts and product build quality, and confirm receipt on the app.',
      icon: Clock,
    },
    {
      title: '4. Automated Merchant Release',
      desc: 'Only after you confirm receipt — or after 48 hours without any logged dispute — the payment is automatically transferred to the seller.',
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Zylod SafePay Escrow</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 space-y-6 md:space-y-8 max-w-3xl mx-auto lg:max-w-4xl w-full pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 rounded-3xl p-6 text-white shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-200 uppercase tracking-wide">
            <Lock className="w-4 h-4" />
            100% Wholesale Payment Protection
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">How Zylod SafePay Escrow Works</h1>
          <p className="text-xs text-red-100 leading-relaxed">
            Eliminating wholesale advance payment risk for Bangladesh retailers and manufacturers.
          </p>
        </div>

        {/* Step-by-Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {features.map((f, idx) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-900">{f.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Payment Gateways */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2.5">
            Supported Wholesale Payment Channels
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-semibold text-gray-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 text-center">
              <span className="text-pink-600 font-bold block mb-0.5">bKash</span>
              <span className="text-[10px] text-gray-400">Merchant Direct</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 text-center">
              <span className="text-orange-600 font-bold block mb-0.5">Nagad</span>
              <span className="text-[10px] text-gray-400">B2B Checkout</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 text-center">
              <span className="text-blue-600 font-bold block mb-0.5">Bank RTGS</span>
              <span className="text-[10px] text-gray-400">BEFTN / NPSB</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 text-center">
              <span className="text-slate-800 font-bold block mb-0.5">Visa / Card</span>
              <span className="text-[10px] text-gray-400">Commercial Debit</span>
            </div>
          </div>
        </div>

        {/* CTA: Wallet + FAQ */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('wallet')}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition"
          >
            Check Your SafePay Wallet →
          </button>
          <button
            onClick={() => navigate('faq', { category: 'payments' })}
            className="text-xs font-bold text-red-600 hover:underline"
          >
            Read Escrow &amp; Payment FAQs →
          </button>
        </div>
      </div>
    </div>
  )
}

export default EscrowProtectionGuidePage
