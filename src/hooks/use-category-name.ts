'use client'

import { useEffect, useState } from 'react'

/**
 * Resolves a category slug to its real display name from the API
 * (single module-level fetch shared by every consumer, cached forever).
 * Falls back to `fallback` until/unless the API resolves the slug.
 */
let categoriesPromise: Promise<Record<string, string>> | null = null

function loadCategories(): Promise<Record<string, string>> {
  if (!categoriesPromise) {
    categoriesPromise = fetch('/api/categories', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => {
        const list = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []
        const map: Record<string, string> = {}
        for (const c of list) {
          if (c?.slug && c?.name) map[c.slug] = c.name
        }
        return map
      })
      .catch(() => ({}))
  }
  return categoriesPromise
}

/** Prettifies an unresolved slug: "leather-goods" -> "Leather Goods" */
export function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/**
 * Returns the human name for a category slug.
 * Priority: API-resolved name > provided fallback > prettified slug.
 */
export function useCategoryName(slug: string, fallback?: string): string {
  const [apiName, setApiName] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    if (!slug) {
      setApiName(null)
      return
    }
    loadCategories().then((map) => {
      if (mounted && map[slug]) setApiName(map[slug])
    })
    return () => {
      mounted = false
    }
  }, [slug])

  if (!slug) return fallback ?? 'All Products'
  return apiName ?? fallback ?? prettifySlug(slug)
}
