'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, XCircle, AlertTriangle, ShieldX } from 'lucide-react'

export function NonReturnablePage() {
  const { navigate, goBack } = useNavigationStore()

  const exclusions = [
    {
      title: 'Custom-Dyed & Bespoke Manufactured Batches',
      desc: 'Goods produced under custom RFQs with buyer-specific lab-dip approvals, custom embroidery, or specific brand tags cannot be returned unless verified laboratory defect exists.',
    },
    {
      title: 'Perishable Raw Materials & Chemical Solvents',
      desc: 'Textile chemicals, dying agents, and perishable organic supplies past delivery seal inspection.',
    },
    {
      title: 'Post-Inspection Modified or Cut Fabrics',
      desc: 'Fabric rolls or garments that have been washed, cut, stitched, printed, or otherwise processed by the buyer after delivery acceptance.',
    },
    {
      title: 'Claims Without Approval or Evidence',
      desc: 'Requests that are not approved through review, or that arrive without the documented evidence described above, cannot be processed as returns.',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Non-Returnable Items & Exceptions</h1>
          <p className="text-xs text-gray-400">Categories Exempt from Standard Return Guarantee</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto lg:max-w-4xl w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8">
        <div className="bg-red-600 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <ShieldX className="w-5 h-5" />
            <h2 className="font-bold text-sm">Strict Exclusions Policy</h2>
          </div>
          <p className="text-xs text-red-100 leading-relaxed">
            Due to customized industrial manufacturing specifications, certain wholesale categories are non-returnable once confirmed and delivered.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start">
          {exclusions.map((e, idx) => (
            <div key={e.title} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-1.5">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <h3 className="text-xs font-bold text-gray-900">{e.title}</h3>
              </div>
              <p className="text-xs text-gray-600 pl-6 leading-relaxed">{e.desc}</p>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('return-policy')} className="w-full bg-slate-900 text-white rounded-xl text-xs font-bold py-3">
          Back to Return Policy
        </Button>
      </div>
    </div>
  )
}

export default NonReturnablePage
