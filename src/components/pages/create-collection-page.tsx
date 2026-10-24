'use client'
import React, { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Lock, Globe, Link as LinkIcon, Search, X, Check, Package, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface WishRow {
  id: string
  product: { id: string; name: string; basePrice: number; unit: string; thumbnailUrl?: string | null }
}

export function CreateCollectionPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const isEditing = !!pageParams?.collectionId

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState('PRIVATE')
  const [coverColor, setCoverColor] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<any[]>([])
  // Task 97: the wishlist picker is REAL — the old search box rendered an
  // input that did nothing. It now reads the buyer's actual wishlist.
  const [wishlist, setWishlist] = useState<WishRow[]>([])
  const [wishlistLoaded, setWishlistLoaded] = useState(false)
  const [wishlistError, setWishlistError] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(isEditing)
  const [serverError, setServerError] = useState('')

  const PRESET_COLORS = ['#C8102E', '#2563EB', '#16A34A', '#D97706', '#9333EA', '#4B5563', '#000000', '']

  useEffect(() => {
    // Task 97: load the REAL wishlist for the picker (both create and edit
    // modes — editing a collection is where "Add More" lives).
    const loadWishlist = async () => {
      try {
        const res = await fetch('/api/wishlist?limit=50')
        const json = await res.json().catch(() => null)
        if (res.ok && json?.success) {
          setWishlist(json.data ?? [])
          setWishlistLoaded(true)
        } else {
          setWishlistError(json?.error || 'Could not load your wishlist')
        }
      } catch {
        setWishlistError('Could not reach the wishlist service')
      }
    }
    loadWishlist()
  }, [])

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

  const selectedIds = new Set(selectedProducts.map((p) => p.id))
  const query = searchQuery.trim().toLowerCase()
  const wishlistResults = query
    ? wishlist.filter((w) => w.product?.name?.toLowerCase().includes(query))
    : wishlist

  const toggleProduct = (p: { id: string; name: string }) => {
    setSelectedProducts((prev) =>
      prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    setServerError('')
    try {
      const payload = {
        name,
        description,
        privacy,
        coverColor,
        // Task 97: PATCH accepts the full desired item set — removals and
        // additions made in this editor persist in one call.
        productIds: selectedProducts.map(p => p.id)
      }

      const url = isEditing ? `/api/collections/${pageParams.collectionId}` : '/api/collections'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        navigate('collection-detail', { collectionId: data.data.id || pageParams.collectionId })
      } else {
        // Real server errors surfaced verbatim (name required, product no
        // longer available, rate limit, auth).
        setServerError(data?.error || `Could not save the collection (HTTP ${res.status})`)
      }
    } catch (err) {
      setServerError('Could not reach the collections service')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full active:bg-gray-100" aria-label="Go back">
            <ArrowLeft className="w-5 h-5 text-gray-800 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
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
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <label className="font-medium text-gray-700 dark:text-gray-300">Collection Name <span className="text-[#C8102E]">*</span></label>
              <span className="text-gray-400 dark:text-gray-500">{name.length}/50</span>
            </div>
            <input 
              type="text" 
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Inventory 2025"
              className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8102E] focus:border-[#C8102E] outline-none text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <label className="font-medium text-gray-700 dark:text-gray-300">Description</label>
              <span className="text-gray-400 dark:text-gray-500">{description.length}/200</span>
            </div>
            <textarea 
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add an optional description"
              rows={3}
              className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8102E] focus:border-[#C8102E] outline-none text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>
        </div>

        {/* Privacy */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-3">
          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm">Privacy</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'PRIVATE', icon: Lock, label: 'Private' },
              { id: 'SHARED', icon: LinkIcon, label: 'Shared' },
              { id: 'PUBLIC', icon: Globe, label: 'Public' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPrivacy(opt.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  privacy === opt.id 
                    ? 'border-[#C8102E] bg-red-50 text-[#C8102E]' 
                    : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-200'
                }`}
              >
                <opt.icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
          {privacy === 'SHARED' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              A secret link is minted for this collection — anyone holding it can view. Flip back to Private and the link stops working.
            </p>
          )}
        </div>

        {/* Cover Color */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-3">
          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm flex items-center justify-between">
            Cover Color
            <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">Optional</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {PRESET_COLORS.map((c, i) => (
              <button
                key={i}
                type="button"
                aria-label={c ? `Cover color ${c}` : 'No cover color'}
                onClick={() => setCoverColor(c)}
                className="w-10 h-10 rounded-full border-2 flex items-center justify-center relative overflow-hidden"
                style={{ 
                  backgroundColor: c || '#f3f4f6', 
                  borderColor: coverColor === c ? (c ? c : '#d1d5db') : 'transparent' 
                }}
              >
                {!c && <div className="absolute w-[120%] h-0.5 bg-gray-300 rotate-45"></div>}
                {coverColor === c && c && <Check className="w-5 h-5 text-white" />}
                {coverColor === c && !c && <Check className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* Add Products — the REAL wishlist picker */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm">Products from your wishlist</label>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your wishlist to add..."
              className="w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#C8102E] focus:border-[#C8102E] outline-none text-sm"
            />
          </div>

          {wishlistError ? (
            <p className="text-xs text-red-500">{wishlistError}</p>
          ) : !wishlistLoaded ? (
            <div className="flex items-center justify-center py-4 text-gray-400 dark:text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-xs">Loading your wishlist…</span>
            </div>
          ) : wishlistResults.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
              {query ? `Nothing in your wishlist matches "${searchQuery}".` : 'Your wishlist is empty — save products from product pages first.'}
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
              {wishlistResults.map((w) => {
                const picked = selectedIds.has(w.product.id)
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleProduct(w.product)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${picked ? 'bg-red-50' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  >
                    <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-900 overflow-hidden flex-shrink-0">
                      {w.product.thumbnailUrl ? (
                        <img src={w.product.thumbnailUrl} alt={w.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-4 h-4" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{w.product.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">৳{w.product.basePrice} / {w.product.unit}</p>
                    </div>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${picked ? 'bg-[#C8102E] border-[#C8102E] text-white' : 'border-gray-300 text-transparent'}`} aria-hidden="true">
                      <Check className="w-4 h-4" />
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Selected Chips */}
          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedProducts.map(p => (
                <div key={p.id} className="bg-gray-100 dark:bg-gray-900 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                  <span className="truncate max-w-[100px]">{p.name}</span>
                  <button onClick={() => setSelectedProducts(selectedProducts.filter(x => x.id !== p.id))} aria-label={`Remove ${p.name}`}>
                    <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">{serverError}</p>
        )}

      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t z-20 md:static md:bg-transparent md:border-0 md:p-0 md:flex md:justify-end">
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
