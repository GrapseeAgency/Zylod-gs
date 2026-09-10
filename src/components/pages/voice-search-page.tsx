'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { X, Mic, MicOff, Search } from 'lucide-react'
import { hasNativeVoiceRecognition, recognizeSpeechWithNative } from '@/lib/native-bridge'

interface VoiceHistoryItem {
  id: string
  query: string
  createdAt: string
}

type RecognitionState = 'idle' | 'listening' | 'processing' | 'done' | 'unsupported'

export function VoiceSearchPage() {
  const { navigate, goBack } = useNavigationStore()
  const [state, setState] = useState<RecognitionState>('idle')
  const [transcript, setTranscript] = useState('')
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const recognitionRef = useRef<any>(null)

  const suggestedPhrases = [
    'Angle grinder wholesale',
    'Cotton fabric bulk order',
    'Electronics distributor Bangladesh',
    'Industrial heavy machinery',
    'Minimum order 50 units',
  ]

  useEffect(() => {
    const SpeechRecognitionAPI = (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition))
    if (!SpeechRecognitionAPI && !hasNativeVoiceRecognition()) {
      setState('unsupported')
      return
    }

    fetchVoiceHistory()
  }, [])

  async function fetchVoiceHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/search/history?type=voice')
      if (res.ok) {
        const json = await res.json()
        setVoiceHistory((json.data || []).slice(0, 5))
      }
    } catch {}
    setLoadingHistory(false)
  }

  function startListening() {
    // Native Android shell — the WebView does not implement the Web Speech API.
    if (hasNativeVoiceRecognition()) {
      setState('listening')
      setTranscript('')
      setErrorMsg('')
      recognizeSpeechWithNative()
        .then((text) => {
          setTranscript(text)
          handleFinalResult(text)
        })
        .catch((err: Error) => {
          setErrorMsg(err.message || 'Voice recognition failed')
          setState('idle')
        })
      return
    }

    const SpeechRecognitionAPI = (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition))
    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setState('listening')
      setTranscript('')
      setErrorMsg('')
    }

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      const text = result[0].transcript
      setTranscript(text)
      if (result.isFinal) {
        handleFinalResult(text)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        setErrorMsg('No speech detected. Please try again.')
      } else if (event.error === 'not-allowed') {
        setErrorMsg('Microphone access denied. Please allow microphone access.')
      } else {
        setErrorMsg(`Error: ${event.error}`)
      }
      setState('idle')
    }

    recognition.onend = () => {
      if (state === 'listening') {
        setState('idle')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setState('idle')
  }

  async function handleFinalResult(text: string) {
    setState('processing')
    try {
      await fetch('/api/search/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      })
    } catch {}
    setState('done')
    setTimeout(() => {
      navigate('search-results', { query: text, type: 'voice' })
    }, 600)
  }

  const micSize = 88
  const ringDelays = [0, 0.2, 0.4]

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <button
          onClick={() => { stopListening(); goBack() }}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <span className="text-base font-semibold">Voice Search</span>
        <button
          onClick={() => navigate('search-home')}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <Search className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Main mic area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 md:max-w-2xl md:mx-auto md:w-full">
        {state === 'unsupported' ? (
          <div className="text-center space-y-4">
            <MicOff className="w-16 h-16 text-gray-500 mx-auto" />
            <p className="text-gray-400 text-sm">Voice search is not supported in this browser.</p>
            <button
              onClick={() => navigate('search-home')}
              className="px-4 py-2 bg-red-600 rounded-xl text-sm font-medium"
            >
              Use Text Search
            </button>
          </div>
        ) : (
          <>
            {/* Mic button with rings */}
            <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
              <AnimatePresence>
                {state === 'listening' &&
                  ringDelays.map((delay, i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full border border-red-500/40"
                      initial={{ width: micSize, height: micSize, opacity: 0.8 }}
                      animate={{ width: micSize + 40 + i * 30, height: micSize + 40 + i * 30, opacity: 0 }}
                      transition={{ duration: 1.4, repeat: Infinity, delay, ease: 'easeOut' }}
                    />
                  ))}
              </AnimatePresence>

              <motion.button
                onClick={state === 'listening' ? stopListening : startListening}
                className={`relative z-10 flex items-center justify-center rounded-full shadow-2xl transition-colors ${
                  state === 'listening' ? 'bg-red-600 scale-110' : 'bg-red-600 hover:bg-red-700'
                }`}
                style={{ width: micSize, height: micSize }}
                whileTap={{ scale: 0.95 }}
              >
                {state === 'processing' ? (
                  <motion.div
                    className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                ) : state === 'listening' ? (
                  <MicOff className="w-9 h-9 text-white" />
                ) : (
                  <Mic className="w-9 h-9 text-white" />
                )}
              </motion.button>
            </div>

            {/* Status text */}
            <div className="text-center space-y-2">
              <AnimatePresence mode="wait">
                <motion.p
                  key={state}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-lg font-medium"
                >
                  {state === 'idle' && 'Tap to speak'}
                  {state === 'listening' && 'Listening...'}
                  {state === 'processing' && 'Processing...'}
                  {state === 'done' && 'Searching...'}
                </motion.p>
              </AnimatePresence>

              {transcript && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-gray-300 bg-white/10 px-4 py-2 rounded-xl max-w-xs text-center"
                >
                  &ldquo;{transcript}&rdquo;
                </motion.p>
              )}

              {errorMsg && (
                <p className="text-sm text-red-400 mt-2">{errorMsg}</p>
              )}
            </div>

            {/* Suggested phrases */}
            {state === 'idle' && (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">Try saying:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedPhrases.map(phrase => (
                    <button
                      key={phrase}
                      onClick={() => handleFinalResult(phrase)}
                      className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full transition text-gray-300"
                    >
                      &ldquo;{phrase}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Voice history */}
      {voiceHistory.length > 0 && (
        <div className="px-4 pb-10">
          <p className="text-xs text-gray-500 mb-2">Recent voice searches</p>
          <div className="space-y-1">
            {voiceHistory.map(item => (
              <button
                key={item.id}
                onClick={() => navigate('search-results', { query: item.query, type: 'voice' })}
                className="w-full text-left text-sm text-gray-300 px-3 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition flex items-center gap-2"
              >
                <Mic className="w-3.5 h-3.5 text-gray-500" />
                {item.query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default VoiceSearchPage
