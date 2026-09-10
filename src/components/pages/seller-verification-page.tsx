'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, ShieldCheck, UploadCloud, FileText, CheckCircle2,
  Clock, AlertCircle, RefreshCw, ChevronRight, FileCheck, Award
} from 'lucide-react'

interface DocumentItem {
  id: string
  documentType: string
  fileName: string
  fileUrl: string | null
  status: 'pending' | 'under_review' | 'verified' | 'rejected'
  uploadedAt: string
  rejectionReason?: string | null
}

const DOC_TYPES = [
  { key: 'trade_license', label: 'Trade License (e-Trade License / City Corp)', required: true },
  { key: 'tin_certificate', label: 'TIN / Tax Identification Certificate', required: true },
  { key: 'nid_front', label: 'National ID / Passport (Proprietor / MD)', required: true },
  { key: 'bank_statement', label: 'Bank Solvency Statement / Cheque Leaf', required: true },
  { key: 'utility_bill', label: 'Factory / Warehouse Utility Bill', required: false }
]

export function SellerVerificationPage() {
  const { navigate } = useNavigationStore()

  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDocs() {
      try {
        setLoading(true)
        const res = await fetch('/api/supplier/verification')
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setDocs(data.data)
        }
      } catch (err) {
        console.error('Failed to load verification docs:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDocs()
  }, [])

  const verifiedCount = docs.filter(d => d.status === 'verified').length
  const totalRequired = DOC_TYPES.filter(d => d.required).length
  const progressPercent = Math.min(100, Math.round((verifiedCount / totalRequired) * 100))

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('seller-dashboard')}
            className="md:hidden p-2 -ml-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
              Seller Verification Hub
            </h1>
            <p className="text-xs text-neutral-400">KYC & Merchant Trade Verification</p>
          </div>
        </div>

        <Button
          onClick={() => navigate('seller-badge-levels')}
          variant="outline"
          size="sm"
          className="border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          <Award className="w-4 h-4 mr-1 text-amber-400" />
          Badge Perks
        </Button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Verification Progress Card */}
        <div className="bg-gradient-to-r from-sky-950/50 to-neutral-900 border border-sky-800/40 rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">KYC Compliance</span>
              <h2 className="text-lg sm:text-xl font-bold text-neutral-100">
                {progressPercent === 100 ? 'Fully Verified Merchant' : 'Verification in Progress'}
              </h2>
              <p className="text-xs text-neutral-400">
                {verifiedCount} of {totalRequired} mandatory credentials approved
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-neutral-950 border-2 border-sky-500/40 flex items-center justify-center font-bold text-sm text-sky-400 shadow-inner">
                {progressPercent}%
              </div>
              <Button
                onClick={() => navigate('seller-verification-upload')}
                className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs font-semibold px-4 h-9"
              >
                <UploadCloud className="w-4 h-4 mr-1.5" />
                Upload Docs
              </Button>
            </div>
          </div>
        </div>

        {/* Required Documents Checklist */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-neutral-300 uppercase tracking-wider">
            Verification Documents Checklist
          </h3>

          <div className="space-y-2.5">
            {DOC_TYPES.map(type => {
              const uploadedDoc = docs.find(d => d.documentType === type.key)
              const status = uploadedDoc?.status || 'pending'

              return (
                <Card
                  key={type.key}
                  className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors"
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-4 h-4 text-neutral-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-xs sm:text-sm text-neutral-200 truncate">
                            {type.label}
                          </p>
                          {type.required && (
                            <span className="text-[10px] text-red-400 font-bold">*Required</span>
                          )}
                        </div>
                        {uploadedDoc ? (
                          <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                            {uploadedDoc.fileName} • Uploaded {new Date(uploadedDoc.uploadedAt).toLocaleDateString()}
                          </p>
                        ) : (
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            Document not yet submitted
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {status === 'verified' ? (
                        <Badge className="bg-emerald-950/40 text-emerald-400 border-emerald-800/60 text-xs py-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified
                        </Badge>
                      ) : status === 'under_review' ? (
                        <Badge className="bg-amber-950/40 text-amber-300 border-amber-800/60 text-xs py-0.5 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Under Review
                        </Badge>
                      ) : status === 'rejected' ? (
                        <Badge className="bg-red-950/40 text-red-400 border-red-800/60 text-xs py-0.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Rejected
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => navigate('seller-verification-upload', { docType: type.key })}
                          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs h-7 px-2.5"
                        >
                          Upload
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Verification Status Tracking Link */}
        <div className="pt-2">
          <Button
            onClick={() => navigate('seller-verification-status')}
            variant="ghost"
            className="w-full justify-between bg-neutral-900/60 border border-neutral-800 hover:bg-neutral-900 text-neutral-300 text-xs sm:text-sm py-5"
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              View Full Compliance Review Timeline & Audit Logs
            </span>
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SellerVerificationPage
