'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { Scale, ArrowLeft, LifeBuoy, PackageSearch, PlugZap } from 'lucide-react'

export function DisputeDetailPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+40px)] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-bold text-slate-900">Dispute Thread</h1>
        </div>
      </header>

      <main className="px-4 py-16 md:py-24 max-w-lg mx-auto text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
          <Scale className="h-9 w-9 text-gray-400" />
        </div>

        <h1 className="text-base font-black text-slate-900">Disputes aren&apos;t connected yet</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          Zylod doesn&apos;t have a dispute &amp; arbitration system connected right now, so there is
          no case record to show here. Nothing about this page is simulated — when the disputes
          service goes live, your real cases will appear in the Dispute Center.
        </p>

        <div className="mt-6 bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 text-left space-y-3 max-w-sm mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
              <PackageSearch className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">Have an issue with an order?</h2>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Open the order from your orders page and use the order timeline or contact the
                supplier directly while the disputes service is being built.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
              <PlugZap className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">Coming from the backend</h2>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                This screen will start showing live dispute data as soon as the disputes API is
                deployed — no sample cases will ever be shown.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 max-w-xs mx-auto">
          <Button
            onClick={() => navigate('help-center')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl shadow-md flex items-center justify-center gap-1.5"
          >
            <LifeBuoy className="h-4 w-4" />
            Visit Help Center
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('orders')}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl"
          >
            View My Orders
          </Button>
          <Button
            variant="outline"
            onClick={goBack}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-10 rounded-2xl"
          >
            Go Back
          </Button>
        </div>
      </main>
    </div>
  )
}

export default DisputeDetailPage
