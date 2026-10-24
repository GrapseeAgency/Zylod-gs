'use client';

/**
 * Shipping Zone Editor (Task 175-b) — REAL hydration + REAL save.
 *
 * The previous page rendered two fabricated zones ("Dhaka Inside 1000-1299"
 * and "Dhaka Suburbs 1300-1499") with invented rates and the Save / Add
 * buttons had NO onClick. The real rail at /api/admin/shipping/zones is
 * admin-only (Task 94) and lists the platform's REAL shippingZones rows —
 * each carries name, a CSV of district names (NOT postcodes), isActive,
 * and a live rateCount.
 *
 * This page now:
 *   - loads the real zones via GET /api/admin/shipping/zones,
 *   - surfaces 401 honestly ("Shipping zone management is not available
 *     on this account") for non-admins — admins get the real editor,
 *   - lets an admin edit a zone's name / districts / isActive via PATCH
 *     /api/admin/shipping/zones/[id] (the canonical writer),
 *   - lets an admin create a new zone via POST /api/admin/shipping/zones,
 *   - honestly shows rateCount and createdAt as read-only context,
 *   - never fabricates a postcode range, a transit-day band, or a rate —
 *     those fields live on shippingRates (admin-shipping-page.tsx) and
 *     shippingMethods respectively, not on this surface.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Plus, RefreshCw, AlertTriangle, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface Zone {
  id: string;
  name: string;
  districts: string[];
  isActive: boolean;
  rateCount: number;
  createdAt: string;
}

interface ZoneForm {
  name: string;
  districts: string; // CSV textarea
  isActive: boolean;
}

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

function toForm(z: Zone): ZoneForm {
  return { name: z.name, districts: z.districts.join(', '), isActive: z.isActive };
}

function parseDistrictsCsv(csv: string): string[] {
  return csv
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

export function ShippingZoneEditorPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [edits, setEdits] = useState<Record<string, ZoneForm>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ZoneForm>({ name: '', districts: '', isActive: true });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('Shipping zone management is an admin console — sign in as an admin to manage zones.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const res = await fetch('/api/admin/shipping/zones', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'Shipping zone management is not available on this account.');
        return;
      }
      if (!res.ok || !json?.success || !Array.isArray(json?.data)) {
        setState('error');
        setLoadError(json?.error || `Failed to load shipping zones (HTTP ${res.status})`);
        return;
      }
      setZones(json.data as Zone[]);
      const nextEdits: Record<string, ZoneForm> = {};
      for (const z of json.data as Zone[]) nextEdits[z.id] = toForm(z);
      setEdits(nextEdits);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading shipping zones. Check your connection and retry.');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const patchZone = async (z: Zone) => {
    const form = edits[z.id];
    if (!form) return;
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error('Zone name must be at least 2 characters.');
      return;
    }
    const districts = parseDistrictsCsv(form.districts);
    if (districts.length === 0) {
      toast.error('A zone must cover at least one district.');
      return;
    }
    setSavingId(z.id);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${z.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ name: form.name.trim(), districts, isActive: form.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Save failed (HTTP ${res.status})`);
        return;
      }
      toast.success(json?.data?.isActive ? `Zone "${json.data.name}" saved` : `Zone "${json.data.name}" saved (inactive)`);
      void load();
    } catch {
      toast.error('Network error while saving. Check your connection and retry.');
    } finally {
      setSavingId(null);
    }
  };

  const deleteZone = async (z: Zone) => {
    if (z.rateCount > 0) {
      toast.error(`This zone has ${z.rateCount} rate(s) attached — remove them in the admin shipping console before deleting.`);
      return;
    }
    if (!confirm(`Delete zone "${z.name}"? This cannot be undone.`)) return;
    setSavingId(z.id);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${z.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Delete failed (HTTP ${res.status})`);
        return;
      }
      toast.success('Zone deleted');
      void load();
    } catch {
      toast.error('Network error while deleting. Retry.');
    } finally {
      setSavingId(null);
    }
  };

  const createZone = async () => {
    if (!createForm.name.trim() || createForm.name.trim().length < 2) {
      toast.error('Zone name must be at least 2 characters.');
      return;
    }
    const districts = parseDistrictsCsv(createForm.districts);
    if (districts.length === 0) {
      toast.error('A zone must cover at least one district.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/shipping/zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ name: createForm.name.trim(), districts, isActive: createForm.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 201 && json?.success) {
        toast.success(`Zone "${json.data.name}" created`);
        setShowCreate(false);
        setCreateForm({ name: '', districts: '', isActive: true });
        void load();
      } else {
        toast.error(json?.error || `Create failed (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Network error while creating. Retry.');
    } finally {
      setCreating(false);
    }
  };

  const updateEdit = (id: string, patch: Partial<ZoneForm>) => {
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
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Shipping Zones</h1>
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Shipping Zones</h1>
        </div>
        <button onClick={load} aria-label="Refresh" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="p-4 md:max-w-3xl md:mx-auto md:p-6 md:pt-8 space-y-4">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shipping Zones</h1>
          <button onClick={load} className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-primary inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 -mt-2">
          Zones cover districts (not postcodes). A district can belong to only one active zone. Rates are managed in the admin shipping console.
        </p>

        {zones.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-2">
            <MapPin className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No shipping zones yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Create the first zone to start covering districts.</p>
          </div>
        ) : (
          zones.map((z) => {
            const form = edits[z.id] ?? toForm(z);
            const dirty = JSON.stringify(form) !== JSON.stringify(toForm(z));
            return (
              <div key={z.id} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateEdit(z.id, { name: e.target.value })}
                      className="font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-b border-transparent focus:border-primary focus:outline-none text-sm flex-1 min-w-0"
                    />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${form.isActive ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Covered districts (comma-separated)</label>
                  <textarea
                    value={form.districts}
                    onChange={(e) => updateEdit(z.id, { districts: e.target.value })}
                    rows={2}
                    placeholder="Dhaka, Gazipur, Narayanganj"
                    className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => updateEdit(z.id, { isActive: e.target.checked })}
                    className="w-4 h-4 text-primary"
                  />
                  Active (matches buyers at checkout)
                </label>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  <span>{z.rateCount} rate(s) attached · created {new Date(z.createdAt).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteZone(z)}
                      disabled={savingId === z.id}
                      className="px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center gap-1 disabled:opacity-50"
                      title={z.rateCount > 0 ? 'Remove attached rates first' : 'Delete zone'}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                    <button
                      onClick={() => patchZone(z)}
                      disabled={!dirty || savingId === z.id}
                      className="px-3 py-1.5 rounded bg-primary text-white inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Save className="w-3.5 h-3.5" /> {savingId === z.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {showCreate ? (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-primary shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">New zone</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Zone name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Dhaka Metro"
                className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Districts (comma-separated)</label>
              <textarea
                value={createForm.districts}
                onChange={(e) => setCreateForm((f) => ({ ...f, districts: e.target.value }))}
                rows={2}
                placeholder="Dhaka, Gazipur, Narayanganj"
                className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary resize-none"
              />
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
              onClick={createZone}
              disabled={creating}
              className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {creating ? 'Creating…' : 'Create zone'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-3 bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:border-primary hover:text-primary inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add new zone
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default ShippingZoneEditorPage;
