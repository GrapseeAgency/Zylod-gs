'use client'

import React, { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, MoreVertical, Lock, Globe, Link as LinkIcon, Share2, Grid, List, CheckSquare, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'

export function CollectionDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { collectionId } = pageParams || {}
  
  const [collection, setCollection] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  useEffect(() => {
    if (!collectionId) {
      goBack()
      return
    }
    const fetchCollection = async () => {
      try {
        const res = await fetch(`/api/collections/${collectionId}`)
        const data = await res.json()
        if (data.success) {
          setCollection(data.data)
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b px-4 py-4 flex items-center gap-3">
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
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Collection not found</div>
  }

  const items = collection.items || []

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8">
      {/* Header */}
      <header className="bg-white sticky top-0 z-20 border-b px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full active:bg-gray-100 shrink-0 md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate pr-2">{collection.name}</h1>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => navigate('create-collection', { collectionId: collection.id })}
            className="p-2 text-[#C8102E] font-medium text-sm rounded-full active:bg-gray-100"
          >
            Edit
          </button>
          <button className="p-2 rounded-full active:bg-gray-100">
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Meta Banner */}
        <div 
          className="bg-white p-5 border-b shadow-sm relative overflow-hidden"
          style={collection.coverColor ? { backgroundColor: collection.coverColor + '20' } : {}}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-full text-xs font-semibold shadow-sm text-gray-700 border">
                {collection.privacy === 'PRIVATE' && <><Lock className="w-3 h-3" /> Private</>}
                {collection.privacy === 'PUBLIC' && <><Globe className="w-3 h-3" /> Public</>}
                {collection.privacy === 'SHARED' && <><LinkIcon className="w-3 h-3" /> Shared</>}
              </span>
              <span className="text-xs text-gray-500 font-medium">
                {items.length} items
              </span>
            </div>
            
            {collection.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{collection.description}</p>
            )}
            
            <p className="text-xs text-gray-400 mt-3">
              Updated {formatDistanceToNow(new Date(collection.updatedAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Share Banner for public/shared */}
        {collection.privacy !== 'PRIVATE' && (
          <div className="bg-blue-50 px-4 py-3 flex items-center justify-between border-b border-blue-100">
            <div className="flex items-center gap-2 text-blue-800 text-sm">
              <Share2 className="w-4 h-4" />
              <span className="font-medium">Anyone with link can view</span>
            </div>
            <button className="text-blue-700 text-sm font-semibold bg-white px-3 py-1 rounded shadow-sm border border-blue-200">
              Copy Link
            </button>
          </div>
        )}

        {/* Toolbar */}
        {items.length > 0 && (
          <div className="px-4 py-3 flex items-center justify-between bg-white border-b sticky top-[60px] z-10">
            <button 
              onClick={toggleBatchMode}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                isBatchMode ? 'bg-red-50 text-[#C8102E] border border-red-200' : 'text-gray-600 border border-transparent'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {isBatchMode ? 'Done' : 'Select'}
            </button>
            
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
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
              className="flex flex-col items-center justify-center text-center mt-12 bg-white p-8 rounded-2xl border border-dashed border-gray-300"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-[#C8102E]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Collection is empty</h3>
              <p className="text-sm text-gray-500 mb-6">Start adding products to this collection.</p>
              <button className="bg-[#C8102E] text-white px-6 py-2.5 rounded-lg font-medium shadow-sm">
                Browse Products
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
                      else navigate('product-detail', { id: prod.id })
                    }}
                    className={`bg-white rounded-xl border overflow-hidden relative ${
                      viewMode === 'list' ? 'flex' : 'flex flex-col'
                    } ${isSelected ? 'border-[#C8102E] ring-1 ring-[#C8102E]' : 'border-gray-200'}`}
                  >
                    {isBatchMode && (
                      <div className="absolute top-2 left-2 z-10 bg-white rounded-full">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-[#C8102E] border-[#C8102E]' : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                    )}
                    
                    <div className={`relative ${viewMode === 'list' ? 'w-32 shrink-0' : 'w-full aspect-square'} bg-gray-100`}>
                      <img src={prod.thumbnailUrl} alt={prod.name} className="w-full h-full object-cover" />
                    </div>
                    
                    <div className={`p-3 flex flex-col justify-between flex-1 ${viewMode === 'list' ? '' : 'min-h-[110px]'}`}>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight mb-1">{prod.name}</h4>
                        <p className="text-[#C8102E] font-bold text-sm">
                          {prod.currency} {prod.basePrice.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-500 font-medium px-2 py-0.5 bg-gray-100 rounded">
                          MOQ: {prod.moq} {prod.unit}
                        </span>
                        {!isBatchMode && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); /* TODO: Add to cart */ }}
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
          className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-20 flex gap-3"
        >
          <button className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-xl font-semibold">
            Remove ({selectedItems.length})
          </button>
          <button className="flex-1 bg-[#C8102E] text-white py-3 rounded-xl font-semibold shadow-md shadow-red-200">
            Add to Cart
          </button>
        </motion.div>
      )}
    </div>
  )
}

export default CollectionDetailPage
