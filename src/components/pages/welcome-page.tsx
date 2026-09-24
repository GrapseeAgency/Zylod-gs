'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import Image from 'next/image'
import { useNavigationStore } from '@/store/navigation-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { ArrowRight, Shield, TrendingUp } from 'lucide-react'

/* ─── Onboarding Slide Data ─── */
interface Slide {
  id: number
  title: string
  description: string
  illustration: 'ship' | 'shield' | 'trending'
}

const SLIDES: Slide[] = [
  {
    id: 1,
    title: 'Source Wholesale',
    description:
      'Browse wholesale products from suppliers on Zylod and order direct — with zero friction.',
    illustration: 'ship',
  },
  {
    id: 2,
    title: 'Trade Securely',
    description:
      'Orders start unpaid and are only marked paid once your payment is verified — every status shown in real time.',
    illustration: 'shield',
  },
  {
    id: 3,
    title: 'Scale Faster',
    description:
      'Add items to your cart, place orders at wholesale quantities, and track each shipment until it arrives.',
    illustration: 'trending',
  },
]

/* ─── Illustration Components ─── */
function ShipIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-[85%] h-[75%]">
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: -6 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl"
        >
          <Image
            src="/images/auth/onboarding-ship.png"
            alt="Cargo ship illustration"
            fill
            sizes="(max-width: 768px) 80vw, 400px"
            className="object-cover"
            priority
          />
        </motion.div>
      </div>
    </div>
  )
}

function ShieldIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: -6 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="w-[85%] h-[75%] rounded-2xl bg-gradient-to-br from-[#C8102E]/10 via-[#C8102E]/5 to-transparent flex items-center justify-center shadow-xl border border-[#C8102E]/10"
      >
        <div className="relative">
          {/* Background glow */}
          <div className="absolute inset-0 bg-[#C8102E]/10 rounded-full blur-3xl scale-150" />
          <Shield className="w-28 h-28 text-[#C8102E] relative z-10" strokeWidth={1.2} />
          {/* Checkmark inside shield */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            className="absolute inset-0 flex items-center justify-center z-20"
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <path
                d="M9 12.75L11.25 15 15 9.75"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </div>
        {/* Decorative floating elements */}
        <div className="absolute top-4 right-6 w-3 h-3 rounded-full bg-[#C8102E]/30" />
        <div className="absolute bottom-6 left-8 w-2 h-2 rounded-full bg-[#C8102E]/20" />
        <div className="absolute top-1/2 right-4 w-1.5 h-1.5 rounded-full bg-[#C8102E]/25" />
      </motion.div>
    </div>
  )
}

function TrendingIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: -6 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="w-[85%] h-[75%] rounded-2xl bg-gradient-to-br from-[#C8102E]/10 via-[#C8102E]/5 to-transparent flex items-center justify-center shadow-xl border border-[#C8102E]/10"
      >
        <div className="relative">
          {/* Background glow */}
          <div className="absolute inset-0 bg-[#C8102E]/10 rounded-full blur-3xl scale-150" />
          <TrendingUp className="w-28 h-28 text-[#C8102E] relative z-10" strokeWidth={1.2} />
          {/* Arrow accent */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            className="absolute -top-2 -right-4 z-20"
          >
            <div className="w-8 h-8 rounded-full bg-[#C8102E] flex items-center justify-center shadow-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v16m0-16l-4 4m4-4l4 4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </motion.div>
        </div>
        {/* Decorative floating elements */}
        <div className="absolute top-8 left-6 w-3 h-3 rounded-full bg-[#C8102E]/20" />
        <div className="absolute bottom-8 right-6 w-2 h-2 rounded-full bg-[#C8102E]/30" />
        <div className="absolute top-1/3 left-4 w-1.5 h-1.5 rounded-full bg-[#C8102E]/25" />
      </motion.div>
    </div>
  )
}

/* ─── Pagination Dots ─── */
function PaginationDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          layout
          className="rounded-full"
          initial={false}
          animate={{
            width: i === current ? 28 : 8,
            height: 8,
            backgroundColor: i === current ? '#C8102E' : '#D1D5DB',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      ))}
    </div>
  )
}

/* ─── Slide Content ─── */
function SlideContent({ slide }: { slide: Slide }) {
  return (
    <div className="text-center space-y-3 px-4">
      <motion.h2
        key={`title-${slide.id}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-[26px] leading-tight font-bold text-[#1A1A1A]"
      >
        {slide.title}
      </motion.h2>
      <motion.p
        key={`desc-${slide.id}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="text-[15px] leading-relaxed text-[#6B7280] max-w-[300px] mx-auto"
      >
        {slide.description}
      </motion.p>
    </div>
  )
}

/* ─── Illustration Circle ─── */
function IllustrationCircle({ slide }: { slide: Slide }) {
  return (
    <div className="relative w-[75%] aspect-square mx-auto rounded-full bg-gradient-to-br from-[#FDE8EC] via-[#FFF0F3] to-[#F8F9FA] flex items-center justify-center shadow-lg">
      {/* Inner subtle ring */}
      <div className="absolute inset-3 rounded-full border border-[#C8102E]/10" />
      <div className="w-[85%] h-[85%] relative">
        <AnimatePresence mode="wait">
          {slide.illustration === 'ship' && (
            <motion.div
              key="ship"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              <ShipIllustration />
            </motion.div>
          )}
          {slide.illustration === 'shield' && (
            <motion.div
              key="shield"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              <ShieldIllustration />
            </motion.div>
          )}
          {slide.illustration === 'trending' && (
            <motion.div
              key="trending"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              <TrendingIllustration />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─── Main Welcome Page ─── */
export function WelcomePage() {
  const { navigate } = useNavigationStore()
  const isMobile = useIsMobile()
  const [currentSlide, setCurrentSlide] = useState(0)
  const dragStartX = useRef(0)

  // Mark onboarding seen so it never re-triggers on this device
  const markSeen = useCallback(() => {
    try { localStorage.setItem('zylod-onboarding-seen', 'true') } catch { /* ignore */ }
  }, [])

  const isLastSlide = currentSlide === SLIDES.length - 1

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      markSeen()
      navigate('home')
    } else {
      setCurrentSlide((prev) => Math.min(prev + 1, SLIDES.length - 1))
    }
  }, [isLastSlide, navigate, markSeen])

  const handleSkip = useCallback(() => {
    markSeen()
    navigate('home')
  }, [navigate, markSeen])

  const handleDragStart = useCallback((_: unknown, info: PanInfo) => {
    dragStartX.current = info.point.x
  }, [])

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const offset = info.point.x - dragStartX.current
      const threshold = 50
      if (offset < -threshold && currentSlide < SLIDES.length - 1) {
        setCurrentSlide((prev) => prev + 1)
      } else if (offset > threshold && currentSlide > 0) {
        setCurrentSlide((prev) => prev - 1)
      }
    },
    [currentSlide]
  )

  /* ─── Mobile Layout ─── */
  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="overflow-x-hidden min-h-screen bg-[#F8F9FA] flex flex-col"
      >
        {/* Brand Header */}
        <div className="pt-12 pb-4 text-center">
          <h1 className="text-2xl font-bold text-[#C8102E] tracking-tight">
            Zylod
          </h1>
        </div>

        {/* Swipeable Content Area */}
        <motion.div
          className="flex-1 flex flex-col items-center justify-center px-6"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
        >
          <div className="w-full flex flex-col items-center gap-8">
            {/* Illustration Circle */}
            <AnimatePresence mode="wait">
              <motion.div
                key={SLIDES[currentSlide].id}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.35 }}
                className="w-full"
              >
                <IllustrationCircle slide={SLIDES[currentSlide]} />
              </motion.div>
            </AnimatePresence>

            {/* Text Content */}
            <SlideContent slide={SLIDES[currentSlide]} />

            {/* Pagination */}
            <PaginationDots current={currentSlide} total={SLIDES.length} />
          </div>
        </motion.div>

        {/* Actions */}
        <div className="px-6 pb-10 pt-4 space-y-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleNext}
            className="w-full h-[54px] rounded-xl bg-[#C8102E] text-white font-semibold text-[16px] flex items-center justify-center gap-2 shadow-md active:shadow-sm transition-shadow"
          >
            {isLastSlide ? 'Get Started' : 'Next'}
            <ArrowRight className="w-5 h-5" />
          </motion.button>

          <button
            onClick={handleSkip}
            className="w-full text-center text-[15px] text-[#6B7280] font-medium py-2 hover:text-[#1A1A1A] transition-colors"
          >
            Skip
          </button>
        </div>
      </motion.div>
    )
  }

  /* ─── Desktop Layout ─── */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="overflow-x-hidden min-h-screen bg-[#F8F9FA] flex items-center justify-center p-8"
    >
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#C8102E" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E0E0E0] overflow-hidden"
      >
        {/* Brand Header */}
        <div className="pt-10 pb-4 text-center">
          <h1 className="text-2xl font-bold text-[#C8102E] tracking-tight">
            Zylod
          </h1>
        </div>

        {/* Content Area */}
        <motion.div
          className="px-8 flex flex-col items-center gap-6"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
        >
          {/* Illustration Circle */}
          <AnimatePresence mode="wait">
            <motion.div
              key={SLIDES[currentSlide].id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
              className="w-full"
            >
              <IllustrationCircle slide={SLIDES[currentSlide]} />
            </motion.div>
          </AnimatePresence>

          {/* Text Content */}
          <SlideContent slide={SLIDES[currentSlide]} />

          {/* Pagination */}
          <PaginationDots current={currentSlide} total={SLIDES.length} />
        </motion.div>

        {/* Actions */}
        <div className="px-8 pt-4 pb-10 space-y-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleNext}
            className="w-full h-[54px] rounded-xl bg-[#C8102E] text-white font-semibold text-[16px] flex items-center justify-center gap-2 shadow-md hover:bg-[#B00E28] active:shadow-sm transition-all"
          >
            {isLastSlide ? 'Get Started' : 'Next'}
            <ArrowRight className="w-5 h-5" />
          </motion.button>

          <button
            onClick={handleSkip}
            className="w-full text-center text-[15px] text-[#6B7280] font-medium py-2 hover:text-[#1A1A1A] transition-colors"
          >
            Skip
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default WelcomePage
