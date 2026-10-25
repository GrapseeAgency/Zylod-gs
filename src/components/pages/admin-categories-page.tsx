'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useNavigationStore } from '@/store/navigation-store'
import { toast } from 'sonner'
import {
  LayoutGrid, RefreshCw, AlertTriangle, Inbox, Plus, Pencil, Trash2,
  ChevronRight, ChevronDown, Power, PowerOff, FolderTree,
} from 'lucide-react'

// ── Real API types (GET/POST /api/admin/categories · PATCH/DELETE /api/admin/categories/[id]) ──
interface AdminCategory {
  id: string
  name: string
  slug: string
  parentId: string | null
  /** Real name of the parent category when one exists, else null. */
  parentName: string | null
  iconUrl: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  productCount: number
  childrenCount: number
}

interface CategoryStats {
  total: number
  active: number
  inactive: number
  roots: number
}

const REFRESH_INTERVAL_MS = 30_000

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-background border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400'

interface TreeNode {
  cat: AdminCategory
  children: TreeNode[]
}

interface FormState {
  mode: 'create' | 'edit'
  category: AdminCategory | null
  name: string
  slug: string
  parentId: string
  sortOrder: string
  isActive: boolean
  iconUrl: string
}

const EMPTY_FORM: FormState = {
  mode: 'create',
  category: null,
  name: '',
  slug: '',
  parentId: '',
  sortOrder: '0',
  isActive: true,
  iconUrl: '',
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function AdminCategoriesPage() {
  const { navigate } = useNavigationStore()

  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [stats, setStats] = useState<CategoryStats | null>(null)
  const [dataNotes, setDataNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Expanded tree nodes — null until the first load auto-expands every branch.
  const [expanded, setExpanded] = useState<Set<string> | null>(null)
  const autoExpandedRef = useRef(false)

  // Create/Edit form dialog (no optimistic writes — server responses applied on 2xx)
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Delete confirm dialog (shows the honest 409 backend message when blocked)
  const [deleting, setDeleting] = useState<AdminCategory | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deletingInFlight, setDeletingInFlight] = useState(false)

  // Inline activate/deactivate single-flight
  const [actingId, setActingId] = useState<string | null>(null)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    dialogOpenRef.current = form !== null || deleting !== null
  }, [form, deleting])

  const loadCategories = useCallback(async (background = false) => {
    // A background refresh never fights a foreground load.
    if (background && inflightRef.current) return
    inflightRef.current = true
    const seq = ++seqRef.current
    const apply = (fn: () => void) => { if (seq === seqRef.current) fn() }
    if (background) apply(() => setRefreshing(true))
    else {
      setLoading(true)
      setError('')
      setRefreshError('')
    }
    apply(() => setRefreshError(''))
    try {
      const res = await fetch('/api/admin/categories', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setCategories([]); setStats(null) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load categories (HTTP ${res.status})`
        apply(() => { if (background) setRefreshError(msg); else setError(msg) })
        return
      }
      const list: AdminCategory[] = Array.isArray(json.data?.categories) ? json.data.categories : []
      apply(() => {
        setCategories(list)
        setStats(json.data?.stats ?? null)
        setDataNotes(Array.isArray(json.data?.dataNotes) ? json.data.dataNotes : [])
        setLastUpdated(new Date())
        setNeedsAuth(false)
        // First successful load: auto-expand every branch that has children.
        if (!autoExpandedRef.current) {
          autoExpandedRef.current = true
          setExpanded(new Set(list.filter((c) => c.childrenCount > 0).map((c) => c.id)))
        }
      })
    } catch {
      const msg = 'Network error while loading categories. Check your connection and retry.'
      apply(() => { if (background) setRefreshError(msg); else setError(msg) })
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [])

  // Initial load + auto-refresh every 30s (cleared on unmount, paused while a dialog is open)
  useEffect(() => {
    loadCategories()
    const id = setInterval(() => { if (!dialogOpenRef.current) loadCategories(true) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadCategories])

  // ── Tree building (roots → children → grandchildren, up to 3 levels) ──
  const tree = useMemo(() => {
    const byId = new Map<string, TreeNode>()
    for (const c of categories) byId.set(c.id, { cat: c, children: [] })
    const roots: TreeNode[] = []
    for (const c of categories) {
      const node = byId.get(c.id)
      if (!node) continue
      if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId)!.children.push(node)
      else roots.push(node)
    }
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.cat.sortOrder - b.cat.sortOrder || a.cat.name.localeCompare(b.cat.name))
      nodes.forEach((n) => sortNodes(n.children))
    }
    sortNodes(roots)
    return roots
  }, [categories])

  // Real depth per category — anything at depth ≥ 3 exists but is not rendered.
  const hiddenDeeperCount = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]))
    const depthOf = new Map<string, number>()
    const depth = (c: AdminCategory): number => {
      const known = depthOf.get(c.id)
      if (known !== undefined) return known
      if (!c.parentId || !byId.has(c.parentId)) {
        depthOf.set(c.id, 0)
        return 0
      }
      const d = depth(byId.get(c.parentId)!) + 1
      depthOf.set(c.id, d)
      return d
    }
    return categories.filter((c) => depth(c) >= 3).length
  }, [categories])

  // Categories that may be picked as a parent in the edit dialog:
  // everything EXCEPT the edited category itself and its descendants (the
  // server's cycle guard rejects exactly those — mirrored here honestly).
  const parentOptions = useMemo(() => {
    if (!form || form.mode === 'create' || !form.category) return categories
    const editingId = form.category.id
    const childrenOf = new Map<string, string[]>()
    for (const c of categories) {
      if (!c.parentId) continue
      const list = childrenOf.get(c.parentId)
      if (list) list.push(c.id)
      else childrenOf.set(c.parentId, [c.id])
    }
    const excluded = new Set<string>([editingId])
    const queue = [editingId]
    while (queue.length > 0) {
      const current = queue.shift() as string
      for (const childId of childrenOf.get(current) ?? []) {
        if (!excluded.has(childId)) {
          excluded.add(childId)
          queue.push(childId)
        }
      }
    }
    return categories.filter((c) => !excluded.has(c.id))
  }, [form, categories])

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, mode: 'create' })
    setFormError('')
  }

  const openEdit = (cat: AdminCategory) => {
    setForm({
      mode: 'edit',
      category: cat,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId ?? '',
      sortOrder: String(cat.sortOrder),
      isActive: cat.isActive,
      iconUrl: cat.iconUrl ?? '',
    })
    setFormError('')
  }

  const closeForm = () => {
    setForm(null)
    setFormError('')
  }

  const submitForm = async () => {
    if (!form) return
    const trimmedName = form.name.trim()
    if (trimmedName.length === 0) {
      setFormError('Name is required.')
      return
    }
    const sortOrderRaw = form.sortOrder.trim()
    const sortOrder = sortOrderRaw.length > 0 ? Number(sortOrderRaw) : 0
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError('Sort order must be a whole number of at least 0.')
      return
    }

    const isEdit = form.mode === 'edit'
    const body: Record<string, unknown> = {
      name: trimmedName,
      ...(form.slug.trim().length > 0 ? { slug: form.slug.trim() } : {}),
      parentId: form.parentId, // '' = top level (POST create / PATCH set-null)
      sortOrder,
      isActive: form.isActive,
      // PATCH always sends iconUrl so clearing the field really clears it.
      iconUrl: form.iconUrl.trim(),
    }

    setSubmitting(true)
    setFormError('')
    try {
      const editingId = form.category?.id ?? ''
      const res = await fetch(isEdit ? `/api/admin/categories/${editingId}` : '/api/admin/categories', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Real backend error, verbatim (409 slug conflict, 400 parent, 422 cycle, 401 …)
        const msg = json?.error || `Could not save the category (HTTP ${res.status})`
        setFormError(msg)
        toast.error(msg)
        return
      }
      const saved = json.data as AdminCategory
      if (isEdit) {
        // Apply the server's serialized row; background refresh updates counts/stats.
        setCategories((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
      }
      toast.success(json.message || (isEdit ? 'Category updated.' : 'Category created.'))
      closeForm()
      loadCategories(true)
    } catch {
      const msg = 'Network error while saving the category. Check your connection and retry.'
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (cat: AdminCategory) => {
    if (actingId) return
    setActingId(cat.id)
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !cat.isActive }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Could not ${cat.isActive ? 'deactivate' : 'activate'} "${cat.name}" (HTTP ${res.status})`
        toast.error(msg)
        return
      }
      const saved = json.data as AdminCategory
      setCategories((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
      toast.success(json.message || `Category "${saved.name}" is now ${saved.isActive ? 'active' : 'inactive'}.`)
      loadCategories(true)
    } catch {
      toast.error('Network error while updating the category. Check your connection and retry.')
    } finally {
      setActingId(null)
    }
  }

  const closeDelete = () => {
    setDeleting(null)
    setDeleteError('')
  }

  const submitDelete = async () => {
    if (!deleting) return
    setDeletingInFlight(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/admin/categories/${deleting.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Honest 409 (has products / has subcategories), 404, 401 … verbatim.
        const msg = json?.error || `Could not delete "${deleting.name}" (HTTP ${res.status})`
        setDeleteError(msg)
        toast.error(msg)
        return
      }
      toast.success(json.message || `Category "${deleting.name}" deleted.`)
      closeDelete()
      loadCategories(true)
    } catch {
      const msg = 'Network error while deleting the category. Check your connection and retry.'
      setDeleteError(msg)
      toast.error(msg)
    } finally {
      setDeletingInFlight(false)
    }
  }

  const renderNode = (node: TreeNode, level: number): React.ReactNode => {
    const cat = node.cat
    const canExpand = node.children.length > 0 && level < 2
    const isOpen = expanded?.has(cat.id) ?? false
    const indentClass = level === 0 ? '' : level === 1 ? 'ml-5' : 'ml-10'
    const busy = actingId === cat.id
    return (
      <React.Fragment key={cat.id}>
        <div className={`flex items-start gap-2 py-2 pr-3 min-h-11 ${indentClass}`}>
          {/* Expander (only where children are actually rendered) */}
          {canExpand ? (
            <button
              onClick={() => toggleExpanded(cat.id)}
              aria-label={isOpen ? `Collapse children of ${cat.name}` : `Expand children of ${cat.name}`}
              className="min-h-11 w-8 shrink-0 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-8 shrink-0" />
          )}

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-black text-slate-800 dark:text-slate-200 break-words">{cat.name}</p>
              <Badge
                variant="outline"
                className={`text-[10px] font-black rounded-lg ${
                  cat.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900'
                    : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-background dark:text-slate-400 dark:border-slate-800'
                }`}
              >
                {cat.isActive ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 break-all">/{cat.slug}</span>
              <span className={chipClass}>{cat.productCount} product{cat.productCount === 1 ? '' : 's'}</span>
              {cat.childrenCount > 0 && <span className={chipClass}>{cat.childrenCount} subcategor{cat.childrenCount === 1 ? 'y' : 'ies'}</span>}
              <span className={chipClass}>sort {cat.sortOrder}</span>
              <span className={chipClass}>created {formatTimestamp(cat.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Button
              variant="outline"
              onClick={() => openEdit(cat)}
              disabled={busy || submitting || deletingInFlight}
              className="min-h-11 h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-800 dark:border-slate-700"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => toggleActive(cat)}
              disabled={busy || submitting || deletingInFlight}
              className={`min-h-11 h-11 px-3 rounded-xl text-xs font-bold gap-1.5 ${
                cat.isActive
                  ? 'border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950'
                  : 'border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950'
              }`}
            >
              {cat.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
              {busy ? 'Saving…' : cat.isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setDeleting(cat); setDeleteError('') }}
              disabled={busy || submitting || deletingInFlight}
              className="min-h-11 h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>

        {/* Children (level 1) and grandchildren (level 2) — 3 levels max, honest note below */}
        {canExpand && isOpen && node.children.map((child) => renderNode(child, level + 1))}
      </React.Fragment>
    )
  }

  // ── Guard states ──────────────────────────────────────────────────────
  const editCat = form?.mode === 'edit' ? form.category : null

  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-sm mx-auto">Category management is restricted to Zylod admins. Sign in with an admin account to create, edit or delete marketplace categories.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  const statChips: { label: string; value: number | null }[] = [
    { label: 'Total', value: stats?.total ?? null },
    { label: 'Active', value: stats?.active ?? null },
    { label: 'Inactive', value: stats?.inactive ?? null },
    { label: 'Roots', value: stats?.roots ?? null },
  ]

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 flex items-center justify-center">
            <LayoutGrid className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Category Management</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Create, edit, reorder and deactivate the real marketplace categories buyers browse. Every action is a real, audit-logged database change.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 tabular-nums">Updated {lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s</span>
          )}
          <Button
            variant="outline"
            onClick={() => loadCategories(true)}
            disabled={refreshing}
            className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-800 dark:border-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button
            onClick={openCreate}
            className="min-h-11 px-4 rounded-xl text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-white"
          >
            <Plus className="h-3.5 w-3.5" /> New category
          </Button>
        </div>
      </div>

      {/* Real stats chips (from the same GET that feeds the tree) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statChips.map((chip) => (
          <div key={chip.label} className="rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 p-3">
            <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 dark:text-slate-400">{chip.label}</p>
            <p className="text-lg font-black text-slate-800 dark:text-slate-200 tabular-nums">
              {chip.value == null ? '—' : chip.value.toLocaleString('en-BD')}
            </p>
          </div>
        ))}
      </div>

      {/* Verbatim refresh error (last good data — even an honest empty list — stays on screen) */}
      {refreshError && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-2xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 font-bold">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-words">{refreshError}</span>
          <button onClick={() => loadCategories(true)} className="ml-auto underline underline-offset-2 shrink-0">Retry</button>
        </div>
      )}

      {/* States */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the category tree</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadCategories()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : categories.length === 0 ? (
        // Honest empty state — the categories table truly holds zero rows
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-700 dark:text-slate-300 mx-auto" />
          <h2 className="text-sm font-black">No categories yet</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-md mx-auto leading-relaxed">
            Buyers see an empty category tree until suppliers/you create real ones. Use “New category” to add the first real category — nothing is seeded or faked here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="px-4 pt-3 flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Category tree</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800 px-4 pb-3 mt-1">
              {tree.map((node) => renderNode(node, 0))}
            </div>
          </div>

          {hiddenDeeperCount > 0 && (
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-background/40 p-4">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
                · {hiddenDeeperCount} categor{hiddenDeeperCount === 1 ? 'y is' : 'ies are'} nested deeper than 3 levels and {hiddenDeeperCount === 1 ? 'is' : 'are'} not shown in this tree. They still exist in the database and remain reachable via Edit on their ancestors.
              </p>
            </div>
          )}

          {/* Honest data notes straight from the API */}
          {dataNotes.length > 0 && (
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-background/40 p-4 space-y-1">
              {dataNotes.map((noteLine, i) => (
                <p key={i} className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">· {noteLine}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={form !== null} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          {form && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black flex items-center gap-2">
                  {form.mode === 'create' ? (
                    <><Plus className="h-4 w-4 text-primary" /> New category</>
                  ) : (
                    <><Pencil className="h-4 w-4 text-primary" /> Edit “{editCat?.name ?? ''}”</>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  {form.mode === 'create'
                    ? 'Creates a real category row (audit-logged). Buyers only see active categories.'
                    : `Created ${editCat ? formatTimestamp(editCat.createdAt) : ''} · ${editCat?.productCount ?? 0} product${editCat?.productCount === 1 ? '' : 's'} · /${editCat?.slug ?? ''}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div className="space-y-1.5">
                  <Label htmlFor="category-name" className="text-xs font-bold">Name *</Label>
                  <Input
                    id="category-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                    placeholder="e.g. Cotton Fabrics"
                    maxLength={80}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category-slug" className="text-xs font-bold">Slug</Label>
                  <Input
                    id="category-slug"
                    value={form.slug}
                    onChange={(e) => setForm((f) => (f ? { ...f, slug: e.target.value } : f))}
                    placeholder={form.mode === 'create' ? 'Auto-generated from the name' : ''}
                    maxLength={80}
                    className="h-10 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Lowercase letters, numbers and hyphens. Must be unique — a collision is refused with the real existing category named.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Parent category</Label>
                  <Select value={form.parentId} onValueChange={(v) => setForm((f) => (f ? { ...f, parentId: v === 'top' ? '' : v } : f))}>
                    <SelectTrigger className="min-h-11 w-full rounded-xl text-xs">
                      <SelectValue placeholder="Top level (no parent)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="top" className="text-xs">Top level (no parent)</SelectItem>
                      {parentOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name} <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">/{c.slug}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.mode === 'edit' && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                      Current parent: {form.category?.parentName ?? 'none (top level)'} · the category itself and its subcategories are not offered as parents (that would create a cycle).
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="category-sort" className="text-xs font-bold">Sort order</Label>
                    <Input
                      id="category-sort"
                      inputMode="numeric"
                      value={form.sortOrder}
                      onChange={(e) => setForm((f) => (f ? { ...f, sortOrder: e.target.value } : f))}
                      className="h-10 rounded-xl text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="category-active" className="text-xs font-bold">Active</Label>
                    <div className="flex items-center gap-2 min-h-10">
                      <Switch
                        id="category-active"
                        checked={form.isActive}
                        onCheckedChange={(checked) => setForm((f) => (f ? { ...f, isActive: checked } : f))}
                      />
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">{form.isActive ? 'Visible to buyers' : 'Hidden from buyers'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category-icon" className="text-xs font-bold">Icon URL</Label>
                  <Input
                    id="category-icon"
                    value={form.iconUrl}
                    onChange={(e) => setForm((f) => (f ? { ...f, iconUrl: e.target.value } : f))}
                    placeholder="https://… (optional)"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                {formError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {formError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeForm} disabled={submitting} className="min-h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 dark:border-slate-700">
                  Cancel
                </Button>
                <Button
                  onClick={submitForm}
                  disabled={submitting || form.name.trim().length === 0}
                  className="min-h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white"
                >
                  {submitting ? 'Saving…' : form.mode === 'create' ? 'Create category' : 'Save changes'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open) closeDelete() }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
          {deleting && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-600" /> Delete “{deleting.name}”?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  This permanently deletes the real category row (audit-logged). Deletion is refused if the category still has products or subcategories.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">/{deleting.slug}</span>
                  <span className={chipClass}>{deleting.productCount} product{deleting.productCount === 1 ? '' : 's'}</span>
                  <span className={chipClass}>{deleting.childrenCount} subcategor{deleting.childrenCount === 1 ? 'y' : 'ies'}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-black rounded-lg ${
                      deleting.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900'
                        : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-background dark:text-slate-400 dark:border-slate-800'
                    }`}
                  >
                    {deleting.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>

                {deleteError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {deleteError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDelete} disabled={deletingInFlight} className="min-h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 dark:border-slate-700">
                  Cancel
                </Button>
                <Button
                  onClick={submitDelete}
                  disabled={deletingInFlight}
                  className="min-h-11 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                >
                  {deletingInFlight ? 'Deleting…' : 'Delete category'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminCategoriesPage
