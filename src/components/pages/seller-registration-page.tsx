'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Building2, MapPin, CreditCard, FileCheck2, ArrowRight,
  ArrowLeft, Check, ShieldCheck, UploadCloud, AlertCircle
} from 'lucide-react'

export function SellerRegistrationPage() {
  const { navigate } = useNavigationStore()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    companyName: '',
    tradeLicenseNo: '',
    tinNumber: '',
    businessType: 'MANUFACTURER',
    contactPerson: '',
    email: '',
    phone: '',
    warehouseAddress: '',
    city: 'Dhaka',
    division: 'Dhaka',
    postalCode: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankName: '',
    branchName: '',
    routingNumber: '',
    bkashMerchant: '',
    agreeToWholesaleTerms: true
  })

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    setError(null)
    if (step === 1) {
      if (!formData.companyName || !formData.tradeLicenseNo || !formData.phone) {
        setError('Please fill in Company Name, Trade License, and Phone Number')
        return
      }
    } else if (step === 2) {
      if (!formData.warehouseAddress || !formData.city) {
        setError('Please enter your primary factory/warehouse address')
        return
      }
    } else if (step === 3) {
      if (!formData.bankAccountNumber && !formData.bkashMerchant) {
        setError('Please provide at least one payout method (Bank Account or bKash Merchant)')
        return
      }
    }
    setStep(prev => prev + 1)
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(true)
        setTimeout(() => {
          navigate('seller-dashboard')
        }, 2000)
      } else {
        setError(data.error || 'Failed to submit registration. Please try again.')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : navigate('home')}
            className="p-2 -ml-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base sm:text-lg text-neutral-100">
              Wholesale Merchant Registration
            </h1>
            <p className="text-xs text-neutral-400">Step {step} of 4 — Onboarding Wizard</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`w-5 h-1.5 rounded-full transition-all ${
                s <= step ? 'bg-[#C8102E]' : 'bg-neutral-800'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 md:max-w-2xl md:px-6 md:py-6">
        {error && (
          <div className="mb-4 bg-red-950/40 border border-red-800/60 rounded-xl p-3 flex items-center gap-2.5 text-red-300 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-2xl p-6"
          >
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-neutral-100">Registration Submitted!</h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-2 mb-6 max-w-sm mx-auto">
              Your merchant application has been received. Redirecting you to the Seller Hub to upload verification credentials...
            </p>
            <Button
              onClick={() => navigate('seller-dashboard')}
              className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs px-6"
            >
              Go to Seller Dashboard
            </Button>
          </motion.div>
        ) : (
          <Card className="bg-neutral-900 border-neutral-800 shadow-xl">
            <CardContent className="p-5 sm:p-6">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-800">
                      <Building2 className="w-5 h-5 text-[#C8102E]" />
                      <div>
                        <h2 className="font-bold text-sm sm:text-base text-neutral-200">Company & Legal Information</h2>
                        <p className="text-[11px] text-neutral-400">Registered entity trade details</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-neutral-300 font-medium mb-1 block">Company / Factory Name *</label>
                      <Input
                        value={formData.companyName}
                        onChange={e => handleChange('companyName', e.target.value)}
                        placeholder="e.g. Apex Industrial Garments Ltd."
                        className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-neutral-300 font-medium mb-1 block">Trade License No *</label>
                        <Input
                          value={formData.tradeLicenseNo}
                          onChange={e => handleChange('tradeLicenseNo', e.target.value)}
                          placeholder="e.g. TRAD/DNCC/12345"
                          className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-300 font-medium mb-1 block">Tax TIN Number</label>
                        <Input
                          value={formData.tinNumber}
                          onChange={e => handleChange('tinNumber', e.target.value)}
                          placeholder="12-digit eTIN"
                          className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-neutral-300 font-medium mb-1 block">Official Contact Person</label>
                        <Input
                          value={formData.contactPerson}
                          onChange={e => handleChange('contactPerson', e.target.value)}
                          placeholder="Full Name"
                          className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-300 font-medium mb-1 block">Official Phone / WhatsApp *</label>
                        <Input
                          value={formData.phone}
                          onChange={e => handleChange('phone', e.target.value)}
                          placeholder="+880 1700 000000"
                          className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-800">
                      <MapPin className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h2 className="font-bold text-sm sm:text-base text-neutral-200">Warehouse & Dispatch Address</h2>
                        <p className="text-[11px] text-neutral-400">Where couriers will collect wholesale orders</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-neutral-300 font-medium mb-1 block">Warehouse / Factory Address *</label>
                      <Textarea
                        rows={3}
                        value={formData.warehouseAddress}
                        onChange={e => handleChange('warehouseAddress', e.target.value)}
                        placeholder="Plot #, Street, Industrial Zone, Area..."
                        className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-neutral-300 font-medium mb-1 block">City / Thana *</label>
                        <Input
                          value={formData.city}
                          onChange={e => handleChange('city', e.target.value)}
                          placeholder="e.g. Gazipur, Narayanganj"
                          className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-300 font-medium mb-1 block">Postal Code</label>
                        <Input
                          value={formData.postalCode}
                          onChange={e => handleChange('postalCode', e.target.value)}
                          placeholder="e.g. 1700"
                          className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-800">
                      <CreditCard className="w-5 h-5 text-amber-400" />
                      <div>
                        <h2 className="font-bold text-sm sm:text-base text-neutral-200">Payout & Banking Details</h2>
                        <p className="text-[11px] text-neutral-400">Where wholesale sales revenue will be deposited</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-neutral-300 font-medium mb-1 block">Bank Name</label>
                        <Input
                          value={formData.bankName}
                          onChange={e => handleChange('bankName', e.target.value)}
                          placeholder="e.g. BRAC Bank Ltd."
                          className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-300 font-medium mb-1 block">Account Number</label>
                        <Input
                          value={formData.bankAccountNumber}
                          onChange={e => handleChange('bankAccountNumber', e.target.value)}
                          placeholder="13-16 digit account"
                          className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-neutral-300 font-medium mb-1 block">Account Holder Title</label>
                      <Input
                        value={formData.bankAccountName}
                        onChange={e => handleChange('bankAccountName', e.target.value)}
                        placeholder="Must match Company or Proprietor name"
                        className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-neutral-300 font-medium mb-1 block">bKash Merchant / Wallet (Optional)</label>
                      <Input
                        value={formData.bkashMerchant}
                        onChange={e => handleChange('bkashMerchant', e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-800">
                      <FileCheck2 className="w-5 h-5 text-purple-400" />
                      <div>
                        <h2 className="font-bold text-sm sm:text-base text-neutral-200">Review & Confirmation</h2>
                        <p className="text-[11px] text-neutral-400">Confirm terms and finalize onboarding</p>
                      </div>
                    </div>

                    <div className="bg-neutral-950 rounded-xl p-4 space-y-2 text-xs border border-neutral-800">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Entity Name:</span>
                        <span className="font-semibold text-neutral-200">{formData.companyName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Trade License:</span>
                        <span className="font-semibold text-neutral-200">{formData.tradeLicenseNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Warehouse:</span>
                        <span className="font-semibold text-neutral-200">{formData.city}, {formData.division}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Payout Target:</span>
                        <span className="font-semibold text-neutral-200">{formData.bankName || 'bKash Merchant'}</span>
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 text-xs text-neutral-300 pt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.agreeToWholesaleTerms}
                        onChange={e => handleChange('agreeToWholesaleTerms', e.target.checked)}
                        className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-[#C8102E] focus:ring-[#C8102E]"
                      />
                      <span>
                        I agree to the Zylod Wholesale Supplier Agreement, Code of Conduct, and standard 5% platform commission schedule.
                      </span>
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-6 mt-6 border-t border-neutral-800">
                {step > 1 ? (
                  <Button
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                    className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-xs px-4"
                  >
                    Back
                  </Button>
                ) : <div />}

                {step < 4 ? (
                  <Button
                    onClick={handleNext}
                    className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs font-semibold px-5 flex items-center gap-1.5"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !formData.agreeToWholesaleTerms}
                    className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs font-semibold px-6 flex items-center gap-1.5"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Complete Application
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default SellerRegistrationPage
