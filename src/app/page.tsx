'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// AppEntry drives the full SPA router via the navigation store.
// It renders the active page (home, product, cart, dashboard, and all generic
// pages) inside the shared AppShell (header / footer / mobile bottom-nav),
// so every link and both mobile + desktop routes stay enabled.
const AppEntry = dynamic(() => import('@/components/app-entry').then(m => m.AppEntry), {
  ssr: false,
  // Same visual as <PageLoader /> (src/components/ui/page-loader.tsx) — the
  // single standard website loading animation, inlined so the entry chunk
  // stays free of the client-component import.
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  ),
})

export default function Home() {
  return <AppEntry />
}
