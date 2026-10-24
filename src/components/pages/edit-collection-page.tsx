'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, GripVertical, Plus, Search, Trash2, X, Lock, Globe, Link as LinkIcon } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

interface CollectionItem {
  id: string
  productId: string
  product: {
    id: string
    name: string
    basePrice: number
    currency: string
    unit: string
    thumbnailUrl?: string | null
  }
}

interface Collection {
  id: string
  name: string
  description: string
  privacy: 'PRIVATE' | 'PUBLIC' | 'SHARED'
  coverColor?: string | null
  items: CollectionItem[]
}

const PRIVACY_OPTIONS = [
  { id: 'PRIVATE', icon: Lock, label: 'Private' },
  { id: 'SHARED', icon: LinkIcon, label: 'Shared' },
  { id: 'PUBLIC', icon: Globe, label: 'Public' },
] as const

export function EditCollectionPage() {
  const { pageParams, goBack, navigate } = useNavigationStore()
  const collectionId = pageParams?.collectionId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [collection, setCollection] = useState<Collection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!collectionId) {
      setError('Collection ID is missing')
      setLoading(false)
      return
    }

    const fetchCollection = async () => {
      try {
        const res = await fetch(`/api/collections/${collectionId}`)
        const json = await res.json().catch(() => null)
        if (res.ok && json?.success) {
          setCollection({
            id: json.data.id,
            name: json.data.name,
            description: json.data.description || '',
            privacy: json.data.privacy,
            coverColor: json.data.coverColor,
            items: json.data.items,
          })
        } else {
          throw new Error(json?.error || 'Failed to load collection')
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
    setSaveError(null)
    try {
      // Task 97: PATCH takes the FULL desired item set, so a removal here
      // persists in the same call that saves the fields (the old editor sent
      // an itemIds field the server never read — removals silently died on
      // refresh).
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: collection.name,
          description: collection.description,
          privacy: collection.privacy,
          productIds: collection.items.map(i => i.product.id),
        })
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        goBack()
      } else {
        setSaveError(json?.error || `Could not save the collection (HTTP ${res.status})`)
      }
    } catch (err: any) {
      setSaveError('Could not reach the collections service')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this collection?')) return
    try {
      const res = await fetch(`/api/collections/${collectionId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        goBack()
      } else {
        setSaveError(json?.error || 'Failed to delete')
      }
    } catch (err: any) {
      setSaveError('Could not reach the collections service')
    }
  }

  const removeItem = (productId: string) => {
    if (collection) {
      setCollection({
        ...collection,
        items: collection.items.filter(i => i.product.id !== productId)
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <header className="md:hidden bg-white dark:bg-gray-900 h-14 border-b flex items-center px-4">
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
      className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col pb-6"
    >
      <header className="bg-white dark:bg-gray-900 h-14 border-b flex items-center justify-between px-4 sticky top-0 z-20 md:hidden">
        <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800" aria-label="Go back">
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
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
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100">Edit Collection</h1>
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
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Collection Name</label>
            <Input 
              value={collection.name}
              onChange={(e) => setCollection({...collection, name: e.target.value})}
              placeholder="E.g., Summer Catalog 2024"
              className="bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description (Optional)</label>
            <Textarea 
              value={collection.description}
              onChange={(e) => setCollection({...collection, description: e.target.value})}
              placeholder="What is this collection about?"
              className="bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800 resize-none h-20"
            />
          </div>

          {/* Task 97: the real three-state privacy model — the old isPublic
              switch wrote a field the server never accepted. */}
          <div className="pt-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Privacy</label>
            <div className="grid grid-cols-3 gap-2">
              {PRIVACY_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCollection({ ...collection, privacy: opt.id })}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border-2 transition-all ${
                    collection.privacy === opt.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-200'
                  }`}
                >
                  <opt.icon className="w-4 h-4 mb-1" />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            {collection.privacy === 'SHARED' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-2">
                A secret link lets anyone holding it view this collection. Flip back to Private and old links stop working.
              </p>
            )}
          </div>
        </div>

        {/* Products */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Products ({collection.items.length})</h2>
            <button 
              onClick={() => navigate('create-collection', { collectionId: collection.id })}
              className="text-primary text-sm font-medium flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" /> Add More
            </button>
          </div>
          
          <div className="space-y-3">
            {collection.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-950 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                <GripVertical className="w-5 h-5 text-gray-400 dark:text-gray-500 dark:text-gray-400 cursor-grab" aria-hidden="true" />
                <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded border flex-shrink-0 overflow-hidden">
                  {item.product?.thumbnailUrl ? (
                    <img src={item.product.thumbnailUrl} alt={item.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.product?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">৳{item.product?.basePrice} / {item.product?.unit}</p>
                </div>
                <button 
                  onClick={() => removeItem(item.product.id)}
                  aria-label={`Remove ${item.product?.name} — saved on Save`}
                  className="p-2 text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {collection.items.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-4">No products in this collection.</p>
            )}
          </div>
        </div>

        {saveError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">{saveError}</p>
        )}

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
