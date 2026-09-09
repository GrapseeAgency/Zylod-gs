'use client'

import React, { useState, useEffect } from 'react'
import {
  ServerCrash,
  RefreshCw,
  Home,
  Activity,
  ShieldCheck,
  ArrowLeft,
  AlertOctagon,
  Copy,
  Check
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function Error500Page() {
  const { navigate } = useNavigationStore()
  const [ticketRef, setTicketRef] = useState<string>('ERR-8820X')
  const [copied, setCopied] = useState(false)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    // Report 500 error telemetry
    fetch('/api/app/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorCode: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
        message: 'Application encountered an unexpected server exception',
        route: typeof window !== 'undefined' ? window.location.href : '',
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.ticketRef) setTicketRef(data.ticketRef)
      })
      .catch(() => {})
  }, [])

  const handleRetry = () => {
    setReloading(true)
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const copyRef = () => {
    navigator.clipboard.writeText(ticketRef)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl text-center space-y-8">
      {/* 500 Graphic Hero */}
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="text-8xl md:text-9xl font-black tracking-tighter text-destructive/20 select-none">
            500
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center text-destructive shadow-inner">
              <ServerCrash className="h-10 w-10" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-foreground">
          Temporary Server Exception Encountered
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Our distributed transaction engine caught an unexpected runtime error. Automated failover telemetry has logged this incident.
        </p>

        <div className="inline-flex items-center gap-2 p-2 px-3 bg-muted/40 rounded-xl border font-mono text-xs text-muted-foreground">
          <span>Incident Reference: <strong className="text-foreground">{ticketRef}</strong></span>
          <button onClick={copyRef} className="hover:text-foreground text-primary transition-colors">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={handleRetry}
          disabled={reloading}
          className="bg-primary text-primary-foreground text-xs font-bold py-5 px-6 rounded-xl gap-2 shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 ${reloading ? 'animate-spin' : ''}`} />
          {reloading ? 'Retrying...' : 'Retry Operation'}
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate('home')}
          className="text-xs font-bold py-5 px-6 rounded-xl gap-2 border-primary/30 text-primary"
        >
          <Home className="h-4 w-4" />
          Marketplace Home
        </Button>

        <Button
          variant="ghost"
          onClick={() => navigate('server-diagnostics')}
          className="text-xs font-bold py-5 px-5 rounded-xl gap-2"
        >
          <Activity className="h-4 w-4" />
          Live Server Diagnostics
        </Button>
      </div>

      {/* SafePay Escrow Notice */}
      <Card className="rounded-2xl border p-4 bg-muted/20 text-left max-w-xl mx-auto">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-foreground">SafePay Escrow Funds Are 100% Protected</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              If this occurred during checkout or order disbursement, your bank transaction is cryptographically secured and ledgered. No duplicate charges can occur.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
export default Error500Page
