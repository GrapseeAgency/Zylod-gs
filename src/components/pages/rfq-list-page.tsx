'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft,
  HelpCircle,
  FileText,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  LogIn,
} from 'lucide-react'

interface RfqRow {
  id: string
  title?: string
  subject?: string
  status: string
  quantity?: number
  targetPrice?: number | null
  createdAt: string
  quotesCount?: number
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  open: { label: 'Open', color: '#C8102E', bg: '#FFF1F2', icon: Clock },
  quoted: { label: 'Quoted', color: '#1565C0', bg: '#E3F2FD', icon: FileText },
  closed: { label: 'Closed', color: '#059669', bg: '#ECFDF5', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6', icon: XCircle },
}

export function RfqListPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()

  const [rfqs, setRfqs] = useState<RfqRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!isAuthenticated || !token) {
        setNeedsAuth(true)
        setIsLoading(false)
        return
      }
      try {
        const res = await fetch('/api/rfq?role=buyer&limit=30', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!cancelled && res.ok && (json.success || Array.isArray(json.data))) {
          setRfqs(json.data)
        } else if (!cancelled && res.status === 401) {
          setNeedsAuth(true)
        } else if (!cancelled) {
          setLoadError('Could not load your quote requests.')
        }
      } catch {
        if (!cancelled) setLoadError('Network error. Please try again.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isAuthenticated, token])

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-[calc(64px+env(safe-area-inset-bottom)+24px)]">
      {/* ─── Top Nav Bar ─── */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-[#E0E0E0] h-14 flex items-center justify-between px-4">
        <button
          onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-[#C8102E]" />
        </button>
        <span className="text-lg font-bold text-[#C8102E]">Zylod</span>
        <button
          onClick={() => navigate('help-center')}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5 text-[#6B7280]" />
        </button>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4 md:max-w-4xl md:px-6 md:py-6">
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight">My Quote Requests</h1>
            <p className="text-xs text-[#6B7280] mt-1">Track RFQs and supplier responses in one place.</p>
          </div>
          <button
            onClick={() => navigate('help-center')}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5 text-[#6B7280]" />
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-black text-[#1A1A1A] tracking-tight">My Quote Requests</h1>
          <p className="text-xs text-[#6B7280] mt-1">Track RFQs and supplier responses in one place.</p>
        </div>

        {/* ─── Sign-in Gate ─── */}
        {needsAuth && (
          <div className="bg-white rounded-2xl border border-[#E0E0E0] p-8 flex flex-col items-center gap-3 text-center shadow-sm">
            <LogIn className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm font-semibold text-[#1A1A1A]">Sign in to view your quote requests</p>
            <p className="text-xs text-[#6B7280] max-w-[260px]">
              Your RFQ history and supplier quotes are tied to your account.
            </p>
            <button
              onClick={() => navigate('login')}
              className="mt-1 px-6 py-2.5 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg"
            >
              Sign In
            </button>
          </div>
        )}

        {/* ─── Loading / Error States ─── */}
        {isLoading && !needsAuth && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280]">Loading requests...</p>
          </div>
        )}
        {!isLoading && loadError && !needsAuth && (
          <div className="flex flex-col items-center gap-3 py-14">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && !needsAuth && rfqs.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E0E0E0] p-8 flex flex-col items-center gap-3 text-center shadow-sm">
            <FileText className="w-8 h-8 text-gray-400" />
            <p className="text-sm font-semibold text-[#1A1A1A]">No quote requests yet</p>
            <p className="text-xs text-[#6B7280] max-w-[260px]">
              Open any product and tap &ldquo;Contact Supplier&rdquo; to request a custom bulk quote.
            </p>
            <button
              onClick={() => navigate('home')}
              className="mt-1 px-6 py-2.5 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg"
            >
              Browse Products
            </button>
          </div>
        )}

        {/* ─── RFQ Cards ─── */}
        <div className="space-y-3">
          {rfqs.map((rfq, idx) => {
            const meta = STATUS_META[rfq.status] || STATUS_META.open
            const StatusIcon = meta.icon
            return (
              <motion.div
                key={rfq.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                className="bg-white rounded-2xl border border-[#E0E0E0] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-[#1A1A1A] leading-snug line-clamp-2 flex-1">
                    {rfq.title || rfq.subject || 'Quote Request'}
                  </h3>
                  <span
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: meta.color, backgroundColor: meta.bg }}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {meta.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-[#6B7280] mt-2 pt-2 border-t border-gray-100">
                  <span>
                    {typeof rfq.quantity === 'number' ? `${rfq.quantity.toLocaleString()} units` : 'Custom quantity'}
                    {rfq.targetPrice ? ` · target ${rfq.targetPrice}` : ''}
                  </span>
                  <span>{new Date(rfq.createdAt).toLocaleDateString()}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default RfqListPage
