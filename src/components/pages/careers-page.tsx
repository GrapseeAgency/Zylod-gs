'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Briefcase, MapPin, DollarSign, Clock,
  Sparkles, ChevronRight, Search, Heart, Award, Building2
} from 'lucide-react'

interface JobListing {
  id: string
  title: string
  slug: string
  department: string
  locationType: string
  location: string
  employmentType: string
  salaryMin?: number
  salaryMax?: number
  currency: string
  isFeatured: boolean
  applicationCount: number
}

export function CareersPage() {
  const { navigate, goBack } = useNavigationStore()
  const [jobs, setJobs] = useState<JobListing[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/careers')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setJobs(res.data.jobs)
          setDepartments(res.data.departments)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filteredJobs = selectedDept === 'all'
    ? jobs
    : jobs.filter(j => j.department === selectedDept)

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Careers at Zylod</h1>
          <p className="text-xs text-gray-400">{jobs.length} Open Positions in Dhaka & Remote</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-6 space-y-5 md:space-y-8 pb-24 md:pb-8 lg:max-w-5xl">
        {/* Hero */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 rounded-3xl p-6 md:p-8 text-white space-y-3">
          <Badge className="bg-white/20 text-white border-none text-xs">
            We are hiring!
          </Badge>
          <h2 className="text-xl md:text-2xl font-black leading-tight">
            Build the Future of South Asian B2B Wholesale Commerce
          </h2>
          <p className="text-xs text-teal-100 leading-relaxed">
            Join a fast-growing team of engineers, designers, and supply chain operators digitizing Bangladesh's $40B wholesale ecosystem.
          </p>
          <div className="flex gap-4 pt-1 border-t border-white/20">
            <div>
              <p className="text-sm font-black">{jobs.length}</p>
              <p className="text-[10px] text-teal-200">Openings</p>
            </div>
            <div>
              <p className="text-sm font-black">Hybrid</p>
              <p className="text-[10px] text-teal-200">Work Culture</p>
            </div>
            <div>
              <p className="text-sm font-black">Top Tier</p>
              <p className="text-[10px] text-teal-200">Compensation</p>
            </div>
          </div>
        </div>

        {/* Quick Nav Sub-pages */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Culture & Benefits</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Employee Benefits', id: 'career-benefits' },
              { label: 'Our Culture', id: 'career-culture' },
              { label: 'Internship Program', id: 'career-internships' },
              { label: 'Life at Zylod', id: 'career-life' },
            ].map(link => (
              <button
                key={link.id}
                onClick={() => navigate(link.id)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition"
              >
                {link.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Department Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedDept === 'all'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All Roles ({jobs.length})
          </button>
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedDept === dept
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* Job Listings */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-200 rounded-3xl" />)}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 text-center text-gray-400 border border-gray-100">
              No positions open in this department right now.
            </div>
          ) : (
            filteredJobs.map(job => (
              <div
                key={job.id}
                onClick={() => navigate('job-detail', { id: job.slug || job.id })}
                className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm hover:border-teal-300 hover:shadow-md transition cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 leading-snug">{job.title}</h3>
                    <p className="text-xs text-teal-700 font-semibold mt-0.5">{job.department}</p>
                  </div>
                  {job.isFeatured && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold">
                      Featured
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {job.employmentType.replace('_', ' ').toUpperCase()}
                  </span>
                  {job.salaryMin && (
                    <span className="flex items-center gap-1 font-bold text-emerald-700">
                      ৳{(job.salaryMin / 1000).toFixed(0)}k - {(job.salaryMax! / 1000).toFixed(0)}k / mo
                    </span>
                  )}
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-gray-50">
                  <span className="text-[10px] text-gray-400">{job.applicationCount} applicants</span>
                  <span className="text-xs font-bold text-teal-600 flex items-center gap-0.5">
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default CareersPage
