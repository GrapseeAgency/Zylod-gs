'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Bell, BellOff, Search, TrendingDown, Plus, Trash2 } from 'lucide-react'
import { useCurrencyStore } from '@/store/currency-store'

interface PriceAlert {
  id: string
  query: string
  targetPrice: number
  currentBestPrice: number
  currency: string
  isActive: boolean
  createdAt: string
  matchCount: number
}

export function SearchPriceAlertPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newQuery, setNewQuery] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAlerts() }, [])

  async function fetchAlerts() {
    setLoading(true)
    try {
      const res = await fetch('/api/search/price-alerts')
      if (res.ok) {
        const json = await res.json()
        setAlerts(json.data || [])
      }
    } catch {}
    setLoading(false)
  }

  async function saveAlert() {
    if (!newQuery.trim() || !newPrice) return
    setSaving(true)
    try {
      const res = await fetch('/api/search/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: newQuery.trim(), targetPrice: Number(newPrice) }),
      })
      if (res.ok) {
        setNewQuery(''); setNewPrice(''); setShowAdd(false)
        fetchAlerts()
      }
    } catch {}
    setSaving(false)
  }

  async function deleteAlert(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
    await fetch(`/api/search/price-alerts/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function toggleAlert(id: string, isActive: boolean) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isActive: !isActive } : a))
    await fetch(`/api/search/price-alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    }).catch(() => {})
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <span className="font-semibold text-gray-900 flex-1">Price Alerts</span>
          <button onClick={() => setShowAdd(s => !s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-xl hover:bg-red-700 transition">
            <Plus className="w-3.5 h-3.5" />New Alert
          </button>
        </div>
      </div>

      {/* Add new alert */}
      {showAdd && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-b border-gray-100 bg-red-50 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-red-700">New Price Alert</p>
          <input type="text" placeholder="Search term (e.g. angle grinder)" value={newQuery} onChange={e => setNewQuery(e.target.value)}
            className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-red-400" />
          <div className="flex gap-2">
            <input type="number" placeholder="Target price (BDT)" value={newPrice} onChange={e => setNewPrice(e.target.value)}
              className="flex-1 border border-red-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-red-400" />
            <button onClick={saveAlert} disabled={saving || !newQuery || !newPrice}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl font-medium disabled:opacity-50">
              {saving ? '...' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-red-500">We&apos;ll notify you when products matching this search drop below your target price</p>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10 md:px-6">
        {loading ? (
          <div className="px-4 pt-4 space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
            <TrendingDown className="w-12 h-12 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No price alerts set</p>
            <p className="text-xs text-gray-400">Set alerts to get notified when wholesale prices drop</p>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-3">
            {alerts.map((alert, idx) => (
              <motion.div key={alert.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                className={`rounded-xl border p-3 ${alert.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-start gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${alert.isActive ? 'bg-red-100' : 'bg-gray-100'}`}>
                    <Bell className={`w-4 h-4 ${alert.isActive ? 'text-red-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">"{alert.query}"</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">Target: <strong className="text-red-600">{formatPrice(alert.targetPrice)}</strong></span>
                      <span className="text-xs text-gray-400">Best now: {formatPrice(alert.currentBestPrice)}</span>
                    </div>
                    {alert.currentBestPrice <= alert.targetPrice && (
                      <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">🎉 Price target reached!</span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => toggleAlert(alert.id, alert.isActive)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                      {alert.isActive ? <Bell className="w-4 h-4 text-red-500" /> : <BellOff className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={() => deleteAlert(alert.id)} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button onClick={() => navigate('search-results', { query: alert.query })}
                  className="mt-2.5 w-full py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5 transition">
                  <Search className="w-3 h-3" />Search Now ({alert.matchCount} products)
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchPriceAlertPage
