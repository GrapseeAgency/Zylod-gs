// Chunk: Browse — Product browsing pages

import type { PageLoadResult } from './types'
import { loadFromMap } from './types'

export const CHUNK_BROWSE = new Set([
  'product-detail', 'category-products', 'product-list', 'search-results',
  'compare', 'product-comparison', 'filter-sort',
  'explore', 'discover', 'brand-showcase', 'category-browser',
  'trending-products', 'trending', 'new-arrivals', 'clearance', 'clearance-sale',
  'seasonal-offers', 'seasonal-sale', 'daily-deals', 'flash-sale', 'flash-deals',
  'browsing-history', 'product-reviews', 'product-qa', 'write-review',
  'upload-review-photos', 'product-specifications', 'size-guide',
  'bulk-pricing', 'wholesale-catalog', 'supplier-products', 'similar-products',
  'frequently-bought', 'frequently-bought-together', 'product-variants',
  'suppliers', 'rfq-list',
])

export async function loadChunkPage(pageId: string): Promise<PageLoadResult> {
  const loaders: Record<string, () => Promise<any>> = {
    'product-detail': () => import('@/components/pages/product-detail-page'),
    'category-products': () => import('@/components/pages/category-products-page'),
    'product-list': () => import('@/components/pages/product-list-page'),
    'search-results': () => import('@/components/pages/search-results-page'),
    'compare': () => import('@/components/pages/product-comparison-page'),
    'product-comparison': () => import('@/components/pages/product-comparison-page'),
    'filter-sort': () => import('@/components/pages/product-list-page'),
    'explore': () => import('@/components/pages/explore-page'),
    'discover': () => import('@/components/pages/explore-page'),
    'trending-products': () => import('@/components/pages/trending-products-page'),
    'trending': () => import('@/components/pages/trending-products-page'),
    'flash-sale': () => import('@/components/pages/flash-deals-page'),
    'flash-deals': () => import('@/components/pages/flash-deals-page'),
    'daily-deals': () => import('@/components/pages/daily-deals-page'),
    'new-arrivals': () => import('@/components/pages/new-arrivals-page'),
    'clearance': () => import('@/components/pages/clearance-sale-page'),
    'clearance-sale': () => import('@/components/pages/clearance-sale-page'),
    'seasonal-offers': () => import('@/components/pages/seasonal-sale-page'),
    'seasonal-sale': () => import('@/components/pages/seasonal-sale-page'),
    'brand-showcase': () => import('@/components/pages/brand-showcase-page'),
    'category-browser': () => import('@/components/pages/category-browser-page'),
    'product-reviews': () => import('@/components/pages/product-reviews-page'),
    'product-qa': () => import('@/components/pages/product-qa-page'),
    'write-review': () => import('@/components/pages/write-review-page'),
    'upload-review-photos': () => import('@/components/pages/upload-review-photos-page'),
    'product-specifications': () => import('@/components/pages/product-specifications-page'),
    'size-guide': () => import('@/components/pages/size-guide-page'),
    'bulk-pricing': () => import('@/components/pages/bulk-pricing-page'),
    'wholesale-catalog': () => import('@/components/pages/wholesale-catalog-page'),
    'supplier-products': () => import('@/components/pages/supplier-products-page'),
    'similar-products': () => import('@/components/pages/similar-products-page'),
    'frequently-bought': () => import('@/components/pages/frequently-bought-together-page'),
    'frequently-bought-together': () => import('@/components/pages/frequently-bought-together-page'),
    'product-variants': () => import('@/components/pages/product-variants-page'),
    'suppliers': () => import('@/components/pages/suppliers-directory-page'),
    'rfq-list': () => import('@/components/pages/rfq-list-page'),
  }
  return loadFromMap(loaders, pageId)
}
