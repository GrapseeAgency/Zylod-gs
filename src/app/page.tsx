'use client'

import dynamic from 'next/dynamic'

// AppEntry drives the full SPA router via the navigation store.
// It renders the active page (home, product, cart, dashboard, and all generic
// pages) inside the shared AppShell (header / footer / mobile bottom-nav),
// so every link and both mobile + desktop routes stay enabled.
const AppEntry = dynamic(() => import('@/components/app-entry').then(m => m.AppEntry), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C8102E]" />
    </div>
  ),
})

export default function Home() {
  return <AppEntry />
}

