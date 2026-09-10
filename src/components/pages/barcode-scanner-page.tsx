'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { isNativeAndroidApp, scanBarcodeWithNativeCamera } from '@/lib/native-bridge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Zap, ZapOff, QrCode, ShoppingCart, ArrowLeft, RefreshCw, Package } from 'lucide-react'

interface ScannedProduct {
  id: string
  name: string
  sku: string
  basePrice: number
  currency: string
  unit: string
  moq: number
  thumbnailUrl?: string
  stockQuantity: number
  supplier: { companyName: string }
}

type ScanMode = 'barcode' | 'qr'
type ScanState = 'idle' | 'scanning' | 'processing' | 'found' | 'not-found' | 'error'

export function BarcodeScannerPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [mode, setMode] = useState<ScanMode>('barcode')
  const [manualEntry, setManualEntry] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scannedCode, setScannedCode] = useState('')
  const [product, setProduct] = useState<ScannedProduct | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectRafRef = useRef<number | null>(null)
  const lastDetectRef = useRef(0)
  // Inside the Android shell the native MLKit scanner is faster and more
  // reliable than any in-browser decoding.
  const [nativeMode] = useState(() => isNativeAndroidApp())

  useEffect(() => {
    if (nativeMode) {
      launchNativeScan()
      return
    }
    startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function launchNativeScan() {
    setScanState('scanning')
    try {
      const code = await scanBarcodeWithNativeCamera()
      if (code) {
        lookupCode(code)
      } else {
        // User closed the scanner without a result.
        setScanState('idle')
      }
    } catch {
      setCameraError('Native scanner unavailable')
      setScanState('idle')
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setScanState('scanning')
      startBrowserDetection()
    } catch {
      setCameraError('Camera access denied or unavailable')
      setScanState('idle')
    }
  }

  /** Live decoding via the platform BarcodeDetector API when available. */
  function startBrowserDetection() {
    const detectorCtor = (window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
    if (!detectorCtor || !videoRef.current) return
    let detector: InstanceType<typeof detectorCtor>
    try {
      detector = new detectorCtor()
    } catch {
      return
    }
    const step = (timestamp: number) => {
      if (!streamRef.current || !videoRef.current) return
      if (timestamp - lastDetectRef.current > 350) {
        lastDetectRef.current = timestamp
        detector.detect(videoRef.current)
          .then(codes => {
            const value = codes?.[0]?.rawValue
            if (value) lookupCode(value)
          })
          .catch(() => {
            // Transient per-frame decode failures are expected; keep scanning.
          })
      }
      detectRafRef.current = requestAnimationFrame(step)
    }
    detectRafRef.current = requestAnimationFrame(step)
  }

  function stopCamera() {
    if (detectRafRef.current !== null) {
      cancelAnimationFrame(detectRafRef.current)
      detectRafRef.current = null
    }
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }

  async function toggleTorch() {
    const next = !torchOn
    setTorchOn(next)
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints)
    } catch {
      // Device has no controllable torch — the icon state is cosmetic only.
    }
  }

  async function lookupCode(code: string) {
    if (!code.trim()) return
    const trimmed = code.trim()
    setScannedCode(trimmed)
    setScanState('processing')
    stopCamera()

    try {
      const res = await fetch(`/api/search/barcode?code=${encodeURIComponent(trimmed)}`)
      if (!res.ok) throw new Error('Not found')
      const json = await res.json()
      if (json.data) {
        setProduct(json.data)
        setScanState('found')
      } else {
        setScanState('not-found')
      }
    } catch {
      setScanState('not-found')
    }
  }

  async function handleFileUpload(file: File) {
    setScanState('processing')
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await fetch('/api/search/barcode', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.data?.product) {
        setProduct(json.data.product)
        setScannedCode(json.data.code || '')
        setScanState('found')
      } else {
        setScanState('not-found')
      }
    } catch {
      setScanState('not-found')
    }
  }

  function reset() {
    setScanState('idle')
    setProduct(null)
    setScannedCode('')
    setManualCode('')
    if (nativeMode) {
      launchNativeScan()
    } else {
      startCamera()
    }
  }

  const isActiveScanning = scanState === 'scanning'

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-12 pb-3 md:pt-4 md:max-w-3xl md:mx-auto">
        <button
          onClick={() => { stopCamera(); goBack() }}
          className="p-2 rounded-full bg-black/40 backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-semibold">Scan Barcode</span>
        {!nativeMode ? (
          <button
            onClick={toggleTorch}
            className="p-2 rounded-full bg-black/40 backdrop-blur-sm"
          >
            {torchOn ? <Zap className="w-5 h-5 text-yellow-400" /> : <ZapOff className="w-5 h-5 text-white" />}
          </button>
        ) : <span className="w-9" />}
      </div>

      {/* Camera viewfinder */}
      <div className="relative flex-1 bg-gray-900 overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <QrCode className="w-12 h-12 text-gray-500 mb-3" />
            <p className="text-gray-300 text-sm mb-4">{cameraError}</p>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="text-white border-white/30">
              Upload Image Instead
            </Button>
          </div>
        ) : nativeMode ? (
          <button
            onClick={launchNativeScan}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900"
          >
            <QrCode className="w-12 h-12 text-gray-500" />
            <span className="text-gray-300 text-sm">Tap to scan with camera</span>
          </button>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        )}

        {/* Scan frame overlay */}
        {(scanState === 'scanning' || scanState === 'idle') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              {/* Corner brackets */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => (
                <div
                  key={corner}
                  className={`absolute w-8 h-8 border-red-500 ${
                    corner === 'top-left' ? 'top-0 left-0 border-t-2 border-l-2' :
                    corner === 'top-right' ? 'top-0 right-0 border-t-2 border-r-2' :
                    corner === 'bottom-left' ? 'bottom-0 left-0 border-b-2 border-l-2' :
                    'bottom-0 right-0 border-b-2 border-r-2'
                  }`}
                />
              ))}
              {/* Scanning line */}
              <AnimatePresence>
                {isActiveScanning && (
                  <motion.div
                    className="absolute left-1 right-1 h-0.5 bg-red-500 shadow-red-500 shadow-sm"
                    initial={{ top: 4 }}
                    animate={{ top: ['4px', '252px', '4px'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Processing overlay */}
        {scanState === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <motion.div
              className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-white text-sm mt-3">Looking up product...</p>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="bg-gray-900 px-4 pt-4 pb-8 space-y-4 md:w-full md:max-w-3xl md:mx-auto md:pb-6">
        {/* Mode tabs */}
        <div className="flex gap-2 justify-center">
          {(['barcode', 'qr'] as ScanMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                mode === m ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-400'
              }`}
            >
              {m === 'barcode' ? 'Barcode' : 'QR Code'}
            </button>
          ))}
        </div>

        {/* Found product card */}
        {scanState === 'found' && product && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-white overflow-hidden">
              <CardContent className="p-3 flex gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                  {product.thumbnailUrl ? (
                    <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                  <p className="text-sm font-bold text-red-600 mt-1">{formatPrice(product.basePrice)}/{product.unit}</p>
                  <p className="text-xs text-gray-400">Stock: {product.stockQuantity} units available</p>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-2 mt-2">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-sm"
                onClick={() => navigate('product-detail', { productId: product.id })}
              >
                View Product
              </Button>
              <Button variant="outline" size="icon" onClick={reset} className="border-white/20 text-white">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {scanState === 'not-found' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-2">
            <p className="text-gray-300 text-sm">
              {scannedCode ? `No product found for code: ${scannedCode}` : 'No matching product found'}
            </p>
            <Button onClick={reset} variant="outline" size="sm" className="border-white/20 text-white">
              Scan Again
            </Button>
          </motion.div>
        )}

        {/* Manual entry */}
        {(scanState === 'scanning' || scanState === 'idle' || scanState === 'not-found') && (
          <div className="space-y-2">
            {!manualEntry ? (
              <button
                onClick={() => setManualEntry(true)}
                className="w-full text-center text-xs text-gray-400 underline"
              >
                Enter barcode manually
              </button>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter barcode or SKU..."
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookupCode(manualCode)}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-gray-500 text-sm"
                />
                <Button
                  onClick={() => lookupCode(manualCode)}
                  className="bg-red-600 hover:bg-red-700 text-sm px-3"
                >
                  Search
                </Button>
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-center text-xs text-gray-500 underline"
            >
              Upload barcode image
            </button>
          </div>
        )}

        <p className="text-xs text-center text-gray-600">
          Point camera at any product barcode or QR code
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      />
    </div>
  )
}

export default BarcodeScannerPage
