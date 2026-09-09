'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { ArrowRight, ArrowLeft, Store, Shield, Upload, FileText, AlertCircle, Banknote, Eye, EyeOff, Lock } from 'lucide-react'
import { toast } from 'sonner'

const STEPS = [
  { label: 'Company Info', icon: Store },
  { label: 'NID Upload', icon: FileText },
  { label: 'Trade License & TIN', icon: Shield },
  { label: 'Bank Details', icon: Banknote },
]

export default function RegisterSupplierPage() {
  const { navigate } = useNavigationStore()
  const { login } = useAuthStore()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Company Info
  const [companyName, setCompanyName] = useState('')
  const [city, setCity] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // Step 2: NID Upload
  const [nidNumber, setNidNumber] = useState('')
  const [nidFrontFile, setNidFrontFile] = useState<File | null>(null)
  const [nidFrontPreview, setNidFrontPreview] = useState<string | null>(null)
  const [nidBackFile, setNidBackFile] = useState<File | null>(null)
  const [nidBackPreview, setNidBackPreview] = useState<string | null>(null)

  // Step 3: Trade License & TIN
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('')
  const [tradeLicenseFile, setTradeLicenseFile] = useState<File | null>(null)
  const [tradeLicensePreview, setTradeLicensePreview] = useState<string | null>(null)
  const [tinNumber, setTinNumber] = useState('')

  // Step 4: Bank Details
  const [bankName, setBankName] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankBranch, setBankBranch] = useState('')

  const handleFileSelect = (
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 8 * 1024 * 1024) {
      setError('Document too large (max 8MB)')
      return
    }
    setFile(f)
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  /** Upload one KYC document and return its server URL. */
  const uploadKyc = async (file: File, kind: 'nid-front' | 'nid-back' | 'trade-license'): Promise<string> => {
    const form = new FormData()
    form.append('file', file)
    form.append('kind', kind)
    const res = await fetch('/api/uploads/kyc', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Failed to upload ${kind}`)
    return data.url
  }

  const handleFinalSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Persist identity documents first so the profile stores real URLs.
      let nidFrontUrl: string | undefined
      let nidBackUrl: string | undefined
      let tradeLicenseUrl: string | undefined

      if (nidFrontFile) nidFrontUrl = await uploadKyc(nidFrontFile, 'nid-front')
      if (nidBackFile) nidBackUrl = await uploadKyc(nidBackFile, 'nid-back')
      if (tradeLicenseFile) tradeLicenseUrl = await uploadKyc(tradeLicenseFile, 'trade-license')

      // Register the supplier via our API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userType: 'supplier',
          email,
          phone,
          password,
          authProvider: 'email',
          fullName,
          businessName: companyName,
          businessType,
          city,
          // KYC documents
          nidNumber,
          nidFrontImageUrl: nidFrontUrl,
          nidBackImageUrl: nidBackUrl,
          tradeLicenseNumber,
          tradeLicenseImageUrl: tradeLicenseUrl,
          tinNumber,
          bankName,
          bankAccountName,
          bankAccountNumber,
          branch: bankBranch,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }

      // Store auth state
      if (data.token && data.user) {
        login({
          id: data.user.id,
          userType: data.user.userType,
          email: data.user.email,
          phone: data.user.phone,
          fullName: data.user.fullName,
          businessName: data.user.businessName,
          avatarUrl: null,
          isProfileComplete: false,
          profileCompletionPct: 30,
        }, data.token)
      }

      toast.success('Account created! Your profile is pending verification.')

      // Navigate to verification status page
      navigate('supplier-verification-status', { supplierId: data.user?.id || '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const progressPct = (step / STEPS.length) * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto space-y-6 md:max-w-2xl md:py-10"
    >
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-lg bg-[#C8102E] text-white font-bold text-lg flex items-center justify-center">
            <Store className="h-6 w-6" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Register as Supplier</h1>
        <p className="text-sm text-[#6B7280]">Start selling on the B2B wholesale marketplace</p>
      </div>

      {/* Progress indicator */}
      <div className="space-y-2">
        <Progress value={progressPct} className="h-2" />
        <div className="flex justify-between">
          {STEPS.map((s, i) => (
            <div key={i} className={`flex items-center gap-1 text-xs ${step > i + 1 ? 'text-[#C8102E]' : step === i + 1 ? 'text-[#1A1A1A] font-medium' : 'text-[#6B7280]'}`}>
              <s.icon className="h-3 w-3" />
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>{STEPS[step - 1].label}</CardTitle>
          <CardDescription>
            {step === 1 ? 'Tell us about your business' : step === 2 ? 'Verify your identity with NID' : step === 3 ? 'Provide trade license and TIN details' : 'Set up your bank account for payments'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 1 && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!fullName || !companyName || !email || !phone || !password) { setError('Please fill all required fields'); return } setError(null); setStep(2) }}>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name (as on NID) *</Label>
                <Input id="fullName" placeholder="Your full legal name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company/Shop Name *</Label>
                <Input id="companyName" placeholder="Your company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dhaka">Dhaka</SelectItem>
                    <SelectItem value="chittagong">Chittagong</SelectItem>
                    <SelectItem value="sylhet">Sylhet</SelectItem>
                    <SelectItem value="rajshahi">Rajshahi</SelectItem>
                    <SelectItem value="khulna">Khulna</SelectItem>
                    <SelectItem value="barishal">Barishal</SelectItem>
                    <SelectItem value="rangpur">Rangpur</SelectItem>
                    <SelectItem value="mymensingh">Mymensingh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type</Label>
                <Select value={businessType} onValueChange={setBusinessType}>
                  <SelectTrigger><SelectValue placeholder="Select business type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manufacturer">Manufacturer</SelectItem>
                    <SelectItem value="wholesaler">Wholesaler</SelectItem>
                    <SelectItem value="trading">Trading Company</SelectItem>
                    <SelectItem value="factory">Factory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" type="tel" placeholder="+880 1700-000000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-[#C8102E] hover:bg-[#A50D25] text-white">
                Next: NID Upload <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          )}

          {step === 2 && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!nidNumber) { setError('Please enter NID number'); return } setError(null); setStep(3) }}>
              <div className="space-y-2">
                <Label htmlFor="nidNumber">NID Number *</Label>
                <Input id="nidNumber" placeholder="National ID number" value={nidNumber} onChange={(e) => setNidNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>NID Front Photo</Label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    id="nid-front"
                    onChange={handleFileSelect(setNidFrontFile, setNidFrontPreview)}
                  />
                  <label htmlFor="nid-front" className="block cursor-pointer">
                    {nidFrontPreview ? (
                      <div className="border rounded-lg overflow-hidden">
                        <img src={nidFrontPreview} alt="NID front" className="w-full h-32 object-cover" />
                        <div className="p-2 text-sm text-center text-[#6B7280]">Click to change</div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-[#C8102E]/50 transition-colors">
                        <Upload className="h-8 w-8 mx-auto text-[#6B7280] mb-2" />
                        <p className="text-sm text-[#6B7280]">Click or drag to upload NID front photo</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>NID Back Photo</Label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    id="nid-back"
                    onChange={handleFileSelect(setNidBackFile, setNidBackPreview)}
                  />
                  <label htmlFor="nid-back" className="block cursor-pointer">
                    {nidBackPreview ? (
                      <div className="border rounded-lg overflow-hidden">
                        <img src={nidBackPreview} alt="NID back" className="w-full h-32 object-cover" />
                        <div className="p-2 text-sm text-center text-[#6B7280]">Click to change</div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-[#C8102E]/50 transition-colors">
                        <Upload className="h-8 w-8 mx-auto text-[#6B7280] mb-2" />
                        <p className="text-sm text-[#6B7280]">Click or drag to upload NID back photo</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F8F9FA] text-sm">
                <Shield className="h-4 w-4 text-[#C8102E] shrink-0" />
                <span className="text-[#6B7280]">Your NID will be verified by our admin team before you can start selling.</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="w-1/3">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button type="submit" className="flex-1 bg-[#C8102E] hover:bg-[#A50D25] text-white">
                  Next: Trade License <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!tradeLicenseNumber || !tinNumber) { setError('Please fill required fields'); return } setError(null); setStep(4) }}>
              <div className="space-y-2">
                <Label htmlFor="tradeLicenseNumber">Trade License Number *</Label>
                <Input id="tradeLicenseNumber" placeholder="Trade license number" value={tradeLicenseNumber} onChange={(e) => setTradeLicenseNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Trade License Document</Label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    id="trade-license"
                    onChange={handleFileSelect(setTradeLicenseFile, setTradeLicensePreview)}
                  />
                  <label htmlFor="trade-license" className="block cursor-pointer">
                    {tradeLicensePreview ? (
                      <div className="border rounded-lg overflow-hidden">
                        <img src={tradeLicensePreview} alt="Trade license" className="w-full h-28 object-cover" />
                        <div className="p-2 text-sm text-center text-[#6B7280]">Click to change</div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-[#C8102E]/50 transition-colors">
                        <Upload className="h-8 w-8 mx-auto text-[#6B7280] mb-2" />
                        <p className="text-sm text-[#6B7280]">Upload trade license document (optional)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tinNumber">TIN Number *</Label>
                <Input id="tinNumber" placeholder="Tax Identification Number" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} required />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="w-1/3">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button type="submit" className="flex-1 bg-[#C8102E] hover:bg-[#A50D25] text-white">
                  Next: Bank Details <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {step === 4 && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleFinalSubmit() }}>
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name *</Label>
                <Input id="bankName" placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccountName">Account Holder Name *</Label>
                <Input id="bankAccountName" placeholder="Name on bank account" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccountNumber">Account Number *</Label>
                <Input id="bankAccountNumber" placeholder="Bank account number" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankBranch">Branch Name</Label>
                <Input id="bankBranch" placeholder="Branch name" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F8F9FA] text-sm">
                <Banknote className="h-4 w-4 text-[#C8102E] shrink-0" />
                <span className="text-[#6B7280]">Your bank details will be used for receiving payments from buyer orders.</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="w-1/3">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button type="submit" className="flex-1 bg-[#C8102E] hover:bg-[#A50D25] text-white" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Create Account & Submit'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          <Separator className="mt-4" />

          <div className="mt-4 text-center">
            <p className="text-sm text-[#6B7280]">
              Already have an account?{' '}
              <Button variant="link" size="sm" className="text-[#C8102E]" onClick={() => navigate('login')}>Log In</Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
