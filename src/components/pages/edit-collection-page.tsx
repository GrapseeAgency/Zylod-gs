'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, GripVertical, Plus, Search, Trash2, X } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

interface CollectionItem {
  id: string
  productId: string
  name: string
  image: string
  price: number
}

interface Collection {
  id: string
  name: string
  description: string
  isPublic: boolean
  items: CollectionItem[]
}

export function EditCollectionPage() {
  const { pageParams, goBack } = useNavigationStore()
  const collectionId = pageParams?.collectionId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [collection, setCollection] = useState<Collection | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!collectionId) {
      setError('Collection ID is missing')
      setLoading(false)
      return
    }

    const fetchCollection = async () => {
      try {
        const res = await fetch(`/api/collections/${collectionId}`)
        if (!res.ok) throw new Error('Failed to load collection')
        const json = await res.json()
        if (json.success) {
          setCollection(json.data)
        } else {
          throw new Error(json.error || 'Failed to load collection')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCollection()
  }, [collectionId])

  const handleSave = async () => {
    if (!collection) return
    setSaving(true)
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: collection.name,
          description: collection.description,
          isPublic: collection.isPublic,
          itemIds: collection.items.map(i => i.id)
        })
      })
      if (!res.ok) throw new Error('Failed to save collection')
      goBack()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this collection?')) return
    try {
      const res = await fetch(`/api/collections/${collectionId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      goBack()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const removeItem = (id: string) => {
    if (collection) {
      setCollection({
        ...collection,
        items: collection.items.filter(i => i.id !== id)
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white h-14 border-b flex items-center px-4">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-32 h-6 ml-4 rounded" />
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="w-full h-12 rounded-xl" />
          <Skeleton className="w-full h-24 rounded-xl" />
          <Skeleton className="w-full h-12 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-red-500">{error || 'Collection not found'}</p>
        <Button onClick={() => goBack()} className="ml-4">Go Back</Button>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="min-h-screen bg-gray-50 flex flex-col pb-6"
    >
      <header className="bg-white h-14 border-b flex items-center justify-between px-4 sticky top-0 z-20 md:hidden">
        <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-semibold">Edit Collection</h1>
        <Button 
          onClick={handleSave} 
          disabled={saving || !collection.name} 
          size="sm" 
          className="bg-primary text-white rounded-full h-8 px-4 font-medium"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </header>

      <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 md:space-y-8 max-w-3xl mx-auto w-full lg:max-w-4xl">
        {/* Desktop Page Header */}
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Edit Collection</h1>
          <Button
            onClick={handleSave}
            disabled={saving || !collection.name}
            size="sm"
            className="bg-primary text-white rounded-full h-9 px-6 font-medium"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Collection Name</label>
            <Input 
              value={collection.name}
              onChange={(e) => setCollection({...collection, name: e.target.value})}
              placeholder="E.g., Summer Catalog 2024"
              className="bg-gray-50 border-gray-200"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Description (Optional)</label>
            <Textarea 
              value={collection.description}
              onChange={(e) => setCollection({...collection, description: e.target.value})}
              placeholder="What is this collection about?"
              className="bg-gray-50 border-gray-200 resize-none h-20"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Make Public</p>
              <p className="text-xs text-gray-500">Anyone with the link can view</p>
            </div>
            <Switch 
              checked={collection.isPublic}
              onCheckedChange={(c) => setCollection({...collection, isPublic: c})}
            />
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Products ({collection.items.length})</h2>
            <button className="text-primary text-sm font-medium flex items-center">
              <Plus className="w-4 h-4 mr-1" /> Add More
            </button>
          </div>
          
          <div className="space-y-3">
            {collection.items.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
                <div className="w-12 h-12 bg-white rounded border flex-shrink-0 overflow-hidden">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">${item.price.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {collection.items.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No products in this collection.</p>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <h2 className="text-base font-semibold text-red-600 mb-2">Danger Zone</h2>
          <p className="text-sm text-red-600/80 mb-4">Deleting a collection cannot be undone.</p>
          <Button 
            onClick={handleDelete}
            variant="destructive" 
            className="w-full md:w-auto md:px-6 bg-red-600 hover:bg-red-700 text-white rounded-full h-10 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete Collection
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

export default EditCollectionPage
