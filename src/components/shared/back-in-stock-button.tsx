'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BellRing, Check } from 'lucide-react'

interface BackInStockButtonProps {
  productId: string
  productName: string
  stockQuantity: number
  /** Task 65: per-variant watch — the currently selected variant on the PDP.
   *  When the product still has stock but THIS variant is at zero, the CTA
   *  becomes a watch pinned to that exact variant. */
  variantId?: string | null
  variantLabel?: string | null
  variantStock?: number | null
  className?: string
  /** Called on a real 401 — the parent owns auth UX (toast + login nav). */
  onRequireLogin?: () => void
  /** Called on 201 (created) or 409 (already watching). */
  onSubscribed?: () => void
}

/**
 * Task 61 — buyer-facing restock watch. Task 65 — variant-aware:
 *
 *   • product itself out of stock           → watch the WHOLE product
 *   • product in stock, selected variant 0  → watch THAT exact variant
 *     ("Notify me when Color: Red is back") — the watch completes only when
 *     that variant restocks, never by another variant's restock.
 *
 * Renders ONLY when something watchable is out of stock and disappears on
 * its own the moment live stock (product:stock socket) comes back through
 * the parent — including per-variant stock pushes carrying a variantId.
 *
 * Real API contract, no fake states:
 *   201 → watch created (state flips to "active")
 *   409 → an active watch already existed (same "active" state)
 *   401 → parent's onRequireLogin (house pattern: toast + login page)
 *   anything else → the button stays usable; the failure is silent only in
 *   the sense that no false success is ever shown.
 */
export function BackInStockButton({
  productId,
  productName,
  stockQuantity,
  variantId,
  variantLabel,
  variantStock,
  className,
  onRequireLogin,
  onSubscribed,
}: BackInStockButtonProps) {
  const [state, setState] = useState<'idle' | 'busy' | 'watching'>('idle')

  const productOutOfStock = stockQuantity <= 0
  const variantOutOfStock =
    !productOutOfStock && variantId != null && variantStock != null && variantStock <= 0

  if (!productOutOfStock && !variantOutOfStock) return null

  // Product-level watch wins when the whole product is gone — a restock of
  // anything on it is news. The variant watch only exists while the product
  // still has stock somewhere else.
  const watchVariantId = productOutOfStock ? null : variantId
  const watchLabel =
    !productOutOfStock && variantLabel ? variantLabel : null

  const subscribe = async () => {
    if (state !== 'idle') return
    setState('busy')
    try {
      const res = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          ...(watchVariantId ? { variantId: watchVariantId } : {}),
        }),
      })
      if (res.status === 201 || res.status === 409) {
        setState('watching')
        onSubscribed?.()
        return
      }
      if (res.status === 401) {
        onRequireLogin?.()
        return
      }
    } catch {
      // network error — fall through, stay idle, no fake success
    }
    setState('idle')
  }

  if (state === 'watching') {
    return (
      <Button variant="outline" disabled className={className} aria-label={`Restock watch active for ${watchLabel ? `${watchLabel} of ` : ''}${productName}`}>
        <Check className="w-4 h-4 mr-2" />
        Restock watch active
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      disabled={state === 'busy'}
      onClick={subscribe}
      className={className}
      aria-label={`Notify me when ${watchLabel ? `${watchLabel} of ` : ''}${productName} is back in stock`}
    >
      <BellRing className={`w-4 h-4 mr-2 ${state === 'busy' ? 'animate-pulse' : ''}`} />
      {watchLabel
        ? `Notify me when ${watchLabel} is back`
        : state === 'busy'
          ? 'Setting watch…'
          : 'Notify me when back in stock'}
    </Button>
  )
}
