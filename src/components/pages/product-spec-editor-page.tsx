'use client';

/**
 * Product spec editor (Task 175-a) — REAL hydration, HONEST save state.
 *
 * The previous page seeded a fake "Material Grade" spec and the Save button
 * had no onClick. The real rail at GET /api/products/[id]/specifications
 * exists and returns the product's real productSpecifications rows
 * ({ specName, specValue, sortOrder }). There is NO writer rail for specs
 * — neither PUT /api/products/[id]/specifications nor a spec field on the
 * PATCH /api/supplier/products/[id] full-replace contract. Per the honesty
 * doctrine, the page loads the REAL specs and shows them; the Save button
 * is honestly disabled with the reason, never faking a save.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Plus, X, Save, Info, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';

interface SpecRow {
  id?: string;
  specName: string;
  specValue: string;
  sortOrder: number;
}

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

export function ProductSpecEditorPage() {
  const { goBack, navigate, pageParams } = useNavigationStore();
  const token = useAuthStore((s) => s.token);
  const productId = typeof pageParams?.productId === 'string' ? pageParams.productId : '';

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [productName, setProductName] = useState('');
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [dirty, setDirty] = useState(false);

  const fetchSpecs = useCallback(async () => {
    if (!productId) {
      setState('error');
      setLoadError('No product was selected. Open this page from a product listing.');
      return;
    }
    if (!token) {
      setState('auth');
      setLoadError('Sign in as the product owner to manage specifications.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const res = await fetch(`/api/products/${productId}/specifications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 404) {
        setState('error');
        setLoadError('Product not found — it may have been removed.');
        return;
      }
      if (!res.ok || !json?.success || !json?.data) {
        setState('error');
        setLoadError(json?.error || `Failed to load specifications (HTTP ${res.status})`);
        return;
      }
      setProductName(json.data.product?.name ?? '');
      const rows: SpecRow[] = (json.data.specifications ?? []).map(
        (s: { id: string; specName: string; specValue: string; sortOrder: number }) => ({
          id: s.id,
          specName: s.specName,
          specValue: s.specValue,
          sortOrder: s.sortOrder,
        }),
      );
      setSpecs(rows);
      setDirty(false);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading specifications. Check your connection and retry.');
    }
  }, [productId, token]);

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);

  const addSpec = () => {
    setSpecs((prev) => [
      ...prev,
      { specName: '', specValue: '', sortOrder: prev.length },
    ]);
    setDirty(true);
  };
  const removeSpec = (index: number) => {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };
  const updateSpec = (index: number, field: 'specName' | 'specValue', value: string) => {
    setSpecs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDirty(true);
  };

  const handleSaveClick = () => {
    // Honest verdict: no writer rail exists for specifications.
    toast.error(
      'Specification saving is not available yet — the writer rail has not shipped. Your edits below are drafts only.',
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={goBack}
          aria-label="Go back"
          className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Technical Specs</h1>
      </div>

      <div className="p-4 space-y-6 md:p-6 md:max-w-3xl md:mx-auto md:pt-8">
        <div className="hidden md:flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Technical Specs</h1>
          {productName && (
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate min-w-0">
              {productName}
            </span>
          )}
        </div>

        {state === 'loading' && (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          </div>
        )}

        {state === 'auth' && (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
            <button
              type="button"
              onClick={() => navigate('login')}
              className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium"
            >
              Sign in
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
            <button
              type="button"
              onClick={fetchSpecs}
              className="min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {state === 'ready' && (
          <>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-medium">Read-only — saving is not yet available</p>
                <p>
                  These specifications are loaded live from the product record. A writer rail for
                  specifications has not shipped yet, so edits below are drafts and will not persist.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Specifications</h2>
                <button
                  onClick={addSpec}
                  className="text-primary text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Spec
                </button>
              </div>

              {specs.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                  No specifications have been added to this product yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {specs.map((spec, i) => (
                    <div key={spec.id ?? i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Name (e.g., Material)"
                        value={spec.specName}
                        onChange={(e) => updateSpec(i, 'specName', e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={spec.specValue}
                        onChange={(e) => updateSpec(i, 'specValue', e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        onClick={() => removeSpec(i)}
                        className="p-2 text-gray-400 hover:text-red-500"
                        aria-label="Remove spec"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSaveClick}
              disabled
              className="w-full md:w-auto md:px-10 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              Save Specifications
            </button>
            {dirty && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center md:text-left">
                You have unsaved draft edits — saving is not yet wired to a server writer.
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

export default ProductSpecEditorPage;
