// Chunk: Search & Navigation — Pages 151-158 + Sub-pages

import type { PageLoadResult } from './types'
import { loadFromMap } from './types'

export const CHUNK_SEARCH = new Set([
  // Main 8 Pages (151-158)
  'search-home', 'search',
  'voice-search',
  'image-search', 'visual-search',
  'barcode-scanner', 'qr-scanner', 'scan-barcode',
  'search-suggestions', 'search-autocomplete',
  'search-history',
  'popular-searches', 'trending-searches',
  'category-navigation', 'all-categories',

  // Search & Navigation Sub-pages
  'search-filters', 'filter-sort',
  'trending-searches-sub',
  'saved-searches',
  'category-products-detail',
  'search-results-supplier',
  'visual-search-results',
  'barcode-result',
  'category-tree',
  'search-price-alert', 'price-alerts',
  'search-results-category',
  'advanced-search',
  'search-voice-history',
])

export async function loadChunkPage(pageId: string): Promise<PageLoadResult> {
  const loaders: Record<string, () => Promise<any>> = {
    // Main Pages 151-158
    'search-home': () => import('@/components/pages/search-home-page'),
    'search': () => import('@/components/pages/search-home-page'),
    'voice-search': () => import('@/components/pages/voice-search-page'),
    'image-search': () => import('@/components/pages/image-search-page'),
    'visual-search': () => import('@/components/pages/image-search-page'),
    'barcode-scanner': () => import('@/components/pages/barcode-scanner-page'),
    'qr-scanner': () => import('@/components/pages/barcode-scanner-page'),
    'scan-barcode': () => import('@/components/pages/barcode-scanner-page'),
    'search-suggestions': () => import('@/components/pages/search-suggestions-page'),
    'search-autocomplete': () => import('@/components/pages/search-suggestions-page'),
    'search-history': () => import('@/components/pages/search-history-page'),
    'popular-searches': () => import('@/components/pages/popular-searches-page'),
    'trending-searches': () => import('@/components/pages/popular-searches-page'),
    'category-navigation': () => import('@/components/pages/category-navigation-page'),
    'all-categories': () => import('@/components/pages/category-navigation-page'),

    // Sub-pages
    'search-filters': () => import('@/components/pages/search-filters-page'),
    'filter-sort': () => import('@/components/pages/search-filters-page'),
    'trending-searches-sub': () => import('@/components/pages/trending-searches-page'),
    'saved-searches': () => import('@/components/pages/saved-searches-page'),
    'category-products-detail': () => import('@/components/pages/category-products-detail-page'),
    'search-results-supplier': () => import('@/components/pages/search-results-supplier-page'),
    'visual-search-results': () => import('@/components/pages/visual-search-results-page'),
    'barcode-result': () => import('@/components/pages/barcode-result-page'),
    'category-tree': () => import('@/components/pages/category-tree-page'),
    'search-price-alert': () => import('@/components/pages/search-price-alert-page'),
    'price-alerts': () => import('@/components/pages/search-price-alert-page'),
    'search-results-category': () => import('@/components/pages/search-results-category-page'),
    'advanced-search': () => import('@/components/pages/advanced-search-page'),
    'search-voice-history': () => import('@/components/pages/search-voice-history-page'),
  }

  return loadFromMap(loaders, pageId)
}
