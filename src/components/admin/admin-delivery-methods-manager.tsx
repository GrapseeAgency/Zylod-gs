'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Truck, Plus, Pencil, Trash2, Loader2, Plane, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Task 108: CHECKOUT COURIERS — the writer for the rail the buyer checkout
 * has fetched since day one (/api/delivery-methods). Curated courier
 * options with a flat displayed price; the icons are exactly the three the
 * checkout pages render (truck/plane/store — an invented glyph would render
 * blank). Parking removes the option from buyers while the console keeps
 * the row. Note: this displayed price is INFORMATION for the buyer's
 * courier choice — the order's charged shipping comes from the Task-95
 * quote engine, and the server re-quotes at order time.
 */

interface DeliveryMethodRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  estimatedDelivery: string | null;
  badge: string | null;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

const ICONS = [
  { id: 'truck', label: 'Truck (road)' },
  { id: 'plane', label: 'Plane (air)' },
  { id: 'store', label: 'Store (pickup)' },
] as const;

const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  truck: Truck,
  plane: Plane,
  store: Store,
};

const EMPTY_FORM = { name: '', description: '', price: '0', estimatedDelivery: '', badge: '', icon: 'truck', isActive: true, sortOrder: '0' };

const taka = (n: number) => `৳${n.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

export function AdminDeliveryMethodsManager() {
  const [rows, setRows] = useState<DeliveryMethodRow[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; inactive: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DeliveryMethodRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryMethodRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/delivery-methods', { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setRefreshError('Admin session required — sign in again to manage checkout couriers.');
        return;
      }
      if (!res.ok || !json?.success) {
        setRefreshError(json?.error || `Failed to load delivery methods (HTTP ${res.status})`);
        return;
      }
      setRows(json.data ?? []);
      setStats(json.stats ?? null);
      setRefreshError('');
    } catch {
      setRefreshError('Could not reach the delivery methods service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (r: DeliveryMethodRow) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? '',
      price: String(r.price),
      estimatedDelivery: r.estimatedDelivery ?? '',
      badge: r.badge ?? '',
      icon: r.icon,
      isActive: r.isActive,
      sortOrder: String(r.sortOrder),
    });
    setFormError('');
    setDialogOpen(true);
  };

  const save = async () => {
    setFormError('');
    const price = Number(form.price);
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!Number.isFinite(price) || price < 0) { setFormError('Price must be a non-negative number.'); return; }
    const sortOrder = Number(form.sortOrder) || 0;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        ...(form.description.trim() ? { description: form.description } : { description: null }),
        price,
        ...(form.estimatedDelivery.trim() ? { estimatedDelivery: form.estimatedDelivery } : { estimatedDelivery: null }),
        ...(form.badge.trim() ? { badge: form.badge } : { badge: null }),
        icon: form.icon,
        isActive: form.isActive,
        sortOrder,
      };
      const res = await fetch(editing ? `/api/admin/delivery-methods/${editing.id}` : '/api/admin/delivery-methods', {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if ((res.status === 200 || res.status === 201) && json?.success) {
        toast.success(editing ? 'Courier updated' : json.data.isActive ? 'Courier live at checkout' : 'Courier saved — parked');
        setDialogOpen(false);
        setEditing(null);
        load();
      } else {
        setFormError(json?.error || `Could not save (HTTP ${res.status})`);
      }
    } catch {
      setFormError('Could not reach the delivery methods service');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: DeliveryMethodRow) => {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/admin/delivery-methods/${r.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.data.isActive ? 'Live — buyers can choose it at checkout' : 'Parked — checkout no longer offers it');
        load();
      } else {
        toast.error(json?.error || `Could not update (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the delivery methods service');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await fetch(`/api/admin/delivery-methods/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Courier deleted');
        load();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || `Could not delete (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the delivery methods service');
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="text-lg font-bold leading-none">{stats?.total ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Couriers</div>
        </div>
        <div className="rounded-lg bg-green-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-green-600">{stats?.active ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Live</div>
        </div>
        <div className="rounded-lg bg-amber-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-amber-600">{stats?.inactive ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Parked</div>
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New courier
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The courier options buyers choose from on the delivery page. The price shown here is the buyer&apos;s courier information — the order&apos;s charged shipping is quoted by the zone/weight price book and re-checked server-side at order time.
      </p>

      {refreshError && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
          {refreshError}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed">
          <Truck className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <h3 className="text-sm font-semibold">No couriers configured</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Checkout honestly shows an empty delivery page until the first courier is added here.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Add the first courier
          </Button>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {rows.map((r) => {
            const Icon = ICON_COMPONENTS[r.icon] ?? Truck;
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold truncate">{r.name}</h4>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      r.isActive ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {r.isActive ? 'Live' : 'Parked'}
                    </span>
                    {r.badge && (
                      <Badge variant="secondary" className="text-[10px]">{r.badge}</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {taka(r.price)}{r.estimatedDelivery ? ` · est. ${r.estimatedDelivery}` : ''}{r.description ? ` · ${r.description}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={r.isActive}
                    disabled={busyId === r.id}
                    onCheckedChange={() => toggleActive(r)}
                    aria-label={`${r.isActive ? 'Park' : 'Activate'} ${r.name}`}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} aria-label={`Edit ${r.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r)} aria-label={`Delete ${r.name}`}>
                    {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit courier' : 'New courier'}</DialogTitle>
            <DialogDescription>
              Buyers see live couriers on the delivery page in the order below. Parking one removes it from checkout without deleting the row.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium block mb-1">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} placeholder="e.g. Sundarban Courier" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium block mb-1">Displayed price (৳) *</Label>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} aria-label="Displayed price" />
              </div>
              <div>
                <Label className="text-xs font-medium block mb-1">Estimated delivery</Label>
                <Input value={form.estimatedDelivery} onChange={(e) => setForm({ ...form, estimatedDelivery: e.target.value })} maxLength={60} placeholder="2-4 days" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium block mb-1">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} placeholder="Doorstep delivery with tracking" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium block mb-1">Icon</Label>
                <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Icon">
                  {ICONS.map((ic) => <option key={ic.id} value={ic.id}>{ic.id}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-medium block mb-1">Badge</Label>
                <Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} maxLength={40} placeholder="Fastest" />
              </div>
              <div>
                <Label className="text-xs font-medium block mb-1">Sort order</Label>
                <Input type="number" min="0" max="9999" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} aria-label="Sort order" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Live at checkout</p>
                <p className="text-xs text-muted-foreground">Off = parked; buyers never see it.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: c })} aria-label="Live at checkout" />
            </div>
            {formError && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? 'Save changes' : 'Create courier'}
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
              This cannot be undone — buyers lose the option immediately.
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

export default AdminDeliveryMethodsManager;
