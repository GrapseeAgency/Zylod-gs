// Chunk: Wishlist — Wishlist/favorites pages (pages 121-128 + sub-pages)

import type { PageLoadResult } from './types'
import { loadFromMap } from './types'

export const CHUNK_WISHLIST = new Set([
  // Main pages (121-128)
  'wishlist', 'favorites', 'save-for-later', 'recently-viewed', 'recently-searched',
  'collections', 'create-collection', 'shared-wishlist',
  // Sub-pages
  'wishlist-detail', 'wishlist-share', 'wishlist-sort-filter',
  'favorite-suppliers', 'favorite-products', 'favorite-categories',
  'save-for-later-detail',
  'collection-detail', 'edit-collection',
  'shared-wishlist-detail',
  'price-drop-alerts', 'bulk-add-to-cart',
])

export async function loadChunkPage(pageId: string): Promise<PageLoadResult> {
  const loaders: Record<string, () => Promise<any>> = {
    // Main pages
    'wishlist': () => import('@/components/pages/wishlist-page'),
    'favorites': () => import('@/components/pages/favorites-page'),
    'save-for-later': () => import('@/components/pages/save-for-later-page'),
    'recently-viewed': () => import('@/components/pages/recently-viewed-page'),
    'recently-searched': () => import('@/components/pages/recently-searched-page'),
    'collections': () => import('@/components/pages/collections-page'),
    'create-collection': () => import('@/components/pages/create-collection-page'),
    'shared-wishlist': () => import('@/components/pages/shared-wishlist-page'),
    // Sub-pages
    'wishlist-detail': () => import('@/components/pages/wishlist-detail-page'),
    'wishlist-share': () => import('@/components/pages/wishlist-share-page'),
    'wishlist-sort-filter': () => import('@/components/pages/wishlist-sort-filter-page'),
    'favorite-suppliers': () => import('@/components/pages/favorite-suppliers-page'),
    'favorite-products': () => import('@/components/pages/favorite-products-page'),
    'favorite-categories': () => import('@/components/pages/favorite-categories-page'),
    'save-for-later-detail': () => import('@/components/pages/save-for-later-detail-page'),
    'collection-detail': () => import('@/components/pages/collection-detail-page'),
    'edit-collection': () => import('@/components/pages/edit-collection-page'),
    'shared-wishlist-detail': () => import('@/components/pages/shared-wishlist-detail-page'),
    'price-drop-alerts': () => import('@/components/pages/price-drop-alerts-page'),
    'bulk-add-to-cart': () => import('@/components/pages/bulk-add-to-cart-page'),
  }
  return loadFromMap(loaders, pageId)
}
