'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BellRing, Check } from 'lucide-react'

interface BackInStockButtonProps {
  productId: string
  productName: string
  stockQuantity: number
  className?: string
  /** Called on a real 401 — the parent owns auth UX (toast + login nav). */
  onRequireLogin?: () => void
  /** Called on 201 (created) or 409 (already watching). */
  onSubscribed?: () => void
}

/**
 * Task 61 — buyer-facing restock watch. Renders ONLY for an out-of-stock
 * product (stockQuantity <= 0) and disappears on its own the moment live
 * stock (product:stock socket) comes back through the parent.
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
  className,
  onRequireLogin,
  onSubscribed,
}: BackInStockButtonProps) {
  const [state, setState] = useState<'idle' | 'busy' | 'watching'>('idle')

  if (stockQuantity > 0) return null

  const subscribe = async () => {
    if (state !== 'idle') return
    setState('busy')
    try {
      const res = await fetch('/api/stock-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
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
      <Button variant="outline" disabled className={className} aria-label={`Restock watch active for ${productName}`}>
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
      aria-label={`Notify me when ${productName} is back in stock`}
    >
      <BellRing className={`w-4 h-4 mr-2 ${state === 'busy' ? 'animate-pulse' : ''}`} />
      {state === 'busy' ? 'Setting watch…' : 'Notify me when back in stock'}
    </Button>
  )
}
