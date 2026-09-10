'use client'

import React, { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Lock, Globe, Link as LinkIcon, Search, X, Check } from 'lucide-react'
import { motion } from 'framer-motion'

export function CreateCollectionPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const isEditing = !!pageParams?.collectionId
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState('PRIVATE')
  const [coverColor, setCoverColor] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<any[]>([])
  
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(isEditing)

  const PRESET_COLORS = ['#C8102E', '#2563EB', '#16A34A', '#D97706', '#9333EA', '#4B5563', '#000000', '']

  useEffect(() => {
    if (isEditing) {
      const fetchCollection = async () => {
        try {
          const res = await fetch(`/api/collections/${pageParams.collectionId}`)
          const data = await res.json()
          if (data.success) {
            const col = data.data
            setName(col.name)
            setDescription(col.description || '')
            setPrivacy(col.privacy)
            setCoverColor(col.coverColor || '')
            setSelectedProducts(col.items.map((i: any) => i.product))
          }
        } catch (err) {
          console.error('Error fetching collection', err)
        } finally {
          setIsLoading(false)
        }
      }
      fetchCollection()
    }
  }, [isEditing, pageParams?.collectionId])

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      const payload = {
        name,
        description,
        privacy,
        coverColor,
        productIds: selectedProducts.map(p => p.id)
      }
      
      const url = isEditing ? `/api/collections/${pageParams.collectionId}` : '/api/collections'
      const method = isEditing ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.success) {
        navigate('collection-detail', { collectionId: data.data.id || pageParams.collectionId })
      }
    } catch (err) {
      console.error('Save error', err)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full active:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Edit Collection' : 'New Collection'}
          </h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={!name.trim() || isSaving}
          className="text-[#C8102E] font-medium disabled:opacity-50 px-2 py-1"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-6 md:space-y-8 w-full md:max-w-3xl md:mx-auto">
        
        {/* Basic Info */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <label className="font-medium text-gray-700">Collection Name <span className="text-[#C8102E]">*</span></label>
              <span className="text-gray-400">{name.length}/50</span>
            </div>
            <input 
              type="text" 
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Inventory 2025"
              className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8102E] focus:border-[#C8102E] outline-none text-gray-900"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <label className="font-medium text-gray-700">Description</label>
              <span className="text-gray-400">{description.length}/200</span>
            </div>
            <textarea 
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add an optional description"
              rows={3}
              className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8102E] focus:border-[#C8102E] outline-none text-gray-900 resize-none"
            />
          </div>
        </div>

        {/* Privacy */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
          <label className="font-medium text-gray-700 text-sm">Privacy</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'PRIVATE', icon: Lock, label: 'Private' },
              { id: 'SHARED', icon: LinkIcon, label: 'Shared' },
              { id: 'PUBLIC', icon: Globe, label: 'Public' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setPrivacy(opt.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  privacy === opt.id 
                    ? 'border-[#C8102E] bg-red-50 text-[#C8102E]' 
                    : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                }`}
              >
                <opt.icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cover Color */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
          <label className="font-medium text-gray-700 text-sm flex items-center justify-between">
            Cover Color
            <span className="text-xs text-gray-400 font-normal">Optional</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {PRESET_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => setCoverColor(c)}
                className="w-10 h-10 rounded-full border-2 flex items-center justify-center relative overflow-hidden"
                style={{ 
                  backgroundColor: c || '#f3f4f6', 
                  borderColor: coverColor === c ? (c ? c : '#d1d5db') : 'transparent' 
                }}
              >
                {!c && <div className="absolute w-[120%] h-0.5 bg-gray-300 rotate-45"></div>}
                {coverColor === c && c && <Check className="w-5 h-5 text-white" />}
                {coverColor === c && !c && <Check className="w-5 h-5 text-gray-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Add Products */}
        {!isEditing && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <label className="font-medium text-gray-700 text-sm">Initial Products</label>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wishlist to add..."
                className="w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8102E] focus:border-[#C8102E] outline-none text-sm"
              />
            </div>
            
            {/* Selected Chips */}
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedProducts.map(p => (
                  <div key={p.id} className="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                    <span className="truncate max-w-[100px]">{p.name}</span>
                    <button onClick={() => setSelectedProducts(selectedProducts.filter(x => x.id !== p.id))}>
                      <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 p-4 bg-white border-t z-20 md:static md:bg-transparent md:border-0 md:p-0 md:flex md:justify-end">
        <button
          onClick={handleSave}
          disabled={!name.trim() || isSaving}
          className="w-full md:w-auto md:px-10 bg-[#C8102E] text-white py-3.5 rounded-xl font-bold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {isSaving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Collection')}
        </button>
      </div>
    </div>
  )
}

export default CreateCollectionPage
