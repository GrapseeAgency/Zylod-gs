'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Search, X, Mic, MicOff } from 'lucide-react'
import { hasNativeVoiceRecognition, recognizeSpeechWithNative } from '@/lib/native-bridge'

/* ─── Web Speech API types ─── */
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  length: number
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}

/* ─── Supported languages ─── */
const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'bn-BD', label: 'বাংলা' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'zh-CN', label: '中文' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'ms-MY', label: 'Malay' },
]

/* ─── Extracted VoiceSearchButton (outside render) ─── */
function VoiceSearchButtonInner({
  isListening,
  onStart,
  onStop,
  voiceLang,
  className = '',
}: {
  isListening: boolean
  onStart: () => void
  onStop: () => void
  voiceLang: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={isListening ? onStop : onStart}
        className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
          isListening
            ? 'bg-primary animate-pulse shadow-lg shadow-primary/30'
            : 'bg-muted hover:bg-muted/80'
        }`}
        aria-label={isListening ? 'Stop voice search' : 'Start voice search'}
        title={isListening ? 'Listening... Click to stop' : 'Voice search - Speak in any language'}
      >
        {isListening ? (
          <MicOff className="h-3.5 w-3.5 text-white" />
        ) : (
          <Mic className="h-3.5 w-3.5"  />
        )}
      </button>

      {/* Language indicator when listening */}
      {isListening && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-bold text-white whitespace-nowrap shadow-md bg-primary"
        >
          🎤 {SUPPORTED_LANGUAGES.find(l => l.code === voiceLang)?.label || 'EN'}
        </div>
      )}
    </div>
  )
}

/* ─── Extracted LanguagePicker (outside render) ─── */
function LanguagePickerInner({
  show,
  voiceLang,
  onSelectLang,
  onClose,
}: {
  show: boolean
  voiceLang: string
  onSelectLang: (code: string) => void
  onClose: () => void
}) {
  if (!show) return null
  return (
    <div
      className="absolute top-full left-0 mt-1 bg-card border border-gray-200 rounded-lg shadow-xl z-50 p-2 min-w-[160px]"
    >
      <p className="text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Voice Language</p>
      <div className="flex flex-col gap-1">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => onSelectLang(lang.code)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
              voiceLang === lang.code
                ? 'bg-primary/5 text-red-600 font-semibold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>{lang.label}</span>
            {voiceLang === lang.code && <span className="text-[10px] ml-auto">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

interface SearchBarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  onSearchSubmit: (e: React.FormEvent) => void
  mobileSearchOpen: boolean
  onMobileSearchToggle: (open: boolean) => void
}

export function SearchBar({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  mobileSearchOpen,
  onMobileSearchToggle,
}: SearchBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceLang, setVoiceLang] = useState('en-US')
  const [showLangPicker, setShowLangPicker] = useState(false)
  const recognitionRef = useRef<any>(null)

  /* Auto-focus search on mobile toggle */
  useEffect(() => {
    if (mobileSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [mobileSearchOpen])

  /* ─── Voice Search Logic ─── */
  const startVoiceSearch = useCallback(() => {
    // Native Android shell — the WebView does not implement the Web Speech API.
    if (hasNativeVoiceRecognition()) {
      setIsListening(true)
      recognizeSpeechWithNative()
        .then((text) => {
          const finalTranscript = text.trim()
          if (finalTranscript) {
            onSearchChange(finalTranscript)
            // Auto-submit search after voice recognition completes
            const formEvent = { preventDefault: () => {} } as React.FormEvent
            onSearchSubmit(formEvent)
          }
        })
        .catch((err: Error) => {
          alert(err.message || 'Voice recognition failed')
        })
        .finally(() => {
          setIsListening(false)
        })
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice search is not supported in your browser. Please use Chrome or Edge.')
      return
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    const recognition = new SpeechRecognition()
    recognition.lang = voiceLang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 3

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.results.length - 1; i >= 0; i--) {
        const result = event.results[i]
        if (result.isFinal) {
          // Use the highest confidence alternative
          let bestAlt = result[0]
          for (let j = 1; j < result.length; j++) {
            if (result[j].confidence > bestAlt.confidence) {
              bestAlt = result[j]
            }
          }
          finalTranscript = bestAlt.transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      // Show interim results as user speaks
      if (interimTranscript) {
        onSearchChange(interimTranscript)
      }
      // When final result arrives, use the most accurate one
      if (finalTranscript) {
        onSearchChange(finalTranscript.trim())
        // Auto-submit search after voice recognition completes
        const formEvent = { preventDefault: () => {} } as React.FormEvent
        onSearchSubmit(formEvent)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('Voice search error:', event.error)
      setIsListening(false)
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone permission in your browser settings.')
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [voiceLang, onSearchChange, onSearchSubmit])

  const stopVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const handleSelectLang = useCallback((code: string) => {
    setVoiceLang(code)
    setShowLangPicker(false)
  }, [])

  return (
    <>
      {/* Search Bar — Desktop */}
      <form
        onSubmit={onSearchSubmit}
        className="hidden md:flex flex-1 max-w-lg ml-2"
      >
        <div className="relative flex items-center w-full">
          <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={isListening ? '🎤 Listening... Speak now' : 'Search products, suppliers...'}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full h-10 rounded-full border-0 pl-10 pr-20 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow ${
              isListening ? 'ring-2 ring-primary bg-primary/5' : 'focus:ring-primary'
            }`}
            
          />

          {/* Mic icon + language picker trigger */}
          <div className="absolute right-9 flex items-center gap-1">
            <VoiceSearchButtonInner
              isListening={isListening}
              onStart={startVoiceSearch}
              onStop={stopVoiceSearch}
              voiceLang={voiceLang}
            />
            {/* Tiny language toggle button */}
            <button
              type="button"
              onClick={() => setShowLangPicker(!showLangPicker)}
              className="text-[9px] font-semibold px-1 py-0.5 rounded transition-colors hover:bg-gray-200"
              
              aria-label="Change voice language"
              title={`Voice language: ${SUPPORTED_LANGUAGES.find(l => l.code === voiceLang)?.label}`}
            >
              {SUPPORTED_LANGUAGES.find(l => l.code === voiceLang)?.label?.split(' ')[0] || 'EN'}
            </button>
          </div>

          {/* Language Picker Dropdown */}
          <LanguagePickerInner
            show={showLangPicker}
            voiceLang={voiceLang}
            onSelectLang={handleSelectLang}
            onClose={() => setShowLangPicker(false)}
          />

          {/* Search submit button */}
          <button
            type="submit"
            className="absolute right-1.5 h-7 w-7 rounded-full flex items-center justify-center transition-colors hover:bg-red-600 bg-primary"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </form>

      {/* Mobile search toggle button */}
      <div className="md:hidden flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMobileSearchToggle(true)}
          aria-label="Open search"
        >
          <Search className="h-5 w-5"  />
        </Button>
        {/* Mobile mic button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={isListening ? stopVoiceSearch : startVoiceSearch}
          className={isListening ? 'text-primary animate-pulse' : ''}
          aria-label={isListening ? 'Stop voice search' : 'Voice search'}
        >
          {isListening ? <MicOff className="h-5 w-5 text-primary" /> : <Mic className="h-5 w-5"  />}
        </Button>
      </div>

      {/* Mobile Search Overlay */}
      {mobileSearchOpen && (
        <div
          className="absolute top-0 left-0 right-0 bg-card shadow-lg z-[60] p-3 md:hidden transition-opacity"
        >
          <div className="flex items-center gap-2">
            <form onSubmit={(e) => { onSearchSubmit(e); onMobileSearchToggle(false) }} className="flex-1">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={isListening ? '🎤 Listening...' : 'Search products, suppliers...'}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className={`w-full h-10 rounded-full border-0 pl-10 pr-20 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
                    isListening ? 'ring-2 ring-primary bg-primary/5' : 'focus:ring-primary'
                  }`}
                  
                />
                {/* Mobile mic in overlay */}
                <div className="absolute right-9">
                  <VoiceSearchButtonInner
                    isListening={isListening}
                    onStart={startVoiceSearch}
                    onStop={stopVoiceSearch}
                    voiceLang={voiceLang}
                  />
                </div>
                <button
                  type="submit"
                  className="absolute right-1.5 h-7 w-7 rounded-full flex items-center justify-center bg-primary"
                  aria-label="Search"
                >
                  <Search className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </form>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { onMobileSearchToggle(false); onSearchChange('') }}
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile language picker */}
          {isListening && (
            <div className="mt-2 flex items-center justify-center gap-1">
              <span className="text-xs text-primary font-semibold">🎤 Listening in</span>
              <select
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value)}
                className="text-xs bg-primary/5 border border-red-200 rounded px-2 py-1 text-red-600 font-semibold"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </>
  )
}
