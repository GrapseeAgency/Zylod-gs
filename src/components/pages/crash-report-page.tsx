'use client'

import React, { useState } from 'react'
import { AlertOctagon, ArrowLeft, Send, CheckCircle2, FileCode } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'

export function CrashReportPage() {
  const { navigate } = useNavigationStore()
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/app/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorCode: 'USER_SUBMITTED_CRASH_TRACE',
          statusCode: 500,
          message: details || 'Manual crash report from user',
        }),
      })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl lg:max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('error-500')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Error 500
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Crash Telemetry & Bug Report</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Submit stack trace or steps to reproduce to our core infrastructure engineering team</p>
      </div>

      {sent ? (
        <Card className="rounded-2xl border p-6 text-center space-y-3 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
          <h3 className="font-bold text-base text-foreground">Crash Trace Logged</h3>
          <p className="text-xs text-muted-foreground">Engineering ticket generated. Thank you for making Zylod better.</p>
          <Button size="sm" onClick={() => navigate('home')} className="mt-2 text-xs font-bold">
            Back to Marketplace
          </Button>
        </Card>
      ) : (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-destructive" />
              Incident Details
            </CardTitle>
            <CardDescription className="text-xs">Describe what actions you took before the server error occurred</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4">
              <Textarea
                placeholder="Steps to reproduce: e.g. Attempted to upload 500-item CSV in bulk supplier inventory..."
                value={details}
                onChange={e => setDetails(e.target.value)}
                className="text-xs min-h-[120px]"
                required
              />

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
                  <Send className="h-4 w-4" />
                  {loading ? 'Submitting...' : 'Send Telemetry Report'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export default CrashReportPage
