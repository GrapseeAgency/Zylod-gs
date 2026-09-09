import type { ComponentType } from 'react'

// Generic page types handled by generic components
export type GenericPageType = 'category' | 'deals' | 'info' | 'finance' | 'supplier' | 'admin' | 'buyer'

// Result returned by page loaders
export interface PageLoadResult {
  component: ComponentType<any> | null
  needsPageId?: boolean
  genericType?: GenericPageType
}

// Helper to load a component from a dynamic import map
export async function loadFromMap(
  loaders: Record<string, () => Promise<any>>,
  pageId: string
): Promise<PageLoadResult> {
  const loader = loaders[pageId]
  if (!loader) return { component: null }
  try {
    const mod = await loader()
    if (mod.default) return { component: mod.default }
    const keys = Object.keys(mod)
    const pageKey = keys.find(k => k.includes('Page'))
    if (pageKey) return { component: mod[pageKey] }
    return { component: null }
  } catch (e) {
    console.error(`Failed to load page: ${pageId}`, e)
    return { component: null }
  }
}
