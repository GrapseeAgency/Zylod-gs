'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, ImagePlus, X, Check, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth-store';

/**
 * Task 115: CREATE A REAL CAMPAIGN. This page used to be a static mockup —
 * inputs bound to nothing, the Create button did nothing. It now speaks the
 * real seller rail (POST /api/supplier/promotions): percentage/fixed only
 * (the engine computes what it can prove — bogo/free-shipping are refused
 * with the honest reason), at least one OWN approved product pinned, real
 * banner upload, and the live toggle that decides whether buyers see it
 * immediately. Every server refusal lands verbatim in a toast.
 */

interface PickerProduct {
  id: string;
  name: string;
  basePrice: number;
  unit: string;
  isActive: boolean;
  isApproved: boolean;
  images?: Array<{ imageUrl: string }>;
}

async function uploadBanner(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/uploads/product-media', { method: 'POST', body, credentials: 'include' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.url) {
    throw new Error(json?.error || `Upload failed (HTTP ${res.status})`);
  }
  return String(json.url);
}

export function CreatePromotionPage() {
  const { goBack, navigate } = useNavigationStore();
  const user = useAuthStore((s) => s.user);

  const [name, setName] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [products, setProducts] = useState<PickerProduct[] | null>(null);
  const [productsError, setProductsError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // The pin picker reads the seller's OWN products. Only active+approved
  // products are selectable — the server re-validates both at POST (phantom,
  // foreign and hidden/unapproved are distinguishable refusals).
  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const res = await fetch('/api/supplier/products?limit=100&status=approved', { credentials: 'include' });
        const json = await res.json();
        if (dead) return;
        if (res.ok && json.success) {
          setProducts(json.data?.items ?? []);
        } else {
          setProductsError(json.error || 'Could not load your products');
          setProducts([]);
        }
      } catch {
        if (dead) return;
        setProductsError('Could not reach the products service');
        setProducts([]);
      }
    };
    load();
    return () => {
      dead = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const togglePin = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const url = await uploadBanner(file);
      setBannerUrl(url);
      toast.success('Banner uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Banner upload failed');
    } finally {
      setBannerUploading(false);
      e.target.value = '';
    }
  };

  const toIso = (local: string) => (local ? new Date(local).toISOString() : '');

  const submit = async () => {
    if (selected.size === 0) {
      toast.error('Pin at least one of your products to this campaign');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        type,
        value: Number(value),
        validFrom: toIso(validFrom),
        validUntil: toIso(validUntil),
        isActive,
        productIds: [...selected],
      };
      if (minOrderAmount && Number(minOrderAmount) > 0) body.minOrderAmount = Number(minOrderAmount);
      if (maxDiscount && Number(maxDiscount) > 0) body.maxDiscount = Number(maxDiscount);
      if (usageLimit && Number(usageLimit) > 0) body.usageLimit = Number(usageLimit);
      if (description.trim()) body.description = description.trim();
      if (bannerUrl) body.bannerImageUrl = bannerUrl;

      const res = await fetch('/api/supplier/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.status === 201 && json.success) {
        toast.success(isActive ? 'Campaign is LIVE — buyers see it on your store and it prices orders automatically' : 'Campaign created — flip it live from the campaigns list when ready');
        navigate('seller-promotions');
      } else {
        toast.error(json.error || 'Could not create the campaign');
      }
    } catch {
      toast.error('Could not reach the campaigns service');
    } finally {
      setSaving(false);
    }
  };

  const valid =
    name.trim().length > 0 &&
    Number(value) > 0 &&
    (type !== 'percentage' || Number(value) <= 100) &&
    validFrom.length > 0 &&
    validUntil.length > 0 &&
    new Date(validUntil) > new Date(validFrom) &&
    selected.size > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 dark:bg-gray-900 flex flex-col">
      {/* Mobile header (red) */}
      <header className="md:hidden bg-primary text-white p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4" aria-label="Go back"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-xl font-bold">Create Campaign</h1>
        </div>
      </header>
      {/* Desktop header */}
      <header className="hidden md:flex sticky top-0 z-20 items-center gap-3 px-6 h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <button onClick={goBack} className="p-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 dark:hover:bg-gray-700 transition" aria-label="Go back">
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <h1 className="text-xl font-bold text-primary">Create Campaign</h1>
      </header>
      <main className="flex-1 p-4 md:p-6 md:max-w-3xl md:mx-auto md:w-full space-y-4 pb-20 md:pb-8">
        <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 dark:border-gray-700 space-y-4 md:p-6">
          <div>
            <Label htmlFor="cp-name">Campaign name</Label>
            <Input id="cp-name" placeholder="e.g. Eid wholesale bonanza" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="cp-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'percentage' | 'fixed')}>
                <SelectTrigger id="cp-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage off</SelectItem>
                  <SelectItem value="fixed">Fixed ৳ off</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
                The engine computes exactly these — buy-one-get-one and free-shipping are refused because nothing can prove them.
              </p>
            </div>
            <div>
              <Label htmlFor="cp-value">Discount value {type === 'percentage' ? '(%)' : '(৳)'}</Label>
              <Input id="cp-value" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'percentage' ? '10' : '500'} />
              {type === 'percentage' && Number(value) > 100 ? (
                <p className="text-xs text-red-600 mt-1">A percentage discount cannot exceed 100%</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="cp-limit">Usage limit (0 = unlimited)</Label>
              <Input id="cp-limit" type="number" min="0" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cp-from">Starts</Label>
              <Input id="cp-from" type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cp-until">Ends</Label>
              <Input id="cp-until" type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cp-min">Minimum order ৳ (0 = none)</Label>
              <Input id="cp-min" type="number" min="0" value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="cp-max">Maximum discount ৳ (optional cap)</Label>
              <Input id="cp-max" type="number" min="0" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="—" />
            </div>
          </div>

          <div>
            <Label htmlFor="cp-desc">Description (shown on your store page)</Label>
            <Textarea id="cp-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell buyers what this campaign is about" />
          </div>

          <div>
            <Label>Campaign banner (optional)</Label>
            {bannerUrl ? (
              <div className="relative mt-2 h-28 w-full max-w-md rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 dark:border-gray-700">
                <img src={bannerUrl} alt="Campaign banner" className="w-full h-full object-cover" />
                <button
                  onClick={() => setBannerUrl('')}
                  className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full"
                  aria-label="Remove banner"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="mt-2 flex items-center justify-center gap-2 h-16 w-full max-w-md rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:border-primary/50">
                {bannerUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {bannerUploading ? 'Uploading…' : 'Upload a banner image'}
                <input type="file" accept="image/*" className="hidden" onChange={onBanner} disabled={bannerUploading} />
              </label>
            )}
          </div>

          <div>
            <Label>Pin products ({selected.size} selected)</Label>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-2">Only YOUR approved, visible products can be pinned — a campaign on someone else's product is refused.</p>
            <Input placeholder="Search your products…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
            {products === null ? (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-12 rounded-lg" />
                <Skeleton className="h-12 rounded-lg" />
              </div>
            ) : productsError ? (
              <div className="text-sm text-red-600">{productsError}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-lg">
                <PackageSearch className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">No approved products found — approve products first, then pin them here.</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 dark:divide-gray-700">
                {filtered.map((p) => {
                  const isSel = selected.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePin(p.id)}
                      className={`w-full flex items-center gap-3 p-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:bg-gray-700/50 ${isSel ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                      aria-pressed={isSel}
                    >
                      <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-900 dark:bg-gray-700 overflow-hidden shrink-0">
                        {p.images?.[0]?.imageUrl ? (
                          <img src={p.images[0].imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-white truncate">{p.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">৳{p.basePrice} / {p.unit}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSel ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300 dark:border-gray-500'}`}>
                        {isSel ? <Check className="w-3 h-3" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 dark:border-gray-700">
            <div>
              <Label htmlFor="cp-live">Publish live immediately</Label>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400">Live campaigns are visible on your store page and price matching orders automatically.</p>
            </div>
            <Switch id="cp-live" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <Button className="w-full" size="lg" onClick={submit} disabled={!valid || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {saving ? 'Creating…' : 'Create campaign'}
          </Button>
          {!user ? (
            <p className="text-xs text-amber-600 text-center">Sign in as a seller to create campaigns.</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default CreatePromotionPage;
