'use client';

/**
 * Store customization (Task 50-a) — REAL persistence via GET/PATCH
 * /api/supplier/storefront (sellerStoreCustomizations upsert). The old page
 * fetched the 6-line static stub /api/supplier/customization (theme:'Red',
 * hardcoded booleans) and its Save button had no onClick at all.
 *
 * Exposed here are exactly the fields with REAL persistence AND a real
 * consumer or real schema round-trip:
 *  - bannerUrl / logoUrl  → rendered by the public seller storefront page
 *  - showRatings / showContactInfo / showCategories → schema-backed booleans
 *    persisted by the PATCH (round-trips on reload)
 * Images upload through /api/uploads/product-media (supplier-gated, real files).
 *
 * Deliberately NOT exposed (honest-absence mandate): theme/layout/font (schema
 * columns exist but no enum values beyond the defaults and no renderer
 * consumes them — options would be invented), company description (no schema
 * column exists), showRecentOrders (the storefront PATCH does not persist it).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, ImagePlus, Loader2, LogIn, Save, Store, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';

interface StoreCustomizationRow {
  bannerUrl: string | null;
  logoUrl: string | null;
  showRatings: boolean;
  showContactInfo: boolean;
  showCategories: boolean;
}

const inputClass =
  'w-full min-h-11 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

async function uploadStoreImage(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/uploads/product-media', { method: 'POST', body, credentials: 'include' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.url) {
    throw new Error(json?.error || `Upload failed (HTTP ${res.status})`);
  }
  return String(json.url);
}

export function StoreCustomizationPage() {
  const { goBack, navigate } = useNavigationStore();
  const token = useAuthStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [companyName, setCompanyName] = useState('');

  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showRatings, setShowRatings] = useState(true);
  const [showContactInfo, setShowContactInfo] = useState(true);
  const [showCategories, setShowCategories] = useState(true);

  const [uploading, setUploading] = useState<'banner' | 'logo' | ''>('');
  const [saving, setSaving] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = useCallback(async () => {
    // No session yet → the sign-in state directly (the storefront GET is public
    // by design and answers 404 for unknown suppliers, so auth must be checked
    // client-side to tell 'not signed in' apart from 'no seller profile').
    if (!useAuthStore.getState().token) {
      setNeedsAuth(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch('/api/supplier/storefront', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true);
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.data) {
        if (res.status === 404) {
          setNeedsRegistration(true);
          return;
        }
        setFetchError(json?.error || `Failed to load store settings (HTTP ${res.status})`);
        return;
      }
      const supplier = json.data;
      setCompanyName(supplier.companyName ?? '');
      const c = supplier.storeCustomization;
      setBannerUrl(c?.bannerUrl ?? null);
      setLogoUrl(c?.logoUrl ?? null);
      setShowRatings(c?.showRatings ?? true);
      setShowContactInfo(c?.showContactInfo ?? true);
      setShowCategories(c?.showCategories ?? true);
    } catch {
      setFetchError('Network error while loading store settings. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleImageSelected = async (target: 'banner' | 'logo', files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error(`${file.name}: only PNG, JPEG, or WebP images are accepted`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 5MB limit`);
      return;
    }
    setUploading(target);
    try {
      const url = await uploadStoreImage(file);
      if (target === 'banner') setBannerUrl(url);
      else setLogoUrl(url);
      toast.success(`${target === 'banner' ? 'Banner' : 'Logo'} uploaded — press Save to apply it to your storefront`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error(message);
    } finally {
      setUploading('');
      if (target === 'banner' && bannerInputRef.current) bannerInputRef.current.value = '';
      if (target === 'logo' && logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/supplier/storefront', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          bannerUrl,
          logoUrl,
          showRatings,
          showContactInfo,
          showCategories,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        // Real backend error verbatim — never a fake success toast.
        const message = json?.error || `Saving store settings failed (HTTP ${res.status})`;
        toast.error(message);
        return;
      }
      const saved = json.data as StoreCustomizationRow;
      setBannerUrl(saved.bannerUrl ?? null);
      setLogoUrl(saved.logoUrl ?? null);
      setShowRatings(saved.showRatings);
      setShowContactInfo(saved.showContactInfo);
      setShowCategories(saved.showCategories);
      toast.success(json.message || 'Store settings saved');
    } catch {
      toast.error('Network error — store settings were not saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" role="status" aria-label="Loading store settings">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Store Customization</h1>
        </div>
        <div className="p-4 max-w-3xl mx-auto md:p-6 md:pt-10">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center space-y-4">
            <LogIn className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-700">Sign in as a supplier to customize your store.</p>
            <button onClick={() => navigate('login')} className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium">
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (needsRegistration) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
        <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Store Customization</h1>
        </div>
        <div className="p-4 max-w-3xl mx-auto md:p-6 md:pt-10">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center space-y-4">
            <Store className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-700">
              No seller store found for this account. Complete seller registration to customize a storefront.
            </p>
            <button onClick={() => navigate('seller-onboarding')} className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium">
              Start seller registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} aria-label="Go back" className="min-h-11 min-w-11 p-2 hover:bg-gray-100 rounded-full flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Store Customization</h1>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6 md:p-6 md:pt-6">
        <div>
          <h1 className="hidden md:block text-2xl font-bold text-gray-900">Store Customization</h1>
          {companyName && <p className="text-sm text-gray-500 mt-1">Branding for “{companyName}” — changes apply to your public storefront after you save.</p>}
        </div>

        {fetchError && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700">
              {fetchError}
              <button onClick={fetchSettings} className="block mt-1 underline font-medium">Retry</button>
            </div>
          </div>
        )}

        {/* Banner */}
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900">Store banner</h2>
          {bannerUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-gray-100">
              { }
              <img src={bannerUrl} alt="Store banner" className="w-full h-36 object-cover" />
              <button
                type="button"
                aria-label="Remove banner"
                onClick={() => setBannerUrl(null)}
                className="absolute top-2 right-2 min-h-11 min-w-11 p-2 bg-white/90 border border-gray-200 rounded-full text-red-500 hover:bg-red-50 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No banner set — your storefront shows a plain header until you upload one.</p>
          )}
          <div className="flex items-center gap-3">
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              id="store-banner-input"
              onChange={(e) => handleImageSelected('banner', e.target.files)}
            />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploading !== ''}
              className="min-h-11 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 hover:bg-gray-50 disabled:opacity-60"
            >
              {uploading === 'banner' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {bannerUrl ? 'Replace banner' : 'Upload banner'}
            </button>
            <span className="text-xs text-gray-500">PNG, JPG, WebP up to 5MB</span>
          </div>
        </section>

        {/* Logo */}
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900">Store logo</h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
              {logoUrl ? (
                 
                <img src={logoUrl} alt="Store logo" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-6 h-6 text-gray-300" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                id="store-logo-input"
                onChange={(e) => handleImageSelected('logo', e.target.files)}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploading !== ''}
                className="min-h-11 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 hover:bg-gray-50 disabled:opacity-60"
              >
                {uploading === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="block text-xs text-red-500 underline"
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Storefront section toggles — schema-backed, persisted by the real PATCH */}
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900">Storefront sections</h2>
          <label className="flex items-center justify-between min-h-11 cursor-pointer">
            <span className="text-sm text-gray-700">Show product ratings</span>
            <input
              type="checkbox"
              checked={showRatings}
              onChange={(e) => setShowRatings(e.target.checked)}
              className="w-5 h-5 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between min-h-11 cursor-pointer">
            <span className="text-sm text-gray-700">Show contact info</span>
            <input
              type="checkbox"
              checked={showContactInfo}
              onChange={(e) => setShowContactInfo(e.target.checked)}
              className="w-5 h-5 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between min-h-11 cursor-pointer">
            <span className="text-sm text-gray-700">Show product categories</span>
            <input
              type="checkbox"
              checked={showCategories}
              onChange={(e) => setShowCategories(e.target.checked)}
              className="w-5 h-5 accent-primary"
            />
          </label>
        </section>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading !== ''}
          className="w-full min-h-11 bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : (
            <>
              <Save className="w-5 h-5" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default StoreCustomizationPage;
