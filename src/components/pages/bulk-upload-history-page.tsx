'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, RefreshCw, FileWarning, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Task 77 — the REAL upload history (the old page showed a HARDCODED fake
 * row "batch_0812.csv / Success: 120 rows" — invented data). Now: the
 * seller's real sellerBulkUploads rows from GET /api/supplier/bulk-upload,
 * with honest per-run counts and expandable per-row errors.
 */

interface RowError { row: number; error: string }

interface UploadRow {
  id: string
  fileName: string
  status: string
  totalRows: number
  successCount: number
  failureCount: number
  errors: RowError[]
  createdAt: string
}

export function BulkUploadHistoryPage() {
  const { goBack } = useNavigationStore();
  const { token } = useAuthStore();
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNeedsAuth(false);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/supplier/bulk-upload', { headers });
      if (res.status === 401) { setNeedsAuth(true); setRows([]); return }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || `Couldn't load history (HTTP ${res.status})`);
        setRows([]);
        return;
      }
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch {
      setError('Network error while loading your upload history.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 md:py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={goBack} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-900" aria-label="Back">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <Button variant="outline" onClick={load} disabled={loading} className="rounded-xl text-xs font-bold gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
        <h1 className="text-xl md:text-2xl font-bold mb-4 text-gray-900">Upload History</h1>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 bg-gray-200 rounded-2xl" />
            <div className="h-16 bg-gray-200 rounded-2xl" />
          </div>
        ) : needsAuth ? (
          <div className="bg-white p-8 rounded-2xl text-center shadow-sm">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">Sign in required</p>
            <p className="text-xs text-gray-500 mt-1">Sign in with your seller account to see your uploads.</p>
          </div>
        ) : error ? (
          <div className="bg-white p-8 rounded-2xl text-center shadow-sm">
            <AlertTriangle className="w-8 h-8 text-red-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">{error}</p>
            <Button variant="outline" onClick={load} className="mt-3 rounded-xl text-xs font-bold">Retry</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center shadow-sm">
            <p className="text-sm font-bold text-gray-700">No bulk uploads yet</p>
            <p className="text-xs text-gray-500 mt-1">Every upload you process is recorded here with its honest row counts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((u) => {
              const allFailed = u.totalRows > 0 && u.successCount === 0;
              const clean = u.failureCount === 0 && u.successCount > 0;
              return (
                <div key={u.id} className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                    className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition"
                    aria-expanded={expanded === u.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-gray-900 block truncate">{u.fileName}</span>
                        <span className="text-[10px] text-gray-400">{new Date(u.createdAt).toLocaleString('en-GB')}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full border flex items-center gap-1 ${clean ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : allFailed ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {clean ? <CheckCircle2 className="w-3 h-3" /> : <FileWarning className="w-3 h-3" />}
                          {clean ? 'Created' : allFailed ? 'Failed' : 'Partial'}
                        </span>
                        <span className="text-xs font-bold text-gray-600 tabular-nums">
                          {u.successCount}/{u.totalRows} rows
                        </span>
                      </div>
                    </div>
                  </button>
                  {expanded === u.id && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                      {u.errors.length === 0 ? (
                        <p className="text-xs text-gray-500">Every row passed validation — no errors recorded.</p>
                      ) : (
                        <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                          {u.errors.map((e, i) => (
                            <div key={i} className="py-2 text-xs">
                              <span className="font-black text-red-600 mr-2">Row {e.row}</span>
                              <span className="text-gray-700">{e.error}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export default BulkUploadHistoryPage;
