'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, MoreVertical, Download, Check, Hourglass,
  Info, Upload, FileText, AlertCircle, ShieldCheck,
  Truck, Warehouse, Calculator, User, MessageSquare
} from 'lucide-react'

export function CustomsClearancePage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const shipmentId = pageParams.shipmentId || 'SHP-84729-X'

  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)

  const handleUpload = () => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(true)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Logistics Suite</span>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg lg:max-w-5xl mx-auto">
        {/* Title & Export */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
              Customs Clearance Status
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Shipment #{shipmentId} • Origin: Shenzhen, CN
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 border-slate-200 flex items-center gap-1.5 shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </Button>
        </div>

        {/* Current Stage Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                CURRENT STAGE
              </span>
              <h2 className="text-base font-black text-slate-900 mt-0.5">
                Under Review
              </h2>
            </div>

            <span className="bg-rose-50 text-primary border border-rose-100 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              In Progress
            </span>
          </div>

          {/* 3-Step Progress */}
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            {/* Step 1: Completed */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20">
                <Check className="h-5 w-5 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-bold text-slate-700 leading-tight">
                Documentation<br />Pending
              </span>
            </div>

            {/* Step 2: Under Review */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-white border-2 border-primary text-primary flex items-center justify-center shadow-md">
                <Hourglass className="h-5 w-5 animate-pulse" />
              </div>
              <span className="text-[10px] font-black text-primary leading-tight">
                Under<br />Review
              </span>
            </div>

            {/* Step 3: Cleared */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200">
                <Check className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-semibold text-slate-400 leading-tight">
                Cleared
              </span>
            </div>
          </div>

          {/* Estimated Completion Notice */}
          <div className="p-3.5 bg-slate-100/80 rounded-2xl border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
            <Info className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-slate-900">Estimated Completion: Tomorrow, 14:00</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Customs agents are currently reviewing the commercial invoice discrepancies.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
        {/* Key Details Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Key Details
          </h2>

          <div className="space-y-2 text-xs divide-y divide-slate-50">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Broker</span>
              <span className="font-bold text-slate-900">Apex Logistics Co.</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Port of Entry</span>
              <span className="font-semibold text-slate-900">Chittagong Port, BD</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Est. Duties</span>
              <span className="font-black text-primary font-mono">{formatPrice(4250.00)}</span>
            </div>
          </div>

          {/* Action Required Banner */}
          <div className="pt-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-primary block mb-2">
              ACTION REQUIRED
            </span>

            {uploaded ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Revised Invoice Submitted to Broker!</span>
              </div>
            ) : (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Submitting to Customs...' : 'Upload Revised Invoice'}
              </Button>
            )}
          </div>
        </div>

        {/* Required Documents List */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Required Documents
            </h2>
            <span className="text-[10px] font-bold text-slate-400">SUBMITTED DATE</span>
          </div>

          <div className="space-y-2">
            {/* Bill of Lading */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Bill of Lading (BOL)</h3>
                  <p className="text-[10px] text-slate-400 font-mono">BOL-992-A</p>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Oct 12, 2023</span>
            </div>

            {/* Commercial Invoice with HS Code Mismatch */}
            <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Commercial Invoice</h3>
                  <p className="text-[10px] font-bold text-primary">HS Code Mismatch</p>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Oct 12, 2023</span>
            </div>

            {/* Packing List */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Packing List</h3>
                  <p className="text-[10px] text-slate-400 font-mono">PL-4432</p>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Oct 14, 2023</span>
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}