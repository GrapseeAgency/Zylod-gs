'use client';

/**
 * Return Inspection (Task 175-c) — REAL hydration.
 *
 * The previous page rendered fabricated data ("Claim #RTN-5512",
 * "Order: ZYL-9923-11", "Tracking: Pth-8812399", "Item damaged in transit")
 * and the action buttons ("Approve Refund" / "Reject Claim" /
 * "Upload Inspection Photos") had NO onClick. None of those identifiers exist.
 *
 * The real rails on this return:
 *   - GET /api/returns/[id] — the authenticated buyer's or admin's view of one
 *     return request, with the real returnNumber, status, items (each with its
 *     real reason), refunds ledger, evidence photos (buyer-uploaded), and the
 *     seller receipts of the returned GOODS (Task 60-a). Sellers (this page's
 *     primary audience) reach it through the seller-order-management Returns
 *     queue which opens the same shape.
 *   - POST /api/seller/returns/[id]/confirm-receipt — the seller confirms the
 *     returned goods physically arrived back at their warehouse. THIS action
 *     (not the admin approval) restores stock/soldCount for the seller's own
 *     items. Status must be 'approved' or 'refunded'; a second receipt for the
 *     same (return, supplier) returns a real 409.
 *   - PATCH /api/admin/returns/[id] { action: 'approve'|'reject' } — ADMIN
 *     ONLY. The seller (this page's audience) cannot approve or reject a
 *     return; that is an admin-side financial decision. The buttons are
 *     honestly disabled with the reason.
 *   - POST /api/returns/[id]/evidence — BUYER ONLY (the buyer who filed the
 *     return). The seller cannot upload inspection photos through this rail;
 *     the closest seller-side artifact is the optional `note` (≤500 chars)
 *     attached to the confirm-receipt call. The Upload Inspection Photos
 *     button is honestly disabled with the reason — the seller's photos
 *     would attach to a rail that has not shipped yet.
 *
 * This page now:
 *   - reads `returnId` from pageParams (defaults to '' → honest "no return
 *     selected"),
 *   - GETs the real return via /api/returns/[id] (401-first, 404, error,
 *     Skeleton loading states),
 *   - renders the REAL returnNumber, status, items (each with its real
 *     reason and quantity), the buyer's evidence photos (read-only thumbnails
 *     of the real evidence rows), and the seller receipts already on the
 *     return (if any),
 *   - wires the Confirm Receipt button to the real POST
 *     /api/seller/returns/[id]/confirm-receipt, with an optional inspection
 *     note, and surfaces the real success / 409 / error verdict via toast,
 *   - honestly disables the Approve Refund / Reject Claim buttons (admin-only
 *     rail) and the Upload Inspection Photos button (no seller-side photo
 *     rail exists) with the real reason — no theater success.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Box,
  Check,
  X,
  Camera,
  RefreshCw,
  AlertTriangle,
  LogIn,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  RotateCcw,
  Banknote,
} from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface ReturnItem {
  id: string;
  orderItemId: string;
  reason: string;
  quantity: number;
  comments: string | null;
}
interface EvidencePhoto {
  id: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  createdAt: string;
  url: string;
}
interface SellerReceipt {
  supplierId: string;
  itemsRestored: number;
  restoredValue: number;
  note: string | null;
  receivedAt: string;
}
interface RefundRecord {
  id: string;
  amount: number;
  method: string;
  reference: string;
  status: string;
  processedAt: string;
  note: string | null;
}
interface ReturnRequest {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string | null;
  orderPaymentStatus: string | null;
  status: string;
  shippingMethod: string;
  estimatedRefund: number | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: ReturnItem[];
  refunds: RefundRecord[];
  evidencePhotos: EvidencePhoto[];
  receipts: SellerReceipt[];
  supplierCount: number;
}

type LoadState = 'loading' | 'auth' | 'notfound' | 'error' | 'ready';

const STATUS_META: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
  pending: { label: 'Pending review', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300', icon: Clock },
  approved: { label: 'Approved', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle2 },
  rejected: { label: 'Rejected', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300', icon: XCircle },
  refunded: { label: 'Refunded', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle2 },
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function ReturnClaimDetailPage() {
  const { goBack, navigate, pageParams } = useNavigationStore();
  const token = useAuthStore((s) => s.token);
  const returnId = pageParams?.returnId || pageParams?.id || '';

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [ret, setRet] = useState<ReturnRequest | null>(null);

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('Return inspection requires a signed-in seller account. Sign in to view this return.');
      return;
    }
    if (!returnId) {
      setState('notfound');
      setLoadError('No return selected. Open a return from your seller Returns queue to inspect it here.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const res = await fetch(`/api/returns/${encodeURIComponent(returnId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'You do not have access to this return request.');
        return;
      }
      if (res.status === 404) {
        setState('notfound');
        setLoadError(json?.error || 'Return request not found.');
        return;
      }
      if (!res.ok || !json?.success || !json?.data) {
        setState('error');
        setLoadError(json?.error || `Failed to load return (HTTP ${res.status})`);
        return;
      }
      setRet(json.data as ReturnRequest);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading the return. Check your connection and retry.');
    }
  }, [token, returnId]);

  useEffect(() => {
    load();
  }, [load]);

  /** The seller confirms the returned goods physically arrived back at their
   *  warehouse — POST /api/seller/returns/[id]/confirm-receipt. The API is the
   *  source of truth; the toast reports its real numbers (itemsRestored,
   *  restoredValue, subOrdersMarkedReturned). Honest 409 / 400 / 500 surfaced. */
  const confirmReceipt = useCallback(async () => {
    if (!ret) return;
    if (!token) {
      toast.error('Sign in required', { description: 'Confirming receipt requires a seller session.' });
      return;
    }
    setSubmitting(true);
    try {
      const trimmed = note.trim().slice(0, 500);
      const res = await fetch(
        `/api/seller/returns/${encodeURIComponent(ret.id)}/confirm-receipt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include',
          body: JSON.stringify(trimmed ? { note: trimmed } : {}),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          toast.error(body?.error || 'Not authorized', {
            description: 'Confirming receipt is a seller action. Sign in with your supplier account.',
          });
        } else if (res.status === 404) {
          toast.error(body?.error || 'Return not found', {
            description: 'This return does not touch any of your order lines.',
          });
        } else if (res.status === 409) {
          toast.error(body?.error || 'Receipt not allowed', {
            description:
              'The return is not approved yet, or you already confirmed receipt of these goods.',
          });
        } else {
          toast.error(body?.error || `Could not confirm receipt (HTTP ${res.status})`);
        }
        return;
      }
      const d = body?.data;
      toast.success(body?.message || 'Receipt confirmed', {
        description: d
          ? `${d.itemsRestored} item line(s) restored · ৳${d.restoredValue} value${
              d.subOrdersMarkedReturned?.length ? ` · ${d.subOrdersMarkedReturned.length} shipment(s) marked returned` : ''
            }`
          : undefined,
      });
      setNote('');
      void load();
    } catch {
      toast.error('Network error while confirming receipt');
    } finally {
      setSubmitting(false);
    }
  }, [ret, token, note, load]);

  /* ─── Loading skeleton ─── */
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24 md:pb-10">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-4 md:max-w-3xl md:mx-auto md:pt-8 space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  /* ─── Auth / notfound / error ─── */
  if (state === 'auth' || state === 'notfound' || state === 'error') {
    const showSignIn = state === 'auth';
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24 md:pb-10">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={goBack}
            aria-label="Go back"
            className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Return Inspection</h1>
        </div>
        <div className="p-4 md:max-w-3xl md:mx-auto md:pt-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
            <AlertTriangle
              className={
                state === 'notfound'
                  ? 'w-8 h-8 text-gray-400 mx-auto'
                  : state === 'auth'
                    ? 'w-8 h-8 text-amber-500 mx-auto'
                    : 'w-8 h-8 text-rose-500 mx-auto'
              }
            />
            <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {showSignIn && (
                <button
                  onClick={() => navigate('login')}
                  className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" /> Sign in
                </button>
              )}
              <button
                onClick={load}
                className="min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ret) return null;

  const statusMeta = STATUS_META[ret.status] || {
    label: ret.status,
    tone: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    icon: Clock,
  };
  const StatusIcon = statusMeta.icon;

  // Confirm-receipt is only legal when the return is approved or refunded.
  const canConfirmReceipt = ret.status === 'approved' || ret.status === 'refunded';
  // Has the seller already confirmed? Show the receipt(s) as read-only state.
  const alreadyReceived = ret.receipts.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 dark:bg-gray-950 pb-[calc(var(--bottom-nav-h)+180px)] md:pb-10"
    >
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 sticky top-0 z-10 flex items-center md:px-6 md:max-w-3xl md:mx-auto">
        <button
          onClick={goBack}
          aria-label="Go back"
          className="md:hidden p-1 -ml-1 min-h-11 min-w-11 flex items-center justify-center text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">Return Inspection</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate">
            Claim <span className="font-mono">{ret.returnNumber}</span>
          </p>
        </div>
      </header>

      <div className="p-4 space-y-4 md:p-6 md:max-w-3xl md:mx-auto">
        {/* Status banner */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${statusMeta.tone}`}
              >
                <StatusIcon className="w-3.5 h-3.5" /> {statusMeta.label}
              </span>
            </div>
            {ret.orderNumber && (
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Order <span className="font-mono text-gray-700 dark:text-gray-300">{ret.orderNumber}</span>
              </p>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-2">
            Filed {new Date(ret.createdAt).toLocaleString()}
            {ret.resolvedAt && (
              <> · Resolved {new Date(ret.resolvedAt).toLocaleString()}</>
            )}
          </p>
          {ret.resolutionNote && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-lg">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Resolution note</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed">{ret.resolutionNote}</p>
            </div>
          )}
        </div>

        {/* Returned items */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Box className="w-4 h-4 text-primary" /> Returned Items
          </h2>
          {ret.items.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">No items on this return.</p>
          ) : (
            <ul className="space-y-2">
              {ret.items.map((it) => (
                <li
                  key={it.id}
                  className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      Line {it.orderItemId.slice(-8)}
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      Qty {it.quantity}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{it.reason}</p>
                  {it.comments && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 mt-1 italic">“{it.comments}”</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {ret.estimatedRefund != null && (
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              Estimated refund: <span className="font-bold text-primary">৳{ret.estimatedRefund}</span>
            </p>
          )}
        </div>

        {/* Buyer's evidence photos (read-only for the seller) */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" /> Buyer Evidence
          </h2>
          {ret.evidencePhotos.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              The buyer attached no evidence photos to this return.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ret.evidencePhotos.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                  title={p.note || `${p.mimeType} · ${formatBytes(p.sizeBytes)}`}
                >
                  <img
                    src={p.url}
                    alt={p.note || 'evidence photo'}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Refunds ledger (read-only — recorded by admins) */}
        {ret.refunds.length > 0 && (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-primary" /> Recorded Refunds
            </h2>
            <ul className="space-y-2">
              {ret.refunds.map((r) => (
                <li
                  key={r.id}
                  className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-gray-900 dark:text-gray-100">৳{r.amount}</span>
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">{r.method}</span>
                  </div>
                  {r.reference && (
                    <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 font-mono">{r.reference}</p>
                  )}
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    {r.status} · {new Date(r.processedAt).toLocaleString()}
                  </p>
                  {r.note && <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500 italic">{r.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Seller receipts of returned goods (read-only state if already confirmed) */}
        {alreadyReceived && (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Receipt Confirmed
            </h2>
            <ul className="space-y-2">
              {ret.receipts.map((rc, i) => (
                <li
                  key={`${rc.supplierId}-${i}`}
                  className="p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      {rc.itemsRestored} item line(s) restored
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">৳{rc.restoredValue}</span>
                  </div>
                  <p className="text-emerald-700 dark:text-emerald-400">
                    Received {new Date(rc.receivedAt).toLocaleString()}
                  </p>
                  {rc.note && <p className="text-emerald-800 dark:text-emerald-300 italic">{rc.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Inspection note + Confirm Receipt action */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" /> Confirm Receipt of Returned Goods
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-relaxed">
            Confirming receipt is what restores stock for your items on this return — the API is the source of truth.
            The action is only allowed when the return status is <span className="font-medium">approved</span> or{' '}
            <span className="font-medium">refunded</span> (goods only travel back after approval).
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            disabled={!canConfirmReceipt || alreadyReceived || submitting}
            placeholder="Optional inspection note (max 500 chars) — included on the receipt audit row."
            className="w-full min-h-20 px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={confirmReceipt}
            disabled={!canConfirmReceipt || alreadyReceived || submitting}
            className="w-full min-h-12 py-3 bg-primary text-white rounded-xl font-medium flex justify-center items-center gap-2 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:disabled:text-gray-400 dark:text-gray-500"
          >
            <Check className="w-5 h-5" />
            {submitting ? 'Confirming…' : alreadyReceived ? 'Already confirmed' : 'Confirm Receipt'}
          </button>
          {!canConfirmReceipt && !alreadyReceived && (
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              This return is currently <span className="font-medium">{statusMeta.label.toLowerCase()}</span> — goods
              can only be received back after the return is approved.
            </p>
          )}
        </div>

        {/* Honestly disabled actions — admin-only rails / no seller-side photo rail */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Review Actions</h3>

          <button
            disabled
            aria-label="Approve refund is admin-only — seller console cannot move money"
            className="w-full min-h-12 py-3 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 text-gray-400 dark:text-gray-500 dark:text-gray-400 rounded-xl font-medium flex justify-center items-center gap-2 cursor-not-allowed"
          >
            <Check className="w-5 h-5" /> Approve Refund
          </button>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed -mt-2">
            Refund approval is an admin-only action (PATCH /api/admin/returns/[id]). The seller console cannot move
            money or flip a return to refunded — that is the admin finance team's job.
          </p>

          <button
            disabled
            aria-label="Reject claim is admin-only — seller console cannot reject a buyer return"
            className="w-full min-h-12 py-3 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 text-gray-400 dark:text-gray-500 dark:text-gray-400 rounded-xl font-medium flex justify-center items-center gap-2 cursor-not-allowed"
          >
            <X className="w-5 h-5" /> Reject Claim
          </button>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed -mt-2">
            Rejecting a return is an admin-only action (PATCH /api/admin/returns/[id] with action=reject). The seller
            console cannot reject a buyer's return claim.
          </p>

          <button
            disabled
            aria-label="Seller-side inspection photo upload is not yet shipped — only buyer evidence is supported"
            className="w-full min-h-12 py-3 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 text-gray-400 dark:text-gray-500 dark:text-gray-400 rounded-xl font-medium flex justify-center items-center gap-2 cursor-not-allowed"
          >
            <Camera className="w-5 h-5" /> Upload Inspection Photos
          </button>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed -mt-2">
            No seller-side inspection-photo rail has shipped yet. The buyer's evidence (shown above) is the only photo
            trail on a return; the seller's inspection notes ride on the confirm-receipt call as text. A dedicated
            seller photo upload will appear here when its rail ships.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default ReturnClaimDetailPage;
