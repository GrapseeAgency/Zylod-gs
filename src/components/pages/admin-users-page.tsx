'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Users, Search, RefreshCw, AlertTriangle, XCircle, CheckCircle2,
  Ban, PauseCircle, PlayCircle, ShieldCheck, ChevronDown, ChevronUp
} from 'lucide-react'

// ── Real API types (GET /api/admin/users) ──────────────────────────────
interface AdminUser {
  id: string
  userType: string
  email: string | null
  phone: string | null
  accountStatus: string
  createdAt: string
  isEmailVerified: boolean
  isPhoneVerified: boolean
  fullName: string | null
  businessName: string | null
  companyName: string | null
  verificationStatus: string | null
  ratingAvg: number
  orderCount: number
  reviewCount: number
  quoteRequestCount: number
}

type Action = 'suspend' | 'activate' | 'ban'

export function AdminUsersPage() {
  const { navigate } = useNavigationStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [role, setRole] = useState<'' | 'buyer' | 'supplier' | 'admin'>('')
  const [status, setStatus] = useState<'' | 'active' | 'suspended' | 'banned'>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [action, setAction] = useState<Action>('suspend')
  const [reason, setReason] = useState('')
  const [rowError, setRowError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadUsers = useCallback(async (opts?: { role?: string; status?: string; search?: string; page?: number }) => {
    const useRole = opts?.role ?? role
    const useStatus = opts?.status ?? status
    const useSearch = opts?.search ?? search
    const usePage = opts?.page ?? page
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    try {
      const params = new URLSearchParams({ page: String(usePage), limit: '20' })
      if (useRole) params.set('role', useRole)
      if (useStatus) params.set('status', useStatus)
      if (useSearch) params.set('search', useSearch)
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) { setNeedsAuth(true); setUsers([]); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load users (HTTP ${res.status})`)
        setUsers([])
        return
      }
      setUsers(Array.isArray(json.data) ? json.data : [])
      setTotalPages(json.pagination?.totalPages || 0)
      setTotal(json.pagination?.total || 0)
    } catch {
      setError('Network error while loading users. Check your connection and retry.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [role, status, search, page])

  useEffect(() => { loadUsers() }, [loadUsers])

  const applyFilter = (patch: { role?: string; status?: string; page?: number }) => {
    const nextRole = patch.role ?? role
    const nextStatus = patch.status ?? status
    const nextPage = patch.page ?? 1
    setRole(nextRole as typeof role)
    setStatus(nextStatus as typeof status)
    setPage(nextPage)
    setActionTarget(null)
    setDetailsId(null)
    loadUsers({ role: nextRole, status: nextStatus, page: nextPage })
  }

  const openAction = (u: AdminUser, a: Action) => {
    if (actionTarget === u.id && action === a) {
      setActionTarget(null)
      return
    }
    setActionTarget(u.id)
    setDetailsId(u.id)
    setAction(a)
    setRowError('')
    setSuccessMsg('')
    setReason('')
  }

  const submitAction = async (u: AdminUser) => {
    setActingId(u.id)
    setRowError('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: u.id, action, reason: reason.trim() || undefined }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setRowError(json?.error || `Action failed (HTTP ${res.status})`)
        return
      }
      // Real success — account status genuinely changed server-side (audit-logged).
      const label = action === 'ban' ? 'banned' : action === 'suspend' ? 'suspended' : 'reactivated'
      setSuccessMsg(`Account ${label}: ${u.email || u.companyName || u.fullName || u.id}`)
      setActionTarget(null)
      loadUsers()
    } catch {
      setRowError('Network error while updating the account. Check your connection and retry.')
    } finally {
      setActingId(null)
    }
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">User management is restricted to Zylod admins. Sign in with an admin account.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  const statusBadge = (s: string) => {
    if (s === 'active') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
    if (s === 'suspended') return 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
    if (s === 'banned') return 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">User Management</h1>
            <p className="text-[11px] text-slate-400">All registered accounts with real order/review counts. Suspend, ban, or reactivate — every action is audit-logged.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadUsers()} className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(['', 'buyer', 'supplier'] as const).map((r) => (
          <button
            key={r || 'all'}
            onClick={() => applyFilter({ role: r, page: 1 })}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition ${role === r ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            {r || 'All roles'}
          </button>
        ))}
        <select
          value={status}
          onChange={(e) => applyFilter({ status: e.target.value, page: 1 })}
          className="h-9 rounded-xl border border-input bg-white dark:bg-slate-900 px-3 text-xs font-bold"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilter({ page: 1 }) }}
            placeholder="Search email, phone, or name…"
            className="h-9 pl-9 rounded-xl text-xs"
          />
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-2xl px-4 py-3 text-xs font-bold">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* States */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load users</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadUsers()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Users className="h-10 w-10 text-slate-300 mx-auto" />
          <h2 className="text-sm font-black">No users found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search || role || status
              ? 'No accounts match the current filters. Adjust the role/status filters or search term.'
              : 'No accounts are registered yet. New buyers and suppliers appear here the moment they sign up.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const showDetails = detailsId === u.id
            const isActionTarget = actionTarget === u.id
            const displayName = u.companyName || u.businessName || u.fullName || '--'
            return (
              <div key={u.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Row */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-[170px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black truncate">{displayName}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${statusBadge(u.accountStatus)}`}>
                        {u.accountStatus}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {u.email || u.phone || 'no contact on file'}
                      <span className="text-slate-300 dark:text-slate-600"> · </span>
                      <span className="capitalize">{u.userType}</span>
                      {u.userType === 'supplier' && u.verificationStatus ? ` · ${u.verificationStatus}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 min-w-[150px]">
                    <span>{u.orderCount} order{u.orderCount === 1 ? '' : 's'}</span>
                    <span>{u.reviewCount} review{u.reviewCount === 1 ? '' : 's'}</span>
                    <span>{new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {u.accountStatus === 'active' ? (
                      <>
                        <Button variant="outline" onClick={() => openAction(u, 'suspend')} className="h-8 px-3 rounded-lg text-[11px] font-bold gap-1 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400">
                          <PauseCircle className="h-3.5 w-3.5" /> Suspend
                        </Button>
                        <Button variant="outline" onClick={() => openAction(u, 'ban')} className="h-8 px-3 rounded-lg text-[11px] font-bold gap-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400">
                          <Ban className="h-3.5 w-3.5" /> Ban
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" onClick={() => openAction(u, 'activate')} className="h-8 px-3 rounded-lg text-[11px] font-bold gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400">
                        <PlayCircle className="h-3.5 w-3.5" /> Reactivate
                      </Button>
                    )}
                    <button
                      onClick={() => { setDetailsId(showDetails ? null : u.id); setRowError('') }}
                      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      title={showDetails ? 'Hide details' : 'Show details'}
                    >
                      {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Details / action panel */}
                {(showDetails || isActionTarget) && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-3">
                    {/* Real account details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                      <div><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Contact</span><span className="font-bold break-all">{u.email || '--'}</span><span className="block text-slate-400">{u.phone || ''}</span></div>
                      <div><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Verified</span><span className="font-bold">Email: {u.isEmailVerified ? 'yes' : 'no'} · Phone: {u.isPhoneVerified ? 'yes' : 'no'}</span></div>
                      <div><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Activity</span><span className="font-bold">{u.orderCount} orders · {u.reviewCount} reviews · {u.quoteRequestCount} RFQs</span></div>
                      <div><span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Supplier rating</span><span className="font-bold">{u.userType === 'supplier' && u.ratingAvg > 0 ? u.ratingAvg.toFixed(1) : '--'}</span></div>
                    </div>

                    {/* Action confirm panel — only when an action button was clicked for THIS row */}
                    {isActionTarget && (
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {action === 'ban' && 'Banning permanently blocks this account. Provide a reason — it is recorded in the audit log.'}
                          {action === 'suspend' && 'Suspending temporarily blocks this account. Provide a reason — it is recorded in the audit log.'}
                          {action === 'activate' && 'Reactivating restores full access to this account.'}
                        </p>
                        {action !== 'activate' && (
                          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (recorded in audit log)" className="h-10 rounded-xl text-xs" />
                        )}
                        {rowError && (
                          <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                            <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> {rowError}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button variant="outline" onClick={() => setActionTarget(null)} className="h-9 px-4 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700">Cancel</Button>
                          <Button
                            onClick={() => submitAction(u)}
                            disabled={actingId === u.id || (action !== 'activate' && !reason.trim())}
                            className={`h-9 px-4 rounded-xl text-xs font-bold gap-1.5 text-white ${action === 'ban' ? 'bg-red-600 hover:bg-red-700' : action === 'suspend' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {actingId === u.id ? 'Applying…' : action === 'ban' ? 'Confirm ban' : action === 'suspend' ? 'Confirm suspend' : 'Confirm reactivate'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">{total} account{total === 1 ? '' : 's'} · page {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadUsers({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); loadUsers({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminUsersPage
