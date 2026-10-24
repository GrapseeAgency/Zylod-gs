'use client'

import React, { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Link2, Package, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Task 97: THE SHARED COLLECTION VIEW — the read-only page behind the
 * secret link (?page=collection-shared&token=…). Served from the public
 * /api/collections/shared/[token] rail: only collections currently set to
 * SHARED open here; a revoked (back-to-Private) link shows the same honest
 * not-found as a phantom token. No owner identity is displayed — the guest
 * sees the curation, not the curator.
 */

interface SharedItem {
  id: string
  product: {
    id: string
    name: string
    basePrice: number
    currency: string
    unit: string
    moq: number
    thumbnailUrl?: string | null
    supplier?: { companyName?: string } | null
  }
}

export function CollectionSharedPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const token = pageParams?.token || ''

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [collection, setCollection] = useState<{
    name: string
    description: string | null
    coverColor: string | null
    coverImageUrl: string | null
    createdAt: string
    items: SharedItem[]
  } | null>(null)

  useEffect(() => {
    if (!token) {
      setNotFound(true)
      setLoading(false)
      return
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/collections/shared/${encodeURIComponent(token)}`)
        const json = await res.json().catch(() => null)
        if (res.ok && json?.success) {
          setCollection(json.data)
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <header className="bg-white dark:bg-gray-900 border-b px-4 py-4 flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-6 w-1/3 rounded" />
        </header>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (notFound || !collection) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-gray-300 mb-3" />
        <h1 className="text-base font-bold text-gray-800 dark:text-gray-200">This link does not open a collection</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
          The link is wrong, or the collection is no longer shared. Ask the sender for a fresh link.
        </p>
        <Button onClick={goBack} className="mt-4">Go Back</Button>
      </div>
    )
  }

  const items = collection.items || []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col pb-20 md:pb-8">
      <header className="bg-white dark:bg-gray-900 sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-2 -ml-2 rounded-full active:bg-gray-100 dark:bg-gray-900 md:hidden" aria-label="Go back">
          <ArrowLeft className="w-5 h-5 text-gray-800 dark:text-gray-200" />
        </button>
        <Link2 className="w-4 h-4 text-[#C8102E]" aria-hidden="true" />
        <h1 className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{collection.name}</h1>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full">
          Shared
        </span>
      </header>

      <main className="flex-1">
        <div
          className="bg-white dark:bg-gray-900 p-5 border-b shadow-sm"
          style={collection.coverColor ? { backgroundColor: collection.coverColor + '20' } : {}}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">
            A curated wholesale list · {items.length} item{items.length !== 1 ? 's' : ''}
          </p>
          {collection.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mt-2 line-clamp-3">{collection.description}</p>
          )}
        </div>

        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full">
          {items.length === 0 ? (
            <div className="text-center py-14 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">This shared collection has no products yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((item) => {
                const prod = item.product
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate('product-detail', { productId: prod.id })}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="w-full aspect-square bg-gray-100 dark:bg-gray-900">
                      {prod.thumbnailUrl ? (
                        <img src={prod.thumbnailUrl} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Package className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-sm line-clamp-2 text-gray-900 dark:text-gray-100 mb-1">{prod.name}</h3>
                      <div className="text-[#C8102E] font-bold text-sm">
                        ৳{prod.basePrice?.toLocaleString()} <span className="text-xs font-normal text-gray-500 dark:text-gray-400 dark:text-gray-500">/ {prod.unit}</span>
                      </div>
                      {prod.supplier?.companyName && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 truncate">{prod.supplier.companyName}</div>
                      )}
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Min. {prod.moq} {prod.unit}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default CollectionSharedPage
