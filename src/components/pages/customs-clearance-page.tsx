'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, FileText, Info, ShieldCheck, Truck, Calculator, Check,
} from 'lucide-react'

/**
 * Customs clearance — HONEST informational guide (audit unit 20). The old
 * page was pure theater: a fake shipment id (SHP-84729-X), a fake broker
 * ("Apex Logistics Co."), a fake "Under Review" pipeline with a pulsing
 * live badge, a fake "Estimated Completion: Tomorrow, 14:00", fake duties
 * (৳4,250.00), and an upload button whose setTimeout fabricated "Revised
 * Invoice Submitted to Broker!" — none of it existed in any table (the
 * schema audit removed the dead customsDocuments model; no customs rails
 * exist on the platform). This page now says exactly that, and keeps only
 * what is real: a genuinely useful document checklist and process guide for
 * buyers whose freight forwarder handles clearance OUTSIDE the platform.
 */

const DOC_CHECKLIST: Array<{ name: string; why: string }> = [
  { name: 'Bill of Lading (BOL)', why: 'Issued by your carrier — proves title to the goods at the port.' },
  { name: 'Commercial Invoice', why: 'Declares value for duty; the HS code on it must match the packing list.' },
  { name: 'Packing List', why: 'Per-carton contents and weights — customs reconciles it against the invoice.' },
  { name: 'HS Code Classification', why: 'The single most common clearance delay — classify before shipping, not at the port.' },
  { name: 'Import Permit / BIN (Bangladesh)', why: 'Your IRC/BIN registration must be valid for the declared consignment.' },
]

const PROCESS_STEPS: Array<{ title: string; body: string }> = [
  { title: '1. Arrival & manifest filing', body: 'The carrier files the manifest at Chittagong Port / Dhaka Airport once the vessel or flight arrives.' },
  { title: '2. Bill of entry by your agent', body: 'Your licensed customs agent (C&F agent) files the bill of entry against your BIN with the supporting documents.' },
  { title: '3. Assessment & duty payment', body: 'Customs assesses duty per the HS code; your agent pays it and collects the release order.' },
  { title: '4. Release & delivery', body: 'The port releases the consignment to your agent\'s trucker; hand-off to your warehouse is your last mile.' },
]

export function CustomsClearancePage() {
  const { goBack, navigate } = useNavigationStore()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        <span className="w-6" />
      </header>

      <main className="px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg lg:max-w-4xl mx-auto">
        {/* Title */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Customs Clearance Guide</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">What to expect when your wholesale consignment crosses the border.</p>
        </div>

        {/* The honest banner — no live process is bound to this view */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-amber-900 space-y-1">
            <p className="font-black">No live customs process is attached to this view.</p>
            <p className="text-amber-800">
              Zylod does not clear customs — cross-border consignments are cleared by your own
              freight forwarder / C&amp;F agent outside the platform, and your supplier ships EXW/FOB/CIF
              per your agreed incoterm. There is intentionally NO fake status, broker, duty figure, or
              upload button here: those would be numbers the platform cannot know.
            </p>
          </div>
        </div>

        {/* What the platform DOES track */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <Truck className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs font-black text-slate-900 dark:text-slate-100">Shipment status</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed mt-0.5">
              Real order slices and tracking events live on each order&apos;s detail page — seller transitions and driver milestones, live.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <ShieldCheck className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs font-black text-slate-900 dark:text-slate-100">Delivery windows</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed mt-0.5">
              Reschedule a real order&apos;s delivery from the order page — the request lands in the supplier&apos;s feed.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <Calculator className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs font-black text-slate-900 dark:text-slate-100">Live freight quotes</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed mt-0.5">
              The freight calculator quotes the operators&apos; real zone book — the same rates checkout charges.
            </p>
          </div>
        </div>

        {/* Document checklist — genuinely real guidance */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Document Checklist</h2>
          <div className="space-y-2">
            {DOC_CHECKLIST.map((doc) => (
              <div key={doc.name} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{doc.name}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed">{doc.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Process steps */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">The Process, Step by Step</h2>
          <div className="space-y-2">
            {PROCESS_STEPS.map((step) => (
              <div key={step.title} className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-rose-50 text-primary flex items-center justify-center shrink-0 border border-rose-100">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{step.title}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={() => navigate('my-orders')}
          className="w-full md:w-auto md:px-8 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
        >
          Track a real order instead
        </Button>
      </main>
    </div>
  )
}

export default CustomsClearancePage
