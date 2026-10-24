'use client';

/**
 * Inventory Audit Log (Task 175-b) — REAL hydration.
 *
 * The previous page rendered three fabricated log entries ("Cotton T-Shirt
 * SKU-1001 +500", "Denim Jeans SKU-2004 -5", etc.) with fake users and fake
 * Oct-2023 dates. The real rail at /api/admin/audit-logs (Task 139) is
 * admin-only and returns the platform's REAL audit trail — every audited
 * write (orders, products, payments, coupons, inventory, etc.) with its
 * real actor, action, entity, metadata, and timestamp.
 *
 * This page now:
 *   - tries to fetch the real audit log via GET /api/admin/audit-logs,
 *   - surfaces 401 honestly ("Audit log is not available on this account")
 *     for non-admins — admins get the real trail,
 *   - renders the real fields: timestamp, actor (real name + userType),
 *     action, entity type, entity ID, and a metadata summary,
 *   - supports filter by action / entityType (the rail's real query params)
 *     and pagination,
 *   - NEVER fabricates a delta, item label, user, or date — the audit trail
 *     is what the server returned, no more.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, RefreshCw, AlertTriangle, User, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface AuditActor {
  id: string | null;
  email: string | null;
  userType: string;
  name: string;
}
interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string | null;
  createdAt: string;
  actor: AuditActor | null;
}
interface Pagination { page: number; limit: number; total: number; totalPages: number; }

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

const ACTION_VERBS: Record<string, string> = {
  inventory_updated: 'Inventory updated',
  product_created: 'Product created',
  product_updated: 'Product updated',
  product_visibility_changed: 'Listing visibility changed',
  product_deleted: 'Listing removed',
  shipping_zone_created: 'Shipping zone created',
  shipping_zone_updated: 'Shipping zone updated',
  shipping_zone_deleted: 'Shipping zone deleted',
  warehouse_added: 'Warehouse added',
  warehouse_updated: 'Warehouse updated',
  warehouse_removed: 'Warehouse removed',
};

function friendlyAction(action: string): string {
  return ACTION_VERBS[action] || action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function summarizeMetadata(raw: string | null): string {
  if (!raw) return '';
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const parts: string[] = [];
    // Inventory updates carry a before/after array.
    if (Array.isArray(obj.updates)) {
      const arr = obj.updates as Array<Record<string, unknown>>;
      for (const u of arr.slice(0, 3)) {
        const before = u.before;
        const after = u.after;
        const id = u.productId || u.variantId;
        if (before != null && after != null && id) {
          parts.push(`${String(id).slice(0, 8)}: ${before} → ${after}`);
        }
      }
      if (arr.length > 3) parts.push(`+${arr.length - 3} more`);
      return parts.join(' · ');
    }
    // Product updates carry before/after summaries.
    if (obj.before && obj.after && typeof obj.before === 'object') {
      const b = obj.before as Record<string, unknown>;
      const a = obj.after as Record<string, unknown>;
      if (b.basePrice !== undefined && a.basePrice !== undefined && b.basePrice !== a.basePrice) {
        parts.push(`price ${b.basePrice} → ${a.basePrice}`);
      }
      if (b.stockQuantity !== undefined && a.stockQuantity !== undefined && b.stockQuantity !== a.stockQuantity) {
        parts.push(`stock ${b.stockQuantity} → ${a.stockQuantity}`);
      }
      if (b.isActive !== undefined && a.isActive !== undefined && b.isActive !== a.isActive) {
        parts.push(`active ${String(b.isActive)} → ${String(a.isActive)}`);
      }
    }
    if (obj.name && typeof obj.name === 'string') parts.push(`name: ${obj.name}`);
    if (obj.districts && Array.isArray(obj.districts)) parts.push(`districts: ${(obj.districts as string[]).join(', ')}`);
    if (obj.removedRates !== undefined) parts.push(`removed rates: ${String(obj.removedRates)}`);
    return parts.join(' · ').slice(0, 200);
  } catch {
    return raw.slice(0, 120);
  }
}

export function InventoryAuditLogPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const LIMIT = 30;

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('Audit log is an admin console — sign in as an admin to view the trail.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      if (entityFilter.trim()) params.set('entityType', entityFilter.trim());
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'Audit log is not available on this account. Admin access is required.');
        return;
      }
      if (!res.ok || !json?.success || !Array.isArray(json?.data)) {
        setState('error');
        setLoadError(json?.error || `Failed to load audit log (HTTP ${res.status})`);
        return;
      }
      setLogs(json.data as AuditLog[]);
      setPagination(json.pagination as Pagination);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading the audit log. Check your connection and retry.');
    }
  }, [token, page, actionFilter, entityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <div className="p-2"><Skeleton className="w-5 h-5 rounded-full" /></div>
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-4 space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (state === 'auth' || state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
        </div>
        <div className="p-4 md:max-w-4xl md:mx-auto md:pt-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {state === 'auth' && (
                <button onClick={() => navigate('login')} className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium">
                  Sign in
                </button>
              )}
              <button onClick={load} className="min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-2">
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
      <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
        </div>
        <button onClick={load} aria-label="Refresh" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="p-4 md:max-w-5xl md:mx-auto md:p-6 md:pt-8 space-y-4">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
          <button onClick={load} className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-primary inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">
            <Filter className="w-3.5 h-3.5" /> Filter
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              placeholder="Action (e.g. inventory)"
              className="px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
              placeholder="Entity type (e.g. products)"
              className="px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-2">
            <Clock className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No audit entries match the filter</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {actionFilter || entityFilter ? 'Clear filters to see all entries.' : 'No audited writes have happened yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="space-y-3 md:hidden">
              {logs.map((log) => {
                const summary = summarizeMetadata(log.metadata);
                return (
                  <div key={log.id} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{friendlyAction(log.action)}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:text-gray-500 flex-shrink-0">
                        {log.entityType}
                      </span>
                    </div>
                    {summary && <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 mb-2 break-words">{summary}</p>}
                    {log.entityId && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">Entity: <code className="text-xs">{log.entityId.slice(0, 12)}</code></p>
                    )}
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <div className="flex items-center gap-1 min-w-0">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{log.actor?.name || 'System'}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50/50 dark:bg-red-950/20 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <th className="px-4 py-3 font-semibold">When</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                      <th className="px-4 py-3 font-semibold">Entity</th>
                      <th className="px-4 py-3 font-semibold">Summary</th>
                      <th className="px-4 py-3 font-semibold">Actor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const summary = summarizeMetadata(log.metadata);
                      return (
                        <tr key={log.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{friendlyAction(log.action)}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">
                            <div className="text-xs">{log.entityType}</div>
                            {log.entityId && <code className="text-xs text-gray-400 dark:text-gray-500">{log.entityId.slice(0, 12)}</code>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 text-xs max-w-xs break-words">{summary || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 text-xs">
                            <div>{log.actor?.name || 'System'}</div>
                            {log.actor?.userType && <div className="text-gray-400 dark:text-gray-500">{log.actor.userType}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination && (
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                <span>
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} entr{pagination.total === 1 ? 'y' : 'ies'}
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
          </>
        )}
      </div>
    </motion.div>
  );
}

export default InventoryAuditLogPage;
