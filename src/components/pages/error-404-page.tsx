'use client'

import React, { useEffect } from 'react'
import {
  FileQuestion,
  Home,
  Search,
  ArrowLeft,
  Compass,
  AlertTriangle,
  Send,
  Sparkles
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function Error404Page() {
  const { navigate, goBack } = useNavigationStore()

  useEffect(() => {
    // Report 404 Telemetry to backend
    fetch('/api/app/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorCode: 'PAGE_NOT_FOUND',
        statusCode: 404,
        message: 'Client route not found',
        route: typeof window !== 'undefined' ? window.location.href : '',
      }),
    }).catch(() => {})
  }, [])

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl text-center space-y-8">
      {/* 404 Graphic Hero */}
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="text-8xl md:text-9xl font-black tracking-tighter text-primary/20 select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <FileQuestion className="h-10 w-10" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-foreground">
          Wholesale Page or Product Not Found
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The requested wholesale listing, supplier storefront, or document route may have been moved, expired, or archived.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => navigate('home')}
          className="bg-primary text-primary-foreground text-xs font-bold py-5 px-6 rounded-xl gap-2 shadow-sm"
        >
          <Home className="h-4 w-4" />
          Back to Marketplace Home
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate('search-home')}
          className="text-xs font-bold py-5 px-6 rounded-xl gap-2 border-primary/30 text-primary"
        >
          <Search className="h-4 w-4" />
          Search Wholesale Catalog
        </Button>

        <Button
          variant="ghost"
          onClick={() => goBack()}
          className="text-xs font-bold py-5 px-5 rounded-xl gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous Page
        </Button>
      </div>

      {/* Helpful Directory Shortcuts */}
      <div className="pt-8 border-t text-left max-w-xl mx-auto space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5" /> Popular Destinations
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {[
            { title: 'Category Directory', page: 'category-navigation' },
            { title: 'Verified Suppliers', page: 'suppliers' },
            { title: 'Daily Wholesale Deals', page: 'daily-deals' },
            { title: 'Help & Support Center', page: 'help-center' },
          ].map((item) => (
            <Card
              key={item.title}
              onClick={() => navigate(item.page as any)}
              className="cursor-pointer hover:border-primary transition-all p-3 rounded-xl border bg-card"
            >
              <div className="text-xs font-bold text-foreground hover:text-primary">{item.title}</div>
            </Card>
          ))}
        </div>

        <div className="text-center pt-4">
          <Button
            variant="link"
            size="sm"
            onClick={() => navigate('broken-link-report')}
            className="text-xs text-muted-foreground hover:text-primary gap-1"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Report broken URL or invalid deep link
          </Button>
        </div>
      </div>
    </div>
  )
}
export default Error404Page
