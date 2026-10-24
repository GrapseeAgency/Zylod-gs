'use client'

/**
 * AdminContentPage — the admin console for the content rails that were dead
 * tables until Task 89: `banners` (home carousel slides) and flashDeals/
 * dailyDeals (the rows /api/deals has always read but nothing could write).
 *
 * BANNERS TAB — full CRUD over /api/admin/banners: create dialog (title,
 * subtitle, imageUrl, position, sortOrder, schedule, active), activate/
 * deactivate toggle, delete. Status badges are the server's own computed
 * status (live | scheduled | expired | inactive), recomputed on every load.
 *
 * DEALS TAB — create flash deals (window + stock + per-buyer cap) and daily
 * deals (a calendar day), toggle them, delete them. The API computes
 * discountPercent from the real basePrice — the UI shows the server's number
 * back, never one it invented. Product selection searches the REAL admin
 * products list (/api/admin/products?search=), so a deal can only ever point
 * at an existing product.
 *
 * LIVE: joins the session admin's token-gated admin:<id> room — a mutation
 * from any other admin console toasts and background-refreshes both queues.
 * Degraded honestly to a 30s poll. Auth failure renders the honest
 * "Admin access required" gate, never a fake empty list.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import { toast } from 'sonner'
import { AdminBlogManager } from '@/components/admin/admin-blog-manager'
import { AdminPromotionsManager } from '@/components/admin/admin-promotions-manager'
import { AdminCompanyManager } from '@/components/admin/admin-company-manager'
import { AdminPressInvestorManager } from '@/components/admin/admin-press-investor-manager'
import { AdminRewardTasksManager } from '@/components/admin/admin-reward-tasks-manager'
import {
  ArrowRight, Image as ImageIcon, Megaphone, Newspaper, Plus, RefreshCw, Trash2, Zap, CalendarDays, BadgePercent, Scale, Gift,
} from 'lucide-react'

/* ─── Types (mirror the API responses verbatim) ─── */

interface AdminBanner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string
  linkPageId: string | null
  linkParams: string | null
  position: string
  sortOrder: number
  isActive: boolean
  startAt: string | null
  endAt: string | null
  createdAt: string
  status: 'live' | 'scheduled' | 'expired' | 'inactive'
}

interface BannerStats {
  total: number
  live: number
  inactive: number
  byPosition: Record<string, number>
}

interface AdminDeal {
  id: string
  type: 'flash' | 'daily'
  productId: string
  dealPrice: number
  discountPercent: number
  isActive: boolean
  createdAt: string
  startAt: string | null
  endAt: string | null
  dayDate?: string | null
  totalStock?: number | null
  soldCount?: number | null
  maxPerBuyer?: number | null
  status: 'live' | 'upcoming' | 'expired' | 'inactive'
  product: {
    id: string
    name: string
    slug: string
    thumbnail: string | null
    basePrice: number
    unit: string
    supplierName: string | null
    categoryName: string | null
  } | null
}

interface DealStats {
  total: number
  live: number
  upcoming: number
  expired: number
  inactive: number
}

interface ProductHit {
  id: string
  name: string
  basePrice: number
  unit: string
  supplierName: string
}

const POSITIONS = [
  { value: 'home_top', label: 'Home — top (main carousel)' },
  { value: 'home_middle', label: 'Home — middle' },
  { value: 'category_top', label: 'Category pages — top' },
  { value: 'sidebar', label: 'Sidebar' },
] as const

const STATUS_STYLES: Record<string, string> = {
  live: 'bg-green-100 text-green-800 dark:text-green-200 border-green-200 dark:border-green-900/60',
  scheduled: 'bg-amber-100 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900/60',
  upcoming: 'bg-amber-100 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900/60',
  expired: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
  inactive: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** datetime-local string → ISO (or undefined when empty). */
function localToIso(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

export function AdminContentPage() {
  const navigate = useNavigationStore((s) => s.navigate)

  const [tab, setTab] = useState<'banners' | 'deals' | 'blog' | 'promotions' | 'company' | 'press' | 'rewards'>('banners')
  const [banners, setBanners] = useState<AdminBanner[]>([])
  const [bannerStats, setBannerStats] = useState<BannerStats | null>(null)
  const [deals, setDeals] = useState<AdminDeal[]>([])
  const [dealStats, setDealStats] = useState<DealStats | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)

  const load = useCallback(async (which: 'banners' | 'deals' | 'both', background = false) => {
    if (background && inflightRef.current) return
    inflightRef.current = true
    const seq = ++seqRef.current
    const apply = (fn: () => void) => { if (seq === seqRef.current) fn() }
    if (background) apply(() => setRefreshing(true))
    else { setLoading(true); apply(() => setRefreshError('')) }
    try {
      const wantBanners = which !== 'deals'
      const wantDeals = which !== 'banners'
      const [bRes, dRes] = await Promise.all([
        wantBanners ? fetch('/api/admin/banners', { credentials: 'include' }) : Promise.resolve(null),
        wantDeals ? fetch('/api/admin/deals', { credentials: 'include' }) : Promise.resolve(null),
      ])
      for (const res of [bRes, dRes]) {
        if (res && (res.status === 401 || res.status === 403)) {
          apply(() => setNeedsAuth(true))
          return
        }
      }
      if (bRes) {
        const json = await bRes.json().catch(() => null)
        if (!bRes.ok || !json?.success) {
          apply(() => setRefreshError(json?.error || `Failed to load banners (HTTP ${bRes.status})`))
        } else {
          apply(() => {
            setBanners(Array.isArray(json.data?.banners) ? json.data.banners : [])
            setBannerStats(json.data?.stats ?? null)
            setNeedsAuth(false)
          })
        }
      }
      if (dRes) {
        const json = await dRes.json().catch(() => null)
        if (!dRes.ok || !json?.success) {
          apply(() => setRefreshError(json?.error || `Failed to load deals (HTTP ${dRes.status})`))
        } else {
          apply(() => {
            setDeals(Array.isArray(json.data?.deals) ? json.data.deals : [])
            setDealStats(json.data?.stats ?? null)
            setNeedsAuth(false)
          })
        }
      }
      apply(() => setLastUpdated(new Date()))
    } catch {
      apply(() => setRefreshError('Network error while loading content. Check your connection and retry.'))
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    load('both')
    const id = setInterval(() => { if (!document.hidden) load('both', true) }, 30_000)
    return () => clearInterval(id)
  }, [load])

  // Live tap on the session admin's own token-gated room — another console's
  // content mutation refreshes this one without polling luck.
  const sessionUser = useAuthStore((s) => s.user)
  const adminRoom = sessionUser?.userType === 'admin' && sessionUser.id ? `admin:${sessionUser.id}` : ''
  const lastEventRef = useRef('')
  useRealtimeRoom(adminRoom ? [adminRoom] : [], {
    onEvent: (message) => {
      const key = `${message.event}:${message.receivedAt.getTime()}`
      if (key === lastEventRef.current) return
      lastEventRef.current = key
      if (message.event === 'banner:changed' || message.event === 'deal:changed') {
        void load(message.event === 'banner:changed' ? 'banners' : 'deals', true)
      }
    },
  })

  /* ─── Banner mutations ─── */
  const toggleBanner = async (b: AdminBanner) => {
    setBusyId(b.id)
    try {
      const res = await fetch(`/api/admin/banners/${b.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !b.isActive }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Failed to update banner (HTTP ${res.status})`)
        return
      }
      toast.success(json.data?.noop ? 'Nothing to change' : `Banner ${json.data?.banner?.isActive ? 'activated' : 'deactivated'}`)
      void load('banners', true)
    } catch {
      toast.error('Network error while updating the banner')
    } finally {
      setBusyId(null)
    }
  }

  const deleteBanner = async (b: AdminBanner) => {
    setBusyId(b.id)
    try {
      const res = await fetch(`/api/admin/banners/${b.id}`, { method: 'DELETE', credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Failed to delete banner (HTTP ${res.status})`)
        return
      }
      toast.success('Banner deleted')
      void load('banners', true)
    } catch {
      toast.error('Network error while deleting the banner')
    } finally {
      setBusyId(null)
    }
  }

  /* ─── Deal mutations ─── */
  const toggleDeal = async (d: AdminDeal) => {
    setBusyId(d.id)
    try {
      const res = await fetch(`/api/admin/deals/${d.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !d.isActive }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Failed to update deal (HTTP ${res.status})`)
        return
      }
      toast.success(`Deal ${json.data?.deal?.isActive ? 'activated' : 'deactivated'}`)
      void load('deals', true)
    } catch {
      toast.error('Network error while updating the deal')
    } finally {
      setBusyId(null)
    }
  }

  const deleteDeal = async (d: AdminDeal) => {
    setBusyId(d.id)
    try {
      const res = await fetch(`/api/admin/deals/${d.id}`, { method: 'DELETE', credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Failed to delete deal (HTTP ${res.status})`)
        return
      }
      toast.success('Deal deleted')
      void load('deals', true)
    } catch {
      toast.error('Network error while deleting the deal')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('admin-dashboard')} className="text-muted-foreground hover:text-primary">
            <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Content &amp; Deals</h1>
            <p className="text-muted-foreground text-sm">Home banners and flash/daily deals shoppers actually see</p>
          </div>
        </div>
        <Badge className="bg-primary hover:bg-[#C62828] dark:hover:bg-primary/90 text-white">Admin Panel</Badge>
      </div>

      {needsAuth ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-6 text-center">
          <p className="font-semibold text-amber-900 dark:text-amber-100">Admin access required</p>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">Sign in with an admin account to manage storefront content.</p>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-2 flex-wrap">
            <Button variant={tab === 'banners' ? 'default' : 'outline'} size="sm" onClick={() => setTab('banners')}>
              <ImageIcon className="h-4 w-4 mr-1.5" /> Banners ({bannerStats?.total ?? '…'})
            </Button>
            <Button variant={tab === 'deals' ? 'default' : 'outline'} size="sm" onClick={() => setTab('deals')}>
              <Zap className="h-4 w-4 mr-1.5" /> Deals ({dealStats?.total ?? '…'})
            </Button>
            <Button variant={tab === 'blog' ? 'default' : 'outline'} size="sm" onClick={() => setTab('blog')}>
              <Newspaper className="h-4 w-4 mr-1.5" /> Blog
            </Button>
            <Button variant={tab === 'promotions' ? 'default' : 'outline'} size="sm" onClick={() => setTab('promotions')}>
              <BadgePercent className="h-4 w-4 mr-1.5" /> Promotions
            </Button>
            <Button variant={tab === 'company' ? 'default' : 'outline'} size="sm" onClick={() => setTab('company')}>
              <Scale className="h-4 w-4 mr-1.5" /> Company
            </Button>
            <Button variant={tab === 'press' ? 'default' : 'outline'} size="sm" onClick={() => setTab('press')}>
              <Newspaper className="h-4 w-4 mr-1.5" /> Press & investor
            </Button>
            <Button variant={tab === 'rewards' ? 'default' : 'outline'} size="sm" onClick={() => setTab('rewards')}>
              <Gift className="h-4 w-4 mr-1.5" /> Rewards
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => load('both')} disabled={refreshing} className="text-muted-foreground">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>

          {refreshError && (
            <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{refreshError}</div>
          )}

          {tab === 'blog' ? (
            <AdminBlogManager />
          ) : tab === 'promotions' ? (
            <AdminPromotionsManager />
          ) : tab === 'company' ? (
            <AdminCompanyManager />
          ) : tab === 'press' ? (
            <AdminPressInvestorManager />
          ) : tab === 'rewards' ? (
            <AdminRewardTasksManager />
          ) : loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : tab === 'banners' ? (
            <BannersTab
              banners={banners}
              stats={bannerStats}
              busyId={busyId}
              onToggle={toggleBanner}
              onDelete={deleteBanner}
              onCreated={() => load('banners', true)}
            />
          ) : (
            <DealsTab
              deals={deals}
              stats={dealStats}
              busyId={busyId}
              onToggle={toggleDeal}
              onDelete={deleteDeal}
              onCreated={() => load('deals', true)}
            />
          )}

          <p className="text-[11px] text-muted-foreground text-right">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s · live taps on admin room` : ''}
          </p>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════ BANNERS TAB ═══════════════════════ */

function BannersTab({ banners, stats, busyId, onToggle, onDelete, onCreated }: {
  banners: AdminBanner[]
  stats: BannerStats | null
  busyId: string | null
  onToggle: (b: AdminBanner) => Promise<void>
  onDelete: (b: AdminBanner) => Promise<void>
  onCreated: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    linkPageId: '',
    linkParams: '',
    position: 'home_top' as (typeof POSITIONS)[number]['value'],
    sortOrder: 0,
    isActive: true,
    startAt: '',
    endAt: '',
  })

  const submit = async () => {
    setError('')
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (!form.imageUrl.trim()) { setError('Image URL is required.'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        imageUrl: form.imageUrl.trim(),
        position: form.position,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      }
      if (form.subtitle.trim()) body.subtitle = form.subtitle.trim()
      if (form.linkPageId.trim()) body.linkPageId = form.linkPageId.trim()
      if (form.linkParams.trim()) body.linkParams = form.linkParams.trim()
      const startIso = localToIso(form.startAt)
      const endIso = localToIso(form.endAt)
      if (startIso) body.startAt = startIso
      if (endIso) body.endAt = endIso

      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const details = json?.details ? Object.values(json.details).flat().join(' ') : ''
        setError((json?.error || `Failed to create banner (HTTP ${res.status})`) + (details ? ` — ${details}` : ''))
        return
      }
      toast.success('Banner created')
      setDialogOpen(false)
      setForm({ title: '', subtitle: '', imageUrl: '', linkPageId: '', linkParams: '', position: 'home_top', sortOrder: 0, isActive: true, startAt: '', endAt: '' })
      onCreated()
    } catch {
      setError('Network error while creating the banner')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <StatChip label="Total" value={stats?.total} />
        <StatChip label="Live now" value={stats?.live} tone="green" />
        <StatChip label="Inactive" value={stats?.inactive} />
        {stats && Object.entries(stats.byPosition).map(([pos, n]) => (
          <StatChip key={pos} label={pos} value={n} />
        ))}
        <div className="flex-1" />
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-8 w-8 text-muted-foreground/40" />}
          title="No banners yet"
          body="The home carousel renders nothing while this list is empty — no fake slides. Create the first real banner."
        />
      ) : (
        <div className="rounded-lg border divide-y">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-3 p-3">
              <div className="h-12 w-20 rounded-md overflow-hidden bg-muted shrink-0">
                {b.imageUrl ? (

                  <img src={b.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground/40" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{b.title}</p>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[b.status]}`}>{b.status}</Badge>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">{b.position}</Badge>
                  <span className="text-[10px] text-muted-foreground">#{b.sortOrder}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {b.subtitle || 'No subtitle'}
                  {b.linkPageId ? ` → ${b.linkPageId}` : ' · display only'}
                  {' · '}{b.startAt || b.endAt ? `${fmtDateTime(b.startAt)} → ${fmtDateTime(b.endAt)}` : 'no schedule'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={b.isActive}
                  disabled={busyId === b.id}
                  onCheckedChange={() => void onToggle(b)}
                  aria-label={b.isActive ? 'Deactivate banner' : 'Activate banner'}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={busyId === b.id} onClick={() => void onDelete(b)} aria-label={`Delete banner ${b.title}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create banner</DialogTitle>
            <DialogDescription>
              Real carousel slide for the storefront. Expired or future-scheduled banners never appear to shoppers.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="banner-title">Title *</Label>
              <Input id="banner-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder="Eid wholesale mega sale" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="banner-subtitle">Subtitle</Label>
              <Input id="banner-subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} maxLength={200} placeholder="Up to 40% off on bulk cartons" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="banner-image">Image URL *</Label>
              <Input id="banner-image" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://cdn.example.com/eid-sale.jpg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="banner-pos">Position</Label>
                <select id="banner-pos" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value as typeof form.position })}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="banner-sort">Sort order</Label>
                <Input id="banner-sort" type="number" min={0} max={10000} value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Math.max(0, Number(e.target.value) || 0) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="banner-start">Starts (optional)</Label>
                <Input id="banner-start" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="banner-end">Ends (optional)</Label>
                <Input id="banner-end" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="banner-link">Links to page id (optional)</Label>
                <Input id="banner-link" value={form.linkPageId} onChange={(e) => setForm({ ...form, linkPageId: e.target.value })} placeholder="flash-deals" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="banner-params">Link params (optional)</Label>
                <Input id="banner-params" value={form.linkParams} onChange={(e) => setForm({ ...form, linkParams: e.target.value })} placeholder="type=flash" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} aria-label="Activate immediately" />
              Activate immediately
            </label>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? 'Creating…' : 'Create banner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ═══════════════════════ DEALS TAB ═══════════════════════ */

function DealsTab({ deals, stats, busyId, onToggle, onDelete, onCreated }: {
  deals: AdminDeal[]
  stats: DealStats | null
  busyId: string | null
  onToggle: (d: AdminDeal) => Promise<void>
  onDelete: (d: AdminDeal) => Promise<void>
  onCreated: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: 'flash' as 'flash' | 'daily',
    product: null as ProductHit | null,
    productQuery: '',
    dealPrice: '',
    startAt: '',
    endAt: '',
    totalStock: '',
    maxPerBuyer: '',
    dayDate: '',
  })
  const [hits, setHits] = useState<ProductHit[]>([])
  const [searching, setSearching] = useState(false)
  const searchSeq = useRef(0)

  // Product search against the REAL admin products list — a deal can only
  // ever point at a product that exists.
  useEffect(() => {
    if (!dialogOpen) return
    const q = form.productQuery.trim()
    if (q.length < 2) { setHits([]); return }
    const seq = ++searchSeq.current
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/products?search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
        const json = await res.json().catch(() => null)
        if (seq === searchSeq.current && res.ok && json?.success) {
          const rows = Array.isArray(json.data?.products) ? json.data.products : []
          setHits(rows.map((p: { id: string; name: string; basePrice: number; unit: string; supplierName: string }) => ({
            id: p.id, name: p.name, basePrice: p.basePrice, unit: p.unit, supplierName: p.supplierName,
          })))
        }
      } catch {
        // keep previous hits
      } finally {
        if (seq === searchSeq.current) setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [form.productQuery, dialogOpen])

  const submit = async () => {
    setError('')
    if (!form.product) { setError('Pick a product for the deal.'); return }
    const price = Number(form.dealPrice)
    if (!(price > 0)) { setError('Deal price must be a positive number.'); return }
    const body: Record<string, unknown> = {
      type: form.type,
      productId: form.product.id,
      dealPrice: price,
    }
    if (form.type === 'flash') {
      const startIso = localToIso(form.startAt)
      const endIso = localToIso(form.endAt)
      if (!startIso || !endIso) { setError('Flash deals need a start and an end.'); return }
      body.startAt = startIso
      body.endAt = endIso
      if (form.totalStock) body.totalStock = Number(form.totalStock)
      if (form.maxPerBuyer) body.maxPerBuyer = Number(form.maxPerBuyer)
    } else {
      if (!form.dayDate) { setError('Daily deals need a day.'); return }
      body.dayDate = new Date(`${form.dayDate}T00:00:00Z`).toISOString()
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/deals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const details = json?.details ? Object.values(json.details).flat().join(' ') : ''
        setError((json?.error || `Failed to create deal (HTTP ${res.status})`) + (details ? ` — ${details}` : ''))
        return
      }
      toast.success('Deal created')
      setDialogOpen(false)
      setForm({ type: 'flash', product: null, productQuery: '', dealPrice: '', startAt: '', endAt: '', totalStock: '', maxPerBuyer: '', dayDate: '' })
      onCreated()
    } catch {
      setError('Network error while creating the deal')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <StatChip label="Total" value={stats?.total} />
        <StatChip label="Live" value={stats?.live} tone="green" />
        <StatChip label="Upcoming" value={stats?.upcoming} tone="amber" />
        <StatChip label="Expired" value={stats?.expired} />
        <StatChip label="Inactive" value={stats?.inactive} />
        <div className="flex-1" />
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New deal
        </Button>
      </div>

      {deals.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-8 w-8 text-muted-foreground/40" />}
          title="No deals yet"
          body="/api/deals has always read flashDeals and dailyDeals — until now nothing could write them. Create the first real deal."
        />
      ) : (
        <div className="rounded-lg border divide-y">
          {deals.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3">
              <div className="h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                {d.product?.thumbnail ? (

                  <img src={d.product.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Megaphone className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{d.product?.name || '(deleted product)'}</p>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[d.status]}`}>{d.status}</Badge>
                  {d.type === 'flash'
                    ? <Badge variant="outline" className="text-[10px] text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900/60 bg-orange-50 dark:bg-orange-950/40"><Zap className="h-3 w-3 mr-0.5" />flash</Badge>
                    : <Badge variant="outline" className="text-[10px] text-teal-700 border-teal-200 bg-teal-50"><CalendarDays className="h-3 w-3 mr-0.5" />daily</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {d.product ? `Base ৳${d.product.basePrice} ${d.product.unit} → ` : ''}
                  <span className="font-semibold text-foreground">৳{d.dealPrice}</span>
                  {' '}{d.discountPercent > 0 ? `· −${d.discountPercent}%` : ''}
                  {d.type === 'flash'
                    ? ` · ${fmtDateTime(d.startAt)} → ${fmtDateTime(d.endAt)}`
                    : ` · ${d.dayDate ? new Date(d.dayDate).toISOString().slice(0, 10) : ''}`}
                  {d.type === 'flash' && d.totalStock != null ? ` · stock ${d.soldCount ?? 0}/${d.totalStock}` : ''}
                  {d.product?.supplierName ? ` · ${d.product.supplierName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={d.isActive}
                  disabled={busyId === d.id}
                  onCheckedChange={() => void onToggle(d)}
                  aria-label={d.isActive ? 'Deactivate deal' : 'Activate deal'}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={busyId === d.id} onClick={() => void onDelete(d)} aria-label={`Delete deal ${d.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create deal</DialogTitle>
            <DialogDescription>
              Discount percent is computed from the product&apos;s real base price — the storefront shows the server&apos;s math.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={form.type === 'flash' ? 'default' : 'outline'} size="sm"
                onClick={() => setForm({ ...form, type: 'flash' })}>
                <Zap className="h-4 w-4 mr-1" /> Flash deal
              </Button>
              <Button type="button" variant={form.type === 'daily' ? 'default' : 'outline'} size="sm"
                onClick={() => setForm({ ...form, type: 'daily' })}>
                <CalendarDays className="h-4 w-4 mr-1" /> Daily deal
              </Button>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="deal-product">Product *</Label>
              {form.product ? (
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{form.product.name}</p>
                    <p className="text-xs text-muted-foreground">৳{form.product.basePrice} / {form.product.unit} · {form.product.supplierName}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, product: null, productQuery: '' })}>Change</Button>
                </div>
              ) : (
                <>
                  <Input id="deal-product" value={form.productQuery} onChange={(e) => setForm({ ...form, productQuery: e.target.value })}
                    placeholder="Search products by name or supplier…" />
                  {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
                  {hits.length > 0 && (
                    <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                      {hits.map((h) => (
                        <button key={h.id} type="button" className="w-full text-left p-2 hover:bg-muted/60"
                          onClick={() => {
                            setForm((f) => ({ ...f, product: h, productQuery: '' }))
                            setHits([])
                          }}>
                          <p className="text-sm truncate">{h.name}</p>
                          <p className="text-xs text-muted-foreground">৳{h.basePrice} / {h.unit} · {h.supplierName}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="deal-price">Deal price (৳) *</Label>
              <Input id="deal-price" type="number" min={0} step="0.01" value={form.dealPrice}
                onChange={(e) => setForm({ ...form, dealPrice: e.target.value })} placeholder="e.g. 480" />
              {form.product && Number(form.dealPrice) > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ −{Math.max(0, Math.round((1 - Number(form.dealPrice) / form.product.basePrice) * 1000) / 10)}% off base ৳{form.product.basePrice}
                </p>
              )}
            </div>

            {form.type === 'flash' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="deal-start">Starts *</Label>
                    <Input id="deal-start" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="deal-end">Ends *</Label>
                    <Input id="deal-end" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="deal-stock">Total stock</Label>
                    <Input id="deal-stock" type="number" min={0} value={form.totalStock} onChange={(e) => setForm({ ...form, totalStock: e.target.value })} placeholder="0" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="deal-max">Max per buyer</Label>
                    <Input id="deal-max" type="number" min={0} value={form.maxPerBuyer} onChange={(e) => setForm({ ...form, maxPerBuyer: e.target.value })} placeholder="unlimited" />
                  </div>
                </div>
              </>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="deal-day">Day *</Label>
                <Input id="deal-day" type="date" value={form.dayDate} onChange={(e) => setForm({ ...form, dayDate: e.target.value })} />
              </div>
            )}

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={saving}>{saving ? 'Creating…' : 'Create deal'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Shared bits ─── */

function StatChip({ label, value, tone }: { label: string; value?: number; tone?: 'green' | 'amber' }) {
  const toneCls = tone === 'green' ? 'text-green-700 dark:text-green-300' : tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : ''
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 bg-background">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${toneCls}`}>{value ?? '…'}</span>
    </span>
  )
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{body}</p>
    </div>
  )
}
