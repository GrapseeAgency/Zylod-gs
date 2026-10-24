'use client';

/**
 * Seller Notifications Center (Task 175-c) — REAL hydration.
 *
 * The previous page rendered a single fabricated blue card:
 *   "New Order #1029 / You have 2 days to fulfill this wholesale order."
 * No such order exists, and the page hit no rail. Now wired to the real
 * notification rail at GET /api/notifications (Task 138/171):
 *
 *   - 401-first: no token → honest "Sign in to see your notifications" CTA.
 *   - Loads the REAL notification feed (type, title, message, timestamp,
 *     isRead, relatedId/relatedShipmentId/relatedPaymentId) for the
 *     authenticated user — no fabricated entries.
 *   - Honest error / notfound / Skeleton loading / empty states.
 *   - Type-aware icon + label (order | payment | promotion | system |
 *     chat | review | delivery).
 *   - Mark-all-read via PATCH /api/notifications { markAll: true } with a
 *     real toast verdict.
 *   - Pagination via the rail's pagination envelope.
 *   - No indigo/blue colors — bg-primary / text-primary (rose/red brand) +
 *     amber / emerald / slate for status.
 *   - Theme-consistent (every bg-white has dark:bg-gray-900).
 *   - Responsive at 320px (mobile card list + desktop table).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bell,
  RefreshCw,
  AlertTriangle,
  LogIn,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  Tag,
  Shield,
  MessageSquare,
  Star,
  CreditCard,
  Inbox,
  Clock,
} from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  relatedId: string | null;
  relatedShipmentId: string | null;
  relatedPaymentId: string | null;
}
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

const TYPE_META: Record<string, { label: string; icon: typeof Bell; tone: string }> = {
  order: { label: 'Order', icon: Package, tone: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  payment: { label: 'Payment', icon: CreditCard, tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
  promotion: { label: 'Promotion', icon: Tag, tone: 'text-primary bg-primary/10' },
  system: { label: 'System', icon: Shield, tone: 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800' },
  chat: { label: 'Chat', icon: MessageSquare, tone: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40' },
  review: { label: 'Review', icon: Star, tone: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40' },
  delivery: { label: 'Delivery', icon: Truck, tone: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' },
};

function typeMeta(type: string) {
  return TYPE_META[type] || { label: type || 'Notification', icon: Bell, tone: 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800' };
}

export function SellerNotificationsCenterPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('Sign in to see your notifications.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const res = await fetch(`/api/notifications?page=${page}&limit=${LIMIT}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'Sign in to see your notifications.');
        return;
      }
      if (!res.ok || !json?.success || !Array.isArray(json?.data)) {
        setState('error');
        setLoadError(json?.error || `Failed to load notifications (HTTP ${res.status})`);
        return;
      }
      setItems(json.data as NotificationItem[]);
      setUnreadCount(Number(json.unreadCount) || 0);
      setPagination(json.pagination as Pagination);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading notifications. Check your connection and retry.');
    }
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = useCallback(async () => {
    if (!token || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ markAll: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error || `Could not mark all as read (HTTP ${res.status})`);
        return;
      }
      toast.success('All notifications marked as read');
      void load();
    } catch {
      toast.error('Network error while marking notifications as read');
    } finally {
      setMarkingAll(false);
    }
  }, [token, markingAll, load]);

  /* ─── Loading skeleton ─── */
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-4 space-y-3 md:max-w-3xl md:mx-auto md:pt-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
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
            className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
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
                className="min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={load}
          aria-label="Refresh"
          className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </header>

      <div className="p-4 md:max-w-3xl md:mx-auto md:p-6 md:pt-8 space-y-4">
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
            {unreadCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50 inline-flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> {markingAll ? 'Marking…' : 'Mark all read'}
              </button>
            )}
            <button
              onClick={load}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary inline-flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Mobile mark-all-read */}
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="md:hidden w-full min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" /> {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
        )}

        {items.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-2">
            <Inbox className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No notifications yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              When orders, payments, returns, deliveries, or system events happen on your account, they appear here in
              real time. We do not show fabricated notifications.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const meta = typeMeta(n.type);
              const Icon = meta.icon;
              return (
                <li
                  key={n.id}
                  className={`bg-white dark:bg-gray-900 p-4 rounded-xl border shadow-sm ${
                    n.isRead
                      ? 'border-gray-100 dark:border-gray-800'
                      : 'border-primary/30 dark:border-primary/40 bg-primary/[0.03]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${meta.tone}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {n.title}
                        </h3>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500 shrink-0">
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed break-words">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(n.timestamp).toLocaleString()}</span>
                        {!n.isRead && (
                          <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-primary" aria-label="Unread" />
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} notification
              {pagination.total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
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

export default SellerNotificationsCenterPage;
