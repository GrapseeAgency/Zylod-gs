'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Loader2, Warehouse, Power } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

/**
 * Task 98: THE WAREHOUSE RAIL on the storefront. Buyers read the supplier's
 * ACTIVE ship-from locations — real addresses, real districts, coordinates
 * when the supplier filed them. The OWNER (viewing their own store, no
 * supplierId param) gets the manage console in the same tab: add, toggle,
 * remove — every error surfaced verbatim from the guarded rail (cap 409
 * included). Empty means empty: no invented distribution centers.
 */

export interface WarehouseRow {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  district: string;
  lat: number | null;
  lng: number | null;
  isActive?: boolean;
}

const EMPTY_FORM = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  district: '',
  lat: '',
  lng: '',
};

const WarehouseCard = ({
  w,
  manage,
  onToggle,
  onRemove,
  busy,
}: {
  w: WarehouseRow;
  manage: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  busy?: boolean;
}) => (
  <div
    className={`bg-white dark:bg-gray-800 rounded-lg border p-3 ${
      manage && w.isActive === false ? 'opacity-60 border-dashed' : 'border-gray-100 dark:border-gray-700'
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-white flex items-center gap-1.5">
          <Warehouse className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
          <span className="truncate">{w.name}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">
          {w.addressLine1}
          {w.addressLine2 ? `, ${w.addressLine2}` : ''}
          <br />
          {w.city}, {w.district}
        </div>
        {w.lat !== null && w.lng !== null && (
          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {w.lat.toFixed(4)}, {w.lng.toFixed(4)}
          </div>
        )}
      </div>
      {manage && (
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <Power className="w-3 h-3 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <Switch
              checked={w.isActive === true}
              onCheckedChange={() => onToggle?.()}
              disabled={busy}
              aria-label={`${w.isActive === false ? 'Activate' : 'Deactivate'} ${w.name}`}
            />
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label={`Remove ${w.name}`}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-900 dark:hover:bg-gray-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  </div>
);

export const StorefrontWarehouses = ({
  ownView,
  guestRows,
}: {
  ownView: boolean;
  guestRows?: WarehouseRow[] | null;
}) => {
  const [rows, setRows] = useState<WarehouseRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  // Own view: load the FULL managed list (active + inactive).
  useEffect(() => {
    if (!ownView) return;
    const load = async () => {
      try {
        const res = await fetch('/api/supplier/warehouses');
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          setRows(json.data);
        } else {
          setError(json?.error || `Could not load your warehouse locations (HTTP ${res.status})`);
        }
      } catch {
        setError('Could not reach the warehouse service');
      }
    };
    load();
  }, [ownView]);

  const addRow = async () => {
    setFormError('');
    if (!form.name.trim() || !form.addressLine1.trim() || !form.city.trim() || !form.district.trim()) {
      setFormError('Name, address, city and district are required.');
      return;
    }
    const lat = form.lat.trim() === '' ? null : Number(form.lat);
    const lng = form.lng.trim() === '' ? null : Number(form.lng);
    if ((lat !== null && Number.isNaN(lat)) || (lng !== null && Number.isNaN(lng))) {
      setFormError('Coordinates must be numbers (lat −90…90, lng −180…180).');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/supplier/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          addressLine1: form.addressLine1,
          ...(form.addressLine2.trim() ? { addressLine2: form.addressLine2 } : {}),
          city: form.city,
          district: form.district,
          ...(lat !== null ? { lat } : {}),
          ...(lng !== null ? { lng } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 201 && json?.success) {
        setRows((prev) => [...(prev ?? []), json.data]);
        setForm(EMPTY_FORM);
        setShowForm(false);
        toast.success('Warehouse location added — buyers see it on your storefront');
      } else {
        setFormError(json?.error || `Could not add the location (HTTP ${res.status})`);
      }
    } catch {
      setFormError('Could not reach the warehouse service');
    } finally {
      setBusy(false);
    }
  };

  const toggleRow = async (w: WarehouseRow) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/supplier/warehouses/${w.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: w.isActive === false }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setRows((prev) => (prev ?? []).map((r) => (r.id === w.id ? { ...r, isActive: json.data.isActive } : r)));
      } else {
        toast.error(json?.error || `Could not update (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the warehouse service');
    } finally {
      setBusy(false);
    }
  };

  const removeRow = async (w: WarehouseRow) => {
    if (!confirm(`Remove "${w.name}" from your storefront?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/supplier/warehouses/${w.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setRows((prev) => (prev ?? []).filter((r) => r.id !== w.id));
        toast.success('Warehouse location removed');
      } else {
        toast.error(json?.error || `Could not remove (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the warehouse service');
    } finally {
      setBusy(false);
    }
  };

  // Guests render the parent's storefront fetch; the owner manages the full list.
  const list = ownView ? rows : (guestRows ?? []);

  return (
    <div className="space-y-4" aria-live="polite">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {list && list.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((w) => (
            <WarehouseCard
              key={w.id}
              w={w}
              manage={ownView}
              busy={busy}
              onToggle={ownView ? () => toggleRow(w) : undefined}
              onRemove={ownView ? () => removeRow(w) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <Warehouse className="w-10 h-10 text-gray-300 dark:text-gray-600 dark:text-gray-400 dark:text-gray-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No warehouse locations listed</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
            {ownView
              ? 'Add where your goods actually ship from — buyers read this before a bulk order.'
              : 'This store has not published its ship-from locations yet.'}
          </p>
        </div>
      )}

      {ownView && (
        <div>
          {!showForm ? (
            <Button type="button" onClick={() => setShowForm(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-1" /> Add warehouse location
            </Button>
          ) : (
            <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 block mb-1">Location name *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tejgaon Main Warehouse" className="bg-gray-50 dark:bg-gray-950 dark:bg-gray-900" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 block mb-1">Address line 1 *</label>
                  <Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} placeholder="House 42, Road 11" className="bg-gray-50 dark:bg-gray-950 dark:bg-gray-900" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 block mb-1">Address line 2</label>
                  <Input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} placeholder="Block C (optional)" className="bg-gray-50 dark:bg-gray-950 dark:bg-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 block mb-1">City *</label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Dhaka" className="bg-gray-50 dark:bg-gray-950 dark:bg-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 block mb-1">District *</label>
                  <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="Dhaka" className="bg-gray-50 dark:bg-gray-950 dark:bg-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 block mb-1">Latitude</label>
                  <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="23.7509 (optional)" className="bg-gray-50 dark:bg-gray-950 dark:bg-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 block mb-1">Longitude</label>
                  <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="90.3932 (optional)" className="bg-gray-50 dark:bg-gray-950 dark:bg-gray-900" />
                </div>
              </div>
              {formError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5" role="alert">{formError}</p>
              )}
              <div className="flex gap-2">
                <Button type="button" onClick={addRow} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save location
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setFormError(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StorefrontWarehouses;
