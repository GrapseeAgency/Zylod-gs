'use client'

import { useNavigationStore } from '@/store/navigation-store'
import { Store, Shield, CreditCard, Banknote, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

const B2B_SERVICES = [
  { icon: Store, label: 'Verified Suppliers', desc: 'Verified & trade assured', color: '#E53935' },
  { icon: Shield, label: 'Secure Transactions', desc: 'Trade assurance protection', color: '#1976D2' },
  { icon: CreditCard, label: 'Flexible Payments', desc: 'bKash, Nagad, Bank', color: '#388E3C' },
  { icon: Banknote, label: 'Credit Lines', desc: 'Net-30/60 payment terms', color: '#F57C00' },
]

export function MobileB2BServices() {
  const { navigate } = useNavigationStore()

  return (
    <section className="mt-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55 }}
        className="bg-card rounded-xl border border-border/50 p-4"
      >
        <p className="text-sm font-bold text-primary mb-3">B2B Services</p>

        <div className="space-y-2.5">
          {B2B_SERVICES.map((service) => {
            const ServiceIcon = service.icon
            return (
              <button
                key={service.label}
                onClick={() => navigate('suppliers')}
                className="flex items-center gap-3 w-full text-left active:scale-[0.98] transition-transform"
              >
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${service.color}10` }}
                >
                  <ServiceIcon className="h-4.5 w-4.5" style={{ color: service.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{service.label}</p>
                  <p className="text-[10px] text-muted-foreground">{service.desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            )
          })}
        </div>

        <Button
          variant="outline"
          className="w-full text-xs font-semibold mt-3 border-primary text-primary"
          onClick={() => navigate('suppliers')}
        >
          Find Suppliers <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </motion.div>
    </section>
  )
}
