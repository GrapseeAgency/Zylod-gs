'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function WishlistSortFilterPage() {
  const { goBack } = useNavigationStore();
  
  // State for filters
  const [sortBy, setSortBy] = useState('Recently Added');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [availability, setAvailability] = useState('Both');
  const [supplierRating, setSupplierRating] = useState('Any');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [country, setCountry] = useState('All');
  const [moq, setMoq] = useState(100);

  // Accordion state
  const [expandedSections, setExpandedSections] = useState({
    price: true,
    availability: true,
    rating: false,
    certs: false,
    location: false,
    moq: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCert = (cert: string) => {
    setCertifications(prev => prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]);
  };

  const activeFilterCount = (priceMin || priceMax ? 1 : 0) + (availability !== 'Both' ? 1 : 0) + (supplierRating !== 'Any' ? 1 : 0) + (certifications.length > 0 ? 1 : 0) + (country !== 'All' ? 1 : 0) + (moq !== 100 ? 1 : 0);

  const resetAll = () => {
    setSortBy('Recently Added');
    setPriceMin('');
    setPriceMax('');
    setAvailability('Both');
    setSupplierRating('Any');
    setCertifications([]);
    setCountry('All');
    setMoq(100);
  };

  const handleApply = () => {
    // Apply logic here
    goBack();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-20 border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-lg font-semibold">Sort & Filter</h1>
        </div>
        <button onClick={resetAll} className="text-sm font-medium text-gray-600">
          Reset All
        </button>
      </header>

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="bg-white px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-b">
          {certifications.map(c => (
            <span key={c} className="whitespace-nowrap px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {c} <button className="ml-1 font-bold" onClick={() => toggleCert(c)}>×</button>
            </span>
          ))}
          {availability !== 'Both' && (
            <span className="whitespace-nowrap px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {availability}
            </span>
          )}
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8 md:px-6">
        <div className="md:max-w-4xl md:mx-auto">
        {/* Sort Section */}
        <section className="bg-white mb-2 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Sort By</h2>
          <div className="space-y-3">
            {['Recently Added', 'Price Low-High', 'Price High-Low', 'Rating', 'Name A-Z'].map(option => (
              <label key={option} className="flex items-center justify-between py-1">
                <span className="text-gray-700">{option}</span>
                <input 
                  type="radio" 
                  name="sort" 
                  checked={sortBy === option} 
                  onChange={() => setSortBy(option)}
                  className="w-5 h-5 text-primary accent-primary" 
                />
              </label>
            ))}
          </div>
        </section>

        {/* Filter Accordions */}
        <section className="bg-white">
          <h2 className="font-semibold text-gray-900 p-4 border-b">Filters</h2>
          
          {/* Price Range */}
          <div className="border-b">
            <button onClick={() => toggleSection('price')} className="w-full flex items-center justify-between p-4 bg-white">
              <span className="font-medium text-gray-800">Price Range</span>
              {expandedSections.price ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            <AnimatePresence>
              {expandedSections.price && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-4 pt-0 flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Min ($)</label>
                      <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-gray-50" placeholder="0" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Max ($)</label>
                      <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-gray-50" placeholder="0" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Availability */}
          <div className="border-b">
            <button onClick={() => toggleSection('availability')} className="w-full flex items-center justify-between p-4 bg-white">
              <span className="font-medium text-gray-800">Availability</span>
              {expandedSections.availability ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            <AnimatePresence>
              {expandedSections.availability && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-4 pt-0 flex gap-2">
                    {['In Stock', 'Out of Stock', 'Both'].map(opt => (
                      <button 
                        key={opt}
                        onClick={() => setAvailability(opt)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border ${availability === opt ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Supplier Rating */}
          <div className="border-b">
            <button onClick={() => toggleSection('rating')} className="w-full flex items-center justify-between p-4 bg-white">
              <span className="font-medium text-gray-800">Supplier Rating</span>
              {expandedSections.rating ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            <AnimatePresence>
              {expandedSections.rating && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-4 pt-0 space-y-3">
                    {['4+', '3+', 'Any'].map(opt => (
                      <label key={opt} className="flex items-center gap-3">
                        <input type="radio" checked={supplierRating === opt} onChange={() => setSupplierRating(opt)} className="w-5 h-5 text-primary accent-primary" />
                        <span className="text-gray-700">{opt} Stars & Up</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Certifications */}
          <div className="border-b">
            <button onClick={() => toggleSection('certs')} className="w-full flex items-center justify-between p-4 bg-white">
              <span className="font-medium text-gray-800">Certifications</span>
              {expandedSections.certs ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            <AnimatePresence>
              {expandedSections.certs && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-4 pt-0 flex flex-wrap gap-2">
                    {['ISO 9001', 'CE', 'RoHS', 'UL Listed', 'FDA'].map(cert => (
                      <button 
                        key={cert}
                        onClick={() => toggleCert(cert)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border ${certifications.includes(cert) ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 bg-gray-50'}`}
                      >
                        {cert}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* MOQ */}
          <div>
            <button onClick={() => toggleSection('moq')} className="w-full flex items-center justify-between p-4 bg-white">
              <span className="font-medium text-gray-800">Max Minimum Order Qty (MOQ)</span>
              {expandedSections.moq ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            <AnimatePresence>
              {expandedSections.moq && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-4 pt-0">
                    <input type="range" min="1" max="1000" value={moq} onChange={e => setMoq(Number(e.target.value))} className="w-full accent-primary" />
                    <div className="flex justify-between text-sm text-gray-500 mt-2">
                      <span>1</span>
                      <span className="font-medium text-gray-900">{moq} units</span>
                      <span>1000+</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
        </div>
      </main>

      <footer className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
        <button onClick={handleApply} className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2">
          Apply Filters {activeFilterCount > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{activeFilterCount}</span>}
        </button>
      </footer>
    </div>
  );
}

export default WishlistSortFilterPage;
