'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Send, AlertTriangle, Package, Paperclip,
  CheckCircle2, AlertCircle, ShieldAlert
} from 'lucide-react'

interface UserOrder {
  id: string
  orderNumber: string
  totalAmount: number
  currency: string
  status: string
  createdAt: string
}

export function SubmitTicketPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const initialOrderId = pageParams.orderId || ''
  const [orders, setOrders] = useState<UserOrder[]>([])
  const [formData, setFormData] = useState({
    category: 'order_issue',
    priority: 'medium',
    subject: '',
    description: '',
    relatedOrderId: initialOrderId,
  })
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const categories = [
    { value: 'order_issue', label: 'Order & Consignment Issue' },
    { value: 'payment_issue', label: 'Escrow & SafePay Payment' },
    { value: 'account_issue', label: 'Account, 2FA & Login' },
    { value: 'product_issue', label: 'Product Quality & Counterfeit' },
    { value: 'seller_issue', label: 'Supplier Dispute & Breach' },
    { value: 'general', label: 'General Commercial Support' },
  ]

  const priorities = [
    { value: 'low', label: 'Low', color: 'text-gray-600 bg-gray-100' },
    { value: 'medium', label: 'Medium', color: 'text-blue-600 bg-blue-50' },
    { value: 'high', label: 'High', color: 'text-orange-600 bg-orange-50' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600 bg-red-50' },
  ]

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    try {
      const res = await fetch('/api/orders/my-orders?limit=10')
      if (res.ok) {
        const json = await res.json()
        setOrders(json.data || json.orders || [])
      }
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        navigate('ticket-detail', { id: json.data.id })
      } else {
        setErrorMsg(json.error || 'Failed to submit ticket')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Open Support Ticket</span>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Open Support Ticket</h1>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full pb-24">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Ticket Information</h2>
            <p className="text-xs text-gray-400 mt-0.5">Submit an official claim or inquiry to the Zylod Support & Dispute Resolution team.</p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Category *</label>
            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:outline-none focus:border-red-500"
            >
              {categories.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Priority Pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Priority Level *</label>
            <div className="grid grid-cols-4 gap-2">
              {priorities.map(p => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setFormData({ ...formData, priority: p.value })}
                  className={`py-2 text-xs font-semibold rounded-xl border transition ${
                    formData.priority === p.value
                      ? 'border-red-600 bg-red-50 text-red-600 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Related Order Selector */}
          {orders.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Related Order (Optional)</label>
              <select
                value={formData.relatedOrderId}
                onChange={e => setFormData({ ...formData, relatedOrderId: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:outline-none focus:border-red-500"
              >
                <option value="">No specific order attached</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    Order #{o.orderNumber || o.id.slice(-8)} — ৳{o.totalAmount.toLocaleString()} ({o.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Ticket Subject *</label>
            <input
              type="text"
              required
              placeholder="e.g. Broken angle grinder shipment in batch #8491"
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Detailed Description *</label>
            <textarea
              required
              rows={5}
              placeholder="Provide complete breakdown of the issue, item count, serial numbers, or supplier breach..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500 leading-relaxed"
            />
            <p className="text-[11px] text-gray-400">Minimum 20 characters.</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" /> Open Official Ticket
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SubmitTicketPage
