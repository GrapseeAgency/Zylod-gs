'use client';

/**
 * Fulfill Order — REAL two-phase dispatch against PATCH /api/supplier/orders/[id].
 *
 * Phase 1 marks the seller's subOrders 'packed' (server-guarded, real status
 * value). Phase 2 collects the tracking number and dispatches
 * { status:'shipped', trackingNumber } — both REAL subOrders columns. The
 * success screen only ever renders after a real 200; every failure shows the
 * server's verbatim error. The old courier-partner picker is gone: subOrders
 * has no courier column, and a choice that persists nothing is a fake step.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Package, Truck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface OrderInfo {
  order: { id: string; orderNumber: string } | null;
  subOrders: { id: string; status: string; trackingNumber: string | null }[];
}

export function SellerOrderFulfillmentPage() {
  const { pageParams, goBack } = useNavigationStore();
  const orderId = typeof pageParams?.orderId === 'string' ? pageParams.orderId : (typeof pageParams?.id === 'string' ? pageParams.id : '');

  const [info, setInfo] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatched, setDispatched] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError('No order was selected. Open this page from an order.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/supplier/orders/${orderId}`, { credentials: 'include' });
      if (res.status === 401) {
        setAuthRequired(true);
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(body?.error || `Could not load the order (HTTP ${res.status})`);
        return;
      }
      setInfo({ order: body.data?.order ?? null, subOrders: Array.isArray(body.data?.subOrders) ? body.data.subOrders : [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error while loading the order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const patchStatus = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/supplier/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.error || `Update failed (HTTP ${res.status})`);
        return false;
      }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const markPacked = async () => {
    if (await patchStatus({ status: 'packed' })) {
      toast.success('Marked as packed');
      void loadOrder();
    }
  };

  const dispatch = async () => {
    if (!(await patchStatus({ status: 'shipped', trackingNumber: trackingNumber.trim() }))) return;
    setDispatched(true);
    toast.success('Order dispatched — the buyer has been notified');
  };

  if (authRequired) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 max-w-sm w-full text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Supplier sign-in required</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">Sign in with a seller account to fulfill orders.</p>
          <button onClick={() => goBack()} className="min-h-11 px-6 bg-primary text-white rounded-lg font-medium w-full">
            Back
          </button>
        </div>
      </div>
    );
  }

  const statuses = info?.subOrders.map((s) => s.status) ?? [];
  const allShipped = statuses.length > 0 && statuses.every((s) => s === 'shipped' || s === 'delivered');
  const canPack = statuses.length > 0 && statuses.every((s) => s === 'pending' || s === 'confirmed');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      <header className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 sticky top-0 z-10 flex items-center">
        <button onClick={goBack} className="p-1 -ml-1 text-gray-600 dark:text-gray-400 dark:text-gray-500 mr-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Fulfill Order</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Fulfill Order</h1>

        {loading ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-20 bg-gray-100 dark:bg-gray-900 rounded" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        ) : dispatched ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Order Dispatched</h2>
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">
              Status is now <span className="font-semibold">shipped</span> with tracking number{' '}
              <span className="font-mono font-semibold">{trackingNumber}</span>. The buyer was notified and the
              tracking page updates live.
            </p>
            <div className="pt-6">
              <button onClick={goBack} className="min-h-11 w-full py-3 bg-primary text-white rounded-xl font-medium">
                Back to Order
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {info?.order && (
              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">#{info.order.orderNumber}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                  Current status: <span className="font-medium capitalize">{statuses.join(', ') || 'unknown'}</span>
                  {allShipped && ' — already shipped'}
                </p>
              </div>
            )}

            {canPack && (
              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Step 1 — Pack the order</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Confirm every item is packed and quality-checked before dispatch.</p>
                <button
                  onClick={() => void markPacked()}
                  disabled={busy}
                  className="min-h-11 w-full py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {busy ? 'Updating…' : 'Mark as Packed'}
                </button>
              </div>
            )}

            {!canPack && !allShipped && (
              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Dispatch</h2>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Air Waybill (AWB) / Tracking number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter the courier tracking number"
                    className="w-full px-3 min-h-11 bg-white dark:bg-gray-900 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                  />
                </div>
                <button
                  onClick={() => void dispatch()}
                  disabled={!trackingNumber.trim() || busy}
                  className="min-h-11 w-full py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Truck className="w-5 h-5" /> {busy ? 'Dispatching…' : 'Dispatch Order'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SellerOrderFulfillmentPage;
