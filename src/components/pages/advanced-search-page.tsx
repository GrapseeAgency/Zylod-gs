'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Search, Sliders, Check } from 'lucide-react'

export function AdvancedSearchPage() {
  const { navigate, goBack } = useNavigationStore()
  const [keyword, setKeyword] = useState('')
  const [sku, setSku] = useState('')
  const [brand, setBrand] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [moq, setMoq] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  useEffect(() => {
    fetch('/api/categories?limit=50')
      .then(res => res.json())
      .then(data => setCategories(data.data || data.categories || []))
      .catch(() => {})
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params: Record<string, string> = {}
    if (keyword.trim()) params.query = keyword.trim()
    if (selectedCategory) params.category = selectedCategory
    if (minPrice) params.minPrice = minPrice
    if (maxPrice) params.maxPrice = maxPrice
    if (moq) params.moq = moq
    navigate('search-results', params)
  }

  function handleReset() {
    setKeyword('')
    setSku('')
    setBrand('')
    setMinPrice('')
    setMaxPrice('')
    setMoq('')
    setSelectedCategory('')
    setVerifiedOnly(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-semibold text-gray-900">Advanced Search</span>
        </div>
        <button onClick={handleReset} className="text-xs text-gray-500 hover:text-red-600">
          Reset All
        </button>
      </div>

      <div className="hidden md:flex items-center justify-between max-w-3xl mx-auto w-full px-6 pt-6">
        <h1 className="text-xl font-bold text-gray-900">Advanced Search</h1>
        <button onClick={handleReset} className="text-xs text-gray-500 hover:text-red-600">
          Reset All
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex-1 px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-y-auto max-w-lg md:max-w-3xl mx-auto w-full space-y-5 md:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Keywords */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold text-gray-700">Keywords / Product Title</label>
          <input
            type="text"
            placeholder="e.g. angle grinder, industrial motor"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-red-500"
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700">Category</label>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-red-500"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Price Range */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700">Price Range (BDT)</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Min Price"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
            <input
              type="number"
              placeholder="Max Price"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
          </div>
        </div>

        {/* MOQ */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700">Maximum MOQ (Units)</label>
          <input
            type="number"
            placeholder="e.g. 50"
            value={moq}
            onChange={e => setMoq(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-red-500"
          />
        </div>

        {/* Brand or SKU */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Brand</label>
            <input
              type="text"
              placeholder="e.g. Bosch"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">SKU / Model #</label>
            <input
              type="text"
              placeholder="e.g. ZYL-850"
              value={sku}
              onChange={e => setSku(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
        </div>

        {/* Verified Suppliers Toggle */}
        <div
          onClick={() => setVerifiedOnly(!verifiedOnly)}
          className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl bg-gray-50 cursor-pointer"
        >
          <div>
            <p className="text-xs font-semibold text-gray-800">Verified Suppliers Only</p>
            <p className="text-xs text-gray-400">Show products from verified factories & wholesale depots</p>
          </div>
          <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
            verifiedOnly ? 'bg-red-600 border-red-600 text-white' : 'border-gray-300 bg-white'
          }`}>
            {verifiedOnly && <Check className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm shadow-md transition flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" />
          Search Catalog
        </button>
      </form>
    </div>
  )
}

export default AdvancedSearchPage
