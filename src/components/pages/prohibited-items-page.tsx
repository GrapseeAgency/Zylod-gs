'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, AlertOctagon, Ban, ShieldAlert, FileText,
  AlertTriangle, CheckCircle2, ChevronRight
} from 'lucide-react'

export function ProhibitedItemsPage() {
  const { navigate, goBack } = useNavigationStore()

  const categories = [
    {
      name: 'Weapons, Firearms & Explosives',
      items: ['Guns, ammunition, replica firearms', 'Fireworks, detonators, explosive materials', 'Military tactical combat gear without DGDP permit'],
    },
    {
      name: 'Counterfeit Goods & IP Infringement',
      items: ['Fake branded electronics, replica garments', 'Forged trade certificates or fake factory warranties', 'Pirated software, media, and unlicensed hardware'],
    },
    {
      name: 'Unregulated Chemicals & Hazardous Materials',
      items: ['Acid, toxic chemicals without Department of Explosives license', 'Unapproved agricultural pesticides', 'Industrial toxins without MSDS documentation'],
    },
    {
      name: 'Illegal Pharmaceuticals & Narcotics',
      items: ['Prescription drugs without DGDA wholesale licensing', 'Controlled narcotics, banned dietary supplements', 'Unlabeled herbal concoctions'],
    },
    {
      name: 'Smuggled & Non-Duty Paid Consignments',
      items: ['Baggage rule violations without customs clearance', 'Refurbished goods falsely labeled as new factory A-grade', 'Stolen or gray market inventory'],
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Prohibited Wholesale Items</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-3xl mx-auto w-full pb-24 md:px-6 md:py-8 md:pb-10">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Prohibited Wholesale Items</h1>
        {/* Warning Banner */}
        <div className="bg-red-600 rounded-3xl p-6 text-white shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-red-200 uppercase tracking-wide">
            <AlertOctagon className="w-4 h-4 text-white" />
            Compliance Notice
          </div>
          <h1 className="text-lg md:text-2xl font-bold">Strictly Restricted & Prohibited Inventory</h1>
          <p className="text-xs text-red-100 leading-relaxed">
            Listing or attempting to trade any of the items below violates Bangladesh Law and Zylod Terms. Violators are immediately banned, escrow deposits forfeited, and cases referred to the Directorate of National Consumer Rights Protection (DNCRP).
          </p>
        </div>

        {/* Categories List */}
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {categories.map((cat, idx) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3"
            >
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-600" />
                {cat.name}
              </h2>
              <ul className="space-y-2 text-xs text-gray-600">
                {cat.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Report link */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center space-y-2">
          <p className="text-xs font-bold text-gray-800">Found a listing violating these rules?</p>
          <button
            onClick={() => navigate('report-user')}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition"
          >
            Report Prohibited Listing
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProhibitedItemsPage
