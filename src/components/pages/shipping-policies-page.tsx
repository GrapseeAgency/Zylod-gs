'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, MoreVertical, ShieldCheck, ShieldAlert,
  ChevronDown, MessageSquare, PhoneCall, Truck, Warehouse, Calculator, User
} from 'lucide-react'

export function ShippingPoliciesPage() {
  const { navigate, goBack } = useNavigationStore()
  const [openSection, setOpenSection] = useState<number | null>(null)

  const toggleSection = (idx: number) => {
    setOpenSection(openSection === idx ? null : idx)
  }

  const sections = [
    {
      title: '1. Understanding Incoterms',
      content:
        'We support EXW, FOB, CIF, and DAP for all enterprise B2B shipments. Under FOB, risk transfers when goods pass the ship rail at origin. Under DAP, supplier remains liable until dock receipt.',
    },
    {
      title: '2. Damage Claims Procedure',
      content:
        'All visible damage must be recorded on the digital Proof of Delivery (POD) before driver departure. Photographic evidence and inspection reports must be submitted through Dispute Center within 72 hours of delivery.',
    },
    {
      title: '3. Return Shipping Rules (RMA)',
      content:
        'Returns require an authorized Return Merchandise Authorization (RMA) code issued via the Return Request portal. Pallets must be shrink-wrapped with corner guards and affixed with original barcode labels.',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Logistics Suite</span>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Logistics Suite</h1>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Title & Intro */}
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Shipping &amp; Logistics Policies
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Comprehensive documentation for global logistics, shipping terms, insurance, and claims procedures. Review these policies carefully before initiating large-scale freight operations.
          </p>
        </div>

        {/* Card 1: Standard Incoterms 2020 */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-black text-slate-900">Standard Incoterms 2020</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Our primary operating terms default to FOB (Free on Board) and CIF (Cost, Insurance, and Freight). Please verify your specific contract.
          </p>
        </div>

        {/* Card 2: Freight Insurance */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-black text-slate-900">Freight Insurance</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            All high-value shipments (&gt; $50,000 USD) mandate comprehensive cargo insurance. Claims must be filed within 72 hours of receipt.
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-2.5 pt-1">
          {sections.map((sec, idx) => {
            const isOpen = openSection === idx

            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleSection(idx)}
                  className="w-full p-4 flex items-center justify-between text-left font-bold text-xs text-slate-900 hover:bg-slate-50"
                >
                  <span>{sec.title}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180 text-primary' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4 pt-1 text-xs text-slate-600 border-t border-slate-100 leading-relaxed"
                    >
                      {sec.content}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Support Card */}
        <div className="bg-slate-100/70 rounded-3xl p-5 border border-slate-200/80 space-y-3">
          <div>
            <h3 className="text-xs font-black text-slate-900">Need further clarification?</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Our logistics support team is available 24/7 for complex routing inquiries.
            </p>
          </div>

          <Button
            onClick={() => navigate('delivery-chat')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Contact Support
          </Button>
        </div>
      </main>
    </div>
  )
}