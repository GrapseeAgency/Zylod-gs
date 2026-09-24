'use client'

import { Smartphone, Building2, Info } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'

// HONESTY NOTE: this page previously showed fabricated saved payment methods
// (a "Corporate Visa ending in 4242 — Acme Corp", invented bKash/Nagad numbers,
// an L/C with named banks, and a fake Net-30 credit limit) plus a "Govt.
// verified escrow checkout" claim. Zylod stores no saved payment instruments
// and has no escrow — payments are made per order via the real routes below.
export function PaymentMethodPage() {
  const { navigate, goBack } = useNavigationStore()

  const routes = [
    {
      icon: Smartphone,
      title: 'Mobile Banking — bKash / Nagad',
      subtitle: 'Send the order total to the bKash/Nagad merchant number shown on your order, then wait for verification.',
    },
    {
      icon: Building2,
      title: 'Bank Transfer',
      subtitle: 'Transfer to the bank account details shown on your order. Payment is confirmed via bank webhook or admin review.',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            ←
          </button>
          <h1 className="text-base font-bold text-slate-900">My Payment Methods</h1>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-6 lg:max-w-4xl">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900">My Payment Methods</h1>

        <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>
            Zylod does not store cards or wallets yet, so there are no saved payment instruments to list — and nothing to select here. Payments are made per order using the routes below. Card saving and trade credit are not available.
          </p>
        </div>

        {/* Real payment routes */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {routes.map((opt) => (
            <div
              key={opt.title}
              className="w-full text-left bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <opt.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs md:text-sm font-bold text-slate-900">{opt.title}</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{opt.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Security badge */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center gap-2.5 text-[11px] text-slate-600">
          <Info className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Zylod does not hold payments in escrow. An order stays UNPAID until your payment is verified.</span>
        </div>

        <button
          onClick={() => navigate('payment-terms')}
          className="w-full md:w-auto md:max-w-xs md:mx-auto md:flex bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-sm items-center justify-center px-8"
        >
          Back to Payment Terms
        </button>
      </main>
    </div>
  )
}

export default PaymentMethodPage
