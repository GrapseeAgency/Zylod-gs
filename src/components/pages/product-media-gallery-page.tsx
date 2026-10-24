'use client';

/**
 * Product media gallery (Task 175-a) — REAL hydration + REAL upload + REAL attach.
 *
 * The previous page rendered 3 hardcoded gray placeholder boxes, the
 * drag-drop zone had no handler, and the video URL input had no state. The
 * real rails:
 *   GET    /api/supplier/products/[id]              → real images[] + videos[]
 *   POST   /api/uploads/product-media               → real file upload (image/video)
 *   POST   /api/supplier/products/[id]/videos       → attach a video URL to the product
 *   DELETE /api/supplier/products/[id]/videos/[vid] → detach a video
 *   PATCH  /api/supplier/products/[id]              → full-replace (the canonical
 *                                                     image writer — images[] is
 *                                                     recreated from the payload)
 * Images have no dedicated attach/delete rail, so image attach + delete ride
 * the full-replace PATCH (the same contract seller-edit-product-page uses).
 * A 409 (variant FK restrict from active carts/orders) is surfaced honestly.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  RefreshCw,
  Link as LinkIcon,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';

interface ApiImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}
interface ApiVideo {
  id: string;
  videoUrl: string;
  title: string | null;
  sortOrder: number;
}
interface ApiTier {
  id: string;
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
}
interface ApiVariant {
  id: string;
  variantName: string;
  variantValue: string;
  sku: string | null;
  stockQuantity: number;
  priceOverride: number | null;
}
interface ApiProduct {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  brand: string | null;
  sku: string | null;
  unit: string;
  bundleSize: number | null;
  weightKg: number | null;
  moq: number;
  maxOrderQty: number | null;
  basePrice: number;
  stockQuantity: number;
  stockAlertThreshold: number | null;
  isCustomizable: boolean;
  thumbnailUrl: string | null;
  images: ApiImage[];
  videos: ApiVideo[];
  variants: ApiVariant[];
  priceTiers: ApiTier[];
}

type LoadState = 'loading' | 'auth' | 'notfound' | 'error' | 'ready';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function buildFullReplacePayload(p: ApiProduct, images: { imageUrl: string }[]) {
  return {
    name: p.name,
    categoryId: p.categoryId,
    description: p.description,
    ...(p.brand ? { brand: p.brand } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    unit: p.unit,
    bundleSize: p.bundleSize,
    weightKg: p.weightKg,
    moq: p.moq,
    maxOrderQty: p.maxOrderQty,
    basePrice: p.basePrice,
    currency: 'BDT' as const,
    stockQuantity: p.stockQuantity,
    stockAlertThreshold: p.stockAlertThreshold,
    isCustomizable: p.isCustomizable,
    thumbnailUrl: images.length > 0 ? images[0].imageUrl : null,
    images: images.map((img, i) => ({ imageUrl: img.imageUrl, sortOrder: i })),
    videos: p.videos
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((v, i) => ({
        url: v.videoUrl,
        sortOrder: i,
        ...(v.title ? { title: v.title } : {}),
      })),
    variants: p.variants.map((v) => ({
      variantName: v.variantName,
      variantValue: v.variantValue,
      ...(v.sku ? { sku: v.sku } : {}),
      stockQuantity: v.stockQuantity,
      ...(v.priceOverride != null ? { priceOverride: v.priceOverride } : { priceOverride: null }),
    })),
    priceTiers: p.priceTiers.map((t) => ({
      minQty: t.minQty,
      ...(t.maxQty != null ? { maxQty: t.maxQty } : { maxQty: null }),
      pricePerUnit: t.pricePerUnit,
    })),
  };
}

export function ProductMediaGalleryPage() {
  const { goBack, navigate, pageParams } = useNavigationStore();
  const token = useAuthStore((s) => s.token);
  const productId = typeof pageParams?.productId === 'string' ? pageParams.productId : (typeof pageParams?.id === 'string' ? pageParams.id : '');

  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [busyImage, setBusyImage] = useState<string | null>(null); // imageUrl being deleted
  const [busyVideo, setBusyVideo] = useState<string | null>(null); // videoId being deleted
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setState('error');
      setLoadError('No product was selected. Open this page from a product listing.');
      return;
    }
    if (!token) {
      setState('auth');
      setLoadError('Sign in as the product owner to manage media.');
      return;
    }
    setState('loading');
    setLoadError('');
    try {
      const res = await fetch(`/api/supplier/products/${productId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setState('auth');
        setLoadError(json?.error || 'Sign in as the product owner to manage media.');
        return;
      }
      if (res.status === 404) {
        setState('notfound');
        setLoadError('Product not found — it may have been removed, or it belongs to another seller.');
        return;
      }
      if (!res.ok || !json?.success || !json?.data) {
        setState('error');
        setLoadError(json?.error || `Failed to load the product (HTTP ${res.status})`);
        return;
      }
      setProduct(json.data as ApiProduct);
      setState('ready');
    } catch {
      setState('error');
      setLoadError('Network error while loading the product. Check your connection and retry.');
    }
  }, [productId, token]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  /** Upload a file via POST /api/uploads/product-media and return the URL. */
  const uploadFile = async (file: File): Promise<{ url: string; type: 'image' | 'video' } | null> => {
    const declared = file.type;
    const isImage = IMAGE_TYPES.includes(declared);
    const isVideo = VIDEO_TYPES.includes(declared);
    if (!isImage && !isVideo) {
      toast.error(`Unsupported file type "${declared || 'unknown'}" — allowed: PNG, JPEG, WebP, MP4, WebM`);
      return null;
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      toast.error(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — limit is ${maxBytes / 1024 / 1024}MB for ${isVideo ? 'video' : 'images'}.`,
      );
      return null;
    }
    const form = new FormData();
    form.append('file', file);
    setUploading(true);
    try {
      const res = await fetch('/api/uploads/product-media', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        body: form,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Upload failed (HTTP ${res.status})`);
        return null;
      }
      return { url: json.url as string, type: json.type as 'image' | 'video' };
    } catch {
      toast.error('Network error during upload. Check your connection and retry.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  /** Attach a video URL (uploaded local or external https) via the dedicated rail. */
  const attachVideo = async (url: string, title?: string): Promise<boolean> => {
    if (!productId) return false;
    setAttaching(true);
    try {
      const res = await fetch(`/api/supplier/products/${productId}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          videoUrl: url,
          ...(title && title.trim() ? { title: title.trim() } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Video attach failed (HTTP ${res.status})`);
        return false;
      }
      toast.success('Video added to the gallery');
      await fetchProduct();
      return true;
    } catch {
      toast.error('Network error while attaching the video. Retry.');
      return false;
    } finally {
      setAttaching(false);
    }
  };

  /** Attach an image URL via the full-replace PATCH (no dedicated image rail). */
  const attachImageViaReplace = async (imageUrl: string): Promise<boolean> => {
    if (!productId || !product) return false;
    setAttaching(true);
    try {
      const nextImages = [
        ...product.images
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((i) => ({ imageUrl: i.imageUrl })),
        { imageUrl },
      ];
      const payload = buildFullReplacePayload(product, nextImages);
      const res = await fetch(`/api/supplier/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message =
          json?.error ||
          (res.status === 409
            ? 'Cannot attach the image: this product has variants referenced by active carts or orders. Try again from the Edit Product page.'
            : `Image attach failed (HTTP ${res.status})`);
        toast.error(message);
        return false;
      }
      setProduct(json.data as ApiProduct);
      toast.success('Image added to the gallery');
      return true;
    } catch {
      toast.error('Network error while attaching the image. Retry.');
      return false;
    } finally {
      setAttaching(false);
    }
  };

  const handleFile = async (file: File) => {
    const uploaded = await uploadFile(file);
    if (!uploaded) return;
    if (uploaded.type === 'video') {
      await attachVideo(uploaded.url);
    } else {
      await attachImageViaReplace(uploaded.url);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // allow re-selecting the same file
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleAttachExternalVideo = async () => {
    const url = videoUrl.trim();
    if (!url) {
      toast.error('Paste a video URL first (must start with https://).');
      return;
    }
    if (!url.startsWith('https://')) {
      toast.error('External video URL must start with https://');
      return;
    }
    const ok = await attachVideo(url, videoTitle);
    if (ok) {
      setVideoUrl('');
      setVideoTitle('');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!productId || busyVideo) return;
    setBusyVideo(videoId);
    try {
      const res = await fetch(`/api/supplier/products/${productId}/videos/${videoId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Video removal failed (HTTP ${res.status})`);
        return;
      }
      toast.success('Video removed');
      await fetchProduct();
    } catch {
      toast.error('Network error while removing the video. Retry.');
    } finally {
      setBusyVideo(null);
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    if (!productId || !product || busyImage) return;
    setBusyImage(imageUrl);
    try {
      const nextImages = product.images
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((i) => i.imageUrl !== imageUrl)
        .map((i) => ({ imageUrl: i.imageUrl }));
      const payload = buildFullReplacePayload(product, nextImages);
      const res = await fetch(`/api/supplier/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message =
          json?.error ||
          (res.status === 409
            ? 'Cannot remove the image: this product has variants referenced by active carts or orders. Try again from the Edit Product page.'
            : `Image removal failed (HTTP ${res.status})`);
        toast.error(message);
        return;
      }
      setProduct(json.data as ApiProduct);
      toast.success('Image removed');
    } catch {
      toast.error('Network error while removing the image. Retry.');
    } finally {
      setBusyImage(null);
    }
  };

  const ErrorState = () => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-4">
      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
      <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        {state === 'auth' && (
          <button
            type="button"
            onClick={() => navigate('login')}
            className="min-h-11 px-4 bg-primary text-white rounded-lg text-sm font-medium"
          >
            Sign in
          </button>
        )}
        <button
          type="button"
          onClick={fetchProduct}
          className="min-h-11 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 inline-flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  const images = (product?.images ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const videos = (product?.videos ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={goBack}
          aria-label="Go back"
          className="min-h-11 min-w-11 p-2 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Media Gallery</h1>
      </div>

      <div className="p-4 space-y-6 md:p-6 md:max-w-4xl md:mx-auto md:pt-8">
        <div className="hidden md:flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Media Gallery</h1>
          {product && (
            <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate min-w-0">
              {product.name}
            </span>
          )}
        </div>

        {state === 'loading' && (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-32 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              <div className="aspect-square bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-lg animate-pulse" />
              <div className="aspect-square bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-lg animate-pulse" />
              <div className="aspect-square bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-lg animate-pulse" />
            </div>
          </div>
        )}

        {(state === 'auth' || state === 'error' || state === 'notfound') && <ErrorState />}

        {state === 'ready' && (
          <>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Upload media</h2>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                disabled={uploading || attaching}
                className={`w-full border-2 border-dashed rounded-xl p-6 md:p-10 text-center transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950'
                } ${uploading || attaching ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                  onChange={handleFileInput}
                  className="hidden"
                />
                {uploading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Uploading…</p>
                  </>
                ) : attaching ? (
                  <>
                    <Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Attaching to product…</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 dark:text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Drag &amp; drop or click to upload
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                      PNG, JPEG, WebP (≤5MB) · MP4, WebM (≤50MB)
                    </p>
                  </>
                )}
              </button>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  External video URL (optional)
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/…"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={handleAttachExternalVideo}
                  disabled={attaching || !videoUrl.trim()}
                  className="min-h-11 px-4 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  {attaching ? 'Attaching…' : 'Attach video link'}
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                Gallery <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 font-normal">({images.length + videos.length})</span>
              </h2>

              {images.length === 0 && videos.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-6">
                  No media uploaded yet. Use the upload zone above to add images or videos.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 group bg-gray-100 dark:bg-gray-900 dark:bg-gray-950"
                    >
                      <img
                        src={img.imageUrl}
                        alt="Product media"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.imageUrl)}
                        disabled={busyImage === img.imageUrl}
                        aria-label="Remove image"
                        className="absolute top-1 right-1 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        {busyImage === img.imageUrl ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Image
                      </span>
                    </div>
                  ))}
                  {videos.map((vid) => (
                    <div
                      key={vid.id}
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 group bg-gray-100 dark:bg-gray-900 dark:bg-gray-950 flex items-center justify-center"
                    >
                      {vid.videoUrl.startsWith('/uploads/videos/') ? (
                        <video
                          src={vid.videoUrl}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          muted
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 dark:text-gray-400 p-2 text-center">
                          <VideoIcon className="w-8 h-8" />
                          <span className="text-[10px] break-all line-clamp-2">External link</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(vid.id)}
                        disabled={busyVideo === vid.id}
                        aria-label="Remove video"
                        className="absolute top-1 right-1 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        {busyVideo === vid.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] flex items-center gap-1">
                        <VideoIcon className="w-3 h-3" /> Video
                      </span>
                      {vid.title && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] max-w-[70%] truncate">
                          {vid.title}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default ProductMediaGalleryPage;
