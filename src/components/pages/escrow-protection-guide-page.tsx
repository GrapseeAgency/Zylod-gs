'use client'

import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, ShieldCheck, Lock, CheckCircle2, Clock,
  Building2, Smartphone, ChevronRight
} from 'lucide-react'

export function EscrowProtectionGuidePage() {
  const { navigate, goBack } = useNavigationStore()

  const steps = [
    {
      title: '1. Order Starts UNPAID',
      desc: 'Every order on Zylod is created as UNPAID. Suppliers are expected not to fulfil an order until its payment is verified — the order status always shows the real payment state.',
      icon: Lock,
    },
    {
      title: '2. You Pay Directly',
      desc: 'Open the order, choose a payment method, and send the exact total to the published bank account or mobile-wallet merchant number. Zylod calculates the total on the server — never trust amounts quoted elsewhere.',
      icon: Building2,
    },
    {
      title: '3. Payment Is Verified',
      desc: 'Your payment is only counted when it is confirmed by a signed payment notification from the payment provider, or reviewed and approved by a Zylod admin. Until then the order stays UNPAID — no exceptions.',
      icon: ShieldCheck,
    },
    {
      title: '4. Supplier Fulfils the Paid Order',
      desc: 'Once the payment is verified, the supplier ships and tracking updates appear on your order timeline. You can follow every status change in real time.',
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition" aria-label="Go back">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">How Payments Work</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 space-y-6 md:space-y-8 max-w-3xl mx-auto lg:max-w-4xl w-full pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 rounded-3xl p-6 text-white shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-200 uppercase tracking-wide">
            <Lock className="w-4 h-4" />
            Payment Verification
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">How Payments Work on Zylod</h1>
          <p className="text-xs text-red-100 leading-relaxed">
            Orders stay UNPAID until a payment is verified by a signed notification or an admin — suppliers only fulfil verified orders.
          </p>
        </div>

        {/* Step-by-Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {steps.map((f, idx) => {
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

        {/* Payment Channels */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2.5">
            Supported Payment Channels
          </h2>
          <div className="grid grid-cols-2 gap-2.5 text-xs font-semibold text-gray-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 text-center">
              <Building2 className="w-5 h-5 mx-auto mb-1 text-slate-700" />
              <span className="text-slate-800 font-bold block mb-0.5">Bank Transfer</span>
              <span className="text-[10px] text-gray-400">Account details shown per order</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 text-center">
              <Smartphone className="w-5 h-5 mx-auto mb-1 text-pink-600" />
              <span className="text-pink-600 font-bold block mb-0.5">Mobile Banking</span>
              <span className="text-[10px] text-gray-400">bKash / Nagad merchant numbers</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
            Card payments and escrow holding are not available yet. Until a dedicated escrow service exists, never send more than the verified order total, and always pay using the exact account details shown on your order.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('wallet')}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition"
          >
            Open Your Wallet →
          </button>
          <button
            onClick={() => navigate('faq', { category: 'payments' })}
            className="text-xs font-bold text-red-600 hover:underline flex items-center gap-0.5"
          >
            Read Payment FAQs
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default EscrowProtectionGuidePage
