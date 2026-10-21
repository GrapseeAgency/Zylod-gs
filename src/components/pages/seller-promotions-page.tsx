'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { toast } from 'sonner';
import { Plus, Tag, AlertCircle, Loader2, BarChart3, Trash2, MousePointerClick } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { campaignLabel, type StorefrontCampaign } from '@/components/supplier/storefront-campaigns';

/**
 * Task 115: THE SELLER CAMPAIGN CONSOLE — real rows from the real pricing
 * engine. Every campaign here has REAL checkout teeth (seller-funded: the
 * discount comes off this supplier's subOrder subtotal). Lifecycle status
 * is computed server-side shape + client mirror; parked campaigns stay
 * listed but visibly dormant. Deletion is refused with 409 for campaigns
 * that priced real orders — the server's words surface verbatim.
 */

type CampaignRow = StorefrontCampaign & {
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  pinnedProducts: Array<{ id: string; name: string }>;
};

interface Stats {
  total: number; live: number; scheduled: number; ended: number; paused: number; totalUses: number;
}

const EMPTY_EDIT = { name: '', value: '', validFrom: '', validUntil: '', isActive: false };

function computedStatus(r: { isActive: boolean; validFrom: string; validUntil: string }): string {
  if (!r.isActive) return 'paused';
  const now = Date.now();
  if (now < new Date(r.validFrom).getTime()) return 'scheduled';
  if (now > new Date(r.validUntil).getTime()) return 'ended';
  return 'live';
}

const STATUS_STYLES: Record<string, string> = {
  live: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  ended: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  paused: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
};

export function SellerPromotionsPage() {
  const { navigate, goBack } = useNavigationStore();
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<CampaignRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteRow, setDeleteRow] = useState<CampaignRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/supplier/promotions', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) {
        setRows(json.data ?? []);
        setStats(json.stats ?? null);
      } else {
        setError(json.error || 'Could not load campaigns');
        setRows([]);
      }
    } catch {
      setError('Could not reach the campaigns service');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (r: CampaignRow) => {
    setEditRow(r);
    const toLocal = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEditForm({
      name: r.name,
      value: String(r.value),
      validFrom: toLocal(r.validFrom),
      validUntil: toLocal(r.validUntil),
      isActive: r.isActive,
    });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        value: Number(editForm.value),
        validFrom: new Date(editForm.validFrom).toISOString(),
        validUntil: new Date(editForm.validUntil).toISOString(),
        isActive: editForm.isActive,
      };
      const res = await fetch(`/api/supplier/promotions/${editRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Campaign updated');
        setEditRow(null);
        load();
      } else {
        toast.error(json.error || 'Could not update the campaign');
      }
    } catch {
      toast.error('Could not reach the campaigns service');
    } finally {
      setEditSaving(false);
    }
  };

  const toggleActive = async (r: CampaignRow, next: boolean) => {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/supplier/promotions/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: next }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(next ? 'Campaign live — it prices orders automatically' : 'Campaign parked — buyers no longer see it');
        load();
      } else {
        toast.error(json.error || 'Could not change the campaign');
      }
    } catch {
      toast.error('Could not reach the campaigns service');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!deleteRow) return;
    setBusyId(deleteRow.id);
    try {
      const res = await fetch(`/api/supplier/promotions/${deleteRow.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || 'Campaign deleted');
        setDeleteRow(null);
        load();
      } else {
        // The 409 for priced campaigns lands here verbatim — the money
        // history must survive, the server says so in its own words.
        toast.error(json.error || 'Could not delete the campaign');
        setDeleteRow(null);
      }
    } catch {
      toast.error('Could not reach the campaigns service');
      setDeleteRow(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">Campaigns</h1>
        </div>
        <button
          onClick={() => navigate('create-promotion')}
          className="bg-white text-primary p-2 rounded-full"
          aria-label="Create campaign"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>
      <main className="flex-1 p-4 md:p-6 md:max-w-4xl md:mx-auto md:w-full pb-20 md:pb-8">
        {stats && stats.total > 0 ? (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            {([
              ['Live', stats.live],
              ['Scheduled', stats.scheduled],
              ['Paused', stats.paused],
              ['Ended', stats.ended],
              ['Uses', stats.totalUses],
              ['Total', stats.total],
            ] as Array<[string, number]>).map(([label, n]) => (
              <div key={label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-2 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">{n}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4 animate-pulse" aria-busy="true">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-800 p-6 rounded text-center shadow border border-gray-100 dark:border-gray-700">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-8 rounded text-center shadow border border-gray-100 dark:border-gray-700">
            <Tag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No campaigns yet</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              Create a campaign to discount your products automatically at checkout — the discount comes off your subOrder subtotal, and buyers see it on your store page.
            </p>
            <Button className="mt-4" onClick={() => navigate('create-promotion')}>
              <Plus className="w-4 h-4 mr-1" /> Create your first campaign
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => {
              const status = computedStatus(r);
              return (
                <div
                  key={r.id}
                  className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border ${
                    status === 'live' ? 'border-emerald-200 dark:border-emerald-900' : 'border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 dark:text-white">{r.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize ${STATUS_STYLES[status]}`}>{status}</span>
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">{campaignLabel(r)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(r.validFrom).toLocaleDateString()} → {new Date(r.validUntil).toLocaleDateString()}
                        {r.minOrderAmount ? ` · min order ৳${r.minOrderAmount.toLocaleString()}` : ''}
                        {r.maxDiscount ? ` · max discount ৳${r.maxDiscount.toLocaleString()}` : ''}
                        {r.usageLimit ? ` · limit ${r.usedCount}/${r.usageLimit}` : ' · unlimited uses'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 flex-wrap">
                        <MousePointerClick className="w-3 h-3" />
                        {r.usedCount === 0
                          ? 'No orders priced yet'
                          : `${r.usedCount} order${r.usedCount > 1 ? 's' : ''} priced under this campaign`}
                      </div>
                      {r.pinnedProducts.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.pinnedProducts.map((p) => (
                            <span key={p.id} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[11px] text-gray-600 dark:text-gray-300 max-w-[180px] truncate">
                              {p.name || p.id}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-600 mt-2">No products pinned — the campaign cannot price anything.</div>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <Switch
                        checked={r.isActive}
                        disabled={busyId === r.id}
                        onCheckedChange={(v) => toggleActive(r, v)}
                        aria-label={r.isActive ? 'Park campaign' : 'Resume campaign'}
                      />
                      <span className="text-[10px] text-gray-400">{r.isActive ? 'Live' : 'Parked'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('promotion-analytics', { id: r.id })}>
                      <BarChart3 className="w-3.5 h-3.5 mr-1" /> Analytics
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteRow(r)}
                      disabled={r.usedCount > 0}
                      title={r.usedCount > 0 ? 'Priced orders exist — park instead' : undefined}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-value">Discount value ({editRow?.type === 'fixed' ? '৳ fixed off' : '% off'})</Label>
              <Input id="edit-value" type="number" min="0" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-from">Starts</Label>
                <Input id="edit-from" type="datetime-local" value={editForm.validFrom} onChange={(e) => setEditForm({ ...editForm, validFrom: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="edit-until">Ends</Label>
                <Input id="edit-until" type="datetime-local" value={editForm.validUntil} onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-active">Live (prices orders automatically)</Label>
              <Switch id="edit-active" checked={editForm.isActive} onCheckedChange={(v) => setEditForm({ ...editForm, isActive: v })} />
            </div>
            <p className="text-[11px] text-gray-400">
              Pinned products stay as they are — create a new campaign if you need a different product set.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving || !editForm.name.trim() || !editForm.value || !editForm.validFrom || !editForm.validUntil}>
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm — honest about what stays */}
      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteRow?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the campaign and its product pins. Campaigns that have priced real orders cannot be deleted — park those instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={(e) => { e.preventDefault(); doDelete(); }}>
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SellerPromotionsPage;
