'use client'

import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { motion } from 'framer-motion'
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

interface PromoSlide {
  id: string
  title: string
  price: number
  priceUnit: string
  badge: string
  navigateTo: string
  gradient: string
  imageSrc?: string
}

const PROMO_SLIDES: PromoSlide[] = [
  {
    id: 'promo-1',
    title: 'Export-Quality Muslin Fabrics',
    price: 85,
    priceUnit: '/meter',
    badge: 'Seasonal Deal',
    navigateTo: 'textiles-fabrics',
    gradient: 'from-red-900/70 via-red-800/50 to-transparent',
    imageSrc: '/images/products/muslin-banner.png',
  },
  {
    id: 'promo-2',
    title: 'Bulk Spices & Lentils',
    price: 28,
    priceUnit: '/kg',
    badge: 'Export Grade',
    navigateTo: 'agriculture-food',
    gradient: 'from-green-900/70 via-green-800/50 to-transparent',
  },
  {
    id: 'promo-3',
    title: 'LED Panel Lights Factory Price',
    price: 35,
    priceUnit: '/piece',
    badge: 'Factory Direct',
    navigateTo: 'electronics',
    gradient: 'from-blue-900/70 via-blue-800/50 to-transparent',
  },
  {
    id: 'promo-4',
    title: 'Jute Products Wholesale',
    price: 18,
    priceUnit: '/yard',
    badge: 'Eco-Friendly',
    navigateTo: 'packaging',
    gradient: 'from-amber-900/70 via-amber-800/50 to-transparent',
  },
]

export function MobilePromoBanner() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [currentSlide, setCurrentSlide] = useState(0)

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % PROMO_SLIDES.length)
  }, [])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length)
  }, [])

  // Auto-advance every 5 seconds
  useEffect(() => {
    const timer = setInterval(nextSlide, 5000)
    return () => clearInterval(timer)
  }, [nextSlide])

  const slide = PROMO_SLIDES[currentSlide]

  return (
    <section className="mt-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="relative w-full h-44 rounded-xl overflow-hidden shadow-lg"
      >
        {/* Background */}
        <div className={`absolute inset-0 bg-gradient-to-r ${slide.gradient} z-10`} />
        {slide.imageSrc ? (
          <Image
            src={slide.imageSrc}
            alt={slide.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50" />
        )}

        {/* Content overlay */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center px-6">
          <div className="flex items-center gap-1.5 mb-2">
            <Flame className="w-3 h-3 text-primary-foreground" />
            <span className="bg-primary text-primary-foreground text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wider">
              {slide.badge}
            </span>
          </div>
          <h3 className="text-white font-bold text-xl max-w-[180px] leading-tight">
            {slide.title}
          </h3>
          <p className="text-white/80 text-xs mt-1.5">
            Starting from {formatPrice(slide.price)}{slide.priceUnit}
          </p>
          <button
            onClick={() => navigate(slide.navigateTo as any)}
            className="mt-3 bg-white text-primary font-semibold text-sm px-4 py-2 rounded-lg w-fit transition-transform active:scale-95 shadow-sm"
          >
            Shop Bulk
          </button>
        </div>

        {/* Navigation arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-7 h-7 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-7 h-7 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Next slide"
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </button>

        {/* Dots indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
          {PROMO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </motion.div>
    </section>
  )
}
