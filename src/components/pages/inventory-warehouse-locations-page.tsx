'use client';

/**
 * Inventory Warehouse Locations (Task 175-b) — REAL hydration.
 *
 * The previous page rendered three fabricated warehouse cards ("Dhaka Hub 80%",
 * "Chittagong Port Warehouse 45%", "Gazipur Factory Store 90%") with invented
 * utilization percentages. The real rail at /api/supplier/warehouses (Task 98)
 * returns the supplier's REAL warehouseLocations rows — name, addressLine1,
 * addressLine2, city, district, lat, lng, isActive. The model has NO
 * utilization/capacity field, so we DO NOT fabricate one.
 *
 * This page now:
 *   - loads the real warehouses via GET /api/supplier/warehouses,
 *   - renders the real address (line1, line2, city, district), the active flag,
 *     and the geo coordinates (when present),
 *   - honest 401 / error / empty states,
 *   - NO fabricated utilization bars or capacity percentages.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, RefreshCw, AlertTriangle, Navigation } from 'lucide-react';
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

type LoadState = 'loading' | 'auth' | 'error' | 'ready';

export function InventoryWarehouseLocationsPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const load = useCallback(async () => {
    if (!token) {
      setState('auth');
      setLoadError('Sign in as a supplier to view warehouse locations.');
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
        setLoadError(json?.error || 'Warehouse locations are not available on this account.');
        return;
      }
      if (!res.ok || !json?.success || !Array.isArray(json?.data)) {
        setState('error');
        setLoadError(json?.error || `Failed to load warehouse locations (HTTP ${res.status})`);
        return;
      }
      setWarehouses(json.data as Warehouse[]);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading warehouse locations. Check your connection and retry.');
    }
  }, [token]);

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
        <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Warehouse Locations</h1>
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Warehouse Locations</h1>
        </div>
        <button onClick={load} aria-label="Refresh" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="p-4 md:max-w-4xl md:mx-auto md:p-6 md:pt-8 space-y-4">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Warehouse Locations</h1>
          <button onClick={load} className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-primary inline-flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 -mt-2">
          Your real ship-from locations. Manage them in the self-pickup settings. Utilization is not tracked — the warehouse model carries no capacity column.
        </p>

        {warehouses.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-2">
            <MapPin className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No warehouse locations yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Add a pickup location from self-pickup settings to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {warehouses.map((w) => (
              <div
                key={w.id}
                className="bg-white dark:bg-gray-900 p-4 md:p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-start gap-3"
              >
                <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded-lg flex-shrink-0">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm break-words">{w.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${w.isActive ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      {w.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{w.district}, {w.city}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 mt-2 break-words">{w.addressLine1}</p>
                  {w.addressLine2 && <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 break-words">{w.addressLine2}</p>}
                  {w.lat != null && w.lng != null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${w.lat}&mlon=${w.lng}#map=16/${w.lat}/${w.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary inline-flex items-center gap-1 mt-2 hover:underline"
                    >
                      <Navigation className="w-3 h-3" /> {w.lat.toFixed(4)}, {w.lng.toFixed(4)}
                    </a>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-2">
                    Added {new Date(w.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default InventoryWarehouseLocationsPage;
