// Chunk loader — contains ALL dynamic imports for chunks and generic components
// This file is loaded on-demand by page.tsx via a two-level dynamic import
// It is NOT part of the initial compilation, preventing OOM

import type { ComponentType } from 'react'
import type { PageLoadResult, GenericPageType } from './page-chunks/types'

// Cache for loaded chunks
const chunkCache: Record<string, any> = {}

// Load a chunk by name
export async function loadChunkByName(chunkName: string): Promise<any> {
  if (chunkCache[chunkName]) return chunkCache[chunkName]
  let mod: any
  switch (chunkName) {
    case 'browse': mod = await import('./page-chunks/chunk-browse'); break
    case 'cart': mod = await import('./page-chunks/chunk-cart'); break
    case 'profile': mod = await import('./page-chunks/chunk-profile'); break
    case 'wishlist': mod = await import('./page-chunks/chunk-wishlist'); break
    case 'seller': mod = await import('./page-chunks/chunk-seller'); break
    case 'search': mod = await import('./page-chunks/chunk-search'); break
    case 'support': mod = await import('./page-chunks/chunk-support'); break
    case 'misc': mod = await import('./page-chunks/chunk-misc'); break
    default: return null
  }
  chunkCache[chunkName] = mod
  return mod
}

// Load a page from a chunk
export async function loadPageFromChunk(chunkName: string, pageId: string): Promise<PageLoadResult> {
  const mod = await loadChunkByName(chunkName)
  if (mod && mod.loadChunkPage) {
    return mod.loadChunkPage(pageId)
  }
  return { component: null }
}

// Load a generic component by type
export async function loadGenericComponent(type: GenericPageType): Promise<ComponentType<any> | null> {
  try {
    switch (type) {
      case 'category': { const m = await import('@/components/pages/generic-category-page'); return m.GenericCategoryPage || m.default }
      case 'deals': { const m = await import('@/components/pages/generic-deals-page'); return m.GenericDealsPage || m.default }
      case 'info': { const m = await import('@/components/pages/generic-info-page'); return m.GenericInfoPage || m.default }
      case 'finance': { const m = await import('@/components/pages/generic-finance-page'); return m.GenericFinancePage || m.default }
      case 'supplier': { const m = await import('@/components/pages/supplier-dashboard-page') as unknown as Record<string, ComponentType<any> | undefined>; return m.default ?? m[Object.keys(m).find(k => k.includes('Page'))!] ?? null }
      case 'admin': { const m = await import('@/components/pages/admin-dashboard-page') as unknown as Record<string, ComponentType<any> | undefined>; return m.default ?? m[Object.keys(m).find(k => k.includes('Page'))!] ?? null }
      case 'buyer': { const m = await import('@/components/pages/buyer-dashboard-page'); return m.default || m[Object.keys(m).find(k => k.includes('Page'))!] }
      default: return null
    }
  } catch { return null }
}
