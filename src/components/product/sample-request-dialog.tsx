'use client'

/**
 * SampleRequestDialog — the buyer-facing entry to the sample rail (Task 90):
 * "try one before the bulk carton". Posts the REAL POST /api/samples with a
 * quantity and (optionally) one of the buyer's real address-book rows; the
 * server snapshots the address at creation (Task 87's lesson) and wakes the
 * supplier durably + live. Every non-happy path surfaces the server's verbatim
 * error (404 product, 409 duplicate active sample, 400 foreign address) —
 * the dialog never invents success.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { PackageOpen, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useNavigationStore } from '@/store/navigation-store'

interface AddressRow {
  id: string
  label: string
  contactName: string | null
  addressLine1: string
  city: string
  postalCode: string | null
  isDefault: boolean
}

export function SampleRequestDialog({
  open,
  onOpenChange,
  productId,
  productName,
  unit,
  moq,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  productId: string
  productName: string
  unit: string
  moq: number
}) {
  const navigate = useNavigationStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)
  const [quantity, setQuantity] = useState(1)
  const [addresses, setAddresses] = useState<AddressRow[]>([])
  const [addressId, setAddressId] = useState('')
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadAddresses = useCallback(async () => {
    if (!user) return
    setLoadingAddresses(true)
    try {
      const res = await fetch('/api/addresses', { credentials: 'include' })
      const json = await res.json().catch(() => null)
      const rows: AddressRow[] = Array.isArray(json?.data) ? json.data : Array.isArray(json?.data?.addresses) ? json.data.addresses : []
      setAddresses(rows)
      const def = rows.find((a) => a.isDefault) ?? rows[0]
      if (def) setAddressId(def.id)
    } catch {
      // honest empty — the buyer can still request without an address
    } finally {
      setLoadingAddresses(false)
    }
  }, [user])

  useEffect(() => {
    if (open) {
      setError('')
      setQuantity(1)
      void loadAddresses()
    }
  }, [open, loadAddresses])

  const submit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { productId, quantity }
      if (addressId) body.shippingAddressId = addressId
      const res = await fetch('/api/samples', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const details = json?.details ? Object.values(json.details).flat().join(' ') : ''
        setError((json?.error || `Failed to request sample (HTTP ${res.status})`) + (details ? ` — ${details}` : ''))
        return
      }
      toast.success('Sample requested', { description: 'The supplier has been notified.' })
      onOpenChange(false)
      navigate('my-samples')
    } catch {
      setError('Network error while requesting the sample')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5 text-primary" /> Request a sample
          </DialogTitle>
          <DialogDescription>
            Try one {unit} of <span className="font-medium">{productName}</span> before committing to a bulk carton. The supplier ships it to you; you confirm arrival.
          </DialogDescription>
        </DialogHeader>
        {user ? (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sample-qty">Quantity ({unit})</Label>
              <Input
                id="sample-qty"
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">Bulk MOQ for this product is {moq} {unit} — a sample is smaller by design.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sample-addr">Ship to</Label>
              {loadingAddresses ? (
                <div className="h-9 rounded-md bg-muted animate-pulse" aria-hidden />
              ) : addresses.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No address book entries yet — the supplier will ask where to ship. (Addresses are snapshotted onto the sample when provided.)
                </p>
              ) : (
                <select
                  id="sample-addr"
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}{a.isDefault ? ' (default)' : ''} — {a.addressLine1}, {a.city}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Sign in as a buyer to request samples.
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !user}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Requesting…</> : 'Request sample'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
