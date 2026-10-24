'use client';

/**
 * Seller Bulk Order Inquiry (Task 175-c) — REAL hydration.
 *
 * The previous page rendered fabricated data ("RFQ #rfq_1001",
 * "Urban Construction", "Safety Helmets - Yellow", "500 units", "৳850")
 * and the "Send Quote" / "Message" buttons had NO onClick. None of those
 * RFQs exist.
 *
 * Now wired to the real supplier RFQ rails (Task 51/52):
 *   - GET /api/supplier/rfqs — the supplier's marketplace-open RFQ inbox.
 *     Real rows: id, title, description, categorySlug, quantity, unit,
 *     targetPrice, deliveryCity, deadline, status, itemCount, quoteCount,
 *     buyer.displayName (privacy — only the buyer's full name, never
 *     email/phone), items[], createdAt, updatedAt.
 *   - POST /api/supplier/rfqs/[id]/quote — the canonical quote writer
 *     (Task 52-a). Body: { pricePerUnit > 0, deliveryDays?: 0..365,
 *     message?: ≤2000 chars }. totalPrice is computed server-side from
 *     rfq.quantity (or Σ rfqItems.quantity). Idempotent per (rfq, supplier):
 *     re-quoting a pending quote edits it. Honest 409 for closed/expired
 *     RFQs, missed deadlines, and a quote already accepted/rejected.
 *
 * The "Message" button has NO RFQ-scoped message rail — chat is product-scoped
 * (/api/chat/conversations requires a productId), not RFQ-scoped. Honestly
 * disabled with the reason.
 *
 * Honest 401 (no token) / 403 (no supplier profile) / 404 / error / Skeleton
 * loading / empty states. No fabricated RFQs.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  LogIn,
  ChevronLeft,
  ChevronRight,
  FileText,
  CalendarClock,
  MessageCircle,
  Send,
  Inbox,
  Clock,
  MapPin,
  Tag,
  Package,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface RfqItem {
  id: string;
  productName: string;
  specifications: string | null;
  quantity: number;
  unit: string;
  targetPrice: number | null;
}
interface Rfq {
  id: string;
  title: string;
  description: string;
  categorySlug: string | null;
  quantity: number | null;
  unit: string;
  targetPrice: number | null;
  deliveryCity: string | null;
  deadline: string | null;
  status: string;
  itemCount: number;
  quoteCount: number;
  buyer: { displayName: string | null };
  items: RfqItem[];
  createdAt: string;
  updatedAt: string;
}
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

const STATUS_TONE: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  quoted: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  awarded: 'bg-primary/10 text-primary',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  expired: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
};

function formatQty(q: number | null, unit: string): string {
  if (q == null) return '—';
  const rounded = Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '');
  return `${rounded} ${unit || 'pcs'}`;
}

function formatMoney(n: number | null): string {
  if (n == null) return '—';
  return `৳${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

export function SellerBulkOrderInquiryPage() {
  const { goBack, navigate, pageParams } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  // An RFQ may be opened directly via pageParams.rfqId (deep link) — pre-select it.
  const initialRfqId = pageParams?.rfqId || pageParams?.id || '';

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(initialRfqId);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const LIMIT = 10;

  const [pricePerUnit, setPricePerUnit] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('RFQs require a signed-in supplier account. Sign in to view open requests.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        status: statusFilter,
      });
      const q = search.trim();
      if (q) params.set('q', q);
      const res = await fetch(`/api/supplier/rfqs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        setState('auth');
        setLoadError(json?.error || 'Supplier authentication required.');
        return;
      }
      if (res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'A supplier profile is required to view RFQs.');
        return;
      }
      if (!res.ok || !json?.success || !Array.isArray(json?.data)) {
        setState('error');
        setLoadError(json?.error || `Failed to load RFQs (HTTP ${res.status})`);
        return;
      }
      setRfqs(json.data as Rfq[]);
      setPagination(json.pagination as Pagination);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading RFQs. Check your connection and retry.');
    }
  }, [token, page, search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset the quote form whenever the selection changes.
  useEffect(() => {
    setPricePerUnit('');
    setDeliveryDays('');
    setMessage('');
  }, [selectedId]);

  const selected = useMemo(
    () => rfqs.find((r) => r.id === selectedId) || null,
    [rfqs, selectedId]
  );

  /** POST /api/supplier/rfqs/[id]/quote — the canonical quote writer.
   *  totalPrice is server-computed; we send only pricePerUnit (required),
   *  deliveryDays (optional), and message (optional). */
  const sendQuote = useCallback(async () => {
    if (!selected || !token) return;
    const priceNum = Number(pricePerUnit);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error('Enter a valid unit price', { description: 'The unit price must be a positive number.' });
      return;
    }
    const days = deliveryDays.trim();
    const daysNum = days ? Number(days) : undefined;
    if (daysNum !== undefined && (!Number.isFinite(daysNum) || daysNum < 0 || daysNum > 365 || !Number.isInteger(daysNum))) {
      toast.error('Invalid delivery days', { description: 'Delivery days must be a whole number from 0 to 365.' });
      return;
    }
    const trimmedMsg = message.trim();
    if (trimmedMsg.length > 2000) {
      toast.error('Message too long', { description: `The message is ${trimmedMsg.length} chars — the limit is 2000.` });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { pricePerUnit: priceNum };
      if (daysNum !== undefined) body.deliveryDays = daysNum;
      if (trimmedMsg) body.message = trimmedMsg;
      const res = await fetch(
        `/api/supplier/rfqs/${encodeURIComponent(selected.id)}/quote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          toast.error(json?.error || 'Not authorized', {
            description: 'Quoting is a supplier action. Sign in with your supplier account.',
          });
        } else if (res.status === 404) {
          toast.error(json?.error || 'RFQ not found');
        } else if (res.status === 409) {
          toast.error(json?.error || 'Quote not allowed', {
            description: 'The RFQ is closed/expired, the deadline passed, or your quote was already accepted/rejected.',
          });
        } else {
          toast.error(json?.error || `Could not send quote (HTTP ${res.status})`);
        }
        return;
      }
      const d = json?.data;
      toast.success('Quote sent', {
        description: d
          ? `Unit ৳${d.pricePerUnit} · Total ৳${d.totalPrice}${d.deliveryDays != null ? ` · ${d.deliveryDays} day(s)` : ''}`
          : undefined,
      });
      setPricePerUnit('');
      setDeliveryDays('');
      setMessage('');
      void load();
    } catch {
      toast.error('Network error while sending the quote');
    } finally {
      setSubmitting(false);
    }
  }, [selected, token, pricePerUnit, deliveryDays, message, load]);

  /* ─── Loading skeleton ─── */
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-4 md:max-w-5xl md:mx-auto md:pt-8 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  /* ─── Auth / error ─── */
  if (state === 'auth' || state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={goBack}
            aria-label="Go back"
            className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Bulk Inquiries</h1>
        </div>
        <div className="p-4 md:max-w-3xl md:mx-auto md:pt-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
            <AlertTriangle
              className={state === 'auth' ? 'w-8 h-8 text-amber-500 mx-auto' : 'w-8 h-8 text-rose-500 mx-auto'}
            />
            <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {state === 'auth' && (
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

  /* ─── Detail (selected RFQ) ─── */
  if (selected) {
    const isQuotable = selected.status === 'open' || selected.status === 'quoted';
    const deadlinePassed = selected.deadline
      ? new Date(selected.deadline).getTime() < Date.now()
      : false;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="overflow-x-hidden min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8"
      >
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 sticky top-0 z-10 flex items-center gap-3 md:px-6 md:max-w-3xl md:mx-auto">
          <button
            onClick={() => setSelectedId('')}
            aria-label="Back to list"
            className="p-1 -ml-1 min-h-11 min-w-11 flex items-center justify-center text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">RFQ Negotiation</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate">
              {selected.buyer.displayName || 'Anonymous buyer'} · {selected.title}
            </p>
          </div>
        </header>

        <div className="p-4 space-y-4 md:p-6 md:max-w-3xl md:mx-auto">
          {/* RFQ summary */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{selected.title}</h2>
              <span
                className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  STATUS_TONE[selected.status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {selected.status}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed mb-3">
              {selected.description}
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Buyer</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {selected.buyer.displayName || '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Quantity</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {formatQty(selected.quantity, selected.unit)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Target price</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {formatMoney(selected.targetPrice)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Delivery city</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {selected.deliveryCity || '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Deadline</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 inline-flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />{' '}
                  {selected.deadline ? new Date(selected.deadline).toLocaleDateString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Quotes received</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{selected.quoteCount}</p>
              </div>
            </div>
          </div>

          {/* Items list */}
          {selected.items.length > 0 && (
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Requested Items
              </h3>
              <ul className="space-y-2">
                {selected.items.map((it) => (
                  <li
                    key={it.id}
                    className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {it.productName}
                      </span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {formatQty(it.quantity, it.unit)}
                      </span>
                    </div>
                    {it.specifications && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500">{it.specifications}</p>
                    )}
                    {it.targetPrice != null && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                        Target: <span className="font-medium">{formatMoney(it.targetPrice)}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quote form */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Submit Quotation
            </h3>

            {!isQuotable && (
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                This RFQ is currently <span className="font-medium">{selected.status}</span> — quotes are only accepted
                while the status is <span className="font-medium">open</span> or <span className="font-medium">quoted</span>.
              </p>
            )}
            {isQuotable && deadlinePassed && (
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                The quoting deadline passed on{' '}
                {selected.deadline ? new Date(selected.deadline).toLocaleString() : 'the deadline'} — quotes are closed.
              </p>
            )}

            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Your Offered Unit Price (৳)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                disabled={!isQuotable || deadlinePassed || submitting}
                placeholder="e.g. 825"
                className="w-full min-h-11 px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1 flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5" /> Delivery Days (optional)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="365"
                step="1"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                disabled={!isQuotable || deadlinePassed || submitting}
                placeholder="e.g. 7"
                className="w-full min-h-11 px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Message (optional, max 2000 chars)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                disabled={!isQuotable || deadlinePassed || submitting}
                placeholder="Add terms, conditions, or notes for the buyer."
                className="w-full min-h-20 px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1 text-right">
                {message.length} / 2000
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                disabled
                aria-label="RFQ-scoped messaging is not yet shipped — include notes in the quote text instead"
                className="flex-1 min-h-12 py-3 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 text-gray-400 dark:text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 dark:border-gray-700 rounded-xl font-medium flex justify-center items-center gap-2 cursor-not-allowed"
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
              <button
                onClick={sendQuote}
                disabled={!isQuotable || deadlinePassed || submitting}
                className="flex-1 min-h-12 py-3 bg-primary text-white rounded-xl font-medium flex justify-center items-center gap-2 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:disabled:text-gray-400 dark:text-gray-500"
              >
                <Send className="w-4 h-4" /> {submitting ? 'Sending…' : 'Send Quote'}
              </button>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <span className="font-medium">Message</span> is disabled — no RFQ-scoped message rail has shipped yet. The
              chat system (/api/chat/conversations) is product-scoped, not RFQ-scoped. Include any message in the quote
              text above; the buyer will see it on your quote.
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-relaxed">
              Total price is computed server-side from the RFQ quantity — never trusted from the client. Re-submitting a
              pending quote edits it (idempotent per supplier).
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ─── List view ─── */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8"
    >
      <header className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={goBack}
            aria-label="Go back"
            className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Bulk Inquiries</h1>
        </div>
        <button
          onClick={load}
          aria-label="Refresh"
          className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </header>

      <div className="p-4 md:max-w-5xl md:mx-auto md:p-6 md:pt-8 space-y-4">
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bulk Order Inquiries (RFQs)</h1>
          </div>
          <button
            onClick={load}
            className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-primary inline-flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search RFQ title…"
                className="w-full min-h-11 pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-11 px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
            >
              <option value="open">Open</option>
              <option value="quoted">Quoted</option>
              <option value="awarded">Awarded</option>
              <option value="closed">Closed</option>
              <option value="expired">Expired</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {rfqs.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-2">
            <Inbox className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {search || statusFilter !== 'open'
                ? 'No RFQs match the filter'
                : 'No open RFQs in your inbox yet'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-sm mx-auto leading-relaxed">
              {search || statusFilter !== 'open'
                ? 'Clear the search or change the status filter to see more.'
                : 'When buyers file bulk-order requests visible to suppliers, they appear here. We do not show fabricated RFQs.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rfqs.map((r) => {
              const deadlinePassed = r.deadline ? new Date(r.deadline).getTime() < Date.now() : false;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className="w-full text-left bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{r.title}</h3>
                      <span
                        className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          STATUS_TONE[r.status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-2 mb-3">
                      {r.description}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {r.buyer.displayName || 'Anonymous'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Package className="w-3 h-3" /> {formatQty(r.quantity, r.unit)}
                      </span>
                      {r.targetPrice != null && (
                        <span>Target {formatMoney(r.targetPrice)}</span>
                      )}
                      {r.deadline && (
                        <span className={`inline-flex items-center gap-1 ${deadlinePassed ? 'text-rose-500' : ''}`}>
                          <Clock className="w-3 h-3" /> {deadlinePassed ? 'Closed ' : 'Due '}
                          {new Date(r.deadline).toLocaleDateString()}
                        </span>
                      )}
                      {r.quoteCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> {r.quoteCount} quote{r.quoteCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} RFQ{pagination.total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default SellerBulkOrderInquiryPage;
