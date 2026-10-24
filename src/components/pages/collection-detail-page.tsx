'use client'

import React, { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCartStore } from '@/store/cart-store'
import { toast } from 'sonner'
import { ArrowLeft, MoreVertical, Lock, Globe, Link as LinkIcon, Share2, Grid, List, CheckSquare, Plus, Package, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'

export function CollectionDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { collectionId } = pageParams || {}
  const addItem = useCartStore((s) => s.addItem)
  
  const [collection, setCollection] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!collectionId) {
      goBack()
      return
    }
    const fetchCollection = async () => {
      try {
        const res = await fetch(`/api/collections/${collectionId}`)
        const data = await res.json().catch(() => null)
        if (res.ok && data?.success) {
          setCollection(data.data)
        } else if (res.status === 404) {
          // Foreign or deleted — same honest outcome.
          toast.error('Collection not found')
          goBack()
        }
      } catch (err) {
        console.error('Error fetching collection details', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCollection()
  }, [collectionId, goBack])

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode)
    setSelectedItems([])
  }

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Task 97: the share link is REAL — the owner GET carries the minted
  // shareToken while the collection is SHARED.
  const copyShareLink = async () => {
    if (!collection?.shareToken) {
      toast.error('No share link yet — set the collection to Shared first')
      return
    }
    const url = `${window.location.origin}/?page=collection-shared&token=${collection.shareToken}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Share link copied — anyone holding it can view')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — your browser blocked clipboard access')
    }
  }

  // Task 97: add-to-cart buttons run the REAL cart store (same canonical
  // pricing rule as the PDP — the collection page invents no prices).
  const addLineToCart = (prod: any) => {
    const qty = prod.moq || 1
    addItem({
      id: `cart-${prod.id}-default-${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      productSlug: prod.slug || '',
      productImage: prod.thumbnailUrl || null,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity: qty,
      unitPrice: prod.basePrice,
      totalPrice: prod.basePrice * qty,
      moq: prod.moq || 1,
      maxOrderQty: prod.maxOrderQty ?? null,
      supplierId: prod.supplier?.id,
      supplierName: prod.supplier?.companyName || '',
      supplierSlug: '',
      unit: prod.unit,
      bundleSize: prod.bundleSize ?? null,
      weightKg: prod.weightKg ?? null,
      priceTiers: [],
    })
    toast.success(`Added ${qty} ${prod.unit} to cart`)
  }

  // Task 97: batch remove hits the real per-item rail, then refetches.
  const removeSelected = async () => {
    if (!collectionId || selectedItems.length === 0) return
    setRemoving(true)
    let failed = 0
    for (const productId of selectedItems) {
      try {
        const res = await fetch(`/api/collections/${collectionId}/items?productId=${encodeURIComponent(productId)}`, { method: 'DELETE' })
        if (!res.ok) failed += 1
      } catch {
        failed += 1
      }
    }
    setRemoving(false)
    if (failed === 0) {
      toast.success(`Removed ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`)
      setSelectedItems([])
      setIsBatchMode(false)
      const res = await fetch(`/api/collections/${collectionId}`)
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) setCollection(data.data)
    } else {
      toast.error(`Could not remove ${failed} item${failed > 1 ? 's' : ''}`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <header className="bg-white dark:bg-gray-900 border-b px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
          <div className="h-6 w-1/3 bg-muted rounded animate-pulse"></div>
        </header>
        <div className="h-40 bg-muted animate-pulse"></div>
        <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="aspect-square bg-muted rounded-xl skeleton-shimmer"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!collection) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">Collection not found</div>
  }

  const items = collection.items || []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 sticky top-0 z-20 border-b px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full active:bg-gray-100 dark:bg-gray-900 shrink-0 md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-800 dark:text-gray-200" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 truncate pr-2">{collection.name}</h1>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => navigate('create-collection', { collectionId: collection.id })}
            className="p-2 text-[#C8102E] font-medium text-sm rounded-full active:bg-gray-100 dark:bg-gray-900"
          >
            Edit
          </button>
          <button onClick={() => navigate("edit-collection", { collectionId: col.id })} className="p-2 rounded-full active:bg-gray-100 dark:bg-gray-900" aria-label="Collection options">
            <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Meta Banner */}
        <div 
          className="bg-white dark:bg-gray-900 p-5 border-b shadow-sm relative overflow-hidden"
          style={collection.coverColor ? { backgroundColor: collection.coverColor + '20' } : {}}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 bg-white dark:bg-gray-900 px-2 py-1 rounded-full text-xs font-semibold shadow-sm text-gray-700 dark:text-gray-300 border">
                {collection.privacy === 'PRIVATE' && <><Lock className="w-3 h-3" /> Private</>}
                {collection.privacy === 'PUBLIC' && <><Globe className="w-3 h-3" /> Public</>}
                {collection.privacy === 'SHARED' && <><LinkIcon className="w-3 h-3" /> Shared</>}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">
                {items.length} items
              </span>
            </div>
            
            {collection.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">{collection.description}</p>
            )}
            
            <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-3">
              Updated {formatDistanceToNow(new Date(collection.updatedAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Share Banner for public/shared */}
        {collection.privacy !== 'PRIVATE' && (
          <div className="bg-primary/5 px-4 py-3 flex items-center justify-between border-b border-primary/20">
            <div className="flex items-center gap-2 text-primary text-sm">
              <Share2 className="w-4 h-4" />
              <span className="font-medium">{collection.privacy === 'SHARED' ? 'Anyone with the secret link can view' : 'Public — visible on your shared lists'}</span>
            </div>
            {collection.privacy === 'SHARED' ? (
              <button onClick={copyShareLink} className="text-primary text-sm font-semibold bg-white dark:bg-gray-900 px-3 py-1 rounded shadow-sm border border-primary/30 active:scale-95">
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            ) : (
              <span className="text-primary/60 text-xs">Sign in elsewhere to view</span>
            )}
          </div>
        )}

        {/* Toolbar */}
        {items.length > 0 && (
          <div className="px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900 border-b sticky top-[60px] z-10">
            <button 
              onClick={toggleBatchMode}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                isBatchMode ? 'bg-red-50 text-[#C8102E] border border-red-200' : 'text-gray-600 dark:text-gray-400 border border-transparent'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {isBatchMode ? 'Done' : 'Select'}
            </button>
            
            <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Products */}
        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full">
          {items.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center text-center mt-12 bg-white dark:bg-gray-900 p-8 rounded-2xl border border-dashed border-gray-300"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-[#C8102E]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Collection is empty</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-6">Start adding products to this collection.</p>
              <button
                onClick={() => navigate('create-collection', { collectionId: collection.id })}
                className="bg-[#C8102E] text-white px-6 py-2.5 rounded-lg font-medium shadow-sm active:scale-95"
              >
                Add Products
              </button>
            </motion.div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3' : 'space-y-3 lg:max-w-3xl lg:mx-auto'}>
              {items.map((item: any, idx: number) => {
                const prod = item.product
                const isSelected = selectedItems.includes(prod.id)
                
                return (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => {
                      if (isBatchMode) toggleItemSelection(prod.id)
                      // Task 96 lesson: the PDP reads productId, not id.
                      else navigate('product-detail', { productId: prod.id })
                    }}
                    className={`bg-white dark:bg-gray-900 rounded-xl border overflow-hidden relative ${
                      viewMode === 'list' ? 'flex' : 'flex flex-col'
                    } ${isSelected ? 'border-[#C8102E] ring-1 ring-[#C8102E]' : 'border-gray-200 dark:border-gray-800'}`}
                  >
                    {isBatchMode && (
                      <div className="absolute top-2 left-2 z-10 bg-white dark:bg-gray-900 rounded-full">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-[#C8102E] border-[#C8102E]' : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                    )}
                    
                    <div className={`relative ${viewMode === 'list' ? 'w-32 shrink-0' : 'w-full aspect-square'} bg-gray-100`}>
                      {prod.thumbnailUrl ? (
                        <img src={prod.thumbnailUrl} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-8 h-8" /></div>
                      )}
                    </div>
                    
                    <div className={`p-3 flex flex-col justify-between flex-1 ${viewMode === 'list' ? '' : 'min-h-[110px]'}`}>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 leading-tight mb-1">{prod.name}</h4>
                        <p className="text-[#C8102E] font-bold text-sm">
                          {prod.currency} {prod.basePrice.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-900 rounded">
                          MOQ: {prod.moq} {prod.unit}
                        </span>
                        {!isBatchMode && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); addLineToCart(prod) }}
                            aria-label={`Add ${prod.name} to cart`}
                            className="bg-[#C8102E] text-white p-1.5 rounded-full shadow-sm active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Batch Actions Bar */}
      {isBatchMode && selectedItems.length > 0 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white dark:bg-gray-900 border-t p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-20 flex gap-3 md:static md:bottom-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none"
        >
          <button
            onClick={removeSelected}
            disabled={removing}
            className="flex-1 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {removing ? 'Removing…' : `Remove (${selectedItems.length})`}
          </button>
          <button
            onClick={() => {
              const lines = items.filter((i: any) => selectedItems.includes(i.product.id)).map((i: any) => i.product)
              lines.forEach((prod: any) => addLineToCart(prod))
              setSelectedItems([])
              setIsBatchMode(false)
            }}
            className="flex-1 bg-[#C8102E] text-white py-3 rounded-xl font-semibold shadow-md shadow-red-200"
          >
            Add to Cart
          </button>
        </motion.div>
      )}
    </div>
  )
}

export default CollectionDetailPage
