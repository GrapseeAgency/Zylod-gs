'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Linkedin, Mail } from 'lucide-react'

export function LeadershipTeamPage() {
  const { navigate, goBack } = useNavigationStore()

  const leaders = [
    {
      name: 'Arafat Rahman',
      role: 'Founder & Chief Executive Officer',
      bio: 'Former supply chain tech lead with 10+ years engineering high-scale fintech and B2B logistics infrastructure across South Asia.',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Tanvir Hossain',
      role: 'Co-Founder & Chief Technology Officer',
      bio: 'Distributed systems architect specialized in high-concurrency order engines, transaction ledgers, and real-time video streaming.',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Nusrat Jahan',
      role: 'Head of Factory Acquisition & RMG Merchandising',
      bio: '12+ years heading direct apparel sourcing across Narayanganj, Gazipur, and Chittagong export processing zones (EPZ).',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Siam Chowdhury',
      role: 'Head of Logistics & Freight Operations',
      bio: 'Oversees 64-district freight distribution, courier API integration, and warehouse hub dispatch operations.',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Leadership Team</h1>
          <p className="text-xs text-gray-400">Founders & Department Heads</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto lg:max-w-5xl w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {leaders.map(l => (
            <div key={l.name} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm flex items-start gap-4">
              <img
                src={l.image}
                alt={l.name}
                className="w-16 h-16 rounded-2xl object-cover border border-gray-100 flex-shrink-0"
              />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-900">{l.name}</h3>
                <p className="text-xs text-blue-600 font-semibold">{l.role}</p>
                <p className="text-[11px] text-gray-500 leading-relaxed pt-0.5">{l.bio}</p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('about-us')} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold py-3 px-6">
          Back to About Us
        </Button>
      </div>
    </div>
  )
}

export default LeadershipTeamPage
