'use client'

import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Smartphone, Landmark } from 'lucide-react'

// HONESTY NOTE: this page previously listed five invented methods — including a
// "Zylod SafePay Escrow Wallet" and fabricated fees/limits/SLAs (1.85%, RTGS
// limits, gateway SLAs). Zylod supports exactly two real payment routes, both
// verified by webhook or admin review before an order advances.
export function PaymentMethodsDetailPage() {
  const { navigate, goBack } = useNavigationStore()

  const methods = [
    {
      icon: Smartphone,
      name: 'Mobile Banking — bKash / Nagad',
      category: 'Mobile Financial Services (MFS)',
      desc: 'Send the order total to the bKash or Nagad merchant number shown on your order, then wait for verification. Your transaction ID is recorded with the payment.',
    },
    {
      icon: Landmark,
      name: 'Bank Transfer',
      category: 'Commercial Banking',
      desc: 'Transfer the order total to the bank account details shown on your order. Payment is confirmed through the bank webhook or a Zylod admin review before the supplier ships.',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Payment Methods Breakdown</h1>
          <p className="text-xs text-gray-400">How paying for a Zylod order works</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24 md:pb-8 md:px-6 md:py-6 lg:max-w-4xl">
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {methods.map(m => (
            <div key={m.name} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs md:text-sm font-bold text-gray-900">{m.name}</h3>
                  <p className="text-[10px] text-gray-400 font-semibold">{m.category}</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                  <m.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100 text-xs text-violet-900 leading-relaxed">
          Zylod does not hold payments in escrow — your bank or mobile-money provider may charge its own transfer fees. Card payments and wallet top-ups are not available yet. An order stays UNPAID until your payment is verified.
        </div>

        <Button onClick={() => navigate('payment-terms')} className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold py-3 md:w-auto md:max-w-xs md:mx-auto md:flex md:px-8">
          Back to Payment Terms
        </Button>
      </div>
    </div>
  )
}

export default PaymentMethodsDetailPage
