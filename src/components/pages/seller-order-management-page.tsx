'use client';

/**
 * Seller Order Management — REAL subOrder list + LIVE order feed.
 *
 * Data: GET /api/supplier/orders (real subOrders for the session supplier,
 * real lowercase schema statuses, buyer display names only). Tabs map to the
 * REAL subOrder status values — unknown filters return the full list, so the
 * tabs here send exactly the API's valid values.
 *
 * Live: subscribes to the seller:<supplierProfileId> socket room via
 * useRealtimeRoom + GET /api/realtime/room-token. The supplierProfile id
 * comes from GET /api/profile/me (its projection exposes it since Task 51).
 * On a real order:new event the list refetches and a toast fires — no
 * fabricated rows are ever inserted client-side.
 *
 * Actions are real or absent: Accept Order PATCHes {status:'confirmed'}
 * (server-guarded), Reject navigates to the real cancellation page, Book
 * Courier navigates to the real fulfillment page. Export CSV exports the
 * orders ACTUALLY loaded in this view — client-side, no fake totals.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Search, Download, Package, Calendar, Radio, Wallet, ChevronDown, ChevronUp, Check, X, Hourglass, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { useRealtimeRoom, type RealtimeRoomMessage } from '@/hooks/use-realtime-room';

/** REAL subOrders.status values (prisma/schema.prisma — Task 51-a contract). */
const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
];

const STATUS_CHIP: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  packed: 'bg-purple-100 text-purple-700',
  shipped: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  returned: 'bg-gray-200 text-gray-700',
};

/** REAL returnRequests.status values (prisma/schema.prisma — Task 59-a). */
const RETURN_STATUS_CHIP: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  refunded: 'bg-emerald-100 text-emerald-700',
};

interface SupplierOrderRow {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  buyerCompanyName: string;
  buyerName: string;
  moqPackCount: number;
  totalAmount: number;
  items: { name: string; imageUrl: string | null; quantity: number; price: number; unit: string | null }[];
}

/** Real row shape of GET /api/seller/returns (Task 59-a). */
interface SellerReturnRow {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string | null;
  orderPaymentStatus: string | null;
  status: string;
  shippingMethod: string;
  estimatedRefund: number;
  sellerShare: number;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  items: {
    id: string;
    productName: string | null;
    unit: string | null;
    variant: string | null;
    quantity: number;
    orderedQuantity: number | null;
    reason: string;
    comments: string | null;
    estimatedItemValue: number;
  }[];
}

/** Real row shape of GET /api/seller/payments (Task 56-b). */
interface SellerPaymentRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  orderPaymentStatus: string;
  method: string;
  amount: number;
  status: string;
  transactionId: string | null;
  brand: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  itemCount: number;
  itemSummary: string[];
}

export function SellerOrderManagementPage() {
  const { navigate } = useNavigationStore();
  const [orders, setOrders] = useState<SupplierOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sellerRoom, setSellerRoom] = useState<string | null>(null);

  // ── Payment-verification inbox (Task 56-b manual leg) ──────────────────
  const [payments, setPayments] = useState<SellerPaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(true);
  const [verifyNotes, setVerifyNotes] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // ── Returns queue (Task 59-a — the seller leg of the real returns flow) ─
  const [returns, setReturns] = useState<SellerReturnRow[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(true);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [returnsOpen, setReturnsOpen] = useState(true);

  const fetchOrders = useCallback(async (tab: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/supplier/orders?status=${encodeURIComponent(tab)}`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        setAuthRequired(true);
        setOrders([]);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed to load orders (HTTP ${res.status})`);
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error while loading orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Session seller room id — from the real profile projection (no fabrication).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile/me', { credentials: 'include' });
        if (!res.ok) return; // signed out → no live feed, honest
        const data = await res.json();
        const id = data?.data?.supplierProfile?.id;
        if (!cancelled && typeof id === 'string' && id.length > 0) setSellerRoom(`seller:${id}`);
      } catch {
        /* profile fetch failed — live feed stays off, list still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const res = await fetch('/api/seller/payments?status=pending', { credentials: 'include' });
      if (res.status === 401) {
        setPaymentsError('Sign in to see payment requests.');
        setPayments([]);
        return;
      }
      if (res.status === 403) {
        // No supplier profile — the section hides itself (nothing to verify).
        setPayments([]);
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setPaymentsError(body?.error || `Failed to load payment requests (HTTP ${res.status})`);
        setPayments([]);
        return;
      }
      setPayments(Array.isArray(body.data) ? body.data : []);
    } catch {
      setPaymentsError('Network error while loading payment requests');
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  const fetchReturns = useCallback(async () => {
    setReturnsLoading(true);
    setReturnsError(null);
    try {
      const res = await fetch('/api/seller/returns', { credentials: 'include' });
      if (res.status === 401) {
        setReturnsError('Sign in to see return requests.');
        setReturns([]);
        return;
      }
      if (res.status === 403) {
        // No supplier profile — the section hides itself (no goods to return).
        setReturns([]);
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setReturnsError(body?.error || `Failed to load return requests (HTTP ${res.status})`);
        setReturns([]);
        return;
      }
      setReturns(Array.isArray(body.data) ? body.data : []);
    } catch {
      setReturnsError('Network error while loading return requests');
      setReturns([]);
    } finally {
      setReturnsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReturns();
  }, [fetchReturns]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const verifyPayment = useCallback(
    async (paymentId: string, action: 'verify' | 'reject') => {
      setVerifyingId(paymentId);
      try {
        const note = (verifyNotes[paymentId] || '').trim();
        const res = await fetch(`/api/seller/payments/${encodeURIComponent(paymentId)}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(note ? { action, note } : { action }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(body?.error || `Could not ${action} the payment (HTTP ${res.status})`);
          return;
        }
        const d = body?.data;
        toast.success(
          action === 'verify'
            ? `Payment verified — order is now ${d?.orderPaymentStatus ?? 'updated'}`
            : 'Payment rejected — the submission was marked failed',
          {
            description:
              action === 'verify' && d
                ? `৳${d.amountPaid} recorded against an order total of ৳${d.orderTotal}.`
                : undefined,
          }
        );
        setVerifyNotes((prev) => {
          const next = { ...prev };
          delete next[paymentId];
          return next;
        });
        void fetchPayments();
        void fetchOrders(activeTabRef.current);
      } catch {
        toast.error('Network error while verifying the payment');
      } finally {
        setVerifyingId(null);
      }
    },
    [verifyNotes, fetchPayments, fetchOrders]
  );

  const onLiveEvent = useCallback(
    (message: RealtimeRoomMessage) => {
      if (message.event === 'order:new') {
        toast('New order received', { description: 'The list below has been refreshed.' });
        void fetchOrders(activeTabRef.current);
      }
      if (message.event === 'payment:submitted') {
        toast('New payment request received', { description: 'A buyer submitted a payment reference — verify it below.' });
        void fetchPayments();
      }
      if (message.event === 'payment:verified' || message.event === 'payment:rejected') {
        void fetchPayments();
      }
      if (message.event === 'return:new') {
        toast('New return request received', { description: 'A buyer filed a return that touches your goods — see the Returns queue.' });
        void fetchReturns();
      }
    },
    [fetchOrders, fetchPayments, fetchReturns]
  );

  const { connected } = useRealtimeRoom(sellerRoom ? [sellerRoom] : [], {
    onEvent: onLiveEvent,
    enabled: Boolean(sellerRoom),
  });

  useEffect(() => {
    void fetchOrders(activeTab);
  }, [activeTab, fetchOrders]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.buyerName?.toLowerCase().includes(q) ||
        o.buyerCompanyName?.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const acceptOrder = async (subOrderId: string) => {
    try {
      const res = await fetch(`/api/supplier/orders/${subOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'confirmed' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || `Could not confirm order (HTTP ${res.status})`);
        return;
      }
      toast.success('Order confirmed');
      void fetchOrders(activeTabRef.current);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error');
    }
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error('No orders in this view to export');
      return;
    }
    const header = 'Order Number,Date,Status,Payment,Buyer,Items,Total BDT';
    const rows = filtered.map((o) => {
      const cells = [
        o.orderNumber,
        o.createdAt,
        o.status,
        o.paymentStatus,
        o.buyerCompanyName,
        String(o.items?.length ?? 0),
        String(o.totalAmount),
      ];
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
    });
    const blob = new Blob([`\uFEFF${header}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zylod-orders-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} orders`);
  };

  if (authRequired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm w-full text-center">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Supplier sign-in required</h2>
          <p className="text-sm text-gray-500 mb-4">Sign in with a seller account to view your orders.</p>
          <button
            onClick={() => navigate('login')}
            className="min-h-11 px-6 bg-[#C8102E] text-white rounded-lg font-medium w-full"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          Order Management
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
              connected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}
            title={connected ? 'Live order feed connected' : 'Live feed offline'}
          >
            <Radio className="w-3 h-3" /> {connected ? 'Live' : 'Offline'}
          </span>
        </h1>
        <button
          onClick={exportCsv}
          className="min-h-11 text-[#C8102E] font-medium text-sm flex items-center gap-1"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto hide-scrollbar px-2">
          {[{ value: 'all', label: 'All' }, ...STATUS_TABS].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`min-h-11 px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.value
                  ? 'border-[#C8102E] text-[#C8102E]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── Payment requests (Task 56-b) — real pending submissions ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setPaymentsOpen((o) => !o)}
            className="min-h-11 w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Wallet className="w-4 h-4 text-[#C8102E]" />
              Payment requests
              {payments.length > 0 && (
                <span className="text-xs bg-[#C8102E] text-white px-2 py-0.5 rounded-full font-medium">{payments.length} pending</span>
              )}
            </span>
            {paymentsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {paymentsOpen && (
            <div className="px-4 pb-4 space-y-3">
              {paymentsError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-3">{paymentsError}</div>
              )}
              {paymentsLoading ? (
                <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ) : payments.length === 0 && !paymentsError ? (
                <p className="text-xs text-gray-400 py-2">No pending payment submissions right now.</p>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">#{p.orderNumber}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {p.itemCount > 0 ? `${p.itemSummary.join(', ')}${p.itemCount > p.itemSummary.length ? '…' : ''}` : 'Items on order'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[#C8102E]">৳{p.amount?.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">of ৳{p.orderTotal?.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 capitalize">
                        {p.method}{p.brand ? ` · ${p.brand}` : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 font-mono">{p.transactionId || '--'}</span>
                      {p.submittedAt && (
                        <span className="text-gray-400 flex items-center gap-1">
                          <Hourglass className="w-3 h-3" /> {format(new Date(p.submittedAt), 'MMM dd, HH:mm')}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={verifyNotes[p.id] || ''}
                        onChange={(e) => setVerifyNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="Verification note (optional)"
                        className="flex-1 min-h-11 px-3 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent"
                        maxLength={500}
                      />
                      <div className="grid grid-cols-2 gap-2 sm:w-56">
                        <button
                          disabled={verifyingId === p.id}
                          onClick={() => void verifyPayment(p.id, 'reject')}
                          className="min-h-11 py-2 px-3 bg-white border border-red-300 text-red-700 text-xs font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          disabled={verifyingId === p.id}
                          onClick={() => void verifyPayment(p.id, 'verify')}
                          className="min-h-11 py-2 px-3 bg-emerald-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> {verifyingId === p.id ? 'Saving…' : 'Verify'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Returns queue (Task 59-a) — real requests touching this supplier ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setReturnsOpen((o) => !o)}
            className="min-h-11 w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Undo2 className="w-4 h-4 text-[#C8102E]" />
              Returns queue
              {returns.length > 0 && (
                <span className="text-xs bg-[#C8102E] text-white px-2 py-0.5 rounded-full font-medium">{returns.length}</span>
              )}
            </span>
            {returnsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {returnsOpen && (
            <div className="px-4 pb-4 space-y-3">
              {returnsError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-3">{returnsError}</div>
              )}
              {returnsLoading ? (
                <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ) : returns.length === 0 && !returnsError ? (
                <p className="text-xs text-gray-400 py-2">No return requests touching your goods right now.</p>
              ) : (
                <>
                  <p className="text-[11px] text-gray-400">
                    The Zylod team reviews and resolves every return. This queue shows each request that includes YOUR items — read-only.
                  </p>
                  {returns.map((r) => (
                    <div key={r.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{r.returnNumber}</p>
                          <p className="text-xs text-gray-500">Order #{r.orderNumber ?? '—'} · {r.shippingMethod}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${RETURN_STATUS_CHIP[r.status] || 'bg-gray-100 text-gray-700'}`}>
                            {r.status}
                          </span>
                          <p className="text-xs font-bold text-[#C8102E] mt-1">৳{r.sellerShare?.toLocaleString()} <span className="font-normal text-gray-400">your share</span></p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {r.items.map((it) => (
                          <div key={it.id} className="bg-gray-50 border border-gray-100 rounded-md px-2.5 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-gray-800 truncate">
                                {it.productName ?? 'Item'}{it.variant ? ` (${it.variant})` : ''}
                              </p>
                              <span className="text-[11px] text-gray-500 shrink-0">
                                {it.quantity}/{it.orderedQuantity ?? '?'} {it.unit ?? ''} · ৳{it.estimatedItemValue?.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">Reason: {it.reason}{it.comments ? ` — “${it.comments}”` : ''}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(r.createdAt), 'MMM dd, HH:mm')}</span>
                        <span>· full-request refund estimate ৳{r.estimatedRefund?.toLocaleString()}</span>
                        {r.resolutionNote && <span className="text-gray-600">· note: {r.resolutionNote}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search loaded orders by number or buyer"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 min-h-11 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent text-sm"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-20 bg-gray-100 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>{searchQuery ? 'No loaded orders match your search' : 'No orders for this status yet'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={order.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">#{order.orderNumber}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                          STATUS_CHIP[order.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                </div>

                <div className="p-4 cursor-pointer" onClick={() => navigate('seller-order-detail', { orderId: order.id })}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
                      {order.items?.[0]?.imageUrl && (
                        <img src={order.items[0].imageUrl} alt={order.items[0].name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {order.buyerCompanyName || order.buyerName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {order.items?.length} line(s) • {order.moqPackCount} units
                        {order.items?.[0]?.unit ? ` • per ${order.items[0].unit}` : ''}
                      </p>
                      <p className="text-[#C8102E] font-semibold text-sm mt-1">
                        ৳{order.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-1 rounded bg-gray-50 border ${
                        order.paymentStatus === 'paid'
                          ? 'border-green-200 text-green-700'
                          : 'border-orange-200 text-orange-700'
                      }`}
                    >
                      Payment: {order.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                  {order.status === 'pending' && (
                    <>
                      <button
                        className="min-h-11 py-2 px-4 bg-white border border-[#C8102E] text-[#C8102E] text-sm font-medium rounded-lg"
                        onClick={() => navigate('seller-order-cancellation', { orderId: order.id })}
                      >
                        Reject
                      </button>
                      <button
                        className="min-h-11 py-2 px-4 bg-[#C8102E] text-white text-sm font-medium rounded-lg"
                        onClick={() => void acceptOrder(order.id)}
                      >
                        Accept Order
                      </button>
                    </>
                  )}
                  {(order.status === 'confirmed' || order.status === 'packed') && (
                    <button
                      className="col-span-2 min-h-11 py-2 px-4 bg-[#C8102E] text-white text-sm font-medium rounded-lg"
                      onClick={() => navigate('seller-order-fulfillment', { orderId: order.id })}
                    >
                      Book Courier
                    </button>
                  )}
                  {order.status !== 'pending' && order.status !== 'confirmed' && order.status !== 'packed' && (
                    <button
                      className="col-span-2 min-h-11 py-2 px-4 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg"
                      onClick={() => navigate('seller-order-detail', { orderId: order.id })}
                    >
                      View Details
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SellerOrderManagementPage;
