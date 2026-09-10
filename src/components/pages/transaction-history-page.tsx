'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Search, Filter, ArrowDownLeft,
  ArrowUpRight, RefreshCw, Calendar, Download,
  Receipt, ChevronRight, Loader2, Sparkles, DollarSign
} from 'lucide-react'

export function TransactionHistoryPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [transactions, setTransactions] = useState<Array<{
    id: string
    type: string
    amount: number
    balanceAfter: number
    description: string
    createdAt: string
  }>>([])

  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadTransactions = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const url = `/api/wallet/transactions?type=${selectedType}&search=${encodeURIComponent(searchQuery)}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data?.transactions) {
          setTransactions(json.data.transactions)
        }
      }
    } catch {
      // Graceful
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [token, selectedType])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadTransactions()
  }

  const types = [
    { key: 'all', label: 'All Activity' },
    { key: 'deposit', label: 'Deposits' },
    { key: 'withdrawal', label: 'Withdrawals' },
    { key: 'payment', label: 'Payments' },
    { key: 'refund', label: 'Refunds' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Transaction Ledger</span>
        <button
          onClick={() => navigate('balance-overview')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          title="Summary"
        >
          <Receipt className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by transaction reference or keyword..."
            className="h-11 pl-10 pr-4 rounded-2xl bg-white border-slate-200 text-xs font-semibold shadow-2xs focus:border-primary"
          />
        </form>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {types.map(({ key, label }) => {
            const isSelected = selectedType === key
            return (
              <button
                key={key}
                onClick={() => setSelectedType(key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Transaction List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-bold">Loading Ledger Records...</span>
            </div>
          ) : transactions.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => navigate('transaction-detail', { id: tx.id })}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                      tx.amount >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {tx.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">{tx.description}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-xs font-black font-mono block ${
                      tx.amount >= 0 ? 'text-emerald-600' : 'text-slate-900'
                    }`}>
                      {tx.amount >= 0 ? '+' : ''}{formatPrice(Math.abs(tx.amount))}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Bal: {formatPrice(tx.balanceAfter)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <Receipt className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-600 block">No matching transactions found</span>
              <p className="text-[11px] text-slate-400">Try adjusting your search or category filter.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default TransactionHistoryPage
