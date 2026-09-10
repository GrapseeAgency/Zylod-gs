'use client'
/**
 * Live data hooks for home/mobile surfaces.
 * Every count and product shown in the UI comes from the real database —
 * these hooks fetch the live totals once and expose them to components.
 * No hardcoded numbers, no fabricated products.
 */
import { useEffect, useState } from 'react'

export interface LiveCategory {
  id: string
  name: string
  slug: string
  productCount: number
  supplierCount: number
  children: { id: string; name: string; slug: string; productCount: number }[]
}

export interface LiveProduct {
  id: string
  name: string
  slug: string
  basePrice: number
  thumbnailUrl: string | null
  unit: string
  moq: number
  soldCount: number
  ratingAvg: number
  reviewCount: number
  supplier?: { companyName: string } | null
  category?: { name: string; slug: string } | null
}

export interface LiveStats {
  supplierCount: number
  productCount: number
}

/** Fetch categories tree (live from /api/categories). */
export function useLiveCategories() {
  const [categories, setCategories] = useState<LiveCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/categories', { signal: AbortSignal.timeout(15000) })
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) setCategories(json.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading }
}

/** Fetch live top products (sorted by soldCount). */
export function useLiveProducts(limit = 8) {
  const [products, setProducts] = useState<LiveProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/products?sortBy=soldCount&sortOrder=desc&limit=${limit}`, { signal: AbortSignal.timeout(15000) })
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) setProducts(json.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [limit])

  return { products, loading }
}

/** Fetch live supplier/product counts for stat chips. */
export function useLiveStats(): LiveStats {
  const [stats, setStats] = useState<LiveStats>({ supplierCount: 0, productCount: 0 })

  useEffect(() => {
    fetch('/api/suppliers?limit=1', { signal: AbortSignal.timeout(15000) })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const total = json.pagination?.total || 0
          setStats(s => ({ ...s, supplierCount: total }))
        }
      })
      .catch(() => {})

    fetch('/api/products?limit=1', { signal: AbortSignal.timeout(15000) })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const total = json.pagination?.total || 0
          setStats(s => ({ ...s, productCount: total }))
        }
      })
      .catch(() => {})
  }, [])

  return stats
}
