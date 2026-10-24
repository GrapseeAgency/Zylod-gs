'use client';

/**
 * Self Pickup Settings (Task 175-b) — REAL hydration + REAL save.
 *
 * The previous page rendered an uncontrolled form with hardcoded "09:00 /
 * 18:00" defaults and a Save button with NO onClick. The real rail at
 * /api/supplier/warehouses (Task 98) returns the supplier's REAL
 * warehouseLocations rows — { name, addressLine1, addressLine2, city,
 * district, lat, lng, isActive }.
 *
 * This page now:
 *   - loads the supplier's real warehouses via GET /api/supplier/warehouses,
 *   - lets the seller edit the real fields (name, addressLine1/2, city,
 *     district, isActive) via PATCH /api/supplier/warehouses/[id],
 *   - lets the seller add a new pickup location via POST /api/supplier/warehouses,
 *   - honestly notes that the warehouse model does NOT carry pickup hours,
 *     contact person, phone, operating days, or gate-pass automation yet —
 *     those fields are shown as drafts with an amber notice explaining the
 *     rail hasn't shipped those fields. They are NOT silently dropped and
 *     NOT fabricated as saved.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Building, Clock, AlertTriangle, Save, Plus, RefreshCw, X, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface Warehouse {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  district: string;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  createdAt: string;
}

interface WarehouseForm {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  isActive: boolean;
}

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

function toForm(w: Warehouse): WarehouseForm {
  return {
    name: w.name,
    addressLine1: w.addressLine1,
    addressLine2: w.addressLine2 ?? '',
    city: w.city,
    district: w.district,
    isActive: w.isActive,
  };
}

export function SelfPickupSettingsPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [edits, setEdits] = useState<Record<string, WarehouseForm>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<WarehouseForm>({ name: '', addressLine1: '', addressLine2: '', city: '', district: '', isActive: true });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('Sign in as a supplier to manage pickup locations.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const res = await fetch('/api/supplier/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'Pickup location management is not available on this account.');
        return;
      }
      if (!res.ok || !json?.success || !Array.isArray(json?.data)) {
        setState('error');
        setLoadError(json?.error || `Failed to load pickup locations (HTTP ${res.status})`);
        return;
      }
      setWarehouses(json.data as Warehouse[]);
      const nextEdits: Record<string, WarehouseForm> = {};
      for (const w of json.data as Warehouse[]) nextEdits[w.id] = toForm(w);
      setEdits(nextEdits);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading pickup locations. Check your connection and retry.');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const patchWarehouse = async (w: Warehouse) => {
    const form = edits[w.id];
    if (!form) return;
    if (form.name.trim().length < 2) { toast.error('Location name must be at least 2 characters.'); return; }
    if (form.addressLine1.trim().length < 2) { toast.error('Address line 1 must be at least 2 characters.'); return; }
    if (form.city.trim().length < 2) { toast.error('City must be at least 2 characters.'); return; }
    if (form.district.trim().length < 2) { toast.error('District must be at least 2 characters.'); return; }
    setSavingId(w.id);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim() || null,
        city: form.city.trim(),
        district: form.district.trim(),
        isActive: form.isActive,
      };
      const res = await fetch(`/api/supplier/warehouses/${w.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Save failed (HTTP ${res.status})`);
        return;
      }
      toast.success(json?.message || 'Pickup location saved');
      void load();
    } catch {
      toast.error('Network error while saving. Retry.');
    } finally {
      setSavingId(null);
    }
  };

  const createWarehouse = async () => {
    if (createForm.name.trim().length < 2) { toast.error('Location name must be at least 2 characters.'); return; }
    if (createForm.addressLine1.trim().length < 2) { toast.error('Address line 1 must be at least 2 characters.'); return; }
    if (createForm.city.trim().length < 2) { toast.error('City must be at least 2 characters.'); return; }
    if (createForm.district.trim().length < 2) { toast.error('District must be at least 2 characters.'); return; }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        name: createForm.name.trim(),
        addressLine1: createForm.addressLine1.trim(),
        city: createForm.city.trim(),
        district: createForm.district.trim(),
        isActive: createForm.isActive,
      };
      if (createForm.addressLine2.trim()) body.addressLine2 = createForm.addressLine2.trim();
      const res = await fetch('/api/supplier/warehouses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 201 && json?.success) {
        toast.success(json?.message || 'Pickup location added');
        setShowCreate(false);
        setCreateForm({ name: '', addressLine1: '', addressLine2: '', city: '', district: '', isActive: true });
        void load();
      } else {
        toast.error(json?.error || `Add failed (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Network error while adding. Retry.');
    } finally {
      setCreating(false);
    }
  };

  const updateEdit = (id: string, patch: Partial<WarehouseForm>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <div className="p-2"><Skeleton className="w-5 h-5 rounded-full" /></div>
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (state === 'auth' || state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Self Pickup</h1>
        </div>
        <div className="p-4 md:max-w-3xl md:mx-auto md:pt-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {state === 'auth' && (
                <button onClick={() => navigate('login')} className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium">
                  Sign in
                </button>
              )}
              <button onClick={load} className="min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-2">
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
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Self Pickup</h1>
        </div>
        <button onClick={load} aria-label="Refresh" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="p-4 md:max-w-3xl md:mx-auto md:p-6 md:pt-8 space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Self Pickup Locations</h1>
          <button onClick={load} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Honest notice about the operating-hours fields the rail does not carry yet */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            The warehouse model saves <strong>name, address, city, district</strong>, and <strong>active flag</strong>.
            Pickup hours, contact person, phone, operating days, and gate-pass automation are drafts below — they are
            not persisted yet (no rail has shipped those fields). Save only stores the real fields.
          </p>
        </div>

        {warehouses.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-2">
            <Building className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No pickup locations yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Add a warehouse so buyers can self-pickup orders.</p>
          </div>
        ) : (
          warehouses.map((w) => {
            const form = edits[w.id] ?? toForm(w);
            const dirty = JSON.stringify(form) !== JSON.stringify(toForm(w));
            return (
              <div key={w.id} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Pickup location</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${form.isActive ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Location name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateEdit(w.id, { name: e.target.value })}
                    className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Address line 1</label>
                  <textarea
                    value={form.addressLine1}
                    onChange={(e) => updateEdit(w.id, { addressLine1: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Address line 2 (optional)</label>
                  <input
                    type="text"
                    value={form.addressLine2}
                    onChange={(e) => updateEdit(w.id, { addressLine2: e.target.value })}
                    className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => updateEdit(w.id, { city: e.target.value })}
                      className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">District</label>
                    <input
                      type="text"
                      value={form.district}
                      onChange={(e) => updateEdit(w.id, { district: e.target.value })}
                      className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => updateEdit(w.id, { isActive: e.target.checked })}
                    className="w-4 h-4 text-primary"
                  />
                  Active (buyers can pick this location at checkout)
                </label>

                {/* Draft-only operating hours block — NOT persisted (no rail yet) */}
                <div className="bg-gray-50 dark:bg-gray-950 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <Clock className="w-3.5 h-3.5" /> Operating hours (draft — not persisted yet)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Opening</label>
                      <input type="time" defaultValue="09:00" className="w-full px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-sm text-gray-500 dark:text-gray-400" disabled />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Closing</label>
                      <input type="time" defaultValue="18:00" className="w-full px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-sm text-gray-500 dark:text-gray-400" disabled />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => patchWarehouse(w)}
                    disabled={!dirty || savingId === w.id}
                    className="px-4 py-2 rounded bg-primary text-white inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <Save className="w-4 h-4" /> {savingId === w.id ? 'Saving…' : 'Save location'}
                  </button>
                </div>
              </div>
            );
          })
        )}

        {showCreate ? (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-primary shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm inline-flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> New pickup location
              </h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Location name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tejgaon Depot"
                className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Address line 1</label>
              <textarea
                value={createForm.addressLine1}
                onChange={(e) => setCreateForm((f) => ({ ...f, addressLine1: e.target.value }))}
                rows={2}
                placeholder="House, road, area"
                className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Address line 2 (optional)</label>
              <input
                type="text"
                value={createForm.addressLine2}
                onChange={(e) => setCreateForm((f) => ({ ...f, addressLine2: e.target.value }))}
                className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">City</label>
                <input
                  type="text"
                  value={createForm.city}
                  onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">District</label>
                <input
                  type="text"
                  value={createForm.district}
                  onChange={(e) => setCreateForm((f) => ({ ...f, district: e.target.value }))}
                  className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={createForm.isActive}
                onChange={(e) => setCreateForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 text-primary"
              />
              Active immediately
            </label>
            <button
              onClick={createWarehouse}
              disabled={creating}
              className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {creating ? 'Adding…' : 'Add pickup location'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-3 bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:border-primary hover:text-primary inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add pickup location
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default SelfPickupSettingsPage;
