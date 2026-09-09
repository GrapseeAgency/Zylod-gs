'use client'

import { useState, useCallback, useEffect } from 'react'

/* ─── Math CAPTCHA ─── */
export interface MathCaptcha {
  question: string
  answer: number
  id: string
}

export function generateMathCaptcha(): MathCaptcha {
  const operations = ['+', '-', '×'] as const
  const op = operations[Math.floor(Math.random() * operations.length)]
  
  let a: number, b: number, answer: number
  
  switch (op) {
    case '+':
      a = Math.floor(Math.random() * 50) + 10
      b = Math.floor(Math.random() * 50) + 10
      answer = a + b
      break
    case '-':
      a = Math.floor(Math.random() * 50) + 30
      b = Math.floor(Math.random() * 30) + 1
      answer = a - b
      break
    case '×':
      a = Math.floor(Math.random() * 12) + 2
      b = Math.floor(Math.random() * 12) + 2
      answer = a * b
      break
  }
  
  return {
    question: `${a} ${op} ${b} = ?`,
    answer,
    id: `captcha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  }
}

export function verifyCaptcha(captcha: MathCaptcha, userAnswer: string): boolean {
  const parsed = parseInt(userAnswer.trim(), 10)
  return !isNaN(parsed) && parsed === captcha.answer
}

/* ─── Password Entropy Calculator ─── */
export interface PasswordStrength {
  score: number // 0-4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
  color: string
  percent: number
  entropy: number
  suggestions: string[]
  crackTime: string
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: 'Very Weak', color: '#EF4444', percent: 0, entropy: 0, suggestions: ['Enter a password'], crackTime: 'Instantly' }
  }
  
  // Calculate Shannon entropy
  let charsetSize = 0
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)
  
  if (hasLower) charsetSize += 26
  if (hasUpper) charsetSize += 26
  if (hasDigit) charsetSize += 10
  if (hasSpecial) charsetSize += 32
  
  const entropy = Math.max(0, password.length * Math.log2(Math.max(charsetSize, 1)))
  
  // Score based on entropy
  let score: number
  if (entropy < 28) score = 0
  else if (entropy < 36) score = 1
  else if (entropy < 60) score = 2
  else if (entropy < 80) score = 3
  else score = 4
  
  const labels: PasswordStrength['label'][] = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#16A34A']
  const percents = [10, 25, 50, 75, 100]
  
  // Crack time estimation
  const guessesPerSecond = 1e10 // 10 billion guesses/sec (modern GPU)
  const totalCombinations = Math.pow(charsetSize, password.length)
  const secondsToCrack = totalCombinations / guessesPerSecond / 2
  
  let crackTime: string
  if (secondsToCrack < 1) crackTime = 'Instantly'
  else if (secondsToCrack < 60) crackTime = `${Math.round(secondsToCrack)} seconds`
  else if (secondsToCrack < 3600) crackTime = `${Math.round(secondsToCrack / 60)} minutes`
  else if (secondsToCrack < 86400) crackTime = `${Math.round(secondsToCrack / 3600)} hours`
  else if (secondsToCrack < 86400 * 30) crackTime = `${Math.round(secondsToCrack / 86400)} days`
  else if (secondsToCrack < 86400 * 365) crackTime = `${Math.round(secondsToCrack / (86400 * 30))} months`
  else if (secondsToCrack < 86400 * 365 * 1000) crackTime = `${Math.round(secondsToCrack / (86400 * 365))} years`
  else if (secondsToCrack < 86400 * 365 * 1e9) crackTime = `${Math.round(secondsToCrack / (86400 * 365 * 1000))} thousand years`
  else if (secondsToCrack < 86400 * 365 * 1e12) crackTime = `${Math.round(secondsToCrack / (86400 * 365 * 1e9))} billion years`
  else crackTime = 'Centuries+'
  
  // Suggestions
  const suggestions: string[] = []
  if (password.length < 8) suggestions.push('Use at least 8 characters')
  if (!hasLower) suggestions.push('Add lowercase letters')
  if (!hasUpper) suggestions.push('Add uppercase letters')
  if (!hasDigit) suggestions.push('Add numbers')
  if (!hasSpecial) suggestions.push('Add special characters (!@#$%)')
  if (/(.)\1{2,}/.test(password)) suggestions.push('Avoid repeated characters')
  if (/^[a-zA-Z]/.test(password) && password.length < 12) suggestions.push('Longer passwords are stronger')
  
  return {
    score,
    label: labels[score],
    color: colors[score],
    percent: percents[score],
    entropy: Math.round(entropy),
    suggestions,
    crackTime
  }
}

/* ─── Client-side Rate Limiter ─── */
export interface RateLimitState {
  attempts: number
  lastAttempt: number
  lockedUntil: number | null
}

const RATE_LIMIT_KEY = 'zylod-auth-ratelimit'
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes
const ATTEMPT_WINDOW = 5 * 60 * 1000 // 5 minutes

export function getRateLimitState(): RateLimitState {
  if (typeof window === 'undefined') return { attempts: 0, lastAttempt: 0, lockedUntil: null }
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { attempts: 0, lastAttempt: 0, lockedUntil: null }
}

export function recordFailedAttempt(): RateLimitState {
  const state = getRateLimitState()
  const now = Date.now()
  
  // Reset if outside window
  if (now - state.lastAttempt > ATTEMPT_WINDOW) {
    const newState = { attempts: 1, lastAttempt: now, lockedUntil: null }
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newState))
    return newState
  }
  
  const newAttempts = state.attempts + 1
  const lockedUntil = newAttempts >= MAX_ATTEMPTS ? now + LOCKOUT_DURATION : null
  
  const newState = { attempts: newAttempts, lastAttempt: now, lockedUntil }
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newState))
  return newState
}

export function resetRateLimit(): void {
  localStorage.removeItem(RATE_LIMIT_KEY)
}

export function isRateLimited(): { limited: boolean; remainingMs: number; attemptsRemaining: number } {
  const state = getRateLimitState()
  const now = Date.now()
  
  if (state.lockedUntil && now < state.lockedUntil) {
    return { limited: true, remainingMs: state.lockedUntil - now, attemptsRemaining: 0 }
  }
  
  if (state.lockedUntil && now >= state.lockedUntil) {
    resetRateLimit()
    return { limited: false, remainingMs: 0, attemptsRemaining: MAX_ATTEMPTS }
  }
  
  // Reset if outside window
  if (now - state.lastAttempt > ATTEMPT_WINDOW) {
    return { limited: false, remainingMs: 0, attemptsRemaining: MAX_ATTEMPTS }
  }
  
  return { limited: false, remainingMs: 0, attemptsRemaining: MAX_ATTEMPTS - state.attempts }
}

/* ─── Backup Code Generator ─── */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const part1 = Math.floor(1000 + Math.random() * 9000).toString()
    const part2 = Math.floor(1000 + Math.random() * 9000).toString()
    codes.push(`${part1}-${part2}`)
  }
  return codes
}

/* ─── React Hook: useMathCaptcha ─── */
export function useMathCaptcha() {
  const [captcha, setCaptcha] = useState<MathCaptcha>(generateMathCaptcha())
  const [userAnswer, setUserAnswer] = useState('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  
  const refresh = useCallback(() => {
    setCaptcha(generateMathCaptcha())
    setUserAnswer('')
    setIsValid(null)
  }, [])
  
  const validate = useCallback((): boolean => {
    const valid = verifyCaptcha(captcha, userAnswer)
    setIsValid(valid)
    if (!valid) {
      // Refresh on wrong answer
      setTimeout(() => {
        setCaptcha(generateMathCaptcha())
        setUserAnswer('')
        setIsValid(null)
      }, 1500)
    }
    return valid
  }, [captcha, userAnswer])
  
  return { captcha, userAnswer, setUserAnswer, isValid, validate, refresh }
}

/* ─── React Hook: useCountdown ─── */
export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds)
  const [isRunning, setIsRunning] = useState(true)
  
  useEffect(() => {
    if (!isRunning || remaining <= 0) return
    
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [isRunning, remaining])
  
  const reset = useCallback((newSeconds?: number) => {
    setRemaining(newSeconds ?? seconds)
    setIsRunning(true)
  }, [seconds])
  
  const formatTime = useCallback((secs: number): string => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }, [])
  
  return { remaining, isRunning, reset, formatted: formatTime(remaining) }
}
