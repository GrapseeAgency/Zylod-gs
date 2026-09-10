'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, ShieldAlert, AlertTriangle, CheckCircle2,
  XCircle, Filter, Eye, Ban, ShieldCheck, Clock,
  FileText, ExternalLink, MessageSquare, AlertOctagon, User
} from 'lucide-react'

interface ModerationReport {
  id: string
  reporterId: string
  reportedUserId: string
  reason: string
  description: string
  relatedOrderId?: string
  status: 'pending' | 'under_review' | 'action_taken' | 'dismissed'
  adminNotes?: string
  createdAt: string
  reporter: { id: string; name: string; email?: string; phone?: string }
  reportedEntity: { id: string; name: string; type: string; status: string; rating?: number }
}

export function AdminReportsPage() {
  const { navigate, goBack } = useNavigationStore()
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [metrics, setMetrics] = useState({ total: 0, pending: 0, actionTaken: 0, dismissed: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [reasonFilter, setReasonFilter] = useState('all')

  // Selected report for action modal
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null)
  const [actionType, setActionType] = useState('warn_user')
  const [adminNotes, setAdminNotes] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionSuccess, setActionSuccess] = useState('')

  useEffect(() => {
    fetchReports()
  }, [statusFilter, reasonFilter])

  async function fetchReports() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reports?status=${statusFilter}&reason=${reasonFilter}`)
      if (res.ok) {
        const json = await res.json()
        setReports(json.data || [])
        if (json.metrics) setMetrics(json.metrics)
      }
    } catch {}
    setLoading(false)
  }

  async function handleExecuteAction(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedReport) return

    setSubmittingAction(true)
    try {
      const res = await fetch(`/api/admin/reports/${selectedReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: actionType === 'dismiss' ? 'dismissed' : 'action_taken',
          actionType,
          adminNotes,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setActionSuccess(json.message || 'Action executed successfully')
        setTimeout(() => {
          setSelectedReport(null)
          setActionSuccess('')
          setAdminNotes('')
          fetchReports()
        }, 1200)
      }
    } catch {}
    setSubmittingAction(false)
  }

  const reasonColors: Record<string, string> = {
    scam: 'bg-red-50 text-red-700 border-red-200',
    counterfeit: 'bg-orange-50 text-orange-700 border-orange-200',
    fake_listing: 'bg-amber-50 text-amber-700 border-amber-200',
    harassment: 'bg-purple-50 text-purple-700 border-purple-200',
    non_delivery: 'bg-rose-50 text-rose-700 border-rose-200',
    other: 'bg-gray-100 text-gray-700 border-gray-200',
  }

  const statusBadges: Record<string, { label: string; class: string }> = {
    pending: { label: 'Pending Review', class: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
    under_review: { label: 'Under Investigation', class: 'bg-blue-50 text-blue-800 border-blue-200' },
    action_taken: { label: 'Action Taken', class: 'bg-green-50 text-green-800 border-green-200' },
    dismissed: { label: 'Dismissed', class: 'bg-gray-100 text-gray-600 border-gray-200' },
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              Trust & Safety Moderation Center
            </h1>
            <p className="text-[11px] text-gray-400">User, Seller & Counterfeit Violation Reports</p>
          </div>
        </div>

        <button
          onClick={() => navigate('admin-dashboard')}
          className="text-xs font-semibold text-gray-600 hover:text-red-600 px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
        >
          Admin Dashboard
        </button>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-6xl mx-auto w-full pb-24">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Reports</p>
            <p className="text-xl font-black text-gray-900">{metrics.total}</p>
          </div>
          <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 shadow-sm space-y-1">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Pending Action</p>
            <p className="text-xl font-black text-amber-900">{metrics.pending}</p>
          </div>
          <div className="bg-green-50/50 p-4 rounded-2xl border border-green-200 shadow-sm space-y-1">
            <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wider">Penalized / Actioned</p>
            <p className="text-xl font-black text-green-900">{metrics.actionTaken}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dismissed</p>
            <p className="text-xl font-black text-gray-700">{metrics.dismissed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-700">Filter Reports:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-red-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="action_taken">Action Taken</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <select
              value={reasonFilter}
              onChange={e => setReasonFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-red-500"
            >
              <option value="all">All Violation Types</option>
              <option value="scam">Off-Platform Payment / Scam</option>
              <option value="counterfeit">Counterfeit Goods</option>
              <option value="fake_listing">Misleading Specs</option>
              <option value="harassment">Harassment</option>
              <option value="non_delivery">Non-Delivery</option>
            </select>
          </div>
        </div>

        {/* Reports Table / Card List */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <ShieldCheck className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-sm font-bold text-gray-800">No moderation reports in queue</p>
              <p className="text-xs text-gray-400">All submitted buyer and seller complaints have been reviewed.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {reports.map(rep => {
                const statusMeta = statusBadges[rep.status] || statusBadges.pending
                return (
                  <div
                    key={rep.id}
                    className="p-5 hover:bg-slate-50/70 transition space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${reasonColors[rep.reason] || 'bg-gray-100'}`}>
                          {rep.reason.replace('_', ' ')}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.class}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {new Date(rep.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-gray-100 text-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400">Reported Entity</p>
                        <p className="font-bold text-gray-900 mt-0.5">{rep.reportedEntity.name}</p>
                        <p className="text-[11px] text-gray-500 font-mono">ID: {rep.reportedUserId}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400">Filed By</p>
                        <p className="font-bold text-gray-900 mt-0.5">{rep.reporter.name}</p>
                        <p className="text-[11px] text-gray-500 font-mono">ID: {rep.reporterId}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400">Attached Order</p>
                        <p className="font-semibold text-gray-800 mt-0.5">
                          {rep.relatedOrderId ? `Order #${rep.relatedOrderId.slice(-8)}` : 'None specified'}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-gray-700 leading-relaxed bg-white p-3 rounded-xl border border-gray-100">
                      <p className="font-semibold text-gray-900 mb-1">Violation Details:</p>
                      <p className="whitespace-pre-line">{rep.description}</p>
                    </div>

                    {rep.adminNotes && (
                      <div className="text-[11px] text-green-800 bg-green-50 p-2.5 rounded-xl border border-green-200">
                        <strong>Resolution Note:</strong> {rep.adminNotes}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setSelectedReport(rep)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" />
                        Take Moderation Action
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Action Execution Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h2 className="text-sm font-bold text-gray-900">Execute Moderation Penalty</h2>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            {actionSuccess ? (
              <div className="text-center py-6 space-y-2 text-green-600">
                <CheckCircle2 className="w-12 h-12 mx-auto" />
                <p className="text-sm font-bold">{actionSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleExecuteAction} className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-gray-100 text-xs space-y-1">
                  <p><strong>Target:</strong> {selectedReport.reportedEntity.name} ({selectedReport.reportedUserId})</p>
                  <p><strong>Allegation:</strong> {selectedReport.reason.replace('_', ' ')}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Select Enforcement Action *</label>
                  <select
                    value={actionType}
                    onChange={e => setActionType(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs bg-white focus:outline-none focus:border-red-500 font-medium"
                  >
                    <option value="warn_user">⚠️ Issue Official Compliance Warning</option>
                    <option value="suspend_store">🚫 Suspend Storefront & Delist Products</option>
                    <option value="freeze_escrow">🔒 Freeze Escrow Payouts & Lock Orders</option>
                    <option value="ban_account">⛔ Permanent Account Termination</option>
                    <option value="dismiss">Dismiss Claim (Unsubstantiated / False Report)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Official Moderation Notes *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter reason for penalty or dismissal decision to log in audit trail..."
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500 leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingAction}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow transition disabled:opacity-40"
                >
                  {submittingAction ? 'Enforcing Action...' : 'Confirm & Apply Moderation Penalty'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default AdminReportsPage
