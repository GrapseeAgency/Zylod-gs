'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Building2, Factory, Users, Globe2, Award,
  ShieldCheck, Save, Check, Plus, Trash2, Camera
} from 'lucide-react'

interface CompanyStoryData {
  companyName: string
  foundedYear: string
  factorySizeSqFt: string
  workforceCount: string
  productionCapacityMonthly: string
  mainExportMarkets: string[]
  certifications: string[]
  aboutBio: string
  factoryPhotos: string[]
  machineryList: string[]
}

export function StoreStoryAboutPage() {
  const { navigate } = useNavigationStore()

  const [formData, setFormData] = useState<CompanyStoryData>({
    companyName: '',
    foundedYear: '',
    factorySizeSqFt: '',
    workforceCount: '',
    productionCapacityMonthly: '',
    mainExportMarkets: [],
    certifications: [],
    aboutBio: '',
    factoryPhotos: [],
    machineryList: []
  })

  const [newMarket, setNewMarket] = useState('')
  const [newCert, setNewCert] = useState('')
  const [newMachine, setNewMachine] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    async function loadStory() {
      try {
        setLoading(true)
        const res = await fetch('/api/supplier/storefront')
        const data = await res.json()
        if (data.success && data.data) {
          const supplier = data.data
          let customSections: any = {}
          try {
            if (supplier.customSections) {
              customSections = typeof supplier.customSections === 'string' 
                ? JSON.parse(supplier.customSections) 
                : supplier.customSections
            }
          } catch {}

          setFormData({
            companyName: supplier.companyName || '',
            foundedYear: customSections.foundedYear || '2015',
            factorySizeSqFt: customSections.factorySizeSqFt || '45,000',
            workforceCount: customSections.workforceCount || '250+',
            productionCapacityMonthly: customSections.productionCapacityMonthly || '50,000 units/mo',
            mainExportMarkets: Array.isArray(customSections.mainExportMarkets) ? customSections.mainExportMarkets : ['North America', 'European Union', 'Middle East', 'South Asia'],
            certifications: Array.isArray(customSections.certifications) ? customSections.certifications : ['ISO 9001:2015', 'CE Compliant', 'RoHS Certified', 'BSCI Audited'],
            aboutBio: customSections.aboutBio || supplier.bio || 'Leading wholesale manufacturer and verified supplier specialized in high-volume industrial export quality production.',
            factoryPhotos: Array.isArray(customSections.factoryPhotos) ? customSections.factoryPhotos : [],
            machineryList: Array.isArray(customSections.machineryList) ? customSections.machineryList : ['CNC Milling Stations (12 units)', 'Automated SMT Assembly Lines', 'Laser Cutting & Engraving', 'Automated QA Testing Rigs']
          })
        }
      } catch (err) {
        console.error('Failed to load story:', err)
      } finally {
        setLoading(false)
      }
    }
    loadStory()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/supplier/storefront', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customSections: JSON.stringify({
            foundedYear: formData.foundedYear,
            factorySizeSqFt: formData.factorySizeSqFt,
            workforceCount: formData.workforceCount,
            productionCapacityMonthly: formData.productionCapacityMonthly,
            mainExportMarkets: formData.mainExportMarkets,
            certifications: formData.certifications,
            aboutBio: formData.aboutBio,
            factoryPhotos: formData.factoryPhotos,
            machineryList: formData.machineryList
          })
        })
      })
      if (res.ok) {
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Failed to save company story:', err)
    } finally {
      setSaving(false)
    }
  }

  const addMarket = () => {
    if (!newMarket.trim()) return
    setFormData(prev => ({
      ...prev,
      mainExportMarkets: [...prev.mainExportMarkets, newMarket.trim()]
    }))
    setNewMarket('')
  }

  const removeMarket = (index: number) => {
    setFormData(prev => ({
      ...prev,
      mainExportMarkets: prev.mainExportMarkets.filter((_, i) => i !== index)
    }))
  }

  const addCert = () => {
    if (!newCert.trim()) return
    setFormData(prev => ({
      ...prev,
      certifications: [...prev.certifications, newCert.trim()]
    }))
    setNewCert('')
  }

  const removeCert = (index: number) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }))
  }

  const addMachine = () => {
    if (!newMachine.trim()) return
    setFormData(prev => ({
      ...prev,
      machineryList: [...prev.machineryList, newMachine.trim()]
    }))
    setNewMachine('')
  }

  const removeMachine = (index: number) => {
    setFormData(prev => ({
      ...prev,
      machineryList: prev.machineryList.filter((_, i) => i !== index)
    }))
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20 md:pb-8">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('store-customization')}
            className="md:hidden p-2 -ml-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#C8102E]" />
              Company Story & Factory Profile
            </h1>
            <p className="text-xs text-neutral-400">Establish trust with verified overseas wholesale buyers</p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs sm:text-sm font-semibold h-9 px-4 flex items-center gap-1.5 shadow-lg shadow-red-950/40"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Profile
            </>
          )}
        </Button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Core Overview Card */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <Factory className="w-4 h-4 text-[#C8102E]" />
              Factory Specifications & Capacity
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-400 font-medium mb-1 block">Year Established</label>
                <Input
                  value={formData.foundedYear}
                  onChange={e => setFormData(prev => ({ ...prev, foundedYear: e.target.value }))}
                  placeholder="e.g. 2012"
                  className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-medium mb-1 block">Factory Area (Sq. Ft.)</label>
                <Input
                  value={formData.factorySizeSqFt}
                  onChange={e => setFormData(prev => ({ ...prev, factorySizeSqFt: e.target.value }))}
                  placeholder="e.g. 50,000 Sq. Ft."
                  className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-medium mb-1 block">Total Workforce</label>
                <Input
                  value={formData.workforceCount}
                  onChange={e => setFormData(prev => ({ ...prev, workforceCount: e.target.value }))}
                  placeholder="e.g. 300+ employees"
                  className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-medium mb-1 block">Monthly Production Volume</label>
                <Input
                  value={formData.productionCapacityMonthly}
                  onChange={e => setFormData(prev => ({ ...prev, productionCapacityMonthly: e.target.value }))}
                  placeholder="e.g. 100,000 units / month"
                  className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-400 font-medium mb-1 block">Company Introduction & Heritage</label>
              <Textarea
                rows={4}
                value={formData.aboutBio}
                onChange={e => setFormData(prev => ({ ...prev, aboutBio: e.target.value }))}
                placeholder="Describe your manufacturing heritage, specialized OEM/ODM capabilities, and quality assurance process..."
                className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Global Export Markets */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-emerald-400" />
              Primary Export Markets
            </h2>

            <div className="flex gap-2">
              <Input
                value={newMarket}
                onChange={e => setNewMarket(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMarket())}
                placeholder="Add export destination (e.g. Australia, Japan)..."
                className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
              />
              <Button onClick={addMarket} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {formData.mainExportMarkets.map((market, idx) => (
                <Badge
                  key={idx}
                  className="bg-neutral-800 text-neutral-200 border border-neutral-700 pl-3 pr-1.5 py-1 flex items-center gap-1.5"
                >
                  {market}
                  <button onClick={() => removeMarket(idx)} className="hover:text-red-400 p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Certifications & Quality Accreditations */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Industrial Certifications & Compliance
            </h2>

            <div className="flex gap-2">
              <Input
                value={newCert}
                onChange={e => setNewCert(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCert())}
                placeholder="Add accreditation (e.g. ISO 14001, FDA Registered)..."
                className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
              />
              <Button onClick={addCert} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {formData.certifications.map((cert, idx) => (
                <Badge
                  key={idx}
                  className="bg-amber-950/30 text-amber-300 border border-amber-800/50 pl-3 pr-1.5 py-1 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  {cert}
                  <button onClick={() => removeCert(idx)} className="hover:text-red-400 p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Key Machinery & Tech Equipment */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <Factory className="w-4 h-4 text-sky-400" />
              Key Production Machinery & Equipment
            </h2>

            <div className="flex gap-2">
              <Input
                value={newMachine}
                onChange={e => setNewMachine(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMachine())}
                placeholder="e.g. 5-Axis Automated CNC Lathes (8 Units)..."
                className="bg-neutral-950 border-neutral-800 text-sm focus-visible:ring-[#C8102E]"
              />
              <Button onClick={addMachine} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            <div className="space-y-2 pt-1">
              {formData.machineryList.map((machine, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-neutral-300"
                >
                  <span>{machine}</span>
                  <button onClick={() => removeMachine(idx)} className="text-neutral-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default StoreStoryAboutPage
