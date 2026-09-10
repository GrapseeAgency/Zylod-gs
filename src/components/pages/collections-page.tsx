'use client'

import React, { useEffect, useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Plus, MoreVertical, Lock, Globe, Link as LinkIcon, Folder } from 'lucide-react'
import { motion } from 'framer-motion'

export function CollectionsPage() {
  const { navigate, goBack } = useNavigationStore()
  const [collections, setCollections] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortOption, setSortOption] = useState('recent')

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const res = await fetch('/api/collections')
        const data = await res.json()
        if (data.success) {
          setCollections(data.data)
        }
      } catch (err) {
        console.error('Error fetching collections', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCollections()
  }, [])

  const sortedCollections = [...collections].sort((a, b) => {
    if (sortOption === 'name') return a.name.localeCompare(b.name)
    if (sortOption === 'items') return (b._count?.items || 0) - (a._count?.items || 0)
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 border-b px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2 -ml-2 rounded-full active:bg-gray-100 md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">My Collections</h1>
            <p className="text-xs text-gray-500">Organize your saved products</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('create-collection')}
          className="p-2 -mr-2 rounded-full active:bg-gray-100"
        >
          <Plus className="w-6 h-6 text-[#C8102E]" />
        </button>
      </header>

      {/* Sort Options */}
      {!isLoading && collections.length > 0 && (
        <div className="px-4 md:px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b bg-white">
          {['recent', 'name', 'items'].map((opt) => (
            <button
              key={opt}
              onClick={() => setSortOption(opt)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortOption === opt 
                  ? 'bg-[#C8102E] text-white' 
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              {opt === 'recent' && 'Recently Updated'}
              {opt === 'name' && 'Name A-Z'}
              {opt === 'items' && 'Most Items'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-xl aspect-square mb-2"></div>
                <div className="bg-gray-200 h-4 rounded w-3/4 mb-1"></div>
                <div className="bg-gray-200 h-3 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : sortedCollections.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center mt-20"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Folder className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No collections yet</h2>
            <p className="text-gray-500 mb-6 text-sm">Create your first collection to organize products.</p>
            <button 
              onClick={() => navigate('create-collection')}
              className="bg-[#C8102E] text-white px-6 py-2.5 rounded-lg font-medium shadow-sm active:scale-95 transition-transform"
            >
              Create Collection
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedCollections.map((col, idx) => (
              <motion.div 
                key={col.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate('collection-detail', { collectionId: col.id })}
                className="group relative flex flex-col cursor-pointer active:scale-95 transition-transform"
              >
                {/* Cover Collage */}
                <div 
                  className="rounded-xl aspect-square mb-2 overflow-hidden bg-gray-100 border border-gray-100 shadow-sm relative"
                  style={col.coverColor ? { backgroundColor: col.coverColor } : {}}
                >
                  {col.coverImageUrl ? (
                    <img src={col.coverImageUrl} alt={col.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5">
                      {[0, 1, 2, 3].map(i => {
                        const img = col.items?.[i]?.product?.thumbnailUrl
                        return img ? (
                          <img key={i} src={img} className="w-full h-full object-cover bg-white" alt="" />
                        ) : (
                          <div key={i} className="bg-gray-50 w-full h-full"></div>
                        )
                      })}
                    </div>
                  )}
                  {/* Privacy Badge */}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1 rounded-full shadow-sm">
                    {col.privacy === 'PRIVATE' && <Lock className="w-3.5 h-3.5 text-gray-700" />}
                    {col.privacy === 'PUBLIC' && <Globe className="w-3.5 h-3.5 text-gray-700" />}
                    {col.privacy === 'SHARED' && <LinkIcon className="w-3.5 h-3.5 text-gray-700" />}
                  </div>
                </div>
                
                {/* Info */}
                <div className="flex justify-between items-start px-1">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{col.name}</h3>
                    <p className="text-xs text-gray-500">{col._count?.items || 0} items</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); /* TODO: options modal */ }} 
                    className="p-1 -mr-1 text-gray-400 hover:text-gray-700"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      {!isLoading && collections.length > 0 && (
        <button
          onClick={() => navigate('create-collection')}
          className="fixed bottom-24 md:bottom-8 right-6 w-14 h-14 bg-[#C8102E] rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-20"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  )
}

export default CollectionsPage
