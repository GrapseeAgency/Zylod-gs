'use client'

import React, { useState } from 'react'
import { Shield, ArrowLeft, CheckCircle2, Fingerprint, Lock, KeyRound, Smartphone, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'

export function AppSecuritySettingsPage() {
  const { navigate } = useNavigationStore()
  const [biometricSafePay, setBiometricSafePay] = useState(true)
  const [appPinCode, setAppPinCode] = useState(false)
  const [screenCaptureProtection, setScreenCaptureProtection] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleTestBiometrics = () => {
    if (typeof window !== 'undefined' && (window as any).ZylodNativeBridge?.requestBiometricAuth) {
      (window as any).ZylodNativeBridge.requestBiometricAuth('window.__biometricCallback')
      ;(window as any).__biometricCallback = (success: boolean, err: string | null) => {
        if (success) {
          alert('Biometric authentication verified successfully on device!')
        } else {
          alert('Biometric authentication failed: ' + err)
        }
      }
    } else {
      alert('Native Android Biometric Scanner is active in APK release. (Simulated success in Web)')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Security & Biometrics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Device biometric gating, escrow multi-factor authorization, and hardware protection</p>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            Hardware-Backed Authentication
          </CardTitle>
          <CardDescription className="text-xs">Android BiometricPrompt API with Android Keystore encryption</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-semibold text-sm">Fingerprint / Face ID for SafePay Release</div>
              <p className="text-xs text-muted-foreground">Sign wholesale disbursements and supplier payouts with device biometric sensors</p>
            </div>
            <Switch checked={biometricSafePay} onCheckedChange={setBiometricSafePay} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="space-y-0.5">
              <div className="font-semibold text-sm">FLAG_SECURE Screen Capture Shield</div>
              <p className="text-xs text-muted-foreground">Prevent screenshots and screen recording on invoice and payment screens</p>
            </div>
            <Switch checked={screenCaptureProtection} onCheckedChange={setScreenCaptureProtection} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t md:col-span-2">
            <div className="space-y-0.5">
              <div className="font-semibold text-sm">App Inactivity 4-Digit Quick PIN</div>
              <p className="text-xs text-muted-foreground">Require quick PIN access when returning to Zylod after switching apps</p>
            </div>
            <Switch checked={appPinCode} onCheckedChange={setAppPinCode} />
          </div>

          <div className="pt-4 border-t flex flex-col sm:flex-row items-center gap-3 justify-between md:col-span-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestBiometrics}
              className="text-xs font-semibold gap-2 border-primary/40 text-primary w-full sm:w-auto"
            >
              <Fingerprint className="h-4 w-4" />
              Test Device Biometric Sensor
            </Button>
            <Button
              size="sm"
              onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }}
              className="bg-primary text-primary-foreground text-xs font-bold w-full sm:w-auto"
            >
              {saved ? 'Saved!' : 'Update Security Guardrails'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default AppSecuritySettingsPage
