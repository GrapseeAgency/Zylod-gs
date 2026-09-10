/**
 * Web Audio API Sound Synthesizer for Notifications.
 * Generates realistic acoustic chimes, pulses, and haptic vibration feedback directly in-browser.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  /** Standard wholesale alert double-chime */
  public playDefault() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now) // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12) // A5

    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(880, now + 0.12)
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.28) // D6

    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start(now)
    osc1.stop(now + 0.12)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.45)

    this.vibrate([40, 60, 40])
  }

  /** Soft acoustic chime */
  public playChime() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(523.25, now) // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08) // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16) // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.24) // C6

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.6)

    this.vibrate([30])
  }

  /** Urgent / Out for delivery chime */
  public playUrgent() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.setValueAtTime(1046.5, now + 0.1)
    osc.frequency.setValueAtTime(1318.51, now + 0.2)

    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.4)

    this.vibrate([80, 50, 80])
  }

  /** Vibrate device if supported */
  public vibrate(pattern: number[] = [50]) {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern)
      } catch {}
    }
  }

  public playByName(name: string) {
    if (name === 'silent') return
    if (name === 'vibrate') {
      this.vibrate([80, 60, 80])
      return
    }
    if (name === 'chime') {
      this.playChime()
      return
    }
    this.playDefault()
  }
}

export const soundEffects = new SoundSynthesizer()
