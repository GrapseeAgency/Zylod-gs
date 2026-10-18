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
import { Search, Download, Package, Calendar, Radio } from 'lucide-react';
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

export function SellerOrderManagementPage() {
  const { navigate } = useNavigationStore();
  const [orders, setOrders] = useState<SupplierOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sellerRoom, setSellerRoom] = useState<string | null>(null);

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
        const id = data?.user?.supplierProfile?.id;
        if (!cancelled && typeof id === 'string' && id.length > 0) setSellerRoom(`seller:${id}`);
      } catch {
        /* profile fetch failed — live feed stays off, list still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const onLiveEvent = useCallback(
    (message: RealtimeRoomMessage) => {
      if (message.event === 'order:new') {
        toast('New order received', { description: 'The list below has been refreshed.' });
        void fetchOrders(activeTabRef.current);
      }
    },
    [fetchOrders]
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
