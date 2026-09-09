'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Award, FileCheck, CheckCircle2, ShieldCheck,
  Building2, CreditCard, ChevronRight, UploadCloud
} from 'lucide-react'

export function SellerVerificationGuidePage() {
  const { navigate, goBack } = useNavigationStore()

  const requirements = [
    {
      title: '1. Trade License (ট্রেড লাইসেন্স)',
      desc: 'Valid trade license issued by City Corporation or Union Parishad for the current fiscal year.',
      icon: Building2,
    },
    {
      title: '2. National ID (NID) of Proprietor',
      desc: 'Clear color scan of front and back of the business owner or managing director’s National Identity Card.',
      icon: ShieldCheck,
    },
    {
      title: '3. e-TIN Certificate (টিন সার্টিফিকেট)',
      desc: '12-digit Tax Identification Number certificate registered in Bangladesh.',
      icon: FileCheck,
    },
    {
      title: '4. Commercial Bank Account Verification',
      desc: 'Bank statement or cheque leaf matching the official registered business name for automated payouts.',
      icon: CreditCard,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Supplier Verification Guide</span>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Supplier Verification Guide</h1>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-3xl mx-auto w-full pb-24">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-3xl p-6 shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-200 uppercase tracking-wide">
            <Award className="w-4 h-4 text-yellow-300" />
            Verified Supplier Badge
          </div>
          <h1 className="text-lg sm:text-xl font-bold">KYC & Factory Verification Standards</h1>
          <p className="text-xs text-red-100 leading-relaxed">
            Boost customer confidence, unlock high-volume wholesale orders, and rank higher in search.
          </p>
        </div>

        {/* Requirements */}
        <div className="space-y-3">
          {requirements.map((r, idx) => {
            const Icon = r.icon
            return (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-900">{r.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{r.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Verification Timeline */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-2">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Review SLA & Timeline
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Our compliance team inspects submitted documents within **24–48 business hours**. Once approved, your storefront is automatically upgraded with the **Verified Supplier** trust badge.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center pt-2">
          <button
            onClick={() => navigate('seller-verification')}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 mx-auto"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Verification Documents
          </button>
        </div>
      </div>
    </div>
  )
}

export default SellerVerificationGuidePage
