'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { toast } from 'sonner'
import {
  ArrowLeft, Star, ThumbsUp, Flag, QrCode, Bell, Package, CheckCircle2
} from 'lucide-react'

interface ReviewItem {
  id: string
  authorName: string
  companyName?: string
  purchasedQty?: number
  unit?: string
  date: string
  verified: boolean
  rating: number
  title: string
  content: string
  helpfulCount: number
  photos?: string[]
}

interface ProductInfo {
  id: string
  name: string
  rating_avg: number
  rating_count: number
  images: { url: string }[]
}

export function ProductReviewsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || pageParams.id || ''

  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | 'photos' | 'verified' | '5star'>('all')
  const [helpfulClicked, setHelpfulClicked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const prodUrl = productId ? `/api/products/${productId}` : '/api/products?limit=1'
        const res = await fetch(prodUrl)
        if (res.ok) {
          const data = await res.json()
          const p = data.data || (Array.isArray(data) ? data[0] : data)
          if (mounted && p) {
            // HONEST mapping — no fabricated fallbacks. A product with no
            // ratingAvg shows "0.0 (0 reviews)" instead of the previous
            // fake "4.8 (1284)" copy.
            const productData: ProductInfo = {
              id: p.id || '',
              name: p.name || 'Unnamed product',
              rating_avg: Number(p.ratingAvg ?? p.rating_avg ?? 0),
              rating_count: Number(p.reviewCount ?? p.reviewsCount ?? p.reviews_count ?? 0),
              // t229g IMAGE FIX: /api/products image rows carry `imageUrl`
              // (Prisma ProductImage) — normalize so the card shows the real photo.
              images: (Array.isArray(p.images) ? p.images : [])
                .map((img: { url?: string; imageUrl?: string }) => ({
                  url: img.url ?? img.imageUrl ?? '',
                }))
                .filter((img: { url: string }) => img.url.length > 0),
            }
            setProduct(productData)

            // Map REAL reviews from the API shape:
            //   { id, rating, comment, images (array), verifiedPurchase, createdAt,
            //     buyer: { id, buyerProfile: { fullName, businessName } | null },
            //     replies: [...] }
            // Previous code read r.user?.name (wrong shape) and synthesized
            // fake "Midwest Logistics Corp" reviews when none existed.
            const realReviews: ReviewItem[] = Array.isArray(p.reviews)
              ? p.reviews.map((r: any, idx: number) => {
                  const profile = r.buyer?.buyerProfile || null
                  return {
                    id: r.id || `r-${idx}`,
                    authorName: profile?.fullName || 'Anonymous Buyer',
                    companyName: profile?.businessName || undefined,
                    purchasedQty: r.quantity || undefined,
                    unit: p.unit || undefined,
                    date: r.createdAt || r.date || new Date().toISOString(),
                    verified: !!r.verifiedPurchase,
                    rating: Number(r.rating ?? 0),
                    title: r.title || '',
                    content: r.comment || r.content || '',
                    helpfulCount: Number(r.helpfulCount ?? 0),
                    photos: Array.isArray(r.images) ? r.images : [],
                  }
                })
              : []

            setReviews(realReviews)
          }
        }
      } catch (err) {
        console.error('Failed to load reviews:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()
    return () => { mounted = false }
  }, [productId])

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (activeFilter === 'photos') return r.photos && r.photos.length > 0
      if (activeFilter === 'verified') return r.verified
      if (activeFilter === '5star') return r.rating === 5
      return true
    })
  }, [reviews, activeFilter])

  const toggleHelpful = (id: string) => {
    setHelpfulClicked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-10 text-slate-900 dark:text-neutral-100">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700 dark:text-neutral-300" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button onClick={() => navigate("notifications")} className="p-1 text-slate-700 dark:text-neutral-300" title="Notifications" aria-label="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>

        {/* Back Link */}
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-neutral-400 dark:text-neutral-500 hover:text-slate-900 dark:text-neutral-100 pt-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Product
        </button>
      </header>

      <main className="px-4 py-3 space-y-4 md:px-6 md:py-6 md:max-w-4xl md:mx-auto md:w-full md:space-y-5">
        <button
          onClick={goBack}
          className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-neutral-400 dark:text-neutral-500 hover:text-slate-900 dark:text-neutral-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Product
        </button>
        {/* Product Snippet Header Card */}
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 border border-slate-100 dark:border-neutral-800 flex items-center gap-3">
            <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ) : product ? (
          <div
            onClick={() => navigate('product-detail', { productId: product.id })}
            className="bg-white dark:bg-gray-900 rounded-2xl p-3 border border-slate-100 dark:border-neutral-800 flex items-center gap-3 shadow-2xs cursor-pointer hover:border-slate-200 transition-all"
          >
            <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-card overflow-hidden shrink-0 flex items-center justify-center">
              {product.images[0]?.url ? (
                <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="h-6 w-6 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-bold text-slate-900 dark:text-neutral-100 line-clamp-1">{product.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex items-center text-amber-500 text-xs font-bold">
                  <Star className="h-3.5 w-3.5 fill-amber-500 mr-0.5" />
                  {product.rating_avg.toFixed(1)}
                </div>
                <span className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">({product.rating_count.toLocaleString()} reviews)</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Reviews' },
            { key: 'photos', label: 'With Photos' },
            { key: 'verified', label: 'Verified Only' },
            { key: '5star', label: '5 Star' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-card'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 pt-1">
          <span>Sort by: <strong className="text-primary font-semibold">Most Relevant</strong></span>
          <button
            onClick={() => navigate('write-review', { productId: product?.id || '' })}
            className="text-xs font-bold text-primary hover:underline"
          >
            Write a Review
          </button>
        </div>

        {/* Reviews List */}
        {!loading && filteredReviews.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-slate-100 dark:border-neutral-800 text-center space-y-3">
            <div className="w-14 h-14 mx-auto bg-rose-50 dark:bg-rose-950/40 text-primary rounded-full flex items-center justify-center">
              <Star className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-200">
              {reviews.length === 0 ? 'No reviews yet' : 'No reviews match this filter'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-xs mx-auto">
              {reviews.length === 0
                ? 'Be the first to share your experience with this product.'
                : 'Try a different filter to see more reviews.'}
            </p>
            {reviews.length === 0 && product?.id && (
              <Button
                size="sm"
                onClick={() => navigate('write-review', { productId: product.id })}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Write the First Review
              </Button>
            )}
          </div>
        ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {filteredReviews.map((rev) => {
            const hasHelpful = helpfulClicked[rev.id]
            const count = rev.helpfulCount + (hasHelpful ? 1 : 0)
            const relativeDate = (() => {
              const d = new Date(rev.date)
              if (isNaN(d.getTime())) return ''
              const diffMs = Date.now() - d.getTime()
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
              if (diffDays < 1) return 'today'
              if (diffDays === 1) return 'yesterday'
              if (diffDays < 7) return `${diffDays} days ago`
              if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`
              if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`
              return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`
            })()

            return (
              <div key={rev.id} className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-100 dark:border-neutral-800 shadow-2xs space-y-3">
                {/* Author Info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-rose-50 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                      {rev.authorName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-neutral-200">{rev.authorName}</h4>
                        {rev.verified && (
                          <Badge className="bg-rose-50 text-primary border-none text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            Verified Buyer
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {rev.purchasedQty
                          ? `Purchased ${rev.purchasedQty} ${rev.unit || ''}${relativeDate ? ' • ' : ''}`
                          : relativeDate
                            ? ''
                            : 'Verified buyer'}
                        {relativeDate}
                      </p>
                    </div>
                  </div>

                  {/* Stars */}
                  <div className="flex items-center text-rose-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < rev.rating ? 'fill-rose-500' : 'text-slate-200'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Review Text */}
                <div>
                  {rev.title && <h5 className="text-xs font-bold text-slate-900 dark:text-neutral-100 mb-1">{rev.title}</h5>}
                  <p className="text-xs text-slate-600 dark:text-neutral-400 dark:text-neutral-500 leading-relaxed">{rev.content}</p>
                </div>

                {/* Attached Photos */}
                {rev.photos && rev.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pt-1">
                    {rev.photos.map((photo, pIdx) => (
                      <div key={pIdx} className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-card shrink-0 border border-slate-100 dark:border-neutral-800">
                        <img src={photo} alt="Customer upload" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions: Helpful & Report */}
                <div className="flex items-center gap-4 pt-2 border-t border-slate-50 text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 font-medium">
                  <button
                    onClick={() => toggleHelpful(rev.id)}
                    className={`flex items-center gap-1.5 transition-colors ${
                      hasHelpful ? 'text-primary font-bold' : 'hover:text-slate-800'
                    }`}
                  >
                    <ThumbsUp className={`h-3.5 w-3.5 ${hasHelpful ? 'fill-primary' : ''}`} />
                    Helpful ({count})
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Report submitted', { description: 'Our team will review this submission. Thanks for keeping Zylod safe.' })
                    }}
                    className="flex items-center gap-1 hover:text-rose-600 transition-colors"
                    aria-label={`Report review ${rev.id}`}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Report
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        )}
      </main>
    </div>
  )
}
