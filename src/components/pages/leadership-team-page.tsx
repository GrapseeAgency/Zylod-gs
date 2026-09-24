'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Users, Mail, Briefcase } from 'lucide-react'

export function LeadershipTeamPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Leadership Team</h1>
          <p className="text-xs text-gray-400">About Zylod</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto lg:max-w-5xl w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
        {/* Honest empty-roster notice — Zylod publishes no fabricated people */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-blue-50 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-blue-600" />
          </div>
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold uppercase">
            Not Published Yet
          </Badge>
          <h2 className="text-base font-bold text-gray-900">No named team members published yet</h2>
          <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
            Zylod has not published its leadership or team roster. When we do, every person listed
            here will be a real member of the company with their actual role — no placeholder
            profiles. Open roles will be posted on the careers page as they become available.
          </p>
        </div>

        {/* Contact + Careers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-blue-600">
              <Briefcase className="w-5 h-5" />
              <h3 className="text-sm font-bold text-gray-900">Work With Us</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Roles will be posted on the careers page as they open.
            </p>
            <Button onClick={() => navigate('careers-page')} variant="outline" className="w-full rounded-xl text-xs font-bold py-2.5">
              View Careers Page
            </Button>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-emerald-600">
              <Mail className="w-5 h-5" />
              <h3 className="text-sm font-bold text-gray-900">Contact</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Questions for the team? Reach us by email.
            </p>
            <a
              href="mailto:support@zylod.com"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold py-2.5 transition"
            >
              support@zylod.com
            </a>
          </div>
        </div>

        <Button onClick={() => navigate('about-us')} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold py-3 px-6">
          Back to About Us
        </Button>
      </div>
    </div>
  )
}

export default LeadershipTeamPage
