'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Menu, Search, Plus, Scale, Clock, HeartHandshake,
  CheckCircle2, AlertTriangle, ChevronDown
} from 'lucide-react'

interface DisputeCase {
  id: string
  title: string
  caseId: string
  orderId: string
  supplier: string
  amount: number
  status: 'awaiting_supplier' | 'under_mediation' | 'action_required'
  statusBadge: string
  statusType: 'peach' | 'red' | 'gray'
  openedTime: string
}

export function DisputeCenterPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [activeTab, setActiveTab] = useState<'all' | 'awaiting' | 'mediation'>('all')

  const metrics = {
    totalActive: 12,
    awaitingSupplier: 5,
    underMediation: 3,
    resolved30d: 24,
  }

  const cases: DisputeCase[] = [
    {
      id: 'dsp-1',
      title: 'Missing Items in Bulk Shipment',
      caseId: 'DSP-2023-8901',
      orderId: 'ORD-992-441',
      supplier: 'MegaTech Electronics',
      amount: 1250.00,
      status: 'awaiting_supplier',
      statusBadge: 'Awaiting Supplier Response',
      statusType: 'peach',
      openedTime: 'Opened 2 days ago',
    },
    {
      id: 'dsp-2',
      title: 'Defective Product Batch - Safety Gear',
      caseId: 'DSP-2023-8874',
      orderId: 'ORD-991-802',
      supplier: 'Industrial Supply Co.',
      amount: 3400.00,
      status: 'under_mediation',
      statusBadge: 'Under Mediation',
      statusType: 'red',
      openedTime: 'Opened 5 days ago',
    },
    {
      id: 'dsp-3',
      title: 'Delayed Shipping - Missed Delivery Window',
      caseId: 'DSP-2023-8899',
      orderId: 'ORD-992-105',
      supplier: 'Global Textiles Ltd.',
      amount: 850.00,
      status: 'action_required',
      statusBadge: 'Awaiting Your Response',
      statusType: 'gray',
      openedTime: 'Updated 1 hr ago',
    },
  ]

  const filteredCases = cases.filter((c) => {
    if (activeTab === 'awaiting') return c.status === 'awaiting_supplier'
    if (activeTab === 'mediation') return c.status === 'under_mediation'
    return true
  })

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Menu">
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Search">
            <Search className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto lg:max-w-5xl">
        {/* Title */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
            Dispute Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage and resolve active disputes with suppliers.
          </p>
        </div>

        {/* Open New Dispute CTA */}
        <Button
          onClick={() => navigate('raise-complaint')}
          className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Open New Dispute
        </Button>

        {/* 2x2 Metric Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Metric 1 */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
              <Scale className="h-3.5 w-3.5" />
              <span>Total Active</span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900">
              {metrics.totalActive}
            </div>
          </div>

          {/* Metric 2 */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
              <Clock className="h-3.5 w-3.5" />
              <span>Awaiting Supplier</span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-primary">
              {metrics.awaitingSupplier}
            </div>
          </div>

          {/* Metric 3 */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
              <HeartHandshake className="h-3.5 w-3.5" />
              <span>Under Mediation</span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-primary">
              {metrics.underMediation}
            </div>
          </div>

          {/* Metric 4 */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Resolved (30d)</span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900">
              {metrics.resolved30d}
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Active' },
            { key: 'awaiting', label: 'Awaiting Supplier Response' },
            { key: 'mediation', label: 'Under Mediation' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dispute Cases List */}
        <div className="space-y-3">
          <div className="md:hidden space-y-3">
          {filteredCases.map((c) => {
            const isPeach = c.statusType === 'peach'
            const isRed = c.statusType === 'red'

            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 border-l-4 border-l-primary"
              >
                {/* Header Tag & Time */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-bold px-2.5 py-0.5 rounded-md ${
                      isPeach
                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                        : isRed
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {c.statusBadge}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {c.openedTime}
                  </span>
                </div>

                {/* Case Title & Info */}
                <div>
                  <h3 className="text-xs font-black text-slate-900 leading-snug">
                    {c.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Case ID: <span className="font-mono text-slate-600">{c.caseId}</span> &nbsp;•&nbsp; Order ID: <span className="font-mono text-slate-600">{c.orderId}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Supplier: <span className="font-semibold text-slate-700">{c.supplier}</span>
                  </p>
                </div>

                {/* Amount & Action Button */}
                <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-base font-black text-slate-900">
                    {formatPrice(c.amount)}
                  </span>

                  {c.status === 'action_required' ? (
                    <Button
                      onClick={() => navigate('dispute-detail', { disputeId: c.id })}
                      className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-4 rounded-xl text-xs shadow-xs"
                    >
                      Action Required
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => navigate('dispute-detail', { disputeId: c.id })}
                      className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-9 px-4 rounded-xl text-xs"
                    >
                      View Details
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50/50 text-left">
                  <th className="p-3 text-xs font-semibold text-gray-700">Case</th>
                  <th className="p-3 text-xs font-semibold text-gray-700">Supplier</th>
                  <th className="p-3 text-xs font-semibold text-gray-700">Amount</th>
                  <th className="p-3 text-xs font-semibold text-gray-700">Status</th>
                  <th className="p-3 text-xs font-semibold text-gray-700">Opened</th>
                  <th className="p-3 text-xs font-semibold text-gray-700"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => {
                  const isPeach = c.statusType === 'peach'
                  const isRed = c.statusType === 'red'
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-red-50/30">
                      <td className="p-3">
                        <div className="font-medium text-slate-900">{c.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {c.caseId} &nbsp;•&nbsp; {c.orderId}
                        </div>
                      </td>
                      <td className="p-3 text-slate-700">{c.supplier}</td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{formatPrice(c.amount)}</td>
                      <td className="p-3">
                        <span
                          className={`text-[9px] font-bold px-2.5 py-0.5 rounded-md whitespace-nowrap ${
                            isPeach
                              ? 'bg-rose-50 text-rose-700 border border-rose-100'
                              : isRed
                              ? 'bg-primary text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.statusBadge}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap">{c.openedTime}</td>
                      <td className="p-3">
                        {c.status === 'action_required' ? (
                          <Button
                            onClick={() => navigate('dispute-detail', { disputeId: c.id })}
                            className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-4 rounded-xl text-xs shadow-xs"
                          >
                            Action Required
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => navigate('dispute-detail', { disputeId: c.id })}
                            className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-9 px-4 rounded-xl text-xs"
                          >
                            View Details
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Load More Link */}
        <div className="text-center pt-2">
          <button className="text-xs text-primary font-bold inline-flex items-center gap-1 hover:underline">
            <span>Load More Cases</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </main>
    </div>
  )
}
