'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Briefcase, MapPin, Clock, DollarSign,
  CheckCircle2, Send, Share2, Users, Building2
} from 'lucide-react'

export function JobDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const jobId = pageParams?.id || pageParams?.slug || 'senior-backend-engineer-distributed-systems'
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/careers/${jobId}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) setJob(res.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [jobId])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-base">Job Opening</h1>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24 md:px-6 md:py-6 md:pb-8 md:space-y-6 lg:max-w-4xl">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-3xl" />)}
          </div>
        ) : !job ? (
          <div className="bg-white rounded-3xl p-6 text-center text-gray-400 border border-gray-100">
            Job opening not found or has expired.
          </div>
        ) : (
          <>
            {/* Header Card */}
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm space-y-3">
              <div className="space-y-1">
                <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-bold">
                  {job.department}
                </Badge>
                <h2 className="text-base md:text-xl font-black text-gray-900 leading-snug">{job.title}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-gray-500 pt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  {job.employmentType?.replace('_', ' ').toUpperCase()}
                </span>
                {job.salaryMin && (
                  <span className="font-bold text-emerald-700">
                    ৳{(job.salaryMin / 1000).toFixed(0)}k - {(job.salaryMax / 1000).toFixed(0)}k / month
                  </span>
                )}
              </div>
            </div>

            {/* Role Overview */}
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm space-y-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Role Overview</h3>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.descriptionEn}</p>
            </div>

            {/* Requirements */}
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm space-y-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Requirements & Skills</h3>
              <div className="text-xs md:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.requirementsEn}</div>
            </div>

            {/* Benefits */}
            {job.benefitsEn && (
              <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Perks & Compensation</h3>
                <div className="text-xs md:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.benefitsEn}</div>
              </div>
            )}

            {/* Apply Button */}
            <Button
              onClick={() => navigate('job-apply', { jobId: job.id, jobTitle: job.title })}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold py-3.5 shadow-lg shadow-teal-600/20"
            >
              <Send className="w-4 h-4 mr-2" />
              Apply for this Position
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default JobDetailPage
