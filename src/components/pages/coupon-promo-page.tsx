'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Menu, Search, Tag, Copy, Check, Ticket,
  AlertCircle, RefreshCw, LogIn
} from 'lucide-react'

/**
 * REAL coupons & promo page (audit unit 19 fake-data purge). The old version
 * hard-coded three promo tiles (TIER310 / FREESHIPB2B / NEWVENDOR5 — none
 * existed in the database, so "Use Code" promised discounts that checkout
 * would refuse) and its Apply box answered ANY input with a fabricated
 * "applied successfully to your active order". Now every tile is a REAL
 * coupons row from GET /api/coupons (personal vouchers served only to their
 * owner — Task 143), collection goes through POST /api/coupons/claim with
 * the server's honest 201/409/403/404 verdicts, and the code box CLAIMS the
 * entered code to the vault instead of pretending an order was discounted.
 * Codes are applied at CHECKOUT from the vault — that flow lives in the
 * cart/checkout rails.
 */

interface CouponRow {
  id: string
  code: string
  discountType: string
  discountPercent: number
  maxDiscount: number | null
  minOrderAmount: number | null
  usageLimit: number | null
  usedCount: number
  userId: string | null
  validUntil: string
}

function discountBadge(c: CouponRow): string {
  if (c.discountType === 'percentage') return `${Number(c.discountPercent)}% OFF`
  return `৳${Number(c.discountPercent).toLocaleString()} OFF`
}

export function CouponPromoPage() {
  const { navigate } = useNavigationStore()
  const [promoInput, setPromoInput] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimingCode, setClaimingCode] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/coupons?limit=30', { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setCoupons(json.data)
        setTotal(typeof json.pagination?.total === 'number' ? json.pagination.total : json.data.length)
      } else {
        setLoadError(json?.error || `Could not load the offers (HTTP ${res.status}).`)
      }
    } catch {
      setLoadError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Honest claim — the server's verdict is the message, never a fake success. */
  const claimByCouponId = async (coupon: CouponRow) => {
    if (claimingId) return
    setClaimingId(coupon.id)
    try {
      const res = await fetch('/api/coupons/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ couponId: coupon.id }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201) {
        toast.success(`Collected — ${discountBadge(coupon)} is in your voucher vault`)
      } else if (res.status === 401) {
        toast.error('Sign in to collect vouchers', {
          description: 'Your vault is tied to your account.',
        })
        navigate('login')
        return
      } else {
        toast.message(res.status === 409 ? 'Already yours or fully claimed' : 'Cannot collect', {
          description: json?.error || `The server refused (HTTP ${res.status}).`,
        })
      }
    } catch {
      toast.error('Network error — the voucher was NOT collected. Please retry.')
    } finally {
      setClaimingId(null)
    }
  }

  const claimByTypedCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = promoInput.trim().toUpperCase()
    if (!code || claimingCode) return
    setClaimingCode(true)
    try {
      const res = await fetch('/api/coupons/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201) {
        toast.success(`Collected "${code}" — it is in your voucher vault`)
        setPromoInput('')
        load() // the list may now include this code if it was personal to me
      } else if (res.status === 401) {
        toast.error('Sign in to collect vouchers', { description: 'Your vault is tied to your account.' })
        navigate('login')
        return
      } else {
        toast.message('Not collected', {
          description: json?.error || `The server refused (HTTP ${res.status}).`,
        })
      }
    } catch {
      toast.error('Network error — the voucher was NOT collected. Please retry.')
    } finally {
      setClaimingCode(false)
    }
  }

  const handleCopyCode = (code: string) => {
    setPromoInput(code)
    setCopiedCode(code)
    navigator.clipboard?.writeText(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("home")} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Menu" aria-label="Menu">
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button onClick={() => navigate("search-home")} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Search" aria-label="Search">
            <Search className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6 max-w-lg mx-auto lg:max-w-4xl">
        {/* Title */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Coupons &amp; Promo Codes
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
            Collect vouchers to your vault — codes are applied at checkout.
          </p>
        </div>

        {/* Code box — the honest action is a real CLAIM to the vault */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <label htmlFor="promo-code-input" className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
            Have a code? Collect it to your vault
          </label>

          <form onSubmit={claimByTypedCode} className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
              <Input
                id="promo-code-input"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="E.G. BULK2024"
                className="h-11 pl-10 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-slate-800 text-xs font-bold tracking-wider uppercase text-slate-800 dark:text-slate-200"
              />
            </div>

            <Button
              type="submit"
              disabled={claimingCode}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-2xl text-xs shadow-sm disabled:opacity-60"
            >
              {claimingCode ? 'Checking…' : 'Collect'}
            </Button>
          </form>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
            The server checks the code against the live database — expired, exhausted,
            foreign, or unknown codes are refused with the real reason. Application to an
            order happens at checkout from your vault.
          </p>
        </div>

        {/* Available Offers Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Available B2B Offers</h2>
            {!loading && !loadError && (
              <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 font-medium">{total} active</span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 animate-pulse space-y-2">
                  <div className="h-3 bg-slate-100 dark:bg-card rounded w-20" />
                  <div className="h-4 bg-slate-100 dark:bg-card rounded w-28" />
                  <div className="h-3 bg-slate-100 dark:bg-card rounded w-full" />
                  <div className="h-7 bg-slate-100 dark:bg-card rounded w-full" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center">
              <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{loadError}</p>
              <Button variant="outline" size="sm" onClick={load} className="mt-3">
                <RefreshCw className="h-4 w-4 mr-1" /> Retry
              </Button>
            </div>
          ) : coupons.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center">
              <Ticket className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No active coupons right now</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
                New offers appear here the moment the platform publishes them — nothing is faked.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {coupons.map((coupon) => {
                const remaining = coupon.usageLimit !== null ? Math.max(0, coupon.usageLimit - coupon.usedCount) : null
                const exhausted = remaining !== null && remaining <= 0
                return (
                  <div
                    key={coupon.id}
                    className={`bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden ${coupon.userId ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-primary'}`}
                  >
                    {/* Header tags */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-slate-100 dark:bg-card text-slate-600 dark:text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                        {coupon.userId ? 'Personal voucher' : 'Platform offer'}
                      </span>
                      <span className="text-xs font-black text-primary whitespace-nowrap">
                        {discountBadge(coupon)}
                      </span>
                    </div>

                    {/* Real terms — every number from the DB row */}
                    <div className="mt-2 space-y-1">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug font-mono tracking-wider">
                        {coupon.code}
                      </h3>
                      <ul className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed space-y-0.5">
                        {coupon.minOrderAmount ? (
                          <li>Minimum order ৳{Number(coupon.minOrderAmount).toLocaleString()}</li>
                        ) : (
                          <li>No minimum order</li>
                        )}
                        <li>Valid until {new Date(coupon.validUntil).toLocaleDateString('en-GB')}</li>
                        {coupon.usageLimit !== null && (
                          <li>{exhausted ? 'Fully claimed' : `${remaining} of ${coupon.usageLimit} left`}</li>
                        )}
                        {coupon.discountType === 'percentage' && coupon.maxDiscount ? (
                          <li>Capped at ৳{Number(coupon.maxDiscount).toLocaleString()}</li>
                        ) : null}
                      </ul>
                    </div>

                    {/* Real actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleCopyCode(coupon.code)}
                        className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        {copiedCode === coupon.code ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <span>Copy</span>
                            <Copy className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>

                      {exhausted ? (
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 px-3 py-1.5">Fully claimed</span>
                      ) : (
                        <Button
                          onClick={() => claimByCouponId(coupon)}
                          disabled={claimingId === coupon.id}
                          className="bg-primary hover:bg-primary/90 text-white font-bold h-8 px-4 rounded-xl text-[11px] shadow-sm disabled:opacity-60"
                        >
                          {claimingId === coupon.id ? 'Collecting…' : (
                            <span className="flex items-center gap-1">
                              <LogIn className="h-3 w-3" /> Collect
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default CouponPromoPage
