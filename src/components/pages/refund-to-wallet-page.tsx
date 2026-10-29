'use client'

/**
 * RefundToWalletPage (Task 140 honesty pass) — was a SELF-SERVICE money
 * printer: a form that POSTed any orderId + any amount to /api/wallet/refund
 * and the route credited the caller's own wallet instantly, no verification.
 * That channel is retired — refunds are never self-claimed.
 *
 * The page is now the buyer's honest refund ledger: the refunds the platform
 * actually processed for this buyer (admin rail POST /api/admin/returns/[id]/refund
 * after an approved return), each documented with its real-world transaction
 * reference (UTR / TxnID), method, and status. Empty state explains exactly
 * where refunds come from and points at the buyer's return requests.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Wallet, RefreshCw, Landmark, Smartphone, Banknote, ShieldCheck, FileText } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface RefundRow {
  id: string
  orderId: string
  returnRequestId: string
  amount: number
  method: string
  reference: string
  status: string
  note: string | null
  createdAt: string
}

const METHOD_ICONS: Record<string, typeof Landmark> = {
  bank_transfer: Landmark,
  mobile_banking: Smartphone,
  cash: Banknote,
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  mobile_banking: 'Mobile banking',
  cash: 'Cash',
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function RefundToWalletPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()
  const [rows, setRows] = useState<RefundRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/wallet/refund', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401) {
        setErrorMsg('Please sign in to see your refund records.')
        setRows(null)
      } else if (!res.ok || !json?.success) {
        setErrorMsg(json?.error || `Could not load refunds (HTTP ${res.status})`)
        setRows(null)
      } else {
        setRows(json.data ?? [])
      }
    } catch {
      setErrorMsg('Network error — could not reach the refund service.')
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 dark:text-neutral-200 hover:text-slate-900 dark:text-neutral-100 dark:hover:text-white" title="Back" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Refunds</span>
        <button
          onClick={() => navigate('my-wallet')}
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-card dark:bg-card flex items-center justify-center text-slate-700 dark:text-neutral-300 dark:text-neutral-200 hover:bg-slate-200"
          title="Wallet"
          aria-label="Wallet"
        >
          <Wallet className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-neutral-100">Refunds</h1>
          <button
            onClick={() => navigate('my-wallet')}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-card dark:bg-card flex items-center justify-center text-slate-700 dark:text-neutral-300 dark:text-neutral-200 hover:bg-slate-200"
            title="Wallet"
            aria-label="Wallet"
          >
            <Wallet className="h-4 w-4" />
          </button>
        </div>

        {/* Doctrine banner — what a refund actually is here */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-neutral-900 dark:to-rose-950 rounded-3xl p-5 text-gray-900 dark:text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black/5 dark:bg-gray-900/10 border border-black/10 dark:border-white/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-black">How refunds reach you</h2>
              <p className="text-xs text-slate-600 dark:text-neutral-300">
                When a return is approved, the platform processes your refund through the channel you arranged — bank transfer, mobile banking, or cash. Every completed refund is documented below with its real transaction reference. Refunds are never self-claimed; that is what keeps your money safe.
              </p>
            </div>
          </div>
        </div>

        {/* Ledger */}
        <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
              Processed refunds
            </h2>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="h-7 text-xs gap-1.5">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1].map((i) => <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-card dark:bg-card animate-pulse" />)}
            </div>
          ) : errorMsg ? (
            <div className="text-center py-8 space-y-3" role="alert">
              <p className="text-sm text-destructive font-bold">{errorMsg}</p>
              {errorMsg.includes('sign in') && (
                <Button size="sm" onClick={() => navigate('login')} className="text-xs font-bold">Sign In</Button>
              )}
            </div>
          ) : !rows || rows.length === 0 ? (
            <div className="text-center py-8 space-y-3" data-testid="refunds-empty">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-card dark:bg-card flex items-center justify-center mx-auto">
                <FileText className="h-6 w-6 text-slate-400 dark:text-neutral-500 dark:text-neutral-400" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-neutral-100">No refunds processed yet</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-xs mx-auto">
                If something went wrong with an order, request a return from your order history. Once the platform approves and processes it, the refund — with its transaction reference — appears here.
              </p>
              <Button size="sm" variant="outline" onClick={() => navigate('purchase-history')} className="text-xs font-bold">
                View my orders
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((r) => {
                const Icon = METHOD_ICONS[r.method] ?? Landmark
                return (
                  <div key={r.id} className="rounded-2xl border border-slate-200 dark:border-neutral-800 p-3.5 space-y-2 bg-slate-50 dark:bg-background/60 dark:bg-card/40" data-testid="refund-row">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-neutral-100">{formatPrice(r.amount)}</p>
                          <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500">{METHOD_LABELS[r.method] ?? r.method}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md shrink-0">
                        {r.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 rounded-xl px-3 py-2 border border-slate-100 dark:border-neutral-800">
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 font-mono truncate">
                        Ref: {r.reference}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 shrink-0">{fmt(r.createdAt)}</span>
                    </div>
                    {r.note && <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 italic">{r.note}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Where refunds come from */}
        <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-2.5">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">The refund path</h2>
          <ol className="space-y-2 text-xs text-slate-600 dark:text-neutral-400 dark:text-neutral-500 list-decimal list-inside">
            <li>Request a return from the order in your purchase history.</li>
            <li>The platform reviews and approves (or rejects) the request.</li>
            <li>Once approved, the refund is processed through your arranged channel — bank transfer, mobile banking, or cash.</li>
            <li>The completed transfer is documented here with its real UTR / TxnID reference.</li>
          </ol>
        </section>
      </main>
    </div>
  )
}
