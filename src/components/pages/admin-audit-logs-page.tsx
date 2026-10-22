'use client'

/**
 * AdminAuditLogsPage (Task 139) — the admin console for the platform's audit
 * trail. Every audited write lands here with its actor resolved and its
 * before/after metadata expandable. This is the reader half of the anti-fake
 * doctrine: the rows were always written for real (Task 120's doctrine sweep
 * made them auth-first, Task 128/132/133 killed the last fake audit events)
 * — this console finally makes them VISIBLE to the admin they were written
 * for. Desktop table + mobile cards, honest pagination, real filters.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, ChevronLeft, RefreshCw, ScrollText, Search } from 'lucide-react'

interface AuditRow {
  id: string
  action: string
  entityType: string
  entityId: string | null
  metadata: string | null
  createdAt: string
  actor: { id: string; email: string; userType: string; name: string } | null
}

interface Payload {
  data: AuditRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  summary: { byEntityType: { entityType: string; count: number }[] }
}

const USER_TYPE_STYLES: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  supplier: 'bg-amber-100 text-amber-800 border-amber-200',
  buyer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function prettyMeta(raw: string | null): string {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function AdminAuditLogsPage() {
  const { goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [entityIdFilter, setEntityIdFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  const load = useCallback(async (pageNum = page) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ page: String(pageNum), limit: '30' })
      if (actionFilter.trim()) qs.set('action', actionFilter.trim())
      if (entityTypeFilter.trim()) qs.set('entityType', entityTypeFilter.trim())
      if (entityIdFilter.trim()) qs.set('entityId', entityIdFilter.trim())
      const res = await fetch(`/api/admin/audit-logs?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401) {
        setError('Admin access required — sign in as an administrator to read the audit trail.')
        setPayload(null)
      } else if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load audit logs (HTTP ${res.status})`)
        setPayload(null)
      } else {
        setPayload(json as Payload)
      }
    } catch {
      setError('Network error — could not reach the audit service.')
      setPayload(null)
    } finally {
      setLoading(false)
      setApplying(false)
    }
  }, [token, page, actionFilter, entityTypeFilter, entityIdFilter])

  useEffect(() => {
    void load(page)
  }, [page])

  const applyFilters = () => {
    setApplying(true)
    setPage(1)
    void load(1)
  }

  const resetFilters = () => {
    setActionFilter('')
    setEntityTypeFilter('')
    setEntityIdFilter('')
    setApplying(true)
    setPage(1)
    void load(1)
  }

  const rows = payload?.data ?? []
  const pagination = payload?.pagination

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50/40 via-white to-orange-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={goBack} aria-label="Go back" className="shrink-0">
              ←
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary shrink-0" />
                Audit Trail
              </h1>
              <p className="text-xs text-muted-foreground">
                Every audited platform write, its actor, and its before/after evidence.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load(page)} disabled={loading} className="shrink-0 gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="audit-action" className="text-xs font-bold text-gray-600 dark:text-gray-400">Action contains</label>
              <Input
                id="audit-action"
                placeholder="e.g. payment, product_updated…"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="audit-type" className="text-xs font-bold text-gray-600 dark:text-gray-400">Entity type</label>
              <Input
                id="audit-type"
                placeholder="e.g. products, orders, payments"
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="h-9 text-sm"
                list="audit-type-options"
              />
              <datalist id="audit-type-options">
                {(payload?.summary.byEntityType ?? []).map((t) => (
                  <option key={t.entityType} value={t.entityType}>{`${t.entityType} (${t.count})`}</option>
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="audit-entity" className="text-xs font-bold text-gray-600 dark:text-gray-400">Entity id</label>
              <Input
                id="audit-entity"
                placeholder="one entity's full history"
                value={entityIdFilter}
                onChange={(e) => setEntityIdFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="h-9 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={applyFilters} disabled={applying} className="gap-1.5 h-8 text-xs font-bold">
              <Search className="h-3.5 w-3.5" />
              {applying ? 'Filtering…' : 'Apply filters'}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetFilters} className="h-8 text-xs">Reset</Button>
            {pagination && (
              <span className="text-xs text-muted-foreground ml-auto" data-testid="audit-total">
                {pagination.total.toLocaleString()} event{pagination.total === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-14 space-y-3" role="alert">
            <p className="text-sm text-destructive font-bold">{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load(page)}>Retry</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-14 space-y-2" data-testid="audit-empty">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">No audit events match these filters.</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Audited actions (product edits, payment verifications, campaign changes, replies, status flips…) write their evidence here the moment they happen.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/60">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">When</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">Actor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">Action</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">Entity</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr
                        className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        data-testid="audit-row"
                      >
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">{fmt(r.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate max-w-40">{r.actor?.name ?? 'System'}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${USER_TYPE_STYLES[r.actor?.userType ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {r.actor?.userType ?? 'system'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono font-bold text-gray-800 dark:text-gray-200">{r.action}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-bold">{r.entityType}</span>
                          {r.entityId && <span className="block font-mono text-[10px] text-gray-400 truncate max-w-48">{r.entityId}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {expandedId === r.id
                            ? <ChevronDown className="h-4 w-4 inline text-gray-400" />
                            : <ChevronRight className="h-4 w-4 inline text-gray-400" />}
                        </td>
                      </tr>
                      {expandedId === r.id && (
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td colSpan={5} className="px-4 py-3 bg-gray-50/80 dark:bg-gray-800/40">
                            <pre className="text-[11px] leading-relaxed font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-64 overflow-y-auto" data-testid="audit-metadata">
                              {prettyMeta(r.metadata)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2.5">
              {rows.map((r) => (
                <div key={r.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 shadow-sm" data-testid="audit-card">
                  <button className="w-full text-left space-y-2" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200 truncate">{r.action}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${USER_TYPE_STYLES[r.actor?.userType ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {r.actor?.userType ?? 'system'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{r.actor?.name ?? 'System'} · <span className="font-bold">{r.entityType}</span></p>
                    <p className="text-[10px] text-gray-400 font-mono">{fmt(r.createdAt)}</p>
                  </button>
                  {expandedId === r.id && (
                    <pre className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800 text-[10px] leading-relaxed font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-56 overflow-y-auto" data-testid="audit-metadata-mobile">
                      {prettyMeta(r.metadata)}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1 h-8 text-xs">
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground font-bold">Page {pagination.page} of {pagination.totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="gap-1 h-8 text-xs">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
