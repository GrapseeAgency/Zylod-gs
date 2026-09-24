'use client'

import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore, CURRENCIES, type CurrencyCode } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Linkedin,
  Send,
  CreditCard,
  Users,
  Zap,
  ChevronRight,
  Globe,
  MessageCircle,
  Heart,
  Store,
  FileText,
  Scale,
  BadgeCheck,
  Truck,
  Banknote,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

export function Footer() {
  const { navigate } = useNavigationStore()
  const { currentCurrency, setCurrency, formatPrice } = useCurrencyStore()
  const [email, setEmail] = useState('')

  const handleSubscribe = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        toast.success(data.data?.alreadySubscribed ? 'You are already subscribed.' : 'Successfully subscribed!')
        setEmail('')
      } else {
        toast.error(data?.error || 'Subscription failed. Please try again later.')
      }
    } catch {
      toast.error('Network error — could not reach the subscription service.')
    }
  }

  const currencyInfo = CURRENCIES[currentCurrency]

  return (
    <footer className="mt-auto bg-muted">
      {/* ─── Newsletter Subscription Bar ─── */}
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div className="flex items-center gap-3 flex-1">
              <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0 bg-primary-foreground/20">
                <Send className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="font-bold text-lg text-primary-foreground">
                  Get wholesale deals & market updates
                </p>
                <p className="text-sm text-primary-foreground/80">
                  Subscribe to our newsletter for exclusive offers, new supplier listings, and market insights.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                className="h-11 min-w-[220px] bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50 focus:border-primary-foreground"
              />
              <Button
                onClick={handleSubscribe}
                className="h-11 px-6 font-semibold bg-primary-foreground text-primary hover:bg-primary-foreground/90 shrink-0"
              >
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Footer - 5 Columns ─── */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-6">
          {/* Column 1 - BRAND INFO */}
          <div className="space-y-5 lg:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/zylod-logo.svg" alt="Zylod" className="h-10 w-auto" />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A B2B wholesale marketplace for Bangladesh. Suppliers list products, buyers order in bulk, and every order stays UNPAID until its payment is verified.
            </p>
            {/* Trust Badges */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Real verification status per supplier
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Payments verified before orders confirmed
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Delivery terms set by each supplier
                </span>
              </div>
            </div>
            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://facebook.com/zylod"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-full flex items-center justify-center bg-background border border-border transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary text-muted-foreground"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com/zylod"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-full flex items-center justify-center bg-background border border-border transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary text-muted-foreground"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://linkedin.com/company/zylod"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-full flex items-center justify-center bg-background border border-border transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary text-muted-foreground"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Column 2 - MARKETPLACE & SEARCH */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-foreground flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              MARKETPLACE
            </h3>
            <div className="flex flex-col gap-1">
              <FooterLink onClick={() => navigate('category-navigation')}>
                Category Directory
              </FooterLink>
              <FooterLink onClick={() => navigate('search-home')}>
                Wholesale Search
              </FooterLink>
              <FooterLink onClick={() => navigate('barcode-scanner')}>
                Barcode Scanner
              </FooterLink>
              <FooterLink onClick={() => navigate('voice-search')}>
                Voice Search
              </FooterLink>
              <FooterLink onClick={() => navigate('popular-searches')}>
                Popular Searches
              </FooterLink>
              <FooterLink onClick={() => navigate('flash-sale')}>
                Flash Deals
              </FooterLink>
              <FooterLink onClick={() => navigate('daily-deals')}>
                Daily Deals
              </FooterLink>
              <FooterLink onClick={() => navigate('coupons')}>
                Coupons & Offers
              </FooterLink>
              <FooterLink onClick={() => navigate('suppliers')}>
                Verified Suppliers
              </FooterLink>
            </div>
          </div>

          {/* Column 3 - FOR BUYERS */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-foreground flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              FOR BUYERS
            </h3>
            <div className="flex flex-col gap-1">
              <FooterLink onClick={() => navigate('register-buyer')}>
                Register as Buyer
              </FooterLink>
              <FooterLink onClick={() => navigate('buyer-dashboard')}>
                Buyer Dashboard
              </FooterLink>
              <FooterLink onClick={() => navigate('my-orders')}>
                My Orders & Consignments
              </FooterLink>
              <FooterLink onClick={() => navigate('wishlist')}>
                Wishlist & Saved
              </FooterLink>
              <FooterLink onClick={() => navigate('collections')}>
                My Collections
              </FooterLink>
              <FooterLink onClick={() => navigate('escrow-protection-guide')}>
                How Payments Work
              </FooterLink>
              <FooterLink onClick={() => navigate('buyer-protection-policy')}>
                Buyer Protection Guarantee
              </FooterLink>
              <FooterLink onClick={() => navigate('rfq-list')}>
                RFQ Quote Requests
              </FooterLink>
            </div>
          </div>

          {/* Column 4 - FOR SUPPLIERS */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-foreground flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" />
              FOR SUPPLIERS
            </h3>
            <div className="flex flex-col gap-1">
              <FooterLink onClick={() => navigate('seller-registration')}>
                Register as Supplier
              </FooterLink>
              <FooterLink onClick={() => navigate('seller-dashboard')}>
                Seller Dashboard
              </FooterLink>
              <FooterLink onClick={() => navigate('seller-storefront')}>
                Storefront Manager
              </FooterLink>
              <FooterLink onClick={() => navigate('add-product')}>
                Add Wholesale Product
              </FooterLink>
              <FooterLink onClick={() => navigate('seller-verification')}>
                KYC & Trade License
              </FooterLink>
              <FooterLink onClick={() => navigate('bulk-upload-products')}>
                Bulk CSV Upload
              </FooterLink>
              <FooterLink onClick={() => navigate('seller-analytics')}>
                Sales & Performance
              </FooterLink>
              <FooterLink onClick={() => navigate('seller-payouts')}>
                Bank Payouts
              </FooterLink>
            </div>
          </div>

          {/* Column 5 - SUPPORT & HELP (Pages 159-170) */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              SUPPORT & HELP
            </h3>
            <div className="flex flex-col gap-1">
              <FooterLink onClick={() => navigate('help-center')}>
                Help Center Hub
              </FooterLink>
              <FooterLink onClick={() => navigate('faq')}>
                Frequently Asked Questions
              </FooterLink>
              <FooterLink onClick={() => navigate('contact-us')}>
                Contact Support Team
              </FooterLink>
              <FooterLink onClick={() => navigate('live-chat')}>
                Live Chat Support
              </FooterLink>
              <FooterLink onClick={() => navigate('chatbot')}>
                AI Wholesale Assistant
              </FooterLink>
              <FooterLink onClick={() => navigate('submit-ticket')}>
                Submit Support Ticket
              </FooterLink>
              <FooterLink onClick={() => navigate('safety-center')}>
                Safety & Trust Center
              </FooterLink>
              <FooterLink onClick={() => navigate('community-guidelines')}>
                Community Guidelines
              </FooterLink>
              <FooterLink onClick={() => navigate('report-problem')}>
                Report a Bug / Glitch
              </FooterLink>
              <FooterLink onClick={() => navigate('report-user')}>
                Report Violation / Fraud
              </FooterLink>
              <FooterLink onClick={() => navigate('feedback-suggestions')}>
                Feedback & Suggestions
              </FooterLink>
            </div>
          </div>
        </div>
      </div>

      {/* ─── FULL DOCUMENTATION & POLICY LIBRARY (AMAZON / STRIPE TIER) ─── */}
      <div className="container mx-auto px-4 pb-8">
        <div className="rounded-2xl p-6 sm:p-8 bg-card border border-border shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-border pb-4">
            <div>
              <h3 className="font-bold text-base tracking-tight uppercase text-foreground flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                WHOLESALE POLICIES & OFFICIAL DOCUMENTATION
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compliant with the Bangladesh Digital Commerce Operation Guidelines & Ministry of Commerce directives.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('docs-browser')}
              className="text-xs font-semibold self-start sm:self-auto gap-1 border-primary/30 text-primary hover:bg-primary/5"
            >
              <FileText className="h-3.5 w-3.5" />
              Open Full Docs Explorer
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3">
            <FooterLink onClick={() => navigate('terms-of-service')} size="xs">
              Terms of Service
            </FooterLink>
            <FooterLink onClick={() => navigate('privacy-policy')} size="xs">
              Privacy Policy & GDPR
            </FooterLink>
            <FooterLink onClick={() => navigate('return-policy')} size="xs">
              Return & Refund Policy
            </FooterLink>
            <FooterLink onClick={() => navigate('shipping-policy')} size="xs">
              Shipping & Freight Policy
            </FooterLink>
            <FooterLink onClick={() => navigate('payment-terms')} size="xs">
              Payment Terms & Escrow
            </FooterLink>
            <FooterLink onClick={() => navigate('wholesale-terms')} size="xs">
              Wholesale Trade Agreement
            </FooterLink>
            <FooterLink onClick={() => navigate('cookie-policy')} size="xs">
              Cookie Preferences
            </FooterLink>
            <FooterLink onClick={() => navigate('dmca-policy')} size="xs">
              DMCA & IP Protection
            </FooterLink>
            <FooterLink onClick={() => navigate('about-us')} size="xs">
              About Zylod
            </FooterLink>
            <FooterLink onClick={() => navigate('careers-page')} size="xs">
              Careers & Jobs
            </FooterLink>
            <FooterLink onClick={() => navigate('press-media')} size="xs">
              Press & Media Hub
            </FooterLink>
            <FooterLink onClick={() => navigate('investor-relations')} size="xs">
              Investor Relations
            </FooterLink>
            <FooterLink onClick={() => navigate('sitemap')} size="xs">
              Platform Sitemap
            </FooterLink>
            <FooterLink onClick={() => navigate('escrow-protection-guide')} size="xs">
              SafePay Escrow Guide
            </FooterLink>
            <FooterLink onClick={() => navigate('buyer-protection-policy')} size="xs">
              Buyer Protection
            </FooterLink>
            <FooterLink onClick={() => navigate('seller-verification-guide')} size="xs">
              Seller KYC & Trade License
            </FooterLink>
            <FooterLink onClick={() => navigate('dispute-resolution-guide')} size="xs">
              Dispute & Arbitration
            </FooterLink>
            <FooterLink onClick={() => navigate('community-guidelines')} size="xs">
              Fair Trading Standards
            </FooterLink>
          </div>
        </div>
      </div>

      {/* ─── Contact & Currency Row ─── */}
      <div className="container mx-auto px-4 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              CONTACT US
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">
                  support@zylod.com
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">
                  +880 1711-000000
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Gulshan-2, Dhaka 1212, Bangladesh
                </span>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <a
                  href="https://wa.me/8801700000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-green-600"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <a
                  href="https://t.me/zylod"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-blue-500"
                  aria-label="Telegram"
                >
                  <Send className="h-4 w-4" />
                  Telegram
                </a>
              </div>
            </div>
          </div>

          {/* Currency Selector */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-foreground flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              CURRENCY
            </h3>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Display prices in your preferred currency. All transactions are processed in BDT.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-primary">
                  {currencyInfo.symbol}
                </span>
                <Select
                  value={currentCurrency}
                  onValueChange={(val) => setCurrency(val as CurrencyCode)}
                >
                  <SelectTrigger className="w-[200px] h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CURRENCIES).map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.symbol} {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: {formatPrice(1000)} (= ৳1,000 BDT)
              </p>
            </div>
          </div>

          {/* Quick Links & Resources */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              RESOURCES
            </h3>
            <div className="flex flex-col gap-1">
              <FooterLink onClick={() => navigate('about')} size="xs">
                About Zylod
              </FooterLink>
              <FooterLink onClick={() => navigate('careers')} size="xs">
                Careers
              </FooterLink>
              <FooterLink onClick={() => navigate('press')} size="xs">
                Press & Media
              </FooterLink>
              <FooterLink onClick={() => navigate('blog')} size="xs">
                Blog
              </FooterLink>
              <FooterLink onClick={() => navigate('events')} size="xs">
                Events
              </FooterLink>
              <FooterLink onClick={() => navigate('partner-program')} size="xs">
                Partner Program
              </FooterLink>
              <FooterLink onClick={() => navigate('welcome')} size="xs">
                Onboarding Guide
              </FooterLink>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Separator ─── */}
      <div className="container mx-auto px-4">
        <Separator />
      </div>

      {/* ─── Bottom Bar: Payment Methods + Copyright + Legal ─── */}
      <div className="container mx-auto px-4 py-5">
        <div className="flex flex-col gap-5">
          {/* Payment Methods — branded logo badges */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
                Pay With
              </span>
            </div>
            <div className="w-px h-6 bg-border hidden sm:block" />
            <div className="flex items-center gap-2 flex-wrap">
              {/* bKash */}
              <div className="inline-flex items-center justify-center h-10 min-w-[64px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="bKash">
                <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
                  <path d="M8 4c2-2 5-1 6 1s1 5-1 7c-2 1-5 0-6-2s-1-4 1-6z" fill="#E2136E"/>
                  <path d="M6 8c1-1 3 0 4 1s1 3 0 4c-1 2-3 1-4 0s-1-3 0-5z" fill="#E2136E" opacity=".7"/>
                  <text x="18" y="14" fontSize="8" fontWeight="700" fill="#E2136E">bKash</text>
                </svg>
              </div>
              {/* Nagad */}
              <div className="inline-flex items-center justify-center h-10 min-w-[64px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="Nagad">
                <svg width="48" height="20" viewBox="0 0 48 20" fill="none">
                  <circle cx="10" cy="10" r="8" fill="#F26522"/>
                  <path d="M7 7l6 6M13 7l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <text x="22" y="14" fontSize="7" fontWeight="700" fill="#F26522">নগদ</text>
                </svg>
              </div>
              {/* Rocket */}
              <div className="inline-flex items-center justify-center h-10 min-w-[64px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="Rocket">
                <svg width="44" height="20" viewBox="0 0 44 20" fill="none">
                  <path d="M10 2l3 8-3 8c-4-2-6-6-6-8s2-6 6-8z" fill="#8C3494"/>
                  <path d="M10 6l2 4-2 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="2" fill="white"/>
                  <text x="17" y="14" fontSize="7" fontWeight="700" fill="#8C3494">রকেট</text>
                </svg>
              </div>
              {/* Upay */}
              <div className="inline-flex items-center justify-center h-10 min-w-[64px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="Upay">
                <svg width="44" height="20" viewBox="0 0 44 20" fill="none">
                  <path d="M10 3c4 0 7 3 7 7s-3 7-7 7-7-3-7-7 3-7 7-7z" fill="#1B3B7C"/>
                  <path d="M7 8h6M10 8v5" stroke="#FFD700" strokeWidth="1.8" strokeLinecap="round"/>
                  <text x="20" y="14" fontSize="7" fontWeight="700" fill="#1B3B7C">উপায়</text>
                </svg>
              </div>
              {/* Tap */}
              <div className="inline-flex items-center justify-center h-10 min-w-[52px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="Tap">
                <svg width="38" height="20" viewBox="0 0 38 20" fill="none">
                  <circle cx="10" cy="10" r="8" fill="#00A651"/>
                  <circle cx="10" cy="10" r="6" fill="none" stroke="#E3272E" strokeWidth="2"/>
                  <text x="7" y="13" fontSize="6" fontWeight="700" fill="white">tap</text>
                  <text x="20" y="14" fontSize="6" fontWeight="600" fill="#00A651">Pay</text>
                </svg>
              </div>
              {/* SureCash */}
              <div className="inline-flex items-center justify-center h-10 min-w-[72px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="SureCash">
                <svg width="64" height="20" viewBox="0 0 64 20" fill="none">
                  <rect x="1" y="3" width="18" height="14" rx="3" fill="#0066B3"/>
                  <path d="M5 10h10M10 7v6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <text x="22" y="14" fontSize="7" fontWeight="700" fill="#0066B3">SureCash</text>
                </svg>
              </div>
              {/* Visa */}
              <div className="inline-flex items-center justify-center h-10 min-w-[56px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="Visa">
                <svg width="44" height="20" viewBox="0 0 44 20" fill="none">
                  <text x="2" y="15" fontSize="12" fontWeight="800" fontStyle="italic" fill="#1A1F71">VISA</text>
                  <path d="M36 6l2 4-2 4" stroke="#F9A51A" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              {/* Mastercard */}
              <div className="inline-flex items-center justify-center h-10 min-w-[56px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="Mastercard">
                <svg width="44" height="20" viewBox="0 0 44 20" fill="none">
                  <circle cx="14" cy="10" r="7" fill="#EB001B"/>
                  <circle cx="24" cy="10" r="7" fill="#F79E1B"/>
                  <path d="M19 5.5a7 7 0 010 9" fill="#EB001B" opacity=".5"/>
                </svg>
              </div>
              {/* DBBL Nexus */}
              <div className="inline-flex items-center justify-center h-10 min-w-[64px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="DBBL Nexus">
                <svg width="52" height="20" viewBox="0 0 52 20" fill="none">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="#0066B3" strokeWidth="2"/>
                  <path d="M6 10a4 4 0 018 0" stroke="#E3272E" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M14 10a4 4 0 01-8 0" stroke="#00A651" strokeWidth="2" strokeLinecap="round"/>
                  <text x="22" y="14" fontSize="6.5" fontWeight="700" fill="#0066B3">Nexus</text>
                </svg>
              </div>
              {/* SSLCommerz */}
              <div className="inline-flex items-center justify-center h-10 min-w-[80px] px-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" title="SSLCommerz">
                <svg width="72" height="20" viewBox="0 0 72 20" fill="none">
                  <rect x="1" y="2" width="18" height="16" rx="3" fill="#0033A0"/>
                  <path d="M5 10h4M7 8v4M12 10h4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M13 7l2 3-2 3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                  <text x="22" y="14" fontSize="7" fontWeight="700" fill="#0033A0">SSLCommerz</text>
                </svg>
              </div>
            </div>
          </div>

          {/* Copyright + Legal Links */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              &copy; 2026 Zylod. All rights reserved.
              {/* Custom heart icon for "Made with love" */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block">
                <path d="M7 12.5s-5.5-3.5-5.5-7A3 3 0 017 3.5a3 3 0 015.5 2c0 3.5-5.5 7-5.5 7z" fill="#C8102E"/>
              </svg>
              <span className="font-medium">Made in Bangladesh</span>
              {/* Custom Bangladesh flag icon */}
              <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline-block">
                <rect width="16" height="11" rx="1.5" fill="#006A4E"/>
                <circle cx="6" cy="5.5" r="3.5" fill="#F42A41"/>
              </svg>
            </p>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <button
                onClick={() => navigate('privacy-policy')}
                className="transition-colors hover:text-primary"
              >
                Privacy
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('terms-of-service')}
                className="transition-colors hover:text-primary"
              >
                Terms
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('cookie-policy')}
                className="transition-colors hover:text-primary"
              >
                Cookies
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('return-policy')}
                className="transition-colors hover:text-primary"
              >
                Refunds
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('shipping-policy')}
                className="transition-colors hover:text-primary"
              >
                Shipping
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('payment-terms')}
                className="transition-colors hover:text-primary"
              >
                Payment Terms
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('wholesale-terms')}
                className="transition-colors hover:text-primary"
              >
                Wholesale Terms
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('dmca-policy')}
                className="transition-colors hover:text-primary"
              >
                DMCA
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('about-us')}
                className="transition-colors hover:text-primary"
              >
                About Us
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('careers-page')}
                className="transition-colors hover:text-primary"
              >
                Careers
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('press-media')}
                className="transition-colors hover:text-primary"
              >
                Press
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('investor-relations')}
                className="transition-colors hover:text-primary"
              >
                Investors
              </button>
              <span className="text-border">•</span>
              <button
                onClick={() => navigate('sitemap')}
                className="transition-colors hover:text-primary font-bold text-primary"
              >
                Sitemap
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ─── Reusable Footer Link Component ─── */
function FooterLink({
  children,
  onClick,
  size = 'sm',
}: {
  children: React.ReactNode
  onClick: () => void
  size?: 'sm' | 'xs'
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-1 text-left transition-all duration-200 text-muted-foreground hover:text-primary hover:translate-x-1 ${
        size === 'xs' ? 'text-xs py-0.5' : 'text-sm py-1'
      }`}
    >
      <ChevronRight className={`text-primary/0 group-hover:text-primary transition-all duration-200 -ml-2 group-hover:ml-0 ${size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
      {children}
    </button>
  )
}
