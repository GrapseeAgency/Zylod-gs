'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Camera, Image as ImageIcon, ArrowLeft, Search, Upload, X, ShoppingCart } from 'lucide-react'

interface MatchedProduct {
  id: string
  name: string
  basePrice: number
  currency: string
  thumbnailUrl?: string
  unit: string
  moq: number
  supplier: { companyName: string }
  category: { name: string }
}

interface SearchResult {
  products: MatchedProduct[]
  query: string
  confidence?: number
}

type Stage = 'select' | 'loading' | 'results' | 'empty' | 'error'

export function ImageSearchPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [stage, setStage] = useState<Stage>('select')
  const [preview, setPreview] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(file: File) {
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setStage('loading')

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/search/image', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Search failed')
      const json = await res.json()
      const data: SearchResult = json.data || { products: [], query: '' }
      setResult(data)
      setStage(data.products.length > 0 ? 'results' : 'empty')
    } catch (e) {
      setErrorMsg('Image search failed. Please try again.')
      setStage('error')
    }
  }

  async function handleUrlSearch() {
    if (!urlInput.trim()) return
    setPreview(urlInput)
    setStage('loading')

    try {
      const res = await fetch(`/api/search/image?url=${encodeURIComponent(urlInput)}`)
      if (!res.ok) throw new Error('Search failed')
      const json = await res.json()
      const data: SearchResult = json.data || { products: [], query: '' }
      setResult(data)
      setStage(data.products.length > 0 ? 'results' : 'empty')
    } catch {
      setErrorMsg('Image search failed. Please try again.')
      setStage('error')
    }
  }

  function reset() {
    setStage('select')
    setPreview(null)
    setResult(null)
    setUrlInput('')
    setErrorMsg('')
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 flex items-center gap-3 px-4 py-3 md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-semibold text-gray-900">Search by Image</span>
        {stage !== 'select' && (
          <button onClick={reset} className="ml-auto p-1.5 rounded-full hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      <div className="flex-1 p-4 space-y-4 pb-20 md:max-w-4xl md:mx-auto md:w-full md:px-6 md:py-8 md:pb-8">
        {/* Preview */}
        {preview && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-32 h-32 rounded-xl overflow-hidden border border-gray-200 mx-auto"
          >
            <img src={preview} alt="Search image" className="w-full h-full object-cover" />
            <button
              onClick={reset}
              className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </motion.div>
        )}

        {stage === 'select' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Upload options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center gap-2 hover:border-red-400 hover:bg-red-50 transition"
              >
                <Camera className="w-8 h-8 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Take Photo</span>
                <span className="text-xs text-gray-400">Use camera</span>
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center gap-2 hover:border-red-400 hover:bg-red-50 transition"
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Upload Image</span>
                <span className="text-xs text-gray-400">From gallery</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* URL input */}
            <div className="flex gap-2">
              <Input
                placeholder="Paste image URL..."
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlSearch()}
                className="flex-1"
              />
              <Button onClick={handleUrlSearch} size="icon" className="bg-red-600 hover:bg-red-700">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-center text-gray-400">
              Upload or paste an image to find similar wholesale products
            </p>
          </motion.div>
        )}

        {stage === 'loading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-center text-sm text-gray-500">Searching for similar products...</p>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-20 h-20 rounded-xl" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {stage === 'results' && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-sm font-semibold text-gray-800">
              Products matching your image
              {result.query && <span className="font-normal text-gray-500">: &ldquo;{result.query}&rdquo;</span>}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.products.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                <Card className="overflow-hidden border border-gray-100">
                  <CardContent className="p-3 flex gap-3">
                    <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                      {product.thumbnailUrl ? (
                        <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{product.supplier.companyName}</p>
                      <p className="text-sm font-bold text-red-600 mt-1">{formatPrice(product.basePrice)}/{product.unit}</p>
                      <p className="text-xs text-gray-400">MOQ: {product.moq} {product.unit}</p>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-red-600 hover:bg-red-700 text-xs h-7"
                          onClick={() => navigate('product-detail', { productId: product.id })}
                        >
                          View Product
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            </div>
          </motion.div>
        )}

        {stage === 'empty' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 space-y-3">
            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-600">No matching products found</p>
            <p className="text-xs text-gray-400">Try a clearer image or different angle</p>
            <Button onClick={reset} variant="outline" size="sm">Try Again</Button>
          </motion.div>
        )}

        {stage === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 space-y-3">
            <X className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-600">{errorMsg}</p>
            <Button onClick={reset} variant="outline" size="sm">Try Again</Button>
          </motion.div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
      />
    </div>
  )
}

export default ImageSearchPage
