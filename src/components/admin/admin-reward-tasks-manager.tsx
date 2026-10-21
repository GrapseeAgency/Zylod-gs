'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Gift, Plus, Pencil, Trash2, Loader2, ShoppingBag, Star, Heart, Package, Milestone, Sparkles, Flame } from 'lucide-react';
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
 * Task 111: REWARD TASKS — the writer for the rail the buyer "Earn Free
 * Vouchers" page has fetched since day one (/api/coupons/earn). A task is
 * money: the server PROVES completion from the buyer's real rows before a
 * voucher exists, so this console may only mint server-verifiable types —
 * share / referral / review_photo are refused by the API with the honest
 * reason (no proof source → a reward on them would be a money printer).
 */

interface RewardTaskRow {
  id: string;
  type: string;
  title: string;
  description: string;
  rewardLabel: string;
  rewardBDT: number;
  iconColor: string;
  targetCount: number;
  isActive: boolean;
  sortOrder: number;
  claimCount: number;
}

const TYPES = [
  { id: 'first_order', label: 'First order', rule: 'Buyer has ≥ 1 order (cancelled/returned never count)' },
  { id: 'review', label: 'Review written', rule: 'Buyer has ≥ 1 verified-purchase supplier review' },
  { id: 'wishlist', label: 'Wishlist added', rule: 'Buyer has ≥ 1 product wishlisted' },
  { id: 'bulk', label: 'Bulk line', rule: 'Buyer has a single order line with quantity ≥ target' },
  { id: 'milestone', label: 'Order milestone', rule: 'Buyer has ≥ target orders' },
  { id: 'spin', label: 'Winning spin', rule: 'Buyer has ≥ 1 winning spin (not "try again")' },
  { id: 'checkin', label: 'Daily check-in', rule: 'Buyer has ≥ target daily check-ins' },
] as const;

const TYPE_RULES: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.id, t.rule]));

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  first_order: ShoppingBag,
  review: Star,
  wishlist: Heart,
  bulk: Package,
  milestone: Milestone,
  spin: Sparkles,
  checkin: Flame,
};

const EMPTY_FORM = { type: 'first_order', title: '', description: '', rewardLabel: '', rewardBDT: '0', targetCount: '1', isActive: true, sortOrder: '0' };

const taka = (n: number) => `৳${n.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

export function AdminRewardTasksManager() {
  const [rows, setRows] = useState<RewardTaskRow[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; parked: number; totalClaims: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RewardTaskRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RewardTaskRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reward-tasks', { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setRefreshError('Admin session required — sign in again to manage reward tasks.');
        return;
      }
      if (!res.ok || !json?.success) {
        setRefreshError(json?.error || `Failed to load reward tasks (HTTP ${res.status})`);
        return;
      }
      setRows(json.data ?? []);
      setStats(json.stats ?? null);
      setRefreshError('');
    } catch {
      setRefreshError('Could not reach the reward tasks service');
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

  const openEdit = (r: RewardTaskRow) => {
    setEditing(r);
    setForm({
      type: r.type,
      title: r.title,
      description: r.description,
      rewardLabel: r.rewardLabel,
      rewardBDT: String(r.rewardBDT),
      targetCount: String(r.targetCount),
      isActive: r.isActive,
      sortOrder: String(r.sortOrder),
    });
    setFormError('');
    setDialogOpen(true);
  };

  const save = async () => {
    setFormError('');
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.description.trim()) { setFormError('Description is required — buyers read it on the earn page.'); return; }
    if (!form.rewardLabel.trim()) { setFormError('Reward label is required (e.g. "৳50 OFF").'); return; }
    const rewardBDT = Number(form.rewardBDT);
    if (!Number.isFinite(rewardBDT) || rewardBDT < 0 || rewardBDT > 10000) { setFormError('Reward must be between ৳0 and ৳10000.'); return; }
    const targetCount = Number(form.targetCount);
    if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 1000) { setFormError('Target must be a whole number between 1 and 1000.'); return; }
    const sortOrder = Number(form.sortOrder) || 0;
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        title: form.title,
        description: form.description,
        rewardLabel: form.rewardLabel,
        rewardBDT,
        targetCount,
        isActive: form.isActive,
        sortOrder,
      };
      const res = await fetch(editing ? `/api/admin/reward-tasks/${editing.id}` : '/api/admin/reward-tasks', {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if ((res.status === 200 || res.status === 201) && json?.success) {
        toast.success(editing ? 'Reward task updated' : form.isActive ? 'Reward task live on the earn page' : 'Reward task saved — parked');
        setDialogOpen(false);
        setEditing(null);
        load();
      } else {
        setFormError(json?.error || `Could not save (HTTP ${res.status})`);
      }
    } catch {
      setFormError('Could not reach the reward tasks service');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: RewardTaskRow) => {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/admin/reward-tasks/${r.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.data.isActive ? 'Live — buyers can claim it' : 'Parked — no longer offered to buyers');
        load();
      } else {
        toast.error(json?.error || `Could not update (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the reward tasks service');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await fetch(`/api/admin/reward-tasks/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Reward task deleted — vouchers already earned stay in buyer vaults');
        load();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || `Could not delete (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the reward tasks service');
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
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tasks</div>
        </div>
        <div className="rounded-lg bg-green-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-green-600">{stats?.active ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Live</div>
        </div>
        <div className="rounded-lg bg-amber-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-amber-600">{stats?.parked ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Parked</div>
        </div>
        <div className="rounded-lg bg-red-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-red-600">{stats?.totalClaims ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Claims</div>
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New reward task
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Buyers see live tasks on the Earn Free Vouchers page. A claim only pays when the server has counted the buyer&apos;s real actions — orders, reviews, wishlists, check-ins, winning spins, bulk lines — so only server-verifiable task types can be created here.
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
          <Gift className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <h3 className="text-sm font-semibold">No reward tasks yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            The earn page honestly shows nothing until the first task is added here.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Add the first reward task
          </Button>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {rows.map((r) => {
            const Icon = TYPE_ICONS[r.type] ?? Gift;
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold truncate">{r.title}</h4>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      r.isActive ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {r.isActive ? 'Live' : 'Parked'}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">{r.rewardLabel}</Badge>
                    {r.claimCount > 0 && (
                      <Badge variant="outline" className="text-[10px]">{r.claimCount} claimed</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {taka(r.rewardBDT)} · target {r.targetCount} · {TYPE_RULES[r.type] ?? r.type}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={r.isActive}
                    disabled={busyId === r.id}
                    onCheckedChange={() => toggleActive(r)}
                    aria-label={`${r.isActive ? 'Park' : 'Activate'} ${r.title}`}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} aria-label={`Edit ${r.title}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r)} aria-label={`Delete ${r.title}`}>
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
            <DialogTitle>{editing ? 'Edit reward task' : 'New reward task'}</DialogTitle>
            <DialogDescription>
              A task is money: the server counts the buyer&apos;s real actions before the voucher exists. Pick a type the platform can prove.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium block mb-1">Task type *</Label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} disabled={!!editing} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Task type">
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">{TYPE_RULES[form.type]}</p>
            </div>
            <div>
              <Label className="text-xs font-medium block mb-1">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder="e.g. Place your first wholesale order" />
            </div>
            <div>
              <Label className="text-xs font-medium block mb-1">Description *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} placeholder="Shown on the earn page — what the buyer needs to do" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium block mb-1">Reward label *</Label>
                <Input value={form.rewardLabel} onChange={(e) => setForm({ ...form, rewardLabel: e.target.value })} maxLength={40} placeholder="৳50 OFF" />
              </div>
              <div>
                <Label className="text-xs font-medium block mb-1">Reward (৳)</Label>
                <Input type="number" min="0" max="10000" step="1" value={form.rewardBDT} onChange={(e) => setForm({ ...form, rewardBDT: e.target.value })} aria-label="Reward amount" />
              </div>
              <div>
                <Label className="text-xs font-medium block mb-1">Target</Label>
                <Input type="number" min="1" max="1000" step="1" value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: e.target.value })} aria-label="Target count" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium block mb-1">Sort order</Label>
                <Input type="number" min="0" max="9999" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} aria-label="Sort order" />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Live</p>
                  <p className="text-xs text-muted-foreground">Off = parked.</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: c })} aria-label="Live" />
              </div>
            </div>
            {formError && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Vouchers already earned keep existing in buyer vaults — the deletion is audit-stamped with how many claims were live.
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

export default AdminRewardTasksManager;
