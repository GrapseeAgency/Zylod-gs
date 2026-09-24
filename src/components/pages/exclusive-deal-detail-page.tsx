'use client'

import { ArrowLeft, Gem } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'

// HONESTY NOTE: this page previously staged a fully fabricated "VIP Mill Direct
// Deal" (invented cotton yarn lot, fake 480→360 BDT pricing, fake Narayanganj
// mill origin) with fake "Lock VIP Allocation with SafePay Escrow" purchase
// buttons. No exclusive-deals backend exists, so the page now shows an honest
// empty state instead of a fake purchase path.
export function ExclusiveDealDetailPage() {
  const { goBack } = useNavigationStore()

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <h1 className="font-bold text-base">VIP Mill Allocation Detail</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto md:max-w-2xl lg:max-w-4xl w-full pb-24 md:pb-8">
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 md:p-8 space-y-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto">
            <Gem className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-white">No exclusive deals published yet</h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
              When a verified supplier posts a real bulk lot, it will appear here with its actual price, available quantity, and lead time. Zylod does not stage demo deals or invented allocations.
            </p>
          </div>
          <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-700">
            Payments on Zylod are made by bank transfer or mobile banking (bKash/Nagad) — an order only advances once payment is verified.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ExclusiveDealDetailPage
