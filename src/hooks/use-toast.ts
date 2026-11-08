'use client'

/* ══════════════════════════════════════════════════════════════════════
   useToast (t291 fix) — SONNER-BACKED SHIM with the original API.

   THE BUG THIS FIXES: this file used to be the classic shadcn in-memory
   toast store, which only renders if <Toaster /> from ui/toaster is
   mounted. The app mounts SONNER's <Toaster /> (layout.tsx) instead —
   so every toast({…}) call from the 11 useToast consumers (wishlist
   sign-in prompts, review publish/remove, finance withdraw/deposit,
   platform settings, missed-delivery reschedule, search hints…) was a
   silent no-op: the UI "worked", the user saw nothing. Verified live in
   t291: 12 guest heart-clicks, zero toasts.

   THE FIX: keep the exact call surface every consumer already uses —
   toast({ title, description?, variant? }) — but forward to the mounted
   sonner toaster. destructive → toast.error; everything else → toast().
   One file, every consumer fixed, no per-file rewrites.
   ══════════════════════════════════════════════════════════════════════ */

import { toast as sonnerToast } from 'sonner'
import type { ReactNode } from 'react'
import type { ToastProps } from '@/components/ui/toast'

interface ToastInput {
  title?: ReactNode
  description?: ReactNode
  variant?: 'default' | 'destructive' | null
}

/* Shape kept for the (unmounted) radix ui/toaster component's contract —
 * it destructures { id, title, description, action, ...props } from the
 * hook. sonner is the app's active toaster, so this list is always empty;
 * the type is retained so tsc stays green without keeping the old store. */
export type ToasterToast = ToastProps & {
  id: string
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
}

function toast(input: ToastInput) {
  if (!input || (input.title === undefined && input.description === undefined)) return
  const { title, description, variant } = input
  const options = description !== undefined ? { description } : undefined
  if (variant === 'destructive') {
    sonnerToast.error(title !== undefined ? title : 'Something went wrong', options)
  } else if (title !== undefined) {
    sonnerToast(title, options)
  } else {
    sonnerToast(description)
  }
}

export function useToast() {
  const toasts: ToasterToast[] = []
  return { toast, toasts }
}

export { toast }
