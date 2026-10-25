'use client'

import { useEffect, useState } from 'react'
import { Smartphone, Building2, Info, CreditCard, Wallet, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

// HONESTY HISTORY: this page previously showed fabricated saved methods
// (a "Corporate Visa ending in 4242 — Acme Corp", invented bKash/Nagad
// numbers, an L/C with named banks, a fake Net-30 credit limit) and was
// stripped to a static "nothing is stored" note. Audit unit 22 corrected
// the over-correction: the platform GENUINELY stores tokenized payment
// methods (last-4 cards, MFS wallets with BD-format validation, bank
// accounts — all financial-audited), so this page now LISTS the buyer's
// real rows from GET /api/payment-methods + GET /api/bank-accounts, links
// to the real add-page, and keeps an honest empty state for accounts that
// genuinely have none. The escrow line stays because it is still true.

interface MethodRow {
  id: string
  type: string
  label: string
  accountNumber: string
  isDefault: boolean
}

function maskAccount(num: string): string {
  if (num.length <= 4) return `••${num}`
  return `${num.slice(0, 2)}••••${num.slice(-4)}`
}

function typeIcon(type: string) {
  const t = type.toLowerCase()
  if (['bkash', 'nagad', 'rocket', 'upay'].includes(t)) return Smartphone
  if (t === 'bank') return Building2
  return CreditCard
}

export function PaymentMethodPage() {
  const { navigate, goBack } = useNavigationStore()
  const [methods, setMethods] = useState<MethodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [pm, bank] = await Promise.all([
        fetch('/api/payment-methods', { credentials: 'include' }),
        fetch('/api/bank-accounts', { credentials: 'include' }),
      ])
      if (pm.status === 401 || bank.status === 401) {
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      const pmJson = await pm.json().catch(() => null)
      const bankJson = await bank.json().catch(() => null)
      const rows: MethodRow[] = []
      if (pm.ok && pmJson?.success) {
        const arr = pmJson.data ?? pmJson.methods ?? []
        if (Array.isArray(arr)) {
          for (const m of arr) {
            rows.push({ id: m.id, type: m.type, label: m.label, accountNumber: m.accountNumber, isDefault: Boolean(m.isDefault) })
          }
        }
      }
      // bank rows are a separate projection of the same table — de-dup by id
      if (bank.ok && bankJson?.success && Array.isArray(bankJson.data)) {
        for (const b of bankJson.data) {
          if (!rows.some((r) => r.id === b.id)) {
            rows.push({ id: b.id, type: 'bank', label: b.bankName, accountNumber: b.accountNumber, isDefault: Boolean(b.isDefault) })
          }
        }
      }
      setMethods(rows)
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

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
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100 active:scale-95 transition-transform" aria-label="Go back">
            ←
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">My Payment Methods</h1>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-6 lg:max-w-4xl">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">My Payment Methods</h1>

        {/* The buyer's REAL saved instruments */}
        <div className="space-y-2">
          {loading ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center">
              <PageLoader className="min-h-0" />
            </div>
          ) : needsAuth ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Sign in to see your saved methods</p>
              <Button onClick={() => navigate('login')} className="w-full max-w-xs bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl">
                Sign in
              </Button>
            </div>
          ) : error ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{error}</p>
              <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Retry</Button>
            </div>
          ) : methods.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <Wallet className="h-7 w-7 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No saved payment instruments yet</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
                Link a wallet, tokenize a card (last 4 only), or add a bank account — every entry is a real
                database row with a financial-audit trail. Payments themselves are made per order below.
              </p>
            </div>
          ) : (
            methods.map((m) => {
              const Icon = typeIcon(m.type)
              return (
                <div key={m.id} className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-card flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{m.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 font-mono">{maskAccount(m.accountNumber)}</p>
                  </div>
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-card px-2 py-0.5 rounded-full">
                    {m.type}
                  </span>
                </div>
              )
            })
          )}
          {!loading && !needsAuth && (
            <Button
              onClick={() => navigate('add-payment-method')}
              variant="outline"
              className="w-full bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-background dark:hover:bg-card text-primary border-slate-300 font-bold h-11 rounded-2xl text-xs"
            >
              <Plus className="h-4 w-4 mr-2" /> Add a payment method
            </Button>
          )}
        </div>

        {/* Real payment routes */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {routes.map((opt) => (
            <div
              key={opt.title}
              className="w-full text-left bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-card flex items-center justify-center shrink-0 mt-0.5">
                  <opt.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100">{opt.title}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">{opt.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Security badge */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500">
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
import { PageLoader } from '@/components/ui/page-loader'
