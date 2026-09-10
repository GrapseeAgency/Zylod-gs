'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Clock, CheckCircle2, Truck, Package, AlertTriangle,
  Activity, Shield, Settings, Edit3, HardHat, Wrench, Boxes,
  Archive, FileText, Camera, Search, Loader2, Check, ChevronRight,
  MapPin, Calendar, Star, Bell, BarChart3, Zap, RefreshCw, X,
  Hash, Award, Layers, Building2, CheckSquare, Download, Radio,
  Phone, MessageSquare, TrendingUp, TrendingDown, ScanLine,
  Warehouse, ClipboardCheck, QrCode, Eye, Send, User, FileCheck2
} from 'lucide-react'

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────────
interface ScanEvent {
  id: string
  barcode: string
  productName?: string
  scannedAt: string
  action: string
  dockId?: string
}

interface AssignedVehicle {
  id: string
  plateNumber: string
  driverName: string
  route: string
  status: string
  eta?: string
}

interface QcRejection {
  id: string
  productName: string
  reason: string
  severity: string
  reportedAt: string
  quantity: number
}

interface ShiftLog {
  id: string
  date: string
  clockIn: string
  clockOut?: string
  hoursWorked?: number
  tasksCompleted: number
}

// ─── SMALL STAT PILL ──────────────────────────────────────────────────────────
function StaffStatCard({
  icon: Icon,
  value,
  label,
  sub,
  color = 'primary',
}: {
  icon: React.ElementType
  value: string
  label: string
  sub?: string
  color?: string
}) {
  const iconMap: Record<string, string> = {
    primary: 'bg-rose-50 border-rose-100 text-primary',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    sky: 'bg-sky-50 border-sky-100 text-sky-600',
    slate: 'bg-slate-100 border-slate-200 text-slate-600',
    violet: 'bg-violet-50 border-violet-100 text-violet-600',
  }

  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-3">
      <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${iconMap[color] || iconMap.primary}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-black text-slate-900 font-mono leading-none">{value}</div>
        <span className="text-[11px] font-bold text-slate-400 block mt-1 uppercase tracking-wider">{label}</span>
        {sub && <span className="text-[10px] text-slate-400 block">{sub}</span>}
      </div>
    </div>
  )
}

// ─── MAIN STAFF PROFILE PAGE ──────────────────────────────────────────────────
export function StaffProfilePage() {
  const { navigate } = useNavigationStore()
  const { user, token } = useAuthStore()

  // Active tab
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'shifts' | 'scans' | 'vehicles' | 'qc' | 'incidents' | 'customs' | 'handover'
  >('dashboard')

  // Clock state
  const [clockedIn, setClockedIn] = useState(false)
  const [clockTime, setClockTime] = useState<Date | null>(null)
  const [clockDuration, setClockDuration] = useState('0:00:00')

  // Data
  const [scanHistory, setScanHistory] = useState<ScanEvent[]>([])
  const [vehicles, setVehicles] = useState<AssignedVehicle[]>([])
  const [qcRejections, setQcRejections] = useState<QcRejection[]>([])
  const [shiftLogs, setShiftLogs] = useState<ShiftLog[]>([])
  const [loadingScans, setLoadingScans] = useState(false)

  // Incident form
  const [incidentTitle, setIncidentTitle] = useState('')
  const [incidentDesc, setIncidentDesc] = useState('')
  const [incidentSeverity, setIncidentSeverity] = useState('medium')
  const [submittingIncident, setSubmittingIncident] = useState(false)
  const [incidentSubmitted, setIncidentSubmitted] = useState(false)

  // Handover form
  const [handoverNotes, setHandoverNotes] = useState('')
  const [generatingHandover, setGeneratingHandover] = useState(false)
  const [handoverGenerated, setHandoverGenerated] = useState(false)

  // QC rejection form
  const [qcProductId, setQcProductId] = useState('')
  const [qcReason, setQcReason] = useState('')
  const [qcQuantity, setQcQuantity] = useState(1)
  const [submittingQc, setSubmittingQc] = useState(false)

  // ─── CLOCK DURATION TICKER ─────────────────────────────────────────────────
  useEffect(() => {
    if (!clockedIn || !clockTime) return
    const interval = setInterval(() => {
      const diff = Date.now() - clockTime.getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setClockDuration(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [clockedIn, clockTime])

  // ─── FETCH FUNCTIONS ───────────────────────────────────────────────────────
  const fetchScans = useCallback(async () => {
    if (!token) return
    setLoadingScans(true)
    try {
      const res = await fetch('/api/staff/scans?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) setScanHistory(json.data)
      }
    } catch {
      // Graceful
    } finally {
      setLoadingScans(false)
    }
  }, [token])

  const fetchVehicles = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/staff/vehicles?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) setVehicles(json.data)
      }
    } catch {
      // Graceful
    }
  }, [token])

  const fetchQcRejections = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/staff/qc-rejections?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) setQcRejections(json.data)
      }
    } catch {
      // Graceful
    }
  }, [token])

  const fetchShiftLogs = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/staff/shifts?limit=14', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) setShiftLogs(json.data)
      }
    } catch {
      // Graceful
    }
  }, [token])

  useEffect(() => {
    if (activeTab === 'scans') fetchScans()
    if (activeTab === 'vehicles') fetchVehicles()
    if (activeTab === 'qc') fetchQcRejections()
    if (activeTab === 'shifts') fetchShiftLogs()
  }, [activeTab, fetchScans, fetchVehicles, fetchQcRejections, fetchShiftLogs])

  // ─── CLOCK IN / OUT ────────────────────────────────────────────────────────
  const handleClockToggle = async () => {
    const now = new Date()
    if (clockedIn) {
      setClockedIn(false)
      setClockTime(null)
      if (token) {
        await fetch('/api/staff/shifts/clock-out', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ clockOut: now.toISOString() }),
        }).catch(() => {})
      }
    } else {
      setClockedIn(true)
      setClockTime(now)
      if (token) {
        await fetch('/api/staff/shifts/clock-in', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ clockIn: now.toISOString() }),
        }).catch(() => {})
      }
    }
  }

  // ─── SUBMIT INCIDENT ───────────────────────────────────────────────────────
  const submitIncident = async () => {
    if (!incidentTitle.trim()) return
    setSubmittingIncident(true)
    try {
      if (token) {
        await fetch('/api/staff/incidents', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: incidentTitle,
            description: incidentDesc,
            severity: incidentSeverity,
          }),
        })
      }
      setIncidentSubmitted(true)
      setIncidentTitle('')
      setIncidentDesc('')
      setTimeout(() => setIncidentSubmitted(false), 3000)
    } catch {
      // Graceful
    } finally {
      setSubmittingIncident(false)
    }
  }

  // ─── SUBMIT QC REJECTION ──────────────────────────────────────────────────
  const submitQcRejection = async () => {
    if (!qcProductId.trim() || !qcReason.trim()) return
    setSubmittingQc(true)
    try {
      if (token) {
        await fetch('/api/staff/qc-rejections', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: qcProductId, reason: qcReason, quantity: qcQuantity }),
        })
      }
      setQcProductId('')
      setQcReason('')
      setQcQuantity(1)
      fetchQcRejections()
    } catch {
      // Graceful
    } finally {
      setSubmittingQc(false)
    }
  }

  // ─── GENERATE HANDOVER REPORT ─────────────────────────────────────────────
  const generateHandover = async () => {
    setGeneratingHandover(true)
    try {
      if (token) {
        await fetch('/api/staff/handover', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: handoverNotes }),
        })
      }
      setHandoverGenerated(true)
      setTimeout(() => setHandoverGenerated(false), 3000)
    } catch {
      // Graceful
    } finally {
      setGeneratingHandover(false)
    }
  }

  const fullName = user?.fullName || 'Staff Member'

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('home')} className="md:hidden p-1 text-slate-700" title="Home">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <span className="text-lg font-black tracking-tight text-primary">Zylod</span>
            <span className="text-[9px] font-bold text-slate-400 block -mt-0.5 uppercase tracking-widest">
              Staff Operations
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {clockedIn && (
            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {clockDuration}
            </span>
          )}
          <button
            onClick={() => navigate('account-settings')}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-3xl">
        {/* ─── STAFF IDENTITY CARD ─────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200">
          <div className="h-20 bg-gradient-to-r from-slate-800 to-slate-900 relative overflow-hidden">
            <div className="absolute top-3 left-3">
              <span className="bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1.5">
                <Warehouse className="h-3 w-3 text-slate-300" />
                Warehouse &amp; Logistics Operations
              </span>
            </div>
          </div>

          <div className="px-4 pb-4 -mt-8 space-y-3">
            <div className="flex items-end justify-between">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden ring-2 ring-slate-200 flex items-center justify-center bg-slate-100">
                  <HardHat className="h-8 w-8 text-slate-600" />
                </div>
              </div>

              {/* Clock In/Out Button */}
              <Button
                onClick={handleClockToggle}
                className={`h-11 px-5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all ${
                  clockedIn
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <Clock className="h-4 w-4" />
                {clockedIn ? 'Clock Out' : 'Clock In'}
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{fullName}</h1>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  clockedIn
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${clockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {clockedIn ? 'On Duty' : 'Off Duty'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Warehouse &amp; Logistics Staff</p>
            </div>
          </div>
        </div>

        {/* ─── TAB NAVIGATION (CLEAN ICONS, NO EMOJIS) ──────────────────── */}
        <div className="sticky top-[57px] z-30 bg-white border-b border-slate-100 shadow-xs">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-3 py-2">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { key: 'shifts', label: 'Shift Log', icon: Clock },
              { key: 'scans', label: 'Barcode Scans', icon: ScanLine },
              { key: 'vehicles', label: 'Vehicles', icon: Truck },
              { key: 'qc', label: 'QC Rejections', icon: ClipboardCheck },
              { key: 'incidents', label: 'Incident Report', icon: AlertTriangle },
              { key: 'customs', label: 'Customs Checklist', icon: FileCheck2 },
              { key: 'handover', label: 'Shift Handover', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-primary text-white shadow-xs font-black'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* ═══════════════════════════════════════════════════════════
                  TAB 1: DASHBOARD
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'dashboard' && (
                <>
                  <div className={`rounded-3xl p-5 shadow-lg space-y-3 ${clockedIn ? 'bg-gradient-to-br from-emerald-800 to-emerald-900' : 'bg-gradient-to-br from-slate-800 to-slate-900'}`}>
                    <div className="flex items-center justify-between text-white">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">Shift Timer</span>
                        <h2 className="text-xl font-black mt-0.5">{clockedIn ? clockDuration : 'Ready to Clock In'}</h2>
                      </div>
                      <Clock className="h-8 w-8 text-white/80" />
                    </div>
                    <Button
                      onClick={handleClockToggle}
                      className={`w-full font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2 ${
                        clockedIn ? 'bg-rose-500 text-white' : 'bg-white text-emerald-800'
                      }`}
                    >
                      {clockedIn ? 'End Shift — Clock Out' : 'Start Shift — Clock In'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <StaffStatCard icon={ScanLine} value={String(scanHistory.length)} label="Scans Logged" color="sky" />
                    <StaffStatCard icon={Truck} value={String(vehicles.length)} label="Fleet Assigned" color="emerald" />
                    <StaffStatCard icon={AlertTriangle} value={String(qcRejections.length)} label="QC Events" color="amber" />
                    <StaffStatCard icon={CheckCircle2} value="Active" label="System Ready" color="primary" />
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 2: SHIFT LOG
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'shifts' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Recent Shift Attendance
                    </h2>
                    {shiftLogs.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {shiftLogs.map((log) => (
                          <div key={log.id} className="py-2.5 flex justify-between text-xs">
                            <span className="font-bold text-slate-800">{log.date}</span>
                            <span className="text-slate-500 font-mono">{log.clockIn} - {log.clockOut || 'Active'}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-4 text-center">No previous shift records found. Clock in to log current shift.</p>
                    )}
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 3: SCANS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'scans' && (
                <>
                  <Button
                    onClick={() => navigate('qr-scanner')}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2"
                  >
                    <ScanLine className="h-4 w-4" />
                    Open Barcode Scanner Camera
                  </Button>

                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <ScanLine className="h-4 w-4 text-primary" />
                      Scan Activity History
                    </h2>
                    {scanHistory.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {scanHistory.map((s) => (
                          <div key={s.id} className="py-2.5 flex justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800 block">{s.productName || s.barcode}</span>
                              <span className="text-[10px] text-slate-400">{s.action}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{new Date(s.scannedAt).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-4 text-center">No recent scan activity recorded.</p>
                    )}
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 4: VEHICLES
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'vehicles' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      Active Dispatch Vehicles
                    </h2>
                    {vehicles.length > 0 ? (
                      <div className="space-y-2">
                        {vehicles.map((v) => (
                          <div key={v.id} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-slate-900 block">{v.plateNumber}</span>
                              <span className="text-[10px] text-slate-500">Driver: {v.driverName} • Route: {v.route}</span>
                            </div>
                            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                              {v.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-4 text-center">No vehicles currently assigned to this dock.</p>
                    )}
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 5: QC REJECTIONS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'qc' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      Log Quality Control Rejection
                    </h2>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Product SKU / Barcode</label>
                        <Input
                          value={qcProductId}
                          onChange={(e) => setQcProductId(e.target.value)}
                          placeholder="e.g. SKU-10023"
                          className="h-10 rounded-xl text-xs mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Defect Reason</label>
                        <Input
                          value={qcReason}
                          onChange={(e) => setQcReason(e.target.value)}
                          placeholder="e.g. Surface defect, packaging damaged, dimension error"
                          className="h-10 rounded-xl text-xs mt-1"
                        />
                      </div>
                      <Button
                        onClick={submitQcRejection}
                        disabled={submittingQc || !qcProductId.trim() || !qcReason.trim()}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-xl text-xs"
                      >
                        Submit QC Rejection Log
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 6: INCIDENTS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'incidents' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      Report Warehouse Incident
                    </h2>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Incident Summary</label>
                        <Input
                          value={incidentTitle}
                          onChange={(e) => setIncidentTitle(e.target.value)}
                          placeholder="Brief description of incident"
                          className="h-10 rounded-xl text-xs mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Detailed Report</label>
                        <textarea
                          rows={3}
                          value={incidentDesc}
                          onChange={(e) => setIncidentDesc(e.target.value)}
                          placeholder="Location, equipment involved, and actions taken..."
                          className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs resize-none focus:outline-none focus:border-primary mt-1"
                        />
                      </div>
                      <Button
                        onClick={submitIncident}
                        disabled={submittingIncident || !incidentTitle.trim()}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-2"
                      >
                        {incidentSubmitted ? <><Check className="h-4 w-4" /> Incident Submitted</> : 'Submit Incident Report'}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 7: CUSTOMS CHECKLIST
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'customs' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-primary" />
                      Freight Customs Document Checklist
                    </h2>
                    <div className="space-y-2 text-xs">
                      {[
                        'Commercial Invoice verified',
                        'Bill of Lading / Consignment note attached',
                        'Packing manifest matches carton count',
                        'Certificate of Origin validated',
                        'VAT / Tax declaration signed',
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-slate-50 last:border-0">
                          <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-slate-800 font-semibold">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 8: HANDOVER
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'handover' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Shift Handover Note
                    </h2>
                    <textarea
                      rows={4}
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="Notes for next shift supervisor regarding pending dock arrivals or equipment..."
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs resize-none focus:outline-none focus:border-primary"
                    />
                    <Button
                      onClick={generateHandover}
                      disabled={generatingHandover}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-2"
                    >
                      {handoverGenerated ? <><Check className="h-4 w-4" /> Handover Report Sent</> : 'Submit Handover Report'}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
