'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Edit, Package, Share2, Star, ImageOff, Store, AlertCircle, ShieldCheck, BadgePercent, MessageCircleQuestion, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import StorefrontCertifications, { StorefrontCertRollup } from '@/components/supplier/storefront-certifications';
import StorefrontWarehouses, { WarehouseRow } from '@/components/supplier/storefront-warehouses';
import StorefrontReviews, { StorefrontReviewRow } from '@/components/supplier/storefront-reviews';
import StorefrontCampaigns from '@/components/supplier/storefront-campaigns';

interface StorefrontData {
  id?: string;
  companyName?: string;
  verificationStatus?: string;
  ratingAvg?: number;
  ratingCount?: number;
  storeCustomization?: { bannerUrl?: string | null; logoUrl?: string | null; theme?: string; layout?: string } | null;
  products?: Array<{
    id: string;
    name: string;
    basePrice: number;
    unit: string;
    moq: number;
    thumbnailUrl?: string | null;
  }>;
  _count?: { products?: number; supplierReviews?: number };
  // Task 96: the server-computed rollup of the Task-92 certification rail
  // across this store's PUBLIC products. Null/absent = honest empty state.
  certificationRollup?: StorefrontCertRollup | null;
  // Task 98: the supplier's ACTIVE ship-from locations (public projection).
  warehouses?: WarehouseRow[];
  // Task 105: the store's real buyer reviews (public projection, `mine`
  // marked server-side for the signed-in viewer only).
  reviews?: StorefrontReviewRow[];
}

/** Initials circle from the store's real company name (up to 2 letters). */
function StoreInitials({ name, className }: { name: string; className: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('') || '?';
  return (
    <div
      className={`${className} flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 dark:text-gray-300 font-black select-none`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

export const SellerStorefrontPage = () => {
  const { goBack, navigate, pageParams } = useNavigationStore();
  const [data, setData] = useState<StorefrontData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Task 146: the buyer→seller query circuit — a visitor asks THIS store a
  // structured pre-order / custom-request / complaint question.
  const [askOpen, setAskOpen] = useState(false);
  const [askType, setAskType] = useState<'pre_order' | 'custom_request' | 'complaint'>('pre_order');
  const [askSubject, setAskSubject] = useState('');
  const [askMessage, setAskMessage] = useState('');
  const [asking, setAsking] = useState(false);

  // Viewing a specific supplier's storefront (e.g. via "Visit store" on a
  // product page) vs. the signed-in supplier's own storefront.
  const viewedSupplierId = pageParams.supplierId || pageParams.id || '';

  // Task 105: extracted so the Reviews tab can trigger a refresh after a
  // write — the header aggregates and the list re-render from the same
  // source of truth (the storefront API), never local guesses.
  const fetchStore = React.useCallback(async () => {
    try {
      const url = viewedSupplierId
        ? `/api/supplier/storefront?supplierId=${encodeURIComponent(viewedSupplierId)}`
        : '/api/supplier/storefront';
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setData(json.data);
      } else {
        // Real API error surfaced — no demo content is substituted.
        setError(json.error || 'Store profile not available');
      }
    } catch (e) {
      console.error(e);
      setError('Could not reach the store service');
    } finally {
      setLoading(false);
    }
  }, [viewedSupplierId]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  const submitAsk = async () => {
    if (askSubject.trim().length < 3 || askMessage.trim().length < 5) {
      toast.error('A real question needs a subject (3+) and a message (5+).');
      return;
    }
    try {
      setAsking(true);
      const res = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          supplierId: campaignSupplierId,
          queryType: askType,
          subject: askSubject.trim(),
          message: askMessage.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 201) {
        toast.success(json?.message || 'Query filed — the seller has been notified.');
        setAskOpen(false);
        setAskSubject('');
        setAskMessage('');
      } else if (res.status === 401) {
        toast.error('Sign in as a buyer to ask this store a question.');
      } else {
        toast.error(json?.error || `Could not file the question (${res.status}).`);
      }
    } catch {
      toast.error('Network error filing the question.');
    } finally {
      setAsking(false);
    }
  };

  const companyName = data?.companyName ?? '';
  const productCount = data?.products?.length ?? 0;
  // Task 115: the campaign rail needs the supplier's profile id — present
  // on both the own view (data.id) and the visitor view (param).
  const campaignSupplierId = data?.id || viewedSupplierId;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 dark:bg-gray-900 pb-20 md:pb-8">
      {/* Banner Area — neutral gradient when no real banner is set */}
      <div className="relative h-48 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700">
        {loading ? (
          <Skeleton className="w-full h-full" />
        ) : data?.storeCustomization?.bannerUrl ? (
          <img src={data.storeCustomization.bannerUrl} alt="Store Banner" className="w-full h-full object-cover" />
        ) : !error ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 dark:text-gray-400 gap-1">
            <ImageOff className="w-8 h-8" />
            <span className="text-[11px]">No banner set yet</span>
          </div>
        ) : null}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <button onClick={goBack} className="md:hidden p-2 bg-black/50 text-white rounded-full backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            {/* Edit only makes sense on the signed-in supplier's OWN storefront */}
            {!viewedSupplierId && (
              <button className="p-2 bg-black/50 text-white rounded-full backdrop-blur-sm" onClick={() => navigate('store-banner-editor')}>
                <Edit className="w-5 h-5" />
              </button>
            )}
            <button className="p-2 bg-black/50 text-white rounded-full backdrop-blur-sm">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        /* Honest state — no demo store content is invented */
        <div className="px-4 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 dark:text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">Store profile not available</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">{error}</p>
          <Button onClick={goBack} className="mt-4">Go Back</Button>
        </div>
      ) : (
        <>
          {/* Profile Header */}
          <div className="px-4 relative pt-12 pb-4 bg-white dark:bg-gray-900 dark:bg-gray-800 shadow-sm mb-2">
            <div className="absolute -top-10 left-4">
              {loading ? (
                <Skeleton className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800" />
              ) : data?.storeCustomization?.logoUrl ? (
                <img src={data.storeCustomization.logoUrl} alt="Logo" className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800 object-cover bg-white dark:bg-gray-900" />
              ) : companyName ? (
                <StoreInitials name={companyName} className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800 text-2xl" />
              ) : (
                <div className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  <Store className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="flex justify-between items-start mb-2">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-white flex items-center gap-2">
                  {loading ? <Skeleton className="w-32 h-6" /> : companyName || 'Unnamed store'}
                </h1>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 gap-3">
                  {/* Verified only reflects the real KYC verification status */}
                  {data?.verificationStatus === 'approved' && (
                    <span className="flex items-center gap-1 text-green-600">Verified</span>
                  )}
                  {typeof data?._count?.products === 'number' && (
                    <span>{data._count.products} product{data._count.products !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 py-3 border-t border-gray-100 dark:border-gray-800 dark:border-gray-700">
              {/* Only real, sourced metrics are displayed */}
              <div className="text-center">
                <div className="text-sm font-bold dark:text-white flex items-center gap-1">
                  {loading
                    ? '-'
                    : data?.ratingCount && data.ratingCount > 0
                      ? data.ratingAvg?.toFixed(1)
                      : '—'}
                  <Star className="w-3 h-3 inline text-amber-400 mb-0.5" fill="currentColor" />
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Rating</div>
              </div>
              <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
              <div className="text-center">
                <div className="text-sm font-bold dark:text-white">{loading ? '-' : data?.ratingCount ?? 0}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Reviews</div>
              </div>
              {/* Task 146: the buyer→seller query rail — visitor view only */}
              {viewedSupplierId && (
                <>
                  <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => setAskOpen(true)}
                    className="text-center group"
                    aria-label="Ask this seller a question"
                  >
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-300 dark:text-gray-200 flex items-center gap-1 group-hover:text-primary transition">
                      <MessageCircleQuestion className="w-4 h-4" /> Ask
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">the seller</div>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs Content */}
          <Tabs defaultValue="products" className="w-full">
            <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 px-4 pt-2 sticky top-0 z-10 shadow-sm">
              <TabsList className="w-full h-auto p-0 bg-transparent gap-6 flex justify-start overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-gray-800 dark:border-gray-700 rounded-none">
                <TabsTrigger value="products" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">All Products</TabsTrigger>
                <TabsTrigger value="featured" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Featured</TabsTrigger>
                <TabsTrigger value="certifications" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  Certifications{!loading && data?.certificationRollup && data.certificationRollup.total > 0 ? ` (${data.certificationRollup.total})` : ''}
                </TabsTrigger>
                <TabsTrigger value="locations" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  Locations{!loading && data?.warehouses && data.warehouses.length > 0 ? ` (${data.warehouses.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="reviews" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  Reviews{!loading && data?.ratingCount ? ` (${data.ratingCount})` : ''}
                </TabsTrigger>
                <TabsTrigger value="campaigns" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  <span className="flex items-center gap-1"><BadgePercent className="w-3.5 h-3.5" />Campaigns</span>
                </TabsTrigger>
                <TabsTrigger value="story" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" onClick={() => navigate('store-story-about')}>Profile</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4">
              <TabsContent value="products" className="mt-0 outline-none">
                <div className="grid grid-cols-2 gap-3">
                  {loading ? (
                    [1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)
                  ) : productCount === 0 ? (
                    <div className="col-span-full text-center py-10">
                      <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 dark:text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No products listed yet</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">This store has not published any approved products.</p>
                    </div>
                  ) : (
                    data?.products?.map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => navigate('product-detail', { productId: prod.id })}
                        className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 dark:border-gray-700 cursor-pointer"
                      >
                        <div className="w-full aspect-square bg-gray-100 dark:bg-gray-900 dark:bg-gray-700">
                          {prod.thumbnailUrl ? (
                            <img src={prod.thumbnailUrl} alt={prod.name} className="w-full aspect-square object-cover" />
                          ) : (
                            <div className="w-full aspect-square flex items-center justify-center text-gray-300 dark:text-gray-500 dark:text-gray-400">
                              <Package className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-medium text-sm line-clamp-2 dark:text-white mb-1">{prod.name}</h3>
                          <div className="font-bold text-primary">৳{prod.basePrice} <span className="text-xs font-normal text-gray-500 dark:text-gray-400 dark:text-gray-500">/ {prod.unit}</span></div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Min. {prod.moq} {prod.unit}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
              <TabsContent value="featured" className="mt-0 outline-none">
                {viewedSupplierId ? (
                  <div className="text-center py-10">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium mb-1">No featured collection published</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">This store has not set up featured products yet.</p>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium mb-4">Set up featured collections</h3>
                    <Button onClick={() => navigate('store-featured-products')}>Manage Featured Products</Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="certifications" className="mt-0 outline-none">
                <div aria-label="Store certifications">
                  {/* Task 96: renders ONLY the server-computed rollup — an empty
                      store shows the honest empty state, an expired document
                      keeps its Expired badge. */}
                  <StorefrontCertifications rollup={loading ? undefined : data?.certificationRollup} />
                </div>
              </TabsContent>
              <TabsContent value="locations" className="mt-0 outline-none">
                <div aria-label="Store warehouse locations">
                  {/* Task 98: buyers read the ship-from truth; the owner (no
                      supplierId param) manages the full list in the same tab. */}
                  <StorefrontWarehouses ownView={!viewedSupplierId} guestRows={data?.warehouses ?? []} />
                </div>
              </TabsContent>
              <TabsContent value="campaigns" className="mt-0 outline-none">
                <div aria-label="Store campaigns">
                  {/* Task 115: the seller's OWN campaigns — live rows from the
                      real pricing engine (seller-funded discounts that apply
                      at checkout automatically). */}
                  {campaignSupplierId ? (
                    <StorefrontCampaigns supplierId={campaignSupplierId} />
                  ) : (
                    <div className="text-center py-10 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Campaigns load once the store profile resolves.</div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="reviews" className="mt-0 outline-none">
                <div aria-label="Store buyer reviews">
                  {/* Task 105: the reviews list + write dialog. The server is
                      the eligibility judge (buyer + real order + one per
                      buyer); its refusals surface verbatim. */}
                  <StorefrontReviews
                    supplierId={data?.id || viewedSupplierId}
                    rows={data?.reviews ?? []}
                    avg={data?.ratingAvg}
                    count={data?.ratingCount}
                    onChanged={fetchStore}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}

      {/* Task 146: the ask dialog */}
      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ask {companyName || 'this store'}</DialogTitle>
            <DialogDescription>
              Pre-order terms, custom requests, complaints — the seller is notified the moment you file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ask-type">What is this about?</Label>
              <select
                id="ask-type"
                value={askType}
                onChange={(e) => setAskType(e.target.value as typeof askType)}
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="pre_order">Pre-order question</option>
                <option value="custom_request">Custom order request</option>
                <option value="complaint">Complaint</option>
              </select>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">Product questions belong on the product page's Q&amp;A.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ask-subject">Subject</Label>
              <Input id="ask-subject" value={askSubject} onChange={(e) => setAskSubject(e.target.value)} placeholder="Bulk order for 500 units — custom packaging?" maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ask-message">Message</Label>
              <Textarea id="ask-message" value={askMessage} onChange={(e) => setAskMessage(e.target.value)} rows={4} maxLength={2000} placeholder="Give the seller what they need to answer well" />
            </div>
            <Button onClick={submitAsk} disabled={asking} className="w-full h-10">
              {asking ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageCircleQuestion className="w-4 h-4 mr-1" />}
              Send to the seller
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerStorefrontPage;
