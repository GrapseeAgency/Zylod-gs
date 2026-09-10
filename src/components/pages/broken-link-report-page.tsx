'use client'

import React, { useState } from 'react'
import { AlertTriangle, ArrowLeft, Send, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useNavigationStore } from '@/store/navigation-store'

export function BrokenLinkReportPage() {
  const { navigate } = useNavigationStore()
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/app/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorCode: 'USER_REPORTED_BROKEN_LINK',
          statusCode: 404,
          message: description || 'User reported dead URL',
          route: url,
        }),
      })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-10 max-w-2xl lg:max-w-3xl space-y-6 md:space-y-8">
      <Button variant="ghost" size="sm" onClick={() => navigate('error-404')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to 404 Page
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Report Broken Link / Dead Route</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Help our engineering team repair missing wholesale URLs and product permalinks</p>
      </div>

      {submitted ? (
        <Card className="rounded-2xl border p-6 text-center space-y-3 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
          <h3 className="font-bold text-base text-foreground">Thank You for Your Report!</h3>
          <p className="text-xs text-muted-foreground">Our web operations team has logged this URL for immediate indexing.</p>
          <Button size="sm" onClick={() => navigate('home')} className="mt-2 text-xs font-bold">
            Return to Marketplace
          </Button>
        </Card>
      ) : (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Broken Link Details
            </CardTitle>
            <CardDescription className="text-xs">Provide the URL you were attempting to access</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Target URL / Deep Link</Label>
                <Input
                  placeholder="https://zylod.com/product/..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Additional Context (Optional)</Label>
                <Textarea
                  placeholder="Where did you find this link? (e.g. email promo, external site, QR code)"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="text-xs min-h-[90px]"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
                  <Send className="h-4 w-4" />
                  {submitting ? 'Submitting...' : 'Submit Broken Link Report'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export default BrokenLinkReportPage
