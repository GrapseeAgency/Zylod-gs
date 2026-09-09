// Chunk: Shipping — Shipping/delivery pages (all handled by generic components)

import type { PageLoadResult } from './types'
import { loadFromMap } from './types'

export const CHUNK_SHIPPING = new Set([
  // All pageIds resolve via generic components (component: null from loadFromMap)
  'shipping-tracker', 'delivery-partner-chat', 'delivery-confirmation', 'delivery-photo-proof',
  'missed-delivery', 'reschedule-delivery', 'pickup-point-selection', 'warehouse-locator',
  'shipping-calculator', 'shipping-policies', 'import-export-tracker', 'customs-clearance', 'freight-tracking',
])

export async function loadChunkPage(pageId: string): Promise<PageLoadResult> {
  const loaders: Record<string, () => Promise<any>> = {}
  return loadFromMap(loaders, pageId)
}
