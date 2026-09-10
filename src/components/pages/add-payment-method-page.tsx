'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, CreditCard, Smartphone, Building2,
  Save, ShieldCheck, CheckCircle2
} from 'lucide-react'

type TabType = 'card' | 'mfs' | 'bank'

export function AddPaymentMethodPage() {
  const { navigate, goBack } = useNavigationStore()
  const [activeTab, setActiveTab] = useState<TabType>('card')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Card form state
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')

  // MFS form state
  const [mfsProvider, setMfsProvider] = useState<'bkash' | 'nagad' | 'rocket'>('bkash')
  const [mfsNumber, setMfsNumber] = useState('')

  // Bank form state
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSuccess(true)
      setTimeout(() => {
        navigate('payment-method')
      }, 1000)
    }, 800)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Add Payment Method</h1>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-6 space-y-5 md:space-y-6 max-w-lg mx-auto lg:max-w-3xl">
        {/* Method Switcher Tabs */}
        <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('card')}
            className={`py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'card' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Card
          </button>
          <button
            onClick={() => setActiveTab('mfs')}
            className={`py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'mfs' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            MFS (bKash)
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'bank' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Bank
          </button>
        </div>

        {/* Card Form */}
        {activeTab === 'card' && (
          <form onSubmit={handleSave} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Debit / Credit / Corporate Card</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Card Number</label>
              <Input
                placeholder="4000 1234 5678 9010"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Cardholder Name</label>
              <Input
                placeholder="e.g. John Doe / Acme Corp"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                required
              />
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Expiry Date</label>
                <Input
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">CVV / CVC</label>
                <Input
                  placeholder="123"
                  type="password"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md mt-2 flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Verifying Card...' : 'Save & Link Card'}
            </Button>
          </form>
        )}

        {/* MFS Form */}
        {activeTab === 'mfs' && (
          <form onSubmit={handleSave} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Mobile Financial Services</h2>

            <div className="flex gap-2">
              {[
                { id: 'bkash', label: 'bKash Merchant' },
                { id: 'nagad', label: 'Nagad Business' },
                { id: 'rocket', label: 'DBBL Rocket' },
              ].map((prov) => (
                <button
                  type="button"
                  key={prov.id}
                  onClick={() => setMfsProvider(prov.id as any)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    mfsProvider === prov.id
                      ? 'bg-rose-50 text-primary border-primary'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {prov.label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Account Number / Wallet No.</label>
              <Input
                placeholder="01XXXXXXXXX"
                type="tel"
                value={mfsNumber}
                onChange={(e) => setMfsNumber(e.target.value)}
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">A verification OTP will be sent to link this wallet.</p>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md mt-2"
            >
              {saving ? 'Linking Wallet...' : 'Verify & Link Wallet'}
            </Button>
          </form>
        )}

        {/* Bank Form */}
        {activeTab === 'bank' && (
          <form onSubmit={handleSave} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Corporate Bank Account / L/C</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Bank Name</label>
              <Input
                placeholder="e.g. Eastern Bank Ltd. / City Bank Corporate"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Account Title / Company</label>
              <Input
                placeholder="e.g. Acme Industrial Supplies Ltd."
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                required
              />
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Account Number</label>
                <Input
                  placeholder="100XXXXXXXXX"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Routing Number</label>
                <Input
                  placeholder="09027XXXX"
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md mt-2"
            >
              {saving ? 'Linking Bank Account...' : 'Link Bank Account'}
            </Button>
          </form>
        )}

        {/* Security badge */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center gap-2.5 text-[11px] text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Payment details are securely encrypted and verified through central payment gateways.</span>
        </div>
      </main>
    </div>
  )
}

export default AddPaymentMethodPage
