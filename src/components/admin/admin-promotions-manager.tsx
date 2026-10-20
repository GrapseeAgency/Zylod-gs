'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BadgePercent, Plus, Trash2, Loader2, Pencil, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Task 100: THE PROMOTION CONSOLE — the fourth tab of the admin content
 * page. Writes the promotions rows the pricing engine reads: a campaign is
 * pinned to REAL products (searched from the live catalog — never typed
 * ids), windowed, limited, and toggled live. The console never invents a
 * price: the engine (percentage | fixed only) computes the discount at
 * order time and the receipt carries the real number.
 */

interface PinnedProduct { id: string; name: string }

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  createdAt: string;
  computedStatus: 'live' | 'scheduled' | 'ended' | 'paused';
  pinnedProducts: PinnedProduct[];
}

interface Stats { total: number; live: number; notActive: number }

interface ProductHit { id: string; name: string; basePrice: number; unit: string }

/* Task 103: one applied-discount event, read from the pricing engine's REAL audit rows. */
interface CampaignUsage {
  id: string;
  orderNumber: string;
  type: string | null;
  value: number | null;
  promotedSubtotal: number | null;
  discount: number | null;
  at: string;
}

const EMPTY_FORM = {
  name: '',
  type: 'percentage' as 'percentage' | 'fixed',
  value: '',
  maxDiscount: '',
  minOrderAmount: '',
  usageLimit: '',
  validFrom: '',
  validUntil: '',
  isActive: false,
  description: '',
};

const STATUS_STYLE: Record<Campaign['computedStatus'], string> = {
  live: 'bg-green-500/10 text-green-600',
  scheduled: 'bg-sky-500/10 text-sky-600',
  ended: 'bg-slate-500/10 text-slate-500',
  paused: 'bg-amber-500/10 text-amber-600',
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminPromotionsManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usages, setUsages] = useState<CampaignUsage[]>([]);
  const [usageTotals, setUsageTotals] = useState<{ count: number; totalDiscount: number } | null>(null);
  const [usagesLoading, setUsagesLoading] = useState(false);

  // Product picker state (create + edit share it)
  const [pinned, setPinned] = useState<PinnedProduct[]>([]);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/promotions', { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setRefreshError('Admin session required — sign in again to manage promotions.');
        return;
      }
      if (!res.ok || !json?.success) {
        setRefreshError(json?.error || `Failed to load campaigns (HTTP ${res.status})`);
        return;
      }
      setCampaigns(json.data ?? []);
      setStats(json.stats ?? null);
      setRefreshError('');
    } catch {
      setRefreshError('Could not reach the promotions service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Product search — debounced, real catalog rows only.
  useEffect(() => {
    if (!dialogOpen) return;
    const q = search.trim();
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          setHits(json.data?.items ?? json.data ?? []);
        } else {
          setHits([]);
        }
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, dialogOpen]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPinned([]);
    setSearch('');
    setHits([]);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      name: c.name,
      type: c.type === 'fixed' ? 'fixed' : 'percentage',
      value: String(c.value),
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
      minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : '',
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
      validFrom: toLocalInput(c.validFrom),
      validUntil: toLocalInput(c.validUntil),
      isActive: c.isActive,
      description: c.description ?? '',
    });
    setPinned(c.pinnedProducts);
    setSearch('');
    setHits([]);
    setFormError('');
    setDialogOpen(true);
  };

  const togglePin = (hit: ProductHit) => {
    setPinned((cur) =>
      cur.some((p) => p.id === hit.id)
        ? cur.filter((p) => p.id !== hit.id)
        : [...cur, { id: hit.id, name: hit.name }]
    );
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      value: Number(form.value),
      ...(form.maxDiscount.trim() ? { maxDiscount: Number(form.maxDiscount) } : { maxDiscount: null }),
      minOrderAmount: form.minOrderAmount.trim() ? Number(form.minOrderAmount) : 0,
      usageLimit: form.usageLimit.trim() ? Number(form.usageLimit) : 0,
      validFrom: new Date(form.validFrom).toISOString(),
      validUntil: new Date(form.validUntil).toISOString(),
      description: form.description.trim() ? form.description : null,
      productIds: pinned.map((p) => p.id),
    };
    if (!editing) payload.isActive = form.isActive;
    return payload;
  };

  const save = async () => {
    setFormError('');
    if (form.name.trim().length < 3) { setFormError('Name must be at least 3 characters.'); return; }
    if (!form.value || Number(form.value) <= 0) { setFormError('Discount value must be greater than zero.'); return; }
    if (form.type === 'percentage' && Number(form.value) > 100) { setFormError('A percentage discount cannot exceed 100%.'); return; }
    if (!form.validFrom || !form.validUntil) { setFormError('Both the start and the end of the window are required.'); return; }
    if (new Date(form.validUntil) <= new Date(form.validFrom)) { setFormError('End date must be after the start date.'); return; }
    if (pinned.length === 0) { setFormError('Pin at least one product — a promotion pinning nothing can never apply.'); return; }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/admin/promotions/${editing.id}` : '/api/admin/promotions', {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json().catch(() => null);
      if ((res.status === 201 || res.status === 200) && json?.success) {
        toast.success(editing ? 'Campaign updated' : json.data.isActive ? 'Campaign is live' : 'Campaign saved (paused)');
        setDialogOpen(false);
        setEditing(null);
        load();
      } else {
        setFormError(json?.error || `Could not save (HTTP ${res.status})`);
      }
    } catch {
      setFormError('Could not reach the promotions service');
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = async (c: Campaign) => {
    if (expandedId === c.id) { setExpandedId(null); setUsages([]); setUsageTotals(null); return; }
    setExpandedId(c.id);
    setUsages([]);
    setUsageTotals(null);
    setUsagesLoading(true);
    try {
      const res = await fetch(`/api/admin/promotions/${c.id}/usages`, { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setUsages(json.data ?? []);
        setUsageTotals(json.totals ?? null);
      } else {
        toast.error(json?.error || `Could not load usage history (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the promotions service');
    } finally {
      setUsagesLoading(false);
    }
  };

  const toggleActive = async (c: Campaign) => {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/admin/promotions/${c.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.data.isActive ? 'Campaign resumed' : 'Campaign paused — orders no longer receive it');
        load();
      } else {
        toast.error(json?.error || `Could not update (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the promotions service');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await fetch(`/api/admin/promotions/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Campaign deleted — past order receipts keep their stamp');
        load();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || `Could not delete (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the promotions service');
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  const valueLabel = (c: Campaign) =>
    c.type === 'percentage' ? `${c.value}% off` : `৳${c.value.toLocaleString()} off`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="text-lg font-bold leading-none">{stats?.total ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Campaigns</div>
        </div>
        <div className="rounded-lg bg-green-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-green-600">{stats?.live ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Active</div>
        </div>
        <div className="rounded-lg bg-amber-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-amber-600">{stats?.notActive ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Paused</div>
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New campaign
        </Button>
      </div>

      {refreshError && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
          {refreshError}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed">
          <BadgePercent className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <h3 className="text-sm font-semibold">No campaigns yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Platform promotions apply automatically at checkout — pin real products to create the first one.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Create the first campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-lg border">
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold truncate">{c.name}</h4>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[c.computedStatus]}`}>
                    {c.computedStatus}
                  </span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{valueLabel(c)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {c.pinnedProducts.length} pinned · {new Date(c.validFrom).toLocaleDateString('en-GB')} → {new Date(c.validUntil).toLocaleDateString('en-GB')}
                  {c.usageLimit != null ? ` · used ${c.usedCount}/${c.usageLimit}` : ` · used ${c.usedCount}×`}
                  {c.minOrderAmount != null ? ` · min ৳${c.minOrderAmount.toLocaleString()}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={c.isActive}
                  disabled={busyId === c.id}
                  onCheckedChange={() => toggleActive(c)}
                  aria-label={`${c.isActive ? 'Pause' : 'Resume'} ${c.name}`}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleExpand(c)} aria-label={`${expandedId === c.id ? 'Hide' : 'Show'} usage history for ${c.name}`}>
                  {expandedId === c.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)} aria-label={`Delete ${c.name}`}>
                  {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            {/* Task 103: usage drill-down — the REAL applied-discount events. */}
            {expandedId === c.id && (
              <div className="border-t bg-muted/30 p-3">
                {usagesLoading ? (
                  <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
                ) : usages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No order has used this campaign yet — the usedCount above is the real zero.</p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                      <span>{usageTotals?.count ?? 0} orders · ৳{(usageTotals?.totalDiscount ?? 0).toLocaleString()} total funded</span>
                      <span>most recent first</span>
                    </div>
                    {usages.map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-gray-800 rounded border px-2.5 py-1.5">
                        <span className="font-mono font-semibold">{u.orderNumber}</span>
                        <span className="text-muted-foreground">
                          {u.type === 'percentage' ? `${u.value}% of ৳${(u.promotedSubtotal ?? 0).toLocaleString()}` : u.type === 'fixed' ? `৳${u.value?.toLocaleString()} flat` : '—'}
                        </span>
                        <span className="font-bold text-emerald-600">−৳{(u.discount ?? 0).toLocaleString()}</span>
                        <span className="text-muted-foreground text-[11px] shrink-0">{new Date(u.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit campaign' : 'New campaign'}</DialogTitle>
            <DialogDescription>
              Platform promotions apply automatically at checkout — no code, no opt-in. The engine computes percentage and fixed discounts off the pinned products' lines; the coupon stacks on top.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">Campaign name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} placeholder="Ramadan Wholesale Fair" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'percentage' | 'fixed' })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Promotion type"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount (৳)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">{form.type === 'percentage' ? 'Discount % *' : 'Discount amount ৳ *'}</label>
                <Input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'percentage' ? '12' : '500'} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Max discount ৳</label>
                <Input type="number" min="0" step="0.01" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} placeholder="No cap" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Min pinned subtotal ৳</label>
                <Input type="number" min="0" step="0.01" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} placeholder="No floor" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Usage limit</label>
                <Input type="number" min="0" step="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="Unlimited" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Starts *</label>
                <Input type="datetime-local" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Ends *</label>
                <Input type="datetime-local" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={1000} placeholder="Shown on the public promotions page (optional)" />
            </div>

            {/* Product pinning — real catalog rows only */}
            <div className="rounded-lg border p-3 space-y-2">
              <label className="text-xs font-medium block">Pinned products * ({pinned.length} selected)</label>
              {pinned.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pinned.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {p.name}
                      <button type="button" onClick={() => setPinned((cur) => cur.filter((x) => x.id !== p.id))} aria-label={`Unpin ${p.name}`} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the catalog to pin products…" className="pl-8" aria-label="Search products to pin" />
                {searching && <Loader2 className="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              {hits.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                  {hits.map((hit) => {
                    const isPinned = pinned.some((p) => p.id === hit.id);
                    return (
                      <button
                        key={hit.id}
                        type="button"
                        onClick={() => togglePin(hit)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center justify-between gap-2 ${isPinned ? 'bg-primary/5' : ''}`}
                      >
                        <span className="truncate font-medium">{hit.name}</span>
                        <span className="shrink-0 text-muted-foreground">৳{hit.basePrice.toLocaleString()}/{hit.unit}{isPinned ? ' · pinned' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {search.trim().length >= 2 && !searching && hits.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No products matched "{search.trim()}".</p>
              )}
            </div>

            {!editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Go live immediately</p>
                  <p className="text-xs text-muted-foreground">Otherwise it is saved paused — flip it on when the window should open.</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: c })} aria-label="Go live immediately" />
              </div>
            )}
            {formError && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? 'Save changes' : 'Create campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. {deleteTarget?.computedStatus === 'live' ? 'The campaign is LIVE — buyers will stop receiving the discount immediately.' : ''} Past order receipts keep the promotion stamp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminPromotionsManager;
