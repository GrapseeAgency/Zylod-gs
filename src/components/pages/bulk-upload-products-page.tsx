'use client';
import React, { useRef, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileSpreadsheet, History, AlertTriangle, CheckCircle2, FileWarning, Loader2 } from 'lucide-react';

/**
 * Task 77 — the REAL bulk upload. The old page was a fake: handleUpload was
 * `setTimeout(() => setUploading(false), 2000)` — a spinner that uploaded
 * NOTHING while the REAL POST /api/supplier/bulk-upload sat unused (a seller
 * got a success animation and zero products). Now: a real file picker, the
 * real multipart POST, and the server's honest per-row results.
 */

interface RowError { row: number; error: string }

interface UploadResult {
  uploadId: string
  totalRows: number
  createdCount: number
  successCount: number
  failureCount: number
  errors: RowError[]
}

export function BulkUploadProductsPage() {
  const { navigate, goBack } = useNavigationStore();
  const { token } = useAuthStore();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const pick = (f: File | null) => {
    setError('');
    setResult(null);
    if (f && !/\.(csv|txt)$/i.test(f.name)) {
      setError('Please choose a .csv file (the template format is on the template page).');
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file) { setError('Choose a CSV file first.'); return }
    setUploading(true);
    setError('');
    setNeedsAuth(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/supplier/bulk-upload', { method: 'POST', headers, body: fd });
      const json = await res.json().catch(() => null);
      if (res.status === 401) { setNeedsAuth(true); setError('Sign in as a supplier to bulk upload.'); return }
      if (res.status === 403) { setError(json?.error?.error || json?.error || 'Supplier profile required.'); return }
      if (!json || (!json.success && res.status !== 422)) {
        setError(json?.error || `Upload failed (HTTP ${res.status})`);
        return;
      }
      // 201 = processed (partial failures honest in errors); 422 = every row failed.
      setResult(json.data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setError('Network error while uploading. Check your connection and retry.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center justify-between md:hidden">
        <div className="flex items-center">
          <button onClick={goBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none active:scale-95 transition-transform" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">Bulk Upload</h1>
        </div>
        <button onClick={() => navigate('bulk-upload-history')} aria-label="History">
          <History className="w-6 h-6" />
        </button>
      </header>
      <main className="flex-1 p-4 md:p-6 md:py-8">
        <div className="hidden md:flex items-center justify-between max-w-3xl mx-auto mb-6">
          <div className="flex items-center gap-3">
            <UploadCloud className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">Bulk Upload Products</h1>
          </div>
          <Button variant="outline" onClick={() => navigate('bulk-upload-history')} className="rounded-xl text-xs font-bold gap-2">
            <History className="w-4 h-4" /> History
          </Button>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {/* Task 77: the REAL upload card — file picker + server truth. */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xs p-5 md:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed">
                <p className="font-bold text-gray-900 dark:text-gray-100">Upload a CSV of products</p>
                <p className="mt-1 break-words">
                  Header must be exactly <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded font-mono text-[11px] break-all">name,categoryId,unit,moq,basePrice,stockQuantity</code> — one product per row, max 100 rows.
                  Valid rows become products in the moderation queue (isApproved=false) for your store.
                  Get the template with your live category ids from the <button onClick={() => navigate('bulk-upload-template')} className="text-primary font-bold underline">template page</button>.
                </p>
              </div>
            </div>

            <label className="block border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/[0.03] transition">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
              <UploadCloud className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                {file ? file.name : 'Click to choose a CSV file'}
              </span>
              {file && <span className="text-[10px] text-gray-400 dark:text-gray-500 block mt-0.5">{(file.size / 1024).toFixed(1)} KB — click to change</span>}
            </label>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs text-red-700 font-bold" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words">{error}{needsAuth ? ' — sign in with your seller account.' : ''}</span>
              </div>
            )}

            <Button
              onClick={upload}
              disabled={uploading || !file}
              className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md"
            >
              {uploading ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing on the server…</span>
              ) : (
                <span className="flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Upload &amp; process</span>
              )}
            </Button>
          </div>

          {/* Task 77: the server's HONEST per-row results. */}
          {result && (
            <div className={`rounded-3xl border p-5 md:p-6 space-y-3 ${result.failureCount === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2">
                {result.failureCount === 0
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  : <FileWarning className="w-5 h-5 text-amber-600" />}
                <span className="text-sm font-black text-gray-900 dark:text-gray-100">
                  {result.successCount} of {result.totalRows} rows created
                  {result.failureCount > 0 ? ` · ${result.failureCount} failed` : ''}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500">
                Created products land in the moderation queue — an admin approves them onto the marketplace.
                Upload id <span className="font-mono">{result.uploadId.slice(-8)}</span> is recorded in your history.
              </p>
              {result.errors.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-100 max-h-56 overflow-y-auto divide-y divide-gray-50">
                  {result.errors.map((e) => (
                    <div key={e.row} className="px-3 py-2 text-xs">
                      <span className="font-black text-red-600 mr-2">Row {e.row}</span>
                      <span className="text-gray-700 dark:text-gray-300">{e.error}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => navigate('bulk-upload-history')} className="flex-1 h-10 rounded-2xl text-xs font-bold">
                  View history
                </Button>
                <Button variant="outline" onClick={() => navigate('supplier-products')} className="flex-1 h-10 rounded-2xl text-xs font-bold">
                  Go to my products
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
export default BulkUploadProductsPage;
