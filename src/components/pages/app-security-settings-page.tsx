'use client'

import { Shield, ArrowLeft, Fingerprint, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

// HONESTY NOTE: this page previously presented fake Android-only security
// switches (biometric "SafePay Release", FLAG_SECURE, quick PIN) that persisted
// nothing, plus a fake "Saved!" button and a simulated biometric test. None of
// these features exist on the Zylod web app, so the page now says so honestly.
export function AppSecuritySettingsPage() {
  const { navigate } = useNavigationStore()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Security & Biometrics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Device-level security for the Zylod web app</p>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Not Available Yet
          </CardTitle>
          <CardDescription className="text-xs">Device security features planned for the Zylod apps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100 text-xs text-blue-900 leading-relaxed">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Biometric authentication, screen-capture shielding, and quick-PIN locking are not available on the Zylod web app yet. Nothing on this page changes your account security today — we will not pretend to save settings that do nothing.
            </p>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-2"><Fingerprint className="h-3.5 w-3.5 text-primary" /> Fingerprint / Face ID sign-in — planned, not available yet</p>
            <p className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-primary" /> Screen-capture protection on payment screens — planned, not available yet</p>
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t">
            In the meantime, your session is protected by signed login tokens — manage them from Account Settings, and email support@zylod.com if you notice anything unusual.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
export default AppSecuritySettingsPage
