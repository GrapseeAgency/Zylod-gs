'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, ShieldAlert, AlertTriangle, CheckCircle2,
  Send, AlertCircle, FileText, Lock, Search, Store,
  Package, ChevronDown, Check, Copy, User, HelpCircle
} from 'lucide-react'

interface SupplierOption {
  id: string
  companyName: string
  isVerified?: boolean
  businessCity?: string
  ratingAvg?: number
}

interface UserOrder {
  id: string
  orderNumber: string
  totalAmount: number
  supplierName?: string
  supplierId?: string
}

export function ReportUserPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const targetId = pageParams.userId || pageParams.sellerId || ''
  const targetName = pageParams.name || pageParams.sellerName || pageParams.userName || ''

  const [formData, setFormData] = useState({
    reportedUserId: targetId,
    reason: 'scam',
    description: '',
    relatedOrderId: pageParams.orderId || '',
  })

  const [selectedEntityName, setSelectedEntityName] = useState(targetName)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [orders, setOrders] = useState<UserOrder[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const reasons = [
    { value: 'scam', label: 'Fraud / Asking for Off-Platform Cash Payment (bKash/Direct Handover)' },
    { value: 'counterfeit', label: 'Counterfeit / Fake Branded Goods / Substandard Materials' },
    { value: 'fake_listing', label: 'Misleading Specifications or Fake Warehouse Stock' },
    { value: 'harassment', label: 'Abusive, Threatening, or Unprofessional Behavior' },
    { value: 'non_delivery', label: 'Deliberate Refusal to Dispatch Confirmed Wholesale Goods' },
    { value: 'other', label: 'Other Serious Digital Commerce Policy Violation' },
  ]

  useEffect(() => {
    fetchRegisteredSuppliers()
    fetchUserOrders()
  }, [])

  async function fetchRegisteredSuppliers() {
    try {
      const res = await fetch('/api/suppliers?limit=25')
      if (res.ok) {
        const json = await res.json()
        setSuppliers(json.data?.suppliers || json.data || [])
      }
    } catch {}
  }

  async function fetchUserOrders() {
    try {
      const res = await fetch('/api/orders/my-orders?limit=10')
      if (res.ok) {
        const json = await res.json()
        setOrders(json.data || json.orders || [])
      }
    } catch {}
  }

  function handleSelectSupplier(sup: SupplierOption) {
    setFormData(prev => ({ ...prev, reportedUserId: sup.id }))
    setSelectedEntityName(sup.companyName)
    setShowSupplierDropdown(false)
    setSupplierSearch('')
  }

  function copyId() {
    if (!formData.reportedUserId) return
    navigator.clipboard.writeText(formData.reportedUserId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.reportedUserId) {
      setErrorMsg('Please select or enter the Supplier / User ID to report.')
      return
    }
    setErrorMsg('')
    setLoading(true)

    try {
      const res = await fetch('/api/support/report-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (res.ok) {
        setSubmitted(true)
      } else {
        setErrorMsg(json.error || 'Failed to submit report')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
    }
    setLoading(false)
  }

  const filteredSuppliers = suppliers.filter(s =>
    s.companyName.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.id.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-sm sm:text-base md:text-xl">Report Policy Violation</h1>
            <p className="text-[11px] text-gray-400">Trust & Safety Moderation Intake</p>
          </div>
        </div>
        <button
          onClick={() => navigate('community-guidelines')}
          className="text-xs font-semibold text-red-600 hover:underline"
        >
          View Guidelines
        </button>
      </div>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full pb-24 space-y-6 md:px-6 md:py-8 md:pb-10">
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
          {submitted ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8 space-y-4"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Report Under Review</h2>
              <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                Your report has been routed to the **Zylod Trust & Safety Moderation Council**. If fraudulent activity or counterfeit merchandise is confirmed, the entity will face immediate account restriction, escrow freeze, and DNCRP referral.
              </p>
              <div className="p-3 bg-slate-50 rounded-2xl border border-gray-100 text-xs text-gray-500 max-w-sm mx-auto">
                Tracking Case Reference: <span className="font-mono font-bold text-gray-900">CASE-{Date.now().toString().slice(-6)}</span>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={goBack}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition"
                >
                  Return to Marketplace
                </button>
                <button
                  onClick={() => navigate('help-center')}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Help Center
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  Report User, Supplier, or Storefront
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select the registered supplier, manufacturer, or user ID violating wholesale regulations.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Target Entity Picker */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                  <span>Reported Supplier / User Entity *</span>
                  {formData.reportedUserId && (
                    <button
                      type="button"
                      onClick={copyId}
                      className="text-[11px] text-gray-400 hover:text-red-600 font-mono flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      ID: {formData.reportedUserId.slice(0, 14)}...
                    </button>
                  )}
                </label>

                {/* Search & Select Input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search supplier company name or enter User/Supplier ID..."
                    value={supplierSearch || selectedEntityName || formData.reportedUserId}
                    onChange={e => {
                      setSupplierSearch(e.target.value)
                      setFormData(prev => ({ ...prev, reportedUserId: e.target.value }))
                      setSelectedEntityName('')
                      setShowSupplierDropdown(true)
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-xs focus:outline-none focus:border-red-500 font-medium"
                  />
                  <Store className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 cursor-pointer" onClick={() => setShowSupplierDropdown(!showSupplierDropdown)} />
                </div>

                {/* Autocomplete Dropdown */}
                <AnimatePresence>
                  {showSupplierDropdown && filteredSuppliers.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto divide-y divide-gray-100"
                    >
                      {filteredSuppliers.map(sup => (
                        <button
                          key={sup.id}
                          type="button"
                          onClick={() => handleSelectSupplier(sup)}
                          className="w-full p-3 text-left hover:bg-red-50 flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <p className="font-bold text-gray-900">{sup.companyName}</p>
                            <p className="text-[10px] text-gray-400 font-mono">ID: {sup.id}</p>
                          </div>
                          {sup.businessCity && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {sup.businessCity}
                            </span>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Violation Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Specific Violation Type *</label>
                <select
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:outline-none focus:border-red-500 font-medium"
                >
                  {reasons.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Related Order Selector */}
              {orders.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Attach Related Wholesale Order (Optional)</label>
                  <select
                    value={formData.relatedOrderId}
                    onChange={e => setFormData({ ...formData, relatedOrderId: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:outline-none focus:border-red-500"
                  >
                    <option value="">No specific order attached</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        Order #{o.orderNumber || o.id.slice(-8)} — ৳{o.totalAmount.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description & Evidence */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Evidence & Detailed Report *</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Provide precise details: Did they ask for direct bKash off-platform? Did they send counterfeit replica goods? Include chat excerpts, product serials, or consignment slips..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-2xl p-3.5 text-xs focus:outline-none focus:border-red-500 leading-relaxed"
                />
              </div>

              {/* Confidentiality Notice */}
              <div className="bg-slate-50 border border-gray-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  <strong>Reporter Anonymity Protected:</strong> The reported supplier will never see your identity. All claims are independently evaluated by Zylod Trust & Safety Compliance.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit to Trust & Safety Council
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportUserPage
