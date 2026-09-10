import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'buyer' | 'supplier' | 'admin' | null

interface UserProfile {
  id: string
  userType: UserRole
  email: string | null
  phone: string | null
  fullName: string | null
  businessName: string | null
  avatarUrl: string | null
  isProfileComplete: boolean
  profileCompletionPct: number
  // Supplier-specific
  verificationStatus?: string
  rejectionReason?: string
  companyName?: string
  supplierSlug?: string
}

interface AuthState {
  isAuthenticated: boolean
  user: UserProfile | null
  token: string | null
  
  login: (user: UserProfile, token: string) => void
  logout: () => Promise<void>
  updateUser: (updates: Partial<UserProfile>) => void
  setToken: (token: string) => void
  /** Fetch fresh user profile from /api/profile/me */
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,

      login: (user, token) => {
        set({ isAuthenticated: true, user, token })
      },

      logout: async () => {
        try {
          // Call the real logout API
          await fetch('/api/auth/logout', { method: 'POST' })
        } catch {
          // Ignore API errors on logout
        }
        set({ isAuthenticated: false, user: null, token: null })
      },

      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }))
      },

      setToken: (token) => {
        set({ token })
      },

      refreshProfile: async () => {
        const { token, isAuthenticated } = get()
        if (!isAuthenticated || !token) return

        try {
          const res = await fetch('/api/profile/me', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.data) {
              const u = data.data
              set({
                user: {
                  id: u.id,
                  userType: u.userType,
                  email: u.email,
                  phone: u.phone,
                  fullName: u.fullName || u.buyerProfile?.fullName || u.supplierProfile?.contactPersonName || null,
                  businessName: u.supplierProfile?.companyName || null,
                  avatarUrl: u.avatarUrl || null,
                  isProfileComplete: u.isProfileComplete ?? false,
                  profileCompletionPct: u.profileCompletionPct ?? 0,
                  verificationStatus: u.supplierProfile?.verificationStatus,
                  rejectionReason: u.supplierProfile?.rejectionReason ?? null,
                  companyName: u.supplierProfile?.companyName,
                  supplierSlug: u.supplierProfile?.slug,
                },
              })
            }
          }
        } catch {
          // Silent fail — keep existing profile
        }
      },
    }),
    {
      name: 'b2b-auth-storage',
    }
  )
)
