'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, Loader2, CheckCircle2, Clock, Ban, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

/**
 * Task 107: THE PAYOUT QUEUE — the admin console that actually settles
 * seller withdrawals. A request holds the amount against the seller's
 * wallet the moment it arrives (double-request is impossible); THIS console
 * decides: complete (debts the wallet inside one transaction with the
 * transfer reference on record) or reject (frees the hold, no money ever
 * moved). Decisions are terminal — the drill proves a completed payout
 * cannot be re-decided, and a completed payout cannot exist without a
 * reference.
 */

interface PayoutRow {
  id: string;
  supplierId: string;
  companyName?: string;
  amount: number;
  method: string;
  status: string;
  destination: string | null;
  reference: string | null;
  fee: number;
  processedAt: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  pendingAmount: number;
  completedAmount: number;
}

const TABS = ['pending', 'processing', 'completed', 'failed'] as const;
const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  processing: 'bg-amber-500/10 text-amber-600',
  completed: 'bg-green-500/10 text-green-600',
  failed: 'bg-rose-500/10 text-rose-600',
};

const taka = (n: number) => `৳${n.toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;

export function AdminPayoutsManager() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusTab, setStatusTab] = useState<(typeof TABS)[number]>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialog, setDialog] = useState<{ row: PayoutRow; action: 'complete' | 'reject' } | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (status?: string) => {
    try {
      const useStatus = status ?? statusTab;
      const res = await fetch(`/api/admin/payouts?status=${useStatus}`, { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setRefreshError('Admin session required — sign in again to manage payouts.');
        return;
      }
      if (!res.ok || !json?.success) {
        setRefreshError(json?.error || `Failed to load payouts (HTTP ${res.status})`);
        return;
      }
      setRows(json.data ?? []);
      setStats(json.stats ?? null);
      setRefreshError('');
    } catch {
      setRefreshError('Could not reach the payout service');
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const openDialog = (row: PayoutRow, action: 'complete' | 'reject') => {
    setDialog({ row, action });
    setReference('');
    setNote('');
    setFormError('');
  };

  const decide = async () => {
    if (!dialog) return;
    setFormError('');
    if (dialog.action === 'complete' && reference.trim().length < 3) {
      setFormError('Transfer reference is required — a settled payout with no reference is an untraceable money claim.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/payouts/${dialog.row.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: dialog.action,
          ...(dialog.action === 'complete' ? { reference: reference.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.message || (dialog.action === 'complete' ? 'Payout settled' : 'Payout rejected'));
        setDialog(null);
        load();
      } else {
        setFormError(json?.error || `Could not save the decision (HTTP ${res.status})`);
      }
    } catch {
      setFormError('Could not reach the payout service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="text-lg font-bold leading-none">{stats?.total ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Requests</div>
        </div>
        <div className="rounded-lg bg-amber-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-amber-600">{taka(stats?.pendingAmount ?? 0)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Held for review</div>
        </div>
        <div className="rounded-lg bg-green-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-green-600">{taka(stats?.completedAmount ?? 0)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Settled</div>
        </div>
        <div className="flex-1" />
      </div>
      <p className="text-xs text-muted-foreground">
        A request holds its amount against the seller&apos;s wallet the moment it arrives. Completing debits the wallet with the transfer reference on record; rejecting frees the hold — no money ever moved.
      </p>

      {/* Status tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((t) => (
          <Button
            key={t}
            variant={statusTab === t ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusTab(t)}
          >
            {t} {stats ? (t === 'pending' ? `(${stats.pending})` : t === 'processing' ? `(${stats.processing})` : t === 'completed' ? `(${stats.completed})` : `(${stats.failed})`) : ''}
          </Button>
        ))}
      </div>

      {refreshError && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
          {refreshError}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed">
          <Banknote className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <h3 className="text-sm font-semibold">No {statusTab} payouts</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            {statusTab === 'pending'
              ? 'The queue is empty — every withdrawal request has been decided.'
              : `Nothing in the ${statusTab} column yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {rows.map((p) => (
            <div key={p.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold font-mono">{taka(p.amount)}</span>
                    <Badge variant="secondary" className={`border-0 uppercase ${STATUS_BADGE[p.status] ?? ''}`}>
                      {p.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{p.method}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {p.companyName ?? p.supplierId} · {new Date(p.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {(p.status === 'pending' || p.status === 'processing') && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" className="h-8" onClick={() => openDialog(p, 'complete')}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Settle
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-destructive hover:text-destructive" onClick={() => openDialog(p, 'reject')}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                )}
                {p.status === 'completed' && p.reference && (
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">ref {p.reference}</span>
                )}
              </div>
              {p.destination && (
                <p className="text-[11px] text-muted-foreground font-mono pl-7 break-all">{p.destination}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === 'complete' ? 'Settle payout' : 'Reject payout'} · {dialog ? taka(dialog.row.amount) : ''}
            </DialogTitle>
            <DialogDescription>
              {dialog?.action === 'complete'
                ? 'The wallet is debited and the reference is stamped in the SAME transaction — money and record move together.'
                : 'The hold is freed and the row is marked failed. The wallet was never debited, so nothing needs refunding.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {dialog?.action === 'complete' && (
              <div>
                <Label className="text-xs font-medium block mb-1">Transfer reference * (TRXID / bank ref)</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={64} placeholder="e.g. TrxID 8HJ2K9LM" aria-label="Transfer reference" />
              </div>
            )}
            <div>
              <Label className="text-xs font-medium block mb-1">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Context for the audit trail" aria-label="Note" />
            </div>
            <div className="rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Destination: {dialog?.row.destination ?? dialog?.row.method}</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Decisions are terminal — a decided payout cannot be re-opened.</p>
            </div>
            {formError && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              onClick={decide}
              disabled={saving}
              className={dialog?.action === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {dialog?.action === 'complete' ? 'Settle & debit wallet' : 'Reject & free hold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminPayoutsManager;
