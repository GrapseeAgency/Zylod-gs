'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useNotificationStore } from '@/store/notification-store'
import {
  useSuppliers, useConversations, useMessages, useRfqs, useAddresses,
  useAdminUsers, useAdminProducts, verifySupplier, updateUserStatus, updateProductApproval,
  sendMessage, uploadChatAttachment, createConversation, useSupplierDetail, useSupplierProducts,
  type SupplierListItem, type ChatConversation, type ChatMessage, type RfqItem, type Address,
  type AdminUser, type AdminProduct, type SupplierDetail, type SupplierProduct,
} from '@/lib/use-api'
import { hasNativeVoiceRecognition, recognizeSpeechWithNative } from '@/lib/native-bridge'
import {
  ArrowLeft, Truck, Wallet, Clock, FileText, Scale, Globe, Users, Heart,
  Megaphone, BookOpen, Mail, Phone, MessageCircle, HelpCircle, AlertTriangle, Lightbulb,
  ChevronRight, Building2, Star, Package, BadgeCheck, Search, Filter,
  TrendingUp, BarChart3, Settings, Warehouse, Eye, Ban, UserCheck, Edit, Trash2, Plus,
  Upload, XCircle, AlertCircle, ArrowUpRight, Download, Store, MapPin, Award,
  ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, ExternalLink, Save, Bell, BellOff,
  Languages, Lock, Unlock, Crown, Target, Zap, Gift, Shield, PieChart, LineChart,
  Activity, ShoppingBag, DollarSign, UserPlus, RefreshCw, Box, ArrowUpDown,
  Inbox, ClipboardCheck,
  TrendingDown, Percent, CalendarDays, FileBarChart, LayoutGrid, List, Palette, Link,
  Send, MessageSquare, Home, CheckCircle2, Navigation, Building, Handshake, Info,
  Paperclip, X, CornerUpLeft, Image as ImageIcon, CheckCheck,
  Camera, Mic, MicOff, ScanLine, Loader2,
} from 'lucide-react'

interface InfoSection { title: string; content: string; icon: React.ReactNode }

interface InfoConfig {
  name: string; description: string; icon: React.ReactNode; sections: InfoSection[];
  quickLinks?: { label: string; pageId: string }[]; specialType?: string
}

const INFO_CONFIGS: Record<string, InfoConfig> = {
  'terms': { name: 'Terms of Service', description: 'Terms and conditions for using Zylod', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: '1. Acceptance of Terms', content: 'By using Zylod, you agree to these terms. All wholesale transactions are governed by BD commercial law.', icon: <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span> },
    { title: '2. User Accounts', content: 'Buyers and suppliers must register with verified information. Account suspension may occur for violations.', icon: <Users className="h-4 w-4" /> },
    { title: '3. Transaction Rules', content: 'All orders are subject to MOQ requirements. Payment must be completed via approved methods (bKash, Nagad, bank transfer).', icon: <Wallet className="h-4 w-4" /> },
    { title: '4. Dispute Resolution', content: 'Disputes are handled through our arbitration process. Both parties must provide documentation within 48 hours.', icon: <Scale className="h-4 w-4" /> },
    { title: '5. Liability', content: 'Zylod acts as a marketplace platform. We are not liable for product quality — sellers bear full responsibility.', icon: <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span> },
  ] },
  'privacy': { name: 'Privacy Policy', description: 'How we protect your data and privacy', icon: <span className="material-symbols-outlined text-white" style={{ fontSize: 32, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span>, sections: [
    { title: 'Data Collection', content: 'We collect name, email, phone, and business details needed for wholesale transactions. Location data is optional.', icon: <Users className="h-4 w-4" /> },
    { title: 'Data Usage', content: 'Your data is used solely for order processing, supplier verification, and platform improvement. No third-party sharing without consent.', icon: <Lightbulb className="h-4 w-4" /> },
    { title: 'Data Protection', content: 'All data is encrypted and stored securely. We follow Bangladesh Data Protection Act 2023 guidelines.', icon: <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span> },
  ] },
  'refund-policy': { name: 'Refund Policy', description: 'Our refund and return process for wholesale orders', icon: <Truck className="h-8 w-8 text-white" />, sections: [
    { title: 'Refund Eligibility', content: 'Products damaged during shipping or not matching specifications are eligible for full refund within 7 days of delivery.', icon: <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span> },
    { title: 'Refund Process', content: 'Submit refund request with photos/videos. Approved refunds are processed within 5 business days to your original payment method.', icon: <Clock className="h-4 w-4" /> },
    { title: 'Bulk Order Returns', content: 'Bulk orders (MOQ+) may have different return terms per supplier. Check product listing for specific return policies.', icon: <Package className="h-4 w-4" /> },
  ] },
  'shipping-policy': { name: 'Shipping Policy', description: 'Delivery terms and logistics information', icon: <Truck className="h-8 w-8 text-white" />, sections: [
    { title: 'Delivery Zones', content: 'We deliver across all 64 districts of Bangladesh. Dhaka city: 1-2 days. Other districts: 3-7 days.', icon: <Globe className="h-4 w-4" /> },
    { title: 'Bulk Shipping', content: 'Large orders qualify for free shipping. Specialized logistics partners handle large shipments.', icon: <Truck className="h-4 w-4" /> },
    { title: 'Tracking', content: 'All orders come with real-time tracking. SMS notifications sent at each delivery milestone.', icon: <Clock className="h-4 w-4" /> },
  ] },
  'about': { name: 'About Zylod', description: 'Bangladesh\'s premier B2B wholesale marketplace', icon: <Building2 className="h-8 w-8 text-white" />, sections: [
    { title: 'Our Mission', content: 'To revolutionize B2B commerce in Bangladesh by connecting verified suppliers with wholesale buyers across all 64 districts.', icon: <Heart className="h-4 w-4" /> },
    { title: 'Our Platform', content: 'Zylod serves 50,000+ registered businesses with 200,000+ products from 5,000+ verified suppliers. Large monthly transaction volume.', icon: <Star className="h-4 w-4" /> },
    { title: 'Our Team', content: 'Founded in 2023 in Dhaka, our team of 200+ employees is dedicated to making wholesale commerce accessible and trustworthy.', icon: <Users className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Careers', pageId: 'careers' }, { label: 'Press', pageId: 'press' }, { label: 'Contact', pageId: 'contact-us' }] },
  'contact-us': { name: 'Contact Us', description: 'Get in touch with our support team', icon: <Mail className="h-8 w-8 text-white" />, sections: [
    { title: 'Customer Support', content: 'Available 24/7 via phone, email, and chat. Average response time: 15 minutes.', icon: <Phone className="h-4 w-4" /> },
    { title: 'Email', content: 'support@zylod.com — for general inquiries and order support', icon: <Mail className="h-4 w-4" /> },
    { title: 'Phone', content: '+880 1700-WHOLESALE — hotline for urgent matters (9AM-9PM BST)', icon: <Phone className="h-4 w-4" /> },
    { title: 'Office', content: 'Zylod HQ, Gulshan-2, Dhaka 1212, Bangladesh', icon: <Building2 className="h-4 w-4" /> },
  ] },
  'faq': { name: 'FAQ', description: 'Frequently asked questions about Zylod', icon: <HelpCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'How do I place a bulk order?', content: 'Browse products, select MOQ, add to cart, and checkout. Minimum order quantities are displayed on each product.', icon: <Package className="h-4 w-4" /> },
    { title: 'What payment methods are accepted?', content: 'bKash, Nagad, bank transfer (BRAC, City, Dutch-Bangla), and credit lines for verified buyers.', icon: <Wallet className="h-4 w-4" /> },
    { title: 'How are suppliers verified?', content: 'Suppliers undergo trade license verification, product quality inspection, and business reference checks.', icon: <BadgeCheck className="h-4 w-4" /> },
    { title: 'What is the refund process?', content: 'Submit refund request with evidence. Approved refunds processed in 5 business days.', icon: <Truck className="h-4 w-4" /> },
  ] },

  // ========== NEW INTERACTIVE CONFIGS ==========

  'suppliers': {
    name: 'Supplier Directory', description: 'Find and connect with verified wholesale suppliers across Bangladesh',
    icon: <Store className="h-8 w-8 text-white" />, specialType: 'suppliers',
    sections: [
      { title: 'Verified Suppliers', content: 'Browse our network of 5,000+ verified suppliers offering wholesale products across all categories.', icon: <BadgeCheck className="h-4 w-4" /> },
      { title: 'Quality Assurance', content: 'Every supplier undergoes trade license verification, product quality inspection, and business reference checks.', icon: <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span> },
    ],
    quickLinks: [{ label: 'Categories', pageId: 'category-products' }, { label: 'Chat', pageId: 'chat-list' }],
  },

  'buyer-complaints': {
    name: 'Submit a Complaint', description: 'Report issues with orders, products, or suppliers',
    icon: <AlertTriangle className="h-8 w-8 text-white" />, specialType: 'buyer-complaints',
    sections: [
      { title: 'Complaint Guidelines', content: 'Please provide detailed information and evidence to help us resolve your issue quickly.', icon: <AlertCircle className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'My Orders', pageId: 'buyer-orders' }, { label: 'Support', pageId: 'support' }],
  },

  'buyer-returns': {
    name: 'Return Request', description: 'Submit return requests for eligible orders',
    icon: <RefreshCw className="h-8 w-8 text-white" />, specialType: 'buyer-returns',
    sections: [
      { title: 'Return Policy', content: 'Items can be returned within 7 days of delivery if damaged or not matching specifications. Bulk orders may have different terms.', icon: <Truck className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'My Orders', pageId: 'buyer-orders' }, { label: 'Refund Policy', pageId: 'refund-policy' }],
  },

  'buyer-settings': {
    name: 'Account Settings', description: 'Manage your notification, language, and privacy preferences',
    icon: <Settings className="h-8 w-8 text-white" />, specialType: 'buyer-settings',
    sections: [
      { title: 'Your Preferences', content: 'Customize how you receive notifications and manage your account privacy settings.', icon: <Bell className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'My Profile', pageId: 'buyer-profile' }, { label: 'Help', pageId: 'help-center' }],
  },

  'buyer-level': {
    name: 'Buyer Level & Benefits', description: 'Track your buyer level and unlock exclusive benefits',
    icon: <Crown className="h-8 w-8 text-white" />, specialType: 'buyer-level',
    sections: [
      { title: 'Level Up', content: 'The more you buy, the higher your level. Unlock exclusive discounts, priority support, and more.', icon: <TrendingUp className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'My Orders', pageId: 'buyer-orders' }, { label: 'Rewards', pageId: 'buyer-rewards' }],
  },

  'buyer-favorites': {
    name: 'My Favorites', description: 'Your saved favorite items and suppliers',
    icon: <Heart className="h-8 w-8 text-white" />, specialType: 'buyer-favorites',
    sections: [
      { title: 'Favorites', content: 'Your favorite items are saved in your wishlist for easy access later.', icon: <Heart className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Go to Wishlist', pageId: 'wishlist' }],
  },

  'admin-users': {
    name: 'User Management', description: 'Manage platform users, roles, and permissions',
    icon: <Users className="h-8 w-8 text-white" />, specialType: 'admin-users',
    sections: [
      { title: 'User Overview', content: 'Monitor and manage all registered buyers and suppliers on the platform.', icon: <Users className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'admin-dashboard' }, { label: 'Suppliers', pageId: 'admin-suppliers' }],
  },

  'admin-products': {
    name: 'Product Review Queue', description: 'Review and approve products before they go live',
    icon: <Package className="h-8 w-8 text-white" />, specialType: 'admin-products',
    sections: [
      { title: 'Product Moderation', content: 'All new products require admin approval before appearing on the marketplace.', icon: <Eye className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'admin-dashboard' }, { label: 'Categories', pageId: 'admin-categories' }],
  },

  'admin-complaints': {
    name: 'Complaint Handling', description: 'Review and resolve user complaints',
    icon: <AlertTriangle className="h-8 w-8 text-white" />, specialType: 'admin-complaints',
    sections: [
      { title: 'Complaint Management', content: 'Track, assign, and resolve complaints from buyers and suppliers.', icon: <AlertCircle className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'admin-dashboard' }, { label: 'Users', pageId: 'admin-users' }],
  },

  'admin-reports': {
    name: 'Reports & Analytics', description: 'Platform performance reports and data export',
    icon: <FileBarChart className="h-8 w-8 text-white" />, specialType: 'admin-reports',
    sections: [
      { title: 'Platform Reports', content: 'Comprehensive reports on platform performance, revenue, and growth metrics.', icon: <BarChart3 className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'admin-dashboard' }, { label: 'Analytics', pageId: 'admin-analytics' }],
  },

  'admin-analytics': {
    name: 'Analytics Dashboard', description: 'Key platform metrics and insights',
    icon: <BarChart3 className="h-8 w-8 text-white" />, specialType: 'admin-analytics',
    sections: [
      { title: 'Platform Analytics', content: 'Real-time metrics and insights for informed decision-making.', icon: <Activity className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'admin-dashboard' }, { label: 'Reports', pageId: 'admin-reports' }],
  },

  'admin-categories': {
    name: 'Category Management', description: 'Manage product categories and subcategories',
    icon: <LayoutGrid className="h-8 w-8 text-white" />, specialType: 'admin-categories',
    sections: [
      { title: 'Categories', content: 'Organize products into well-structured categories for easy discovery.', icon: <LayoutGrid className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'admin-dashboard' }, { label: 'Products', pageId: 'admin-products' }],
  },

  'admin-settings': {
    name: 'System Settings', description: 'Configure platform-wide settings and preferences',
    icon: <Settings className="h-8 w-8 text-white" />, specialType: 'admin-settings',
    sections: [
      { title: 'System Configuration', content: 'Manage platform settings, commission rates, and email configurations.', icon: <Settings className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'admin-dashboard' }, { label: 'Analytics', pageId: 'admin-analytics' }],
  },

  'supplier-analytics': {
    name: 'Sales Analytics', description: 'Track your sales performance and revenue trends',
    icon: <TrendingUp className="h-8 w-8 text-white" />, specialType: 'supplier-analytics',
    sections: [
      { title: 'Sales Performance', content: 'Monitor your sales, revenue, and customer trends to grow your business.', icon: <TrendingUp className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'supplier-dashboard' }, { label: 'Earnings', pageId: 'supplier-earnings' }],
  },

  'supplier-warehouse': {
    name: 'Warehouse & Inventory', description: 'Manage your inventory and stock levels',
    icon: <Warehouse className="h-8 w-8 text-white" />, specialType: 'supplier-warehouse',
    sections: [
      { title: 'Inventory Management', content: 'Keep track of stock levels, manage low stock alerts, and update quantities.', icon: <Box className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'supplier-dashboard' }, { label: 'Products', pageId: 'supplier-products' }],
  },

  'supplier-insights': {
    name: 'Market Insights', description: 'Discover market trends and demand forecasts',
    icon: <Lightbulb className="h-8 w-8 text-white" />, specialType: 'supplier-insights',
    sections: [
      { title: 'Market Intelligence', content: 'Stay ahead with real-time market trends, pricing insights, and demand forecasts.', icon: <Lightbulb className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'supplier-dashboard' }, { label: 'Analytics', pageId: 'supplier-analytics' }],
  },

  'supplier-profile': {
    name: 'Supplier Profile', description: 'Company information and verification status',
    icon: <Building2 className="h-8 w-8 text-white" />, specialType: 'supplier-profile',
    sections: [
      { title: 'Company Profile', content: 'Your public-facing supplier profile with verification status and product showcase.', icon: <Building2 className="h-4 w-4" /> },
    ],
    quickLinks: [{ label: 'Dashboard', pageId: 'supplier-dashboard' }, { label: 'Products', pageId: 'supplier-products' }],
  },

  'explore': { name: 'Explore', description: 'Discover wholesale products across Bangladesh', icon: <Globe className="h-8 w-8 text-white" />, sections: [
    { title: 'Browse by Category', content: 'Explore 20+ categories from textiles to electronics, each with verified suppliers and bulk pricing.', icon: <LayoutGrid className="h-4 w-4" /> },
    { title: 'Trending Now', content: 'See what other retailers are ordering — hot products, top suppliers, and best-selling items.', icon: <TrendingUp className="h-4 w-4" /> },
    { title: 'Curated Collections', content: 'Hand-picked product bundles and seasonal sourcing guides for every business.', icon: <Box className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Categories', pageId: 'category-products' }, { label: 'Trending', pageId: 'trending-products' }, { label: 'New Arrivals', pageId: 'new-arrivals' }] },

  'category-browser': { name: 'Category Browser', description: 'Browse all wholesale categories', icon: <LayoutGrid className="h-8 w-8 text-white" />, specialType: 'category-browser', sections: [] },

  'brand-showcase': { name: 'Brand Showcase', description: 'Featured wholesale brands and manufacturers', icon: <Award className="h-8 w-8 text-white" />, sections: [
    { title: 'Featured Brands', content: 'Top-rated Bangladeshi manufacturers verified by Zylod with quality guarantees.', icon: <BadgeCheck className="h-4 w-4" /> },
    { title: 'Partner With Us', content: 'Grow your brand reach by partnering with our wholesale distribution network.', icon: <Store className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Suppliers', pageId: 'suppliers' }, { label: 'Contact', pageId: 'contact-us' }] },

  'search-results': { name: 'Search Results', description: 'Find wholesale products and suppliers', icon: <Search className="h-8 w-8 text-white" />, sections: [
    { title: 'Refine Results', content: 'Filter by category, price range, location, supplier rating, and MOQ requirements.', icon: <Filter className="h-4 w-4" /> },
    { title: 'Bulk Pricing', content: 'All results show wholesale pricing with tiered discounts for larger quantities.', icon: <Package className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'All Products', pageId: 'category-products' }, { label: 'Search Home', pageId: 'search-home' }] },

  'filter-sort': { name: 'Filter & Sort', description: 'Refine your product search', icon: <Filter className="h-8 w-8 text-white" />, sections: [
    { title: 'Filters', content: 'Narrow products by price, MOQ, supplier location, rating, and customization availability.', icon: <Filter className="h-4 w-4" /> },
    { title: 'Sort Options', content: 'Sort by popularity, price low/high, newest, and best-selling.', icon: <ArrowUpDown className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'All Products', pageId: 'category-products' }] },

  'compare': { name: 'Product Comparison', description: 'Compare wholesale products side by side', icon: <Scale className="h-8 w-8 text-white" />, sections: [
    { title: 'Compare Products', content: 'View up to 4 products side by side — price, MOQ, supplier, ratings and specs.', icon: <Scale className="h-4 w-4" /> },
    { title: 'Better Decisions', content: 'Make informed bulk sourcing decisions with clear data comparisons.', icon: <Lightbulb className="h-4 w-4" /> },
  ] },

  'product-reviews': { name: 'Product Reviews', description: 'Read buyer reviews of wholesale products', icon: <Star className="h-8 w-8 text-white" />, sections: [
    { title: 'Buyer Feedback', content: 'Real reviews from retailers who purchased in bulk, with ratings and photos.', icon: <Star className="h-4 w-4" /> },
    { title: 'Share Your Experience', content: 'Write a review to help other buyers make better sourcing decisions.', icon: <ThumbsUp className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Write Review', pageId: 'write-review' }] },

  'product-qa': { name: 'Product Q&A', description: 'Questions and answers about products', icon: <HelpCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'Ask Questions', content: 'Ask suppliers about quality, MOQ, lead times, and customization before ordering.', icon: <MessageCircle className="h-4 w-4" /> },
    { title: 'Verified Answers', content: 'Suppliers respond to questions within 24 hours for verified listings.', icon: <BadgeCheck className="h-4 w-4" /> },
  ] },
  'write-review': { name: 'Write Review', description: 'Share your product experience', icon: <Edit className="h-8 w-8 text-white" />, specialType: 'write-review', sections: [
    { title: 'Rate Your Purchase', content: 'Rate product quality, packaging, and delivery speed.', icon: <Star className="h-4 w-4" /> },
    { title: 'Add Details', content: 'Include photos and notes to help other wholesale buyers.', icon: <Upload className="h-4 w-4" /> },
  ] },
  'upload-review-photos': { name: 'Upload Review Photos', description: 'Add photos to your review', icon: <Upload className="h-8 w-8 text-white" />, sections: [
    { title: 'Photo Guidelines', content: 'Upload clear photos of the product, packaging, and delivered batch.', icon: <Upload className="h-4 w-4" /> },
  ] },
  'product-specifications': { name: 'Product Specifications', description: 'Detailed product specifications', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Specs', content: 'Materials, dimensions, packaging, and compliance details for each product.', icon: <FileText className="h-4 w-4" /> },
  ] },
  'size-guide': { name: 'Size Guide', description: 'Sizing information for garments', icon: <LayoutGrid className="h-8 w-8 text-white" />, sections: [
    { title: 'Sizing Charts', content: 'Standard size charts for garments and apparel for accurate bulk ordering.', icon: <LayoutGrid className="h-4 w-4" /> },
  ] },
  'bulk-pricing': { name: 'Bulk Pricing Tiers', description: 'Tiered wholesale pricing', icon: <BarChart3 className="h-8 w-8 text-white" />, sections: [
    { title: 'Tiered Discounts', content: 'Larger quantities unlock lower per-unit prices — check each product tier.', icon: <TrendingDown className="h-4 w-4" /> },
  ] },
  'wholesale-catalog': { name: 'Wholesale Catalog', description: 'Complete B2B product catalog', icon: <BookOpen className="h-8 w-8 text-white" />, sections: [
    { title: 'Full Catalog', content: 'Every wholesale product available on Zylod with live pricing.', icon: <BookOpen className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'All Products', pageId: 'category-products' }] },
  'similar-products': { name: 'Similar Products', description: 'Find similar wholesale products', icon: <Package className="h-8 w-8 text-white" />, sections: [
    { title: 'Alternatives', content: 'Similar products from other suppliers so you can compare and choose.', icon: <Package className="h-4 w-4" /> },
  ] },
  'frequently-bought': { name: 'Frequently Bought Together', description: 'Commonly ordered product bundles', icon: <ShoppingBag className="h-8 w-8 text-white" />, sections: [
    { title: 'Bundles', content: 'Products frequently ordered together, bundled for convenience and savings.', icon: <ShoppingBag className="h-4 w-4" /> },
  ] },
  'product-variants': { name: 'Product Variants', description: 'Available product variants', icon: <LayoutGrid className="h-8 w-8 text-white" />, sections: [
    { title: 'Variants', content: 'Sizes, colors, and configurations available for each product.', icon: <LayoutGrid className="h-4 w-4" /> },
  ] },
  'quick-order': { name: 'Quick Order', description: 'Fast reorder by SKU', icon: <Zap className="h-8 w-8 text-white" />, sections: [
    { title: 'Quick Reorder', content: 'Enter product IDs or SKUs to quickly rebuild a previous order.', icon: <Zap className="h-4 w-4" /> },
  ] },
  'add-to-cart-confirm': { name: 'Added to Cart', description: 'Product added to your cart', icon: <ShoppingBag className="h-8 w-8 text-white" />, sections: [
    { title: 'Item Added', content: 'Your bulk order was added. Review your cart or continue shopping.', icon: <ShoppingBag className="h-4 w-4" /> },
    { title: 'Next Steps', content: 'Proceed to checkout, apply coupons, or add more products at wholesale pricing.', icon: <ChevronRight className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Cart', pageId: 'cart' }, { label: 'Checkout', pageId: 'checkout' }] },
  'bulk-order': { name: 'Bulk Order Form', description: 'Place a bulk wholesale order', icon: <Package className="h-8 w-8 text-white" />, sections: [
    { title: 'Bulk Quantities', content: 'Order above MOQ for tiered wholesale pricing across multiple products.', icon: <Package className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Checkout', pageId: 'checkout' }] },
  'buy-now': { name: 'Buy Now', description: 'Instant checkout', icon: <DollarSign className="h-8 w-8 text-white" />, sections: [
    { title: 'Instant Purchase', content: 'Skip the cart and go straight to checkout at the listed MOQ.', icon: <DollarSign className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Checkout', pageId: 'checkout' }] },
  'order-confirmation': { name: 'Order Confirmation', description: 'Your order is confirmed', icon: <BadgeCheck className="h-8 w-8 text-white" />, sections: [
    { title: 'Order Placed', content: 'Your wholesale order has been confirmed and forwarded to the supplier.', icon: <BadgeCheck className="h-4 w-4" /> },
    { title: 'What Next', content: 'Track your order, chat with the supplier, and manage payments from your dashboard.', icon: <Clock className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Track Order', pageId: 'track-order' }, { label: 'My Orders', pageId: 'my-orders' }] },
  'order-summary': { name: 'Order Summary', description: 'Review your order before checkout', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Review Items', content: 'Confirm quantities, tier pricing, shipping method, and total before paying.', icon: <FileText className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Checkout', pageId: 'checkout' }, { label: 'Cart', pageId: 'cart' }] },
  'coupon-promo': { name: 'Coupon & Promo Code', description: 'Apply coupons to your order', icon: <Gift className="h-8 w-8 text-white" />, sections: [
    { title: 'Apply a Coupon', content: 'Enter promo codes at checkout to unlock discounts on your bulk order.', icon: <Gift className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Coupons', pageId: 'coupons' }] },
  'apply-credits': { name: 'Apply Credits', description: 'Use your wallet credit', icon: <Wallet className="h-8 w-8 text-white" />, sections: [
    { title: 'Use Credits', content: 'Apply available wallet credit toward your order at checkout.', icon: <Wallet className="h-4 w-4" /> },
  ] },
  'gift-card': { name: 'Gift Card Redemption', description: 'Redeem a gift card', icon: <Gift className="h-8 w-8 text-white" />, sections: [
    { title: 'Redeem Gift Card', content: 'Enter your gift card code to add credit to your wallet.', icon: <Gift className="h-4 w-4" /> },
  ] },
  'split-payment': { name: 'Split Payment', description: 'Split your payment across methods', icon: <Wallet className="h-8 w-8 text-white" />, sections: [
    { title: 'Split Across Methods', content: 'Pay using a combination of wallet credit, cards, and bank transfer.', icon: <Wallet className="h-4 w-4" /> },
  ] },
  'installment-payment': { name: 'Installment Payment', description: 'Pay in installments', icon: <CalendarDays className="h-8 w-8 text-white" />, sections: [
    { title: 'Flexible Payment', content: 'Eligible customers can split large orders into monthly installments.', icon: <CalendarDays className="h-4 w-4" /> },
  ] },
  'review-order': { name: 'Review Order', description: 'Final order review', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Confirm Details', content: 'Verify items, quantities, addresses, and total before placing your order.', icon: <FileText className="h-4 w-4" /> },
  ] },
  'my-orders': { name: 'My Orders', description: 'Track and manage all your wholesale orders', icon: <Package className="h-8 w-8 text-white" />, sections: [
    { title: 'All Orders', content: 'View every order with status, payment, shipment, and supplier details.', icon: <Package className="h-4 w-4" /> },
    { title: 'Manage Orders', content: 'Cancel, return, track, or download invoices for any order.', icon: <Settings className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Track Order', pageId: 'track-order' }, { label: 'Cart', pageId: 'cart' }] },
  'track-order': { name: 'Track Order', description: 'Track your order in real time', icon: <Truck className="h-8 w-8 text-white" />, sections: [
    { title: 'Live Tracking', content: 'Follow your order from confirmation to delivery with live status updates.', icon: <Truck className="h-4 w-4" /> },
    { title: 'Timeline', content: 'See every milestone — processing, packaged, shipped, out for delivery, delivered.', icon: <Clock className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'My Orders', pageId: 'my-orders' }] },
  'order-timeline': { name: 'Order Timeline', description: 'Full order history', icon: <Clock className="h-8 w-8 text-white" />, sections: [
    { title: 'Milestones', content: 'Chronological updates on your order at every stage of fulfilment.', icon: <Clock className="h-4 w-4" /> },
  ] },
  'cancel-order': { name: 'Cancel Order', description: 'Cancel an order', icon: <XCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'Cancellation', content: 'Cancel eligible orders before they ship. Refunds go to your wallet.', icon: <XCircle className="h-4 w-4" /> },
  ] },
  'return-request': { name: 'Return Request', description: 'Request a return', icon: <RefreshCw className="h-8 w-8 text-white" />, specialType: 'return-request', sections: [
    { title: 'Start a Return', content: 'Submit a return within the return window with reason and details.', icon: <RefreshCw className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Refund Status', pageId: 'refund-status' }] },
  'return-detail': { name: 'Return Detail', description: 'Return request details', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Return Status', content: 'Track the status of your return and refund.', icon: <FileText className="h-4 w-4" /> },
  ] },
  'exchange-request': { name: 'Exchange Request', description: 'Request an exchange', icon: <RefreshCw className="h-8 w-8 text-white" />, sections: [
    { title: 'Exchange Items', content: 'Request a size or item exchange for eligible wholesale orders.', icon: <RefreshCw className="h-4 w-4" /> },
  ] },
  'refund-status': { name: 'Refund Status', description: 'Track your refunds', icon: <Wallet className="h-8 w-8 text-white" />, sections: [
    { title: 'Refund Progress', content: 'See the status of all your refunds — processing, approved, or completed.', icon: <Wallet className="h-4 w-4" /> },
  ] },
  'refund-detail': { name: 'Refund Detail', description: 'Refund details', icon: <Wallet className="h-8 w-8 text-white" />, sections: [
    { title: 'Refund Info', content: 'Amount, method, and timeline for an individual refund.', icon: <Wallet className="h-4 w-4" /> },
  ] },
  'order-receipt': { name: 'Order Receipt', description: 'View order receipt', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Receipt', content: 'Detailed receipt with itemized pricing, taxes, and payment method.', icon: <FileText className="h-4 w-4" /> },
  ] },
  'order-invoice': { name: 'Order Invoice', description: 'View and download invoice', icon: <FileBarChart className="h-8 w-8 text-white" />, sections: [
    { title: 'Invoice', content: 'Download a formal invoice for accounting and tax purposes.', icon: <FileBarChart className="h-4 w-4" /> },
  ] },
  'order-invoice-download': { name: 'Order Invoice Download', description: 'Download your invoice', icon: <Download className="h-8 w-8 text-white" />, sections: [
    { title: 'Download', content: 'Get your invoice as a file for your records.', icon: <Download className="h-4 w-4" /> },
  ] },
  'dispute-center': { name: 'Dispute Center', description: 'Resolve order disputes', icon: <Scale className="h-8 w-8 text-white" />, specialType: 'dispute-center', sections: [
    { title: 'File a Dispute', content: 'Open a dispute with evidence for resolution by our team.', icon: <Scale className="h-4 w-4" /> },
    { title: 'Resolution', content: 'Both parties provide documentation within 48 hours for fair arbitration.', icon: <AlertTriangle className="h-4 w-4" /> },
  ] },
  'dispute-detail': { name: 'Dispute Detail', description: 'View dispute details', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Case Details', content: 'Messages, evidence, and status of your dispute case.', icon: <FileText className="h-4 w-4" /> },
  ] },
  'raise-complaint': { name: 'Raise Complaint', description: 'Complaint about an order', icon: <AlertCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'Submit Complaint', content: 'Describe the issue with supporting details so we can assist quickly.', icon: <AlertCircle className="h-4 w-4" /> },
  ] },
  'order-feedback': { name: 'Order Feedback', description: 'Rate your order experience', icon: <ThumbsUp className="h-8 w-8 text-white" />, sections: [
    { title: 'Share Feedback', content: 'Rate delivery, packaging, and supplier service to improve the platform.', icon: <ThumbsUp className="h-4 w-4" /> },
  ] },
  'shipping-tracker': { name: 'Shipping Tracker', description: 'Track your shipment live', icon: <Truck className="h-8 w-8 text-white" />, sections: [
    { title: 'Live Shipment', content: 'Real-time location and status of your freight or parcel.', icon: <Truck className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Track Order', pageId: 'track-order' }] },
  'delivery-partner-chat': { name: 'Delivery Partner Chat', description: 'Chat with your delivery partner', icon: <MessageCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'Contact Driver', content: 'Message your delivery partner about timing and delivery details.', icon: <MessageCircle className="h-4 w-4" /> },
  ] },
  'delivery-confirmation': { name: 'Delivery Confirmation', description: 'Confirm your delivery', icon: <BadgeCheck className="h-8 w-8 text-white" />, sections: [
    { title: 'Confirm Receipt', content: 'Confirm you received your order correctly and in good condition.', icon: <BadgeCheck className="h-4 w-4" /> },
  ] },
  'delivery-photo-proof': { name: 'Delivery Photo Proof', description: 'Photo evidence of delivery', icon: <Upload className="h-8 w-8 text-white" />, sections: [
    { title: 'Photo Proof', content: 'View photos taken at delivery for verification.', icon: <Upload className="h-4 w-4" /> },
  ] },
  'missed-delivery': { name: 'Missed Delivery', description: 'Resolve a missed delivery', icon: <AlertTriangle className="h-8 w-8 text-white" />, sections: [
    { title: 'Missed Delivery', content: 'Schedule redelivery or pick up your package from a nearby point.', icon: <AlertTriangle className="h-4 w-4" /> },
  ] },
  'reschedule-delivery': { name: 'Reschedule Delivery', description: 'Change delivery time', icon: <CalendarDays className="h-8 w-8 text-white" />, sections: [
    { title: 'Pick a Time', content: 'Reschedule delivery to a convenient date and time.', icon: <CalendarDays className="h-4 w-4" /> },
  ] },
  'pickup-point-selection': { name: 'Pickup Point', description: 'Choose a pickup location', icon: <MapPin className="h-8 w-8 text-white" />, sections: [
    { title: 'Pickup Points', content: 'Choose a nearby warehouse or pickup location for your order.', icon: <MapPin className="h-4 w-4" /> },
  ] },
  'warehouse-locator': { name: 'Warehouse Locator', description: 'Find a warehouse', icon: <Warehouse className="h-8 w-8 text-white" />, sections: [
    { title: 'Locations', content: 'Find Zylod warehouses and partner hubs near you.', icon: <Warehouse className="h-4 w-4" /> },
  ] },
  'shipping-calculator': { name: 'Shipping Calculator', description: 'Estimate shipping cost', icon: <BarChart3 className="h-8 w-8 text-white" />, sections: [
    { title: 'Estimate', content: 'Estimate shipping cost by weight, destination, and method.', icon: <BarChart3 className="h-4 w-4" /> },
  ] },
  'shipping-policies': { name: 'Shipping Policies', description: 'Our shipping and delivery policies', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Policy', content: 'Delivery timelines, areas, and fees for wholesale shipping across Bangladesh.', icon: <FileText className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Track Order', pageId: 'track-order' }] },
  'import-export-tracker': { name: 'Import/Export Tracker', description: 'Track cross-border shipments', icon: <Globe className="h-8 w-8 text-white" />, sections: [
    { title: 'Cross-Border', content: 'Track import/export shipments and documentation status.', icon: <Globe className="h-4 w-4" /> },
  ] },
  'customs-clearance': { name: 'Customs Clearance', description: 'Customs status for your shipment', icon: <Shield className="h-8 w-8 text-white" />, sections: [
    { title: 'Customs Status', content: 'Check the customs clearance status of international shipments.', icon: <Shield className="h-4 w-4" /> },
  ] },
  'freight-tracking': { name: 'Freight Tracking', description: 'Track your freight', icon: <Truck className="h-8 w-8 text-white" />, sections: [
    { title: 'Freight', content: 'Track container and freight-forwarded cargo in real time.', icon: <Truck className="h-4 w-4" /> },
  ] },
  'my-profile': { name: 'My Profile', description: 'Your Zylod profile', icon: <Users className="h-8 w-8 text-white" />, sections: [
    { title: 'Profile', content: 'Your business details, verification status, and account preferences.', icon: <Users className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Edit Profile', pageId: 'edit-profile' }, { label: 'Account Settings', pageId: 'account-settings' }] },
  'edit-profile': { name: 'Edit Profile', description: 'Update your profile', icon: <Edit className="h-8 w-8 text-white" />, sections: [
    { title: 'Update Details', content: 'Edit your name, business info, and contact details.', icon: <Edit className="h-4 w-4" /> },
  ] },
  'profile-photo': { name: 'Profile Photo', description: 'Update your profile photo', icon: <Upload className="h-8 w-8 text-white" />, sections: [
    { title: 'Photo', content: 'Upload a photo for your Zylod profile.', icon: <Upload className="h-4 w-4" /> },
  ] },
  'account-settings': { name: 'Account Settings', description: 'Manage your account', icon: <Settings className="h-8 w-8 text-white" />, sections: [
    { title: 'Account', content: 'Manage password, security, linked accounts, and preferences.', icon: <Settings className="h-4 w-4" /> },
    { title: 'Security', content: 'Enable two-factor auth and review active sessions.', icon: <Lock className="h-4 w-4" /> },
  ] },
  'notification-preferences': { name: 'Notification Preferences', description: 'Control your notifications', icon: <Bell className="h-8 w-8 text-white" />, sections: [
    { title: 'Preferences', content: 'Choose which order, promo, and alert notifications you receive.', icon: <Bell className="h-4 w-4" /> },
  ] },
  'privacy-settings': { name: 'Privacy Settings', description: 'Control your privacy', icon: <Shield className="h-8 w-8 text-white" />, sections: [
    { title: 'Privacy', content: 'Manage profile visibility and data sharing preferences.', icon: <Shield className="h-4 w-4" /> },
  ] },
  'language-settings': { name: 'Language Settings', description: 'Choose your language', icon: <Languages className="h-8 w-8 text-white" />, sections: [
    { title: 'Language', content: 'Select your preferred language for the platform.', icon: <Languages className="h-4 w-4" /> },
  ] },
  'theme-settings': { name: 'Theme Settings', description: 'Choose light or dark theme', icon: <Palette className="h-8 w-8 text-white" />, sections: [
    { title: 'Theme', content: 'Switch between light and dark mode for the app.', icon: <Palette className="h-4 w-4" /> },
  ] },
  'linked-accounts': { name: 'Linked Accounts', description: 'Manage linked accounts', icon: <Link className="h-8 w-8 text-white" />, sections: [
    { title: 'Linked Accounts', content: 'Connect or remove linked accounts for sign-in.', icon: <Link className="h-4 w-4" /> },
  ] },
  'delete-account': { name: 'Delete Account', description: 'Close your account', icon: <Trash2 className="h-8 w-8 text-white" />, sections: [
    { title: 'Delete Account', content: 'Permanently close your Zylod account and data.', icon: <Trash2 className="h-4 w-4" /> },
  ] },
  'account-verification-badge': { name: 'Verification Badge', description: 'Get verified', icon: <BadgeCheck className="h-8 w-8 text-white" />, sections: [
    { title: 'Verified Badge', content: 'Complete KYC to display a verified badge on your profile.', icon: <BadgeCheck className="h-4 w-4" /> },
  ] },
  'business-profile': { name: 'Business Profile', description: 'Your business details', icon: <Building2 className="h-8 w-8 text-white" />, sections: [
    { title: 'Business Info', content: 'Company name, type, and business registration details.', icon: <Building2 className="h-4 w-4" /> },
  ] },
  'tax-information': { name: 'Tax Information', description: 'Your tax details', icon: <FileBarChart className="h-8 w-8 text-white" />, sections: [
    { title: 'Tax Info', content: 'Manage tax ID and billing information for invoicing.', icon: <FileBarChart className="h-4 w-4" /> },
  ] },
  'addresses': { name: 'Addresses', description: 'Manage your addresses', icon: <MapPin className="h-8 w-8 text-white" />, sections: [
    { title: 'Saved Addresses', content: 'Manage your shipping and billing addresses.', icon: <MapPin className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Add Address', pageId: 'add-address' }] },
  'wishlist': { name: 'Wishlist', description: 'Your saved wholesale products', icon: <Heart className="h-8 w-8 text-white" />, sections: [
    { title: 'Saved Products', content: 'Products you saved for later — check prices, MOQ, and supplier updates.', icon: <Heart className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Favorites', pageId: 'favorites' }] },
  'favorites': { name: 'Favorites', description: 'Your favorite products', icon: <Star className="h-8 w-8 text-white" />, sections: [
    { title: 'Favorites', content: 'Quick access to products and suppliers you follow.', icon: <Star className="h-4 w-4" /> },
  ] },
  'save-for-later': { name: 'Save for Later', description: 'Products saved for later', icon: <Clock className="h-8 w-8 text-white" />, sections: [
    { title: 'Saved', content: 'Items you chose to purchase at a later date.', icon: <Clock className="h-4 w-4" /> },
  ] },
  'recently-viewed': { name: 'Recently Viewed', description: 'Products you viewed recently', icon: <Eye className="h-8 w-8 text-white" />, sections: [
    { title: 'Viewed', content: 'Easily revisit products you browsed recently.', icon: <Eye className="h-4 w-4" /> },
  ] },
  'recently-searched': { name: 'Recently Searched', description: 'Your recent searches', icon: <Search className="h-8 w-8 text-white" />, sections: [
    { title: 'Searches', content: 'Review and rerun your recent product searches.', icon: <Search className="h-4 w-4" /> },
  ] },
  'collections': { name: 'Collections', description: 'Your product collections', icon: <LayoutGrid className="h-8 w-8 text-white" />, sections: [
    { title: 'Collections', content: 'Organize products into private or shared collections.', icon: <LayoutGrid className="h-4 w-4" /> },
  ] },
  'create-collection': { name: 'Create Collection', description: 'Make a new collection', icon: <Plus className="h-8 w-8 text-white" />, sections: [
    { title: 'New Collection', content: 'Create a named collection to organize your sourcing.', icon: <Plus className="h-4 w-4" /> },
  ] },
  'shared-wishlist': { name: 'Shared Wishlist', description: 'Wishlists shared with you', icon: <Users className="h-8 w-8 text-white" />, sections: [
    { title: 'Shared', content: 'Wishlists and collections shared by your team or partners.', icon: <Users className="h-4 w-4" /> },
  ] },
  'search-home': { name: 'Search Home', description: 'Search wholesale products and suppliers', icon: <Search className="h-8 w-8 text-white" />, sections: [
    { title: 'Smart Search', content: 'Search by product, category, supplier, or SKU with suggestions.', icon: <Search className="h-4 w-4" /> },
    { title: 'Voice & Image', content: 'Search by voice or by uploading a product photo.', icon: <Upload className="h-4 w-4" /> },
  ], specialType: 'search-home' },
  'voice-search': { name: 'Voice Search', description: 'Search using your voice', icon: <MessageCircle className="h-8 w-8 text-white" />, specialType: 'voice-search', sections: [
    { title: 'Voice', content: 'Speak to search for wholesale products and suppliers.', icon: <MessageCircle className="h-4 w-4" /> },
  ] },
  'image-search': { name: 'Image Search', description: 'Search by photo', icon: <Upload className="h-8 w-8 text-white" />, specialType: 'image-search', sections: [
    { title: 'Upload an Image', content: 'Upload a product photo to find matching wholesale products.', icon: <Upload className="h-4 w-4" /> },
  ] },
  'barcode-scanner': { name: 'Barcode Scanner', description: 'Scan to find products', icon: <LayoutGrid className="h-8 w-8 text-white" />, specialType: 'barcode-scanner', sections: [
    { title: 'Scan', content: 'Scan a barcode to instantly find an item and its suppliers.', icon: <LayoutGrid className="h-4 w-4" /> },
  ] },
  'search-suggestions': { name: 'Search Suggestions', description: 'Smart search suggestions', icon: <Lightbulb className="h-8 w-8 text-white" />, sections: [
    { title: 'Suggestions', content: 'Tailored suggestions based on your browsing and buying history.', icon: <Lightbulb className="h-4 w-4" /> },
  ] },
  'search-history': { name: 'Search History', description: 'Your search history', icon: <Clock className="h-8 w-8 text-white" />, sections: [
    { title: 'History', content: 'Review and clear your recent product searches.', icon: <Clock className="h-4 w-4" /> },
  ] },
  'popular-searches': { name: 'Popular Searches', description: 'Trending searches', icon: <TrendingUp className="h-8 w-8 text-white" />, sections: [
    { title: 'Trending', content: "See what's being searched across Zylod right now.", icon: <TrendingUp className="h-4 w-4" /> },
  ] },
  'category-navigation': { name: 'Category Navigation', description: 'Browse by category', icon: <LayoutGrid className="h-8 w-8 text-white" />, sections: [
    { title: 'Categories', content: 'Navigate the full category tree from top-level to niche.', icon: <LayoutGrid className="h-4 w-4" /> },
  ] },
  'notifications': { name: 'Notifications', description: 'Your notifications', icon: <Bell className="h-8 w-8 text-white" />, sections: [
    { title: 'All Notifications', content: 'Order updates, messages, price drops, and promotional alerts in one place.', icon: <Bell className="h-4 w-4" /> },
    { title: 'Mark Read', content: 'Manage unread notifications and archive history.', icon: <BellOff className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Settings', pageId: 'push-notification-settings' }], specialType: 'notifications' },
  'notification-detail': { name: 'Notification Detail', description: 'View a notification', icon: <Bell className="h-8 w-8 text-white" />, sections: [
    { title: 'Details', content: 'Full details of an individual notification and related links.', icon: <FileText className="h-4 w-4" /> },
  ] },
  'push-notification-settings': { name: 'Push Notification Settings', description: 'Manage push notifications', icon: <Bell className="h-8 w-8 text-white" />, sections: [
    { title: 'Push Settings', content: 'Control which push notifications you receive on this device.', icon: <Bell className="h-4 w-4" /> },
  ] },
  'order-updates': { name: 'Order Updates', description: 'Order status notifications', icon: <Package className="h-8 w-8 text-white" />, sections: [
    { title: 'Order Alerts', content: 'Order confirmed, shipped, delivered, and more.', icon: <Package className="h-4 w-4" /> },
  ] },
  'promo-notifications': { name: 'Promo Notifications', description: 'Promotional alerts', icon: <Megaphone className="h-8 w-8 text-white" />, sections: [
    { title: 'Promos & Deals', content: 'Flash sales, coupons, and exclusive offers.', icon: <Megaphone className="h-4 w-4" /> },
  ] },
  'price-drop-alerts': { name: 'Price Drop Alerts', description: 'Get notified on price drops', icon: <TrendingDown className="h-8 w-8 text-white" />, sections: [
    { title: 'Price Alerts', content: 'Get alerted when saved products drop in price.', icon: <TrendingDown className="h-4 w-4" /> },
  ] },
  'back-in-stock-alerts': { name: 'Back in Stock Alerts', description: 'Stock availability alerts', icon: <Package className="h-8 w-8 text-white" />, sections: [
    { title: 'Stock Alerts', content: 'Get notified when out-of-stock products return.', icon: <Package className="h-4 w-4" /> },
  ] },
  'delivery-updates': { name: 'Delivery Updates', description: 'Shipment delivery alerts', icon: <Truck className="h-8 w-8 text-white" />, sections: [
    { title: 'Delivery Alerts', content: 'Out for delivery, delivered, and missed delivery alerts.', icon: <Truck className="h-4 w-4" /> },
  ] },
  'help-center': { name: 'Help Center', description: 'Get help with Zylod', icon: <HelpCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'Browse Help', content: 'Guides on buying, selling, payments, shipping, and account help.', icon: <HelpCircle className="h-4 w-4" /> },
    { title: 'Popular Topics', content: 'Ordering, returns, refunds, verification, and shipping FAQs.', icon: <BookOpen className="h-4 w-4" /> },
    { title: 'Contact Support', content: 'Live chat, email, and phone support available 24/7.', icon: <MessageCircle className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'FAQs', pageId: 'faq' }, { label: 'Contact Us', pageId: 'contact-us' }] },
  'live-chat': { name: 'Live Chat', description: 'Chat with support in real time', icon: <MessageCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'Live Chat', content: 'Talk to a support agent immediately for quick help.', icon: <MessageCircle className="h-4 w-4" /> },
  ] },
  'chatbot': { name: 'Chatbot', description: 'Automated support assistant', icon: <HelpCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'Chatbot', content: 'Get instant answers to common questions 24/7.', icon: <HelpCircle className="h-4 w-4" /> },
  ] },
  'submit-ticket': { name: 'Submit Ticket', description: 'Open a support ticket', icon: <Plus className="h-8 w-8 text-white" />, sections: [
    { title: 'New Ticket', content: 'Describe your issue and our team will follow up.', icon: <Plus className="h-4 w-4" /> },
  ] },
  'ticket-detail': { name: 'Ticket Detail', description: 'View support ticket', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Ticket', content: 'Conversation, status, and updates on your support ticket.', icon: <FileText className="h-4 w-4" /> },
  ] },
  'report-problem': { name: 'Report a Problem', description: 'Report an issue', icon: <AlertTriangle className="h-8 w-8 text-white" />, sections: [
    { title: 'Report', content: 'Report bugs, errors, or problems you encounter.', icon: <AlertTriangle className="h-4 w-4" /> },
  ] },
  'report-user': { name: 'Report User/Seller', description: 'Report a user or seller', icon: <AlertCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'Report', content: 'Report suspicious or violating accounts with details.', icon: <AlertCircle className="h-4 w-4" /> },
  ] },
  'safety-center': { name: 'Safety Center', description: 'Stay safe on Zylod', icon: <Shield className="h-8 w-8 text-white" />, sections: [
    { title: 'Safety', content: 'Tips to avoid scams and trade safely on the platform.', icon: <Shield className="h-4 w-4" /> },
  ] },
  'community-guidelines': { name: 'Community Guidelines', description: 'Platform community rules', icon: <Users className="h-8 w-8 text-white" />, sections: [
    { title: 'Guidelines', content: 'Rules for respectful and honest B2B commerce.', icon: <Users className="h-4 w-4" /> },
  ] },
  'coupons': { name: 'Coupons', description: 'Wholesale discount coupons', icon: <Gift className="h-8 w-8 text-white" />, sections: [
    { title: 'Available Coupons', content: 'Discount codes for wholesale orders, from 10% to 20% off.', icon: <Gift className="h-4 w-4" /> },
    { title: 'How to Use', content: 'Apply coupon codes at checkout to save on your bulk orders.', icon: <ChevronRight className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'My Coupons', pageId: 'my-coupons' }] },
  'my-coupons': { name: 'My Coupons', description: 'Your saved coupons', icon: <Gift className="h-8 w-8 text-white" />, sections: [
    { title: 'My Coupons', content: 'View and manage coupons you have saved or earned.', icon: <Gift className="h-4 w-4" /> },
  ], specialType: 'my-coupons' },
  'earn-coupons': { name: 'Earn Coupons', description: 'Earn more coupons', icon: <Zap className="h-8 w-8 text-white" />, sections: [
    { title: 'Earn', content: 'Earn coupons via daily check-in, referrals, and promotions.', icon: <Zap className="h-4 w-4" /> },
  ], specialType: 'earn-coupons' },
  'spin-win': { name: 'Spin & Win', description: 'Spin the wheel for rewards', icon: <Award className="h-8 w-8 text-white" />, sections: [
    { title: 'Spin & Win', content: 'Spin daily for coupons, discounts, and loyalty points.', icon: <Award className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Loyalty Points', pageId: 'loyalty-points' }], specialType: 'spin-win' },
  'daily-checkin': { name: 'Daily Check-in', description: 'Check in daily for rewards', icon: <CalendarDays className="h-8 w-8 text-white" />, sections: [
    { title: 'Check-in', content: 'Check in every day to build a streak and earn rewards.', icon: <CalendarDays className="h-4 w-4" /> },
  ], specialType: 'daily-checkin' },
  'referral-program': { name: 'Referral Program', description: 'Refer and earn', icon: <Users className="h-8 w-8 text-white" />, sections: [
    { title: 'Refer Friends', content: 'Share your referral link and earn credits when friends order.', icon: <Users className="h-4 w-4" /> },
  ], specialType: 'referral-program' },
  'affiliate-program': { name: 'Affiliate Program', description: 'Earn as an affiliate', icon: <DollarSign className="h-8 w-8 text-white" />, sections: [
    { title: 'Affiliate', content: 'Promote wholesale products and earn commission on sales.', icon: <DollarSign className="h-4 w-4" /> },
  ] },
  'loyalty-points': { name: 'Loyalty Points', description: 'Your loyalty rewards', icon: <Crown className="h-8 w-8 text-white" />, sections: [
    { title: 'Points', content: 'Earn points on every order and redeem for discounts.', icon: <Crown className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Redeem Points', pageId: 'redeem-points' }, { label: 'Points History', pageId: 'points-history' }], specialType: 'loyalty-points' },
  'points-history': { name: 'Points History', description: 'Your points activity', icon: <FileBarChart className="h-8 w-8 text-white" />, sections: [
    { title: 'History', content: 'Track points earned and redeemed over time.', icon: <FileBarChart className="h-4 w-4" /> },
  ], specialType: 'points-history' },
  'redeem-points': { name: 'Redeem Points', description: 'Spend your loyalty points', icon: <Gift className="h-8 w-8 text-white" />, sections: [
    { title: 'Redeem', content: 'Convert points into coupons and wallet credit.', icon: <Gift className="h-4 w-4" /> },
  ], specialType: 'redeem-points' },
  'vip-membership': { name: 'VIP Membership', description: 'Exclusive VIP benefits', icon: <Crown className="h-8 w-8 text-white" />, sections: [
    { title: 'VIP', content: 'Unlock premium pricing, priority support, and exclusive deals.', icon: <Crown className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Tiers', pageId: 'membership-tiers' }] },
  'membership-tiers': { name: 'Membership Tiers', description: 'Wholesale membership levels', icon: <TrendingUp className="h-8 w-8 text-white" />, sections: [
    { title: 'Tiers', content: 'Standard, Silver, Gold, Platinum — higher tiers, bigger benefits.', icon: <TrendingUp className="h-4 w-4" /> },
  ] },
  'exclusive-deals': { name: 'Exclusive Deals', description: 'Members-only offers', icon: <Award className="h-8 w-8 text-white" />, sections: [
    { title: 'Exclusive', content: 'Special pricing and early access reserved for members.', icon: <Award className="h-4 w-4" /> },
  ] },
  'live-shopping': { name: 'Live Shopping', description: 'Buy live from suppliers', icon: <Activity className="h-8 w-8 text-white" />, sections: [
    { title: 'Live Events', content: 'Watch live product showcases and buy directly from suppliers.', icon: <Activity className="h-4 w-4" /> },
  ] },
  'mini-games': { name: 'Mini Games', description: 'Play and earn rewards', icon: <DollarSign className="h-8 w-8 text-white" />, sections: [
    { title: 'Games', content: 'Play mini games to earn coupons and points.', icon: <DollarSign className="h-4 w-4" /> },
  ] },
  'cookie-policy': { name: 'Cookie Policy', description: 'How we use cookies', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Cookies', content: 'How Zylod uses cookies to improve your experience.', icon: <FileText className="h-4 w-4" /> },
  ] },
  'dmca-policy': { name: 'DMCA Policy', description: 'Copyright policy', icon: <Scale className="h-8 w-8 text-white" />, sections: [
    { title: 'Copyright', content: 'How to report copyright or intellectual property claims.', icon: <Scale className="h-4 w-4" /> },
  ] },
  'payment-terms': { name: 'Payment Terms', description: 'Payment terms and conditions', icon: <Wallet className="h-8 w-8 text-white" />, sections: [
    { title: 'Payment', content: 'Payment methods, timelines, and terms for wholesale orders.', icon: <Wallet className="h-4 w-4" /> },
  ] },
  'wholesale-terms': { name: 'Wholesale Terms', description: 'B2B wholesale terms', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'Wholesale Terms', content: 'MOQ rules, bulk pricing, and B2B trade conditions.', icon: <FileText className="h-4 w-4" /> },
  ] },
  'about-us': { name: 'About Us', description: 'About Zylod', icon: <Building2 className="h-8 w-8 text-white" />, sections: [
    { title: 'Our Story', content: "Bangladesh's premier B2B wholesale marketplace connecting retailers with verified suppliers.", icon: <Building2 className="h-4 w-4" /> },
    { title: 'Our Mission', content: "Powering the supply chain that drives the nation's commerce forward.", icon: <Target className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Careers', pageId: 'careers' }, { label: 'Contact Us', pageId: 'contact-us' }] },
  'careers': { name: 'Careers', description: 'Join the Zylod team', icon: <Users className="h-8 w-8 text-white" />, sections: [
    { title: 'Work With Us', content: 'Open roles across engineering, operations, and growth.', icon: <Users className="h-4 w-4" /> },
  ] },
  'press': { name: 'Press & Media', description: 'Newsroom and media kit', icon: <Megaphone className="h-8 w-8 text-white" />, sections: [
    { title: 'Newsroom', content: 'Press releases, brand assets, and media contacts.', icon: <Megaphone className="h-4 w-4" /> },
  ] },
  'investor-relations': { name: 'Investor Relations', description: 'For investors', icon: <TrendingUp className="h-8 w-8 text-white" />, sections: [
    { title: 'Investors', content: 'Company data, reports, and investor information.', icon: <TrendingUp className="h-4 w-4" /> },
  ] },
  'sitemap': { name: 'Sitemap', description: 'All pages on Zylod', icon: <LayoutGrid className="h-8 w-8 text-white" />, sections: [
    { title: 'Sitemap', content: 'Browse every page on the platform by section.', icon: <LayoutGrid className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Marketplace', pageId: 'category-products' }, { label: 'Home', pageId: 'home' }] },
  'app-settings': { name: 'App Settings', description: 'Manage your app', icon: <Settings className="h-8 w-8 text-white" />, sections: [
    { title: 'Settings', content: 'Storage, cache, updates, and general app preferences.', icon: <Settings className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Cache', pageId: 'cache-settings' }, { label: 'Storage', pageId: 'storage-management' }] },
  'storage-management': { name: 'Storage Management', description: 'Manage app storage', icon: <Save className="h-8 w-8 text-white" />, sections: [
    { title: 'Storage', content: 'Review and clear app data to free up space.', icon: <Save className="h-4 w-4" /> },
  ] },
  'cache-settings': { name: 'Cache Settings', description: 'Manage app cache', icon: <RefreshCw className="h-8 w-8 text-white" />, sections: [
    { title: 'Cache', content: 'Clear cache and review cached data.', icon: <RefreshCw className="h-4 w-4" /> },
  ] },
  'app-update': { name: 'App Update', description: 'Update the app', icon: <Download className="h-8 w-8 text-white" />, sections: [
    { title: 'Update', content: 'Download the latest version of the Zylod app.', icon: <Download className="h-4 w-4" /> },
  ] },
  'maintenance-mode': { name: 'Maintenance Mode', description: 'System maintenance info', icon: <AlertTriangle className="h-8 w-8 text-white" />, sections: [
    { title: 'Maintenance', content: 'Scheduled maintenance notices and estimated downtime.', icon: <AlertTriangle className="h-4 w-4" /> },
  ] },
  'offline-mode': { name: 'Offline Mode', description: 'Browse offline', icon: <Ban className="h-8 w-8 text-white" />, sections: [
    { title: 'Offline', content: 'Access cached content and sync when back online.', icon: <Ban className="h-4 w-4" /> },
  ] },
  'deep-link-handler': { name: 'Deep Link Handler', description: 'Open via deep links', icon: <Link className="h-8 w-8 text-white" />, sections: [
    { title: 'Deep Links', content: 'Open specific pages directly via shareable links.', icon: <Link className="h-4 w-4" /> },
  ] },
  'supplier-products': { name: 'Product Management', description: 'Manage your wholesale product listings', icon: <Package className="h-8 w-8 text-white" />, sections: [
    { title: 'Listings Overview', content: 'View, edit, and organize all your active wholesale product listings with MOQ, bulk pricing, and stock levels.', icon: <Package className="h-4 w-4" /> },
    { title: 'Pricing & Inventory', content: 'Set wholesale price tiers, volume discounts, minimum order quantities, and keep stock levels up to date.', icon: <Box className="h-4 w-4" /> },
    { title: 'Adding Products', content: 'Add products individually through the product form or in bulk via spreadsheet upload.', icon: <Plus className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Add Product', pageId: 'supplier-add-product' }, { label: 'Orders', pageId: 'supplier-orders' }, { label: 'Dashboard', pageId: 'supplier-dashboard' }] },
  'supplier-add-product': { name: 'Add New Product', description: 'Create a new wholesale product listing', icon: <Plus className="h-8 w-8 text-white" />, sections: [
    { title: 'Product Details', content: 'Enter product name, category, images, descriptions, and unique SKU for your listing.', icon: <FileText className="h-4 w-4" /> },
    { title: 'Pricing & MOQ', content: 'Set wholesale price, minimum order quantity, and optional volume-based discount tiers.', icon: <Percent className="h-4 w-4" /> },
    { title: 'Review & Publish', content: 'Preview your listing, then submit for review before it goes live to buyers.', icon: <BadgeCheck className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'My Products', pageId: 'supplier-products' }, { label: 'Catalog', pageId: 'supplier-catalog' }, { label: 'Dashboard', pageId: 'supplier-dashboard' }] },
  'supplier-orders': { name: 'Order Management', description: 'Track and fulfill incoming buyer orders', icon: <Truck className="h-8 w-8 text-white" />, sections: [
    { title: 'Incoming Orders', content: 'Review new wholesale orders, confirm quantities and pricing, and communicate with buyers.', icon: <Inbox className="h-4 w-4" /> },
    { title: 'Fulfillment', content: 'Pack orders, generate shipping labels, and update tracking information for buyers.', icon: <Box className="h-4 w-4" /> },
    { title: 'Payments', content: 'Track order payments and payouts once orders are confirmed as delivered.', icon: <Wallet className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Products', pageId: 'supplier-products' }, { label: 'Finance', pageId: 'supplier-finance' }, { label: 'Dashboard', pageId: 'supplier-dashboard' }] },
  'supplier-finance': { name: 'Supplier Finance', description: 'Earnings, payouts, and financial reports', icon: <Wallet className="h-8 w-8 text-white" />, sections: [
    { title: 'Earnings', content: 'View your total earnings, pending balances, and payout history from confirmed orders.', icon: <DollarSign className="h-4 w-4" /> },
    { title: 'Commission & Fees', content: 'Understand marketplace commission rates, listing fees, and payment processing charges.', icon: <TrendingDown className="h-4 w-4" /> },
    { title: 'Withdrawals', content: 'Withdraw your balance via bank transfer, bKash, or Nagad with scheduled payouts.', icon: <ArrowUpRight className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Earnings', pageId: 'supplier-earnings' }, { label: 'Orders', pageId: 'supplier-orders' }, { label: 'Dashboard', pageId: 'supplier-dashboard' }] },
  'supplier-earnings': { name: 'Earnings', description: 'Track your revenue and payouts', icon: <DollarSign className="h-8 w-8 text-white" />, sections: [
    { title: 'Earnings Overview', content: 'See total revenue, monthly earnings, and balance available for withdrawal.', icon: <TrendingUp className="h-4 w-4" /> },
    { title: 'Transactions', content: 'Review individual order payouts, refunds, and marketplace fee adjustments.', icon: <Activity className="h-4 w-4" /> },
    { title: 'Payouts', content: 'Track payout schedule, methods, and delivery status of your withdrawals.', icon: <CalendarDays className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Finance', pageId: 'supplier-finance' }, { label: 'Orders', pageId: 'supplier-orders' }] },
  'supplier-catalog': { name: 'Product Catalog', description: 'Organize and manage your product collection', icon: <Store className="h-8 w-8 text-white" />, sections: [
    { title: 'Catalog Overview', content: 'Browse all your listings with live status — active, draft, and out of stock.', icon: <LayoutGrid className="h-4 w-4" /> },
    { title: 'Edit Products', content: 'Update prices, descriptions, and images for existing listings at any time.', icon: <Edit className="h-4 w-4" /> },
    { title: 'Organize', content: 'Group products by collections and categories so buyers can find them faster.', icon: <List className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Add Product', pageId: 'supplier-add-product' }, { label: 'Products', pageId: 'supplier-products' }, { label: 'Dashboard', pageId: 'supplier-dashboard' }] },
  'supplier-agreement': { name: 'Supplier Agreement', description: 'Terms and obligations for selling on Zylod', icon: <Scale className="h-8 w-8 text-white" />, sections: [
    { title: 'Agreement Terms', content: 'Review the full supplier agreement covering listings, pricing, and marketplace obligations.', icon: <FileText className="h-4 w-4" /> },
    { title: 'Your Responsibilities', content: 'Maintain accurate product information, fulfill orders on time, and comply with marketplace policies.', icon: <Shield className="h-4 w-4" /> },
    { title: 'Termination & Renewal', content: 'Understand how the agreement renews and the conditions under which it can be terminated.', icon: <RefreshCw className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Verification', pageId: 'supplier-verification-status' }, { label: 'Dashboard', pageId: 'supplier-dashboard' }] },
  'supplier-verification-status': { name: 'Verification Status', description: 'Track your supplier verification progress', icon: <BadgeCheck className="h-8 w-8 text-white" />, sections: [
    { title: 'Verification Progress', content: 'See which documents have been submitted and what stage your business verification is in.', icon: <ClipboardCheck className="h-4 w-4" /> },
    { title: 'Required Documents', content: 'Submit your trade license, TIN certificate, bank statements, and business photos for review.', icon: <FileText className="h-4 w-4" /> },
    { title: 'Timeline', content: 'Verification is typically completed within 2–3 business days after all documents are received.', icon: <CalendarDays className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Agreement', pageId: 'supplier-agreement' }, { label: 'Dashboard', pageId: 'supplier-dashboard' }] },
  'buyer-credit': { name: 'Buyer Credit', description: 'Manage your credit line for wholesale purchases', icon: <Wallet className="h-8 w-8 text-white" />, sections: [
    { title: 'Credit Line', content: 'View your approved credit limit, available balance, and outstanding usage.', icon: <DollarSign className="h-4 w-4" /> },
    { title: 'Repayment', content: 'Repay credit purchases by due date via bank transfer, bKash, or Nagad to avoid fees.', icon: <CalendarDays className="h-4 w-4" /> },
    { title: 'Increase Limit', content: 'Request a higher credit limit by submitting updated business and payment records.', icon: <TrendingUp className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Orders', pageId: 'buyer-orders' }, { label: 'Protection', pageId: 'buyer-protection' }] },
  'buyer-orders': { name: 'My Orders', description: 'Track all your wholesale purchases', icon: <Package className="h-8 w-8 text-white" />, sections: [
    { title: 'Current Orders', content: 'Track active orders from confirmation through dispatch and delivery.', icon: <Truck className="h-4 w-4" /> },
    { title: 'Order History', content: 'Browse past purchases, invoices, and reorder favorite items quickly.', icon: <Clock className="h-4 w-4" /> },
    { title: 'Track & Returns', content: 'Follow shipment tracking and initiate returns or complaints when needed.', icon: <RefreshCw className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Returns', pageId: 'buyer-returns' }, { label: 'Credit', pageId: 'buyer-credit' }, { label: 'Dashboard', pageId: 'buyer-dashboard' }] },
  'buyer-wishlist': { name: 'My Wishlist', description: 'Products you have saved for later', icon: <Heart className="h-8 w-8 text-white" />, sections: [
    { title: 'Saved Products', content: 'Review products you have saved and see live pricing and availability updates.', icon: <Heart className="h-4 w-4" /> },
    { title: 'Share & Compare', content: 'Share wishlists with your team and compare prices across saved suppliers.', icon: <Users className="h-4 w-4" /> },
    { title: 'Move to Cart', content: 'Convert saved items into purchase orders with bulk quantities in one step.', icon: <ShoppingBag className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Orders', pageId: 'buyer-orders' }, { label: 'Profile', pageId: 'buyer-profile' }] },
  'buyer-qr-scan': { name: 'Scan QR', description: 'Scan QR codes for orders and payments', icon: <span className="material-symbols-outlined" style={{ fontSize: 32, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>qr_code_scanner</span>, sections: [
    { title: 'Scan Orders', content: 'Scan supplier or order QR codes to instantly open order details and tracking.', icon: <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>qr_code_scanner</span> },
    { title: 'Pay by QR', content: 'Make secure wholesale payments by scanning a supplier payment QR code.', icon: <Wallet className="h-4 w-4" /> },
    { title: 'Scan History', content: 'View your recent scan history and quick links to visited orders and suppliers.', icon: <Clock className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Orders', pageId: 'buyer-orders' }, { label: 'Help', pageId: 'help-center' }] },
  'buyer-protection': { name: 'Buyer Protection', description: 'Shop with confidence on Zylod', icon: <Shield className="h-8 w-8 text-white" />, sections: [
    { title: 'What Is Covered', content: 'Protection covers non-delivery, damaged or incorrect goods, and quality disputes on eligible orders.', icon: <Shield className="h-4 w-4" /> },
    { title: 'File a Claim', content: 'Open a claim within the eligible window with order details, photos, and supporting documents.', icon: <AlertCircle className="h-4 w-4" /> },
    { title: 'Resolution Process', content: 'Our team reviews evidence, facilitates resolution with the supplier, and processes refunds where applicable.', icon: <Scale className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Complaints', pageId: 'buyer-complaints' }, { label: 'Orders', pageId: 'buyer-orders' }] },
  'buyer-profile': { name: 'Buyer Profile', description: 'Your business profile on Zylod', icon: <Users className="h-8 w-8 text-white" />, sections: [
    { title: 'Profile Overview', content: 'Manage your business name, contact details, and verified company information.', icon: <Building2 className="h-4 w-4" /> },
    { title: 'Business Details', content: 'Add your company registration, trade license, and tax information for verification.', icon: <BadgeCheck className="h-4 w-4" /> },
    { title: 'Account Preferences', content: 'Set default shipping addresses, currency, and communication preferences.', icon: <Settings className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Settings', pageId: 'buyer-settings' }, { label: 'Dashboard', pageId: 'buyer-dashboard' }] },
  'buyer-rewards': { name: 'Rewards', description: 'Earn and redeem rewards on Zylod', icon: <Gift className="h-8 w-8 text-white" />, sections: [
    { title: 'Earn Points', content: 'Earn reward points on every completed wholesale purchase, review, and referral.', icon: <Gift className="h-4 w-4" /> },
    { title: 'Redeem', content: 'Redeem points for order discounts, free shipping, and supplier features.', icon: <Award className="h-4 w-4" /> },
    { title: 'Tier Benefits', content: 'Climb loyalty tiers for better pricing, priority support, and exclusive offers.', icon: <Crown className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Orders', pageId: 'buyer-orders' }, { label: 'Favorites', pageId: 'buyer-favorites' }] },
  'admin-orders': { name: 'Order Management', description: 'Oversee all marketplace orders', icon: <FileBarChart className="h-8 w-8 text-white" />, sections: [
    { title: 'All Orders', content: 'Monitor every order across the marketplace with filters by status, supplier, and buyer.', icon: <Package className="h-4 w-4" /> },
    { title: 'Fulfillment Oversight', content: 'Track supplier fulfillment performance and delivery timelines at a glance.', icon: <Truck className="h-4 w-4" /> },
    { title: 'Disputes & Refunds', content: 'Review order disputes and approve refunds in line with marketplace policy.', icon: <Scale className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Dashboard', pageId: 'admin-dashboard' }, { label: 'Complaints', pageId: 'admin-complaints' }] },
  'admin-suppliers': { name: 'Supplier Management', description: 'Review and verify marketplace suppliers', icon: <UserCheck className="h-8 w-8 text-white" />, sections: [
    { title: 'Verification Queue', content: 'Approve or suspend supplier accounts based on their submitted documents and marketplace record.', icon: <BadgeCheck className="h-4 w-4" /> },
    { title: 'Performance Monitoring', content: 'Track supplier ratings, on-time delivery, and product quality across the marketplace.', icon: <BarChart3 className="h-4 w-4" /> },
    { title: 'Compliance', content: 'Ensure every supplier meets trade license, tax, and product compliance requirements.', icon: <Shield className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Dashboard', pageId: 'admin-dashboard' }, { label: 'Users', pageId: 'admin-users' }], specialType: 'admin-suppliers' },
  'seller-storefront': { name: 'Seller Storefront', description: 'Your public storefront on Zylod', icon: <Store className="h-8 w-8 text-white" />, sections: [
    { title: 'Storefront Overview', content: 'See how your public storefront appears to buyers, including banner, logo, and rating.', icon: <Store className="h-4 w-4" /> },
    { title: 'Customization', content: 'Customize your banner, logo, featured products, and store description.', icon: <Palette className="h-4 w-4" /> },
    { title: 'Product Showcase', content: 'Feature selected products on your storefront to highlight your best wholesale offers.', icon: <Package className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Products', pageId: 'supplier-products' }, { label: 'Dashboard', pageId: 'supplier-dashboard' }], specialType: 'seller-storefront' },
  'support': { name: 'Support', description: 'Get help with your Zylod account', icon: <MessageCircle className="h-8 w-8 text-white" />, sections: [
    { title: 'Contact Channels', content: 'Reach our support team by phone, email, or live chat — 7 days a week.', icon: <Phone className="h-4 w-4" /> },
    { title: 'Submit a Ticket', content: 'Open a support ticket with details about your issue and get a response within 24 hours.', icon: <AlertTriangle className="h-4 w-4" /> },
    { title: 'Track Tickets', content: 'Follow the status of your open tickets and review past resolutions.', icon: <Clock className="h-4 w-4" /> },
  ], quickLinks: [{ label: 'Help Center', pageId: 'help-center' }, { label: 'Feedback', pageId: 'feedback' }], specialType: 'support' },
  'chat-list': { name: 'Messages', description: 'Chat with your suppliers and buyers', icon: <MessageSquare className="h-8 w-8 text-white" />, sections: [
    { title: 'Conversations', content: 'All your business conversations in one place.', icon: <MessageSquare className="h-4 w-4" /> },
  ], specialType: 'chat-list' },
  'chat-detail': { name: 'Chat', description: 'Conversation with supplier', icon: <MessageSquare className="h-8 w-8 text-white" />, sections: [
    { title: 'Thread', content: 'Send messages, share offers, and close deals directly with suppliers.', icon: <MessageSquare className="h-4 w-4" /> },
  ], specialType: 'chat-detail' },
  'quote-request': { name: 'Request Quote', description: 'Get bulk pricing from suppliers', icon: <FileText className="h-8 w-8 text-white" />, sections: [
    { title: 'RFQ', content: 'Submit a request for quotation and receive offers from multiple suppliers.', icon: <FileText className="h-4 w-4" /> },
  ], specialType: 'quote-request' },
  'rfq-list': { name: 'My RFQs', description: 'Track your quote requests', icon: <FileBarChart className="h-8 w-8 text-white" />, sections: [
    { title: 'RFQ History', content: 'View the status of every quote request you have submitted.', icon: <FileBarChart className="h-4 w-4" /> },
  ], specialType: 'rfq-list' },
  'add-address': { name: 'Add Address', description: 'Add a new delivery address', icon: <MapPin className="h-8 w-8 text-white" />, sections: [
    { title: 'Address', content: 'Save delivery addresses for faster checkout.', icon: <MapPin className="h-4 w-4" /> },
  ], specialType: 'add-address' },
  'dispute-resolution': { name: 'Dispute Resolution', description: 'Resolve order disputes fairly', icon: <Scale className="h-8 w-8 text-white" />, sections: [
    { title: 'File a Dispute', content: 'Open a dispute within 7 days of delivery. Provide order ID, photos/videos, and a description of the issue.', icon: <AlertTriangle className="h-4 w-4" /> },
    { title: 'Resolution Process', content: 'Both parties submit documentation within 48 hours. Our arbitration team mediates and issues a verdict within 5 business days.', icon: <Scale className="h-4 w-4" /> },
    { title: 'Outcomes', content: 'Possible outcomes: full/partial refund, return & re-ship, or supplier penalty. All verdicts are final.', icon: <CheckCircle2 className="h-4 w-4" /> },
  ] },
  'partner-program': { name: 'Partner Program', description: 'Grow with Zylod partnerships', icon: <Award className="h-8 w-8 text-white" />, sections: [
    { title: 'Why Partner', content: 'Earn commissions, get priority placement, and access exclusive buyer leads across Bangladesh.', icon: <Award className="h-4 w-4" /> },
    { title: 'Partner Tiers', content: 'Silver (starter), Gold (steady volume), and Platinum (top 5% by GMV). Higher tiers unlock lower commission rates.', icon: <TrendingUp className="h-4 w-4" /> },
    { title: 'Apply', content: 'Applications reviewed within 5 business days. You need verified business registration to qualify.', icon: <Building className="h-4 w-4" /> },
  ] },
  'quality-guarantee': { name: 'Quality Guarantee', description: 'Trade with confidence', icon: <BadgeCheck className="h-8 w-8 text-white" />, sections: [
    { title: 'What We Guarantee', content: 'Orders shipped by verified suppliers with inspected quality. If goods don\'t match the listing, we cover you.', icon: <BadgeCheck className="h-4 w-4" /> },
    { title: 'Inspection Reports', content: 'Buyers can request third-party inspection before shipping for orders above ৳100,000.', icon: <ClipboardCheck className="h-4 w-4" /> },
    { title: 'Claims', content: 'Submit a quality claim within 72 hours of delivery with photo evidence for a fast review.', icon: <Shield className="h-4 w-4" /> },
  ] },
}

function getInfoConfig(pageId: string): InfoConfig {
  if (INFO_CONFIGS[pageId]) return INFO_CONFIGS[pageId]
  const names: Record<string, string> = {
    'cookies': 'Cookie Policy', 'quality-guarantee': 'Quality Guarantee', 'compliance': 'Compliance',
    'dispute-resolution': 'Dispute Resolution', 'careers': 'Careers', 'press': 'Press Room',
    'blog': 'Blog', 'events': 'Events', 'help-center': 'Help Center', 'support': 'Support',
    'feedback': 'Feedback', 'report-issue': 'Report Issue', 'suggestions': 'Suggestions',
    'announcements': 'Announcements', 'marketplace-rules': 'Marketplace Rules',
    'partner-program': 'Partner Program', 'onboarding': 'Onboarding Guide',
  }
  const name = names[pageId] || pageId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  return {
    name, description: `${name} — Zylod information and resources`,
    icon: <FileText className="h-8 w-8 text-white" />,
    sections: [
      { title: `${name} Overview`, content: `Zylod's ${name} page provides important information for all users of our B2B wholesale marketplace platform in Bangladesh.`, icon: <BookOpen className="h-4 w-4" /> },
      { title: 'What You Can Do', content: `Explore ${name.toLowerCase()} resources, manage your wholesale account, and access buyer & supplier tools — all from one place.`, icon: <Lightbulb className="h-4 w-4" /> },
      { title: 'Key Points', content: 'Our policies are designed to protect both buyers and suppliers while ensuring fair and transparent wholesale commerce across Bangladesh.', icon: <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span> },
      { title: 'Getting Started', content: 'Register once as a buyer or supplier, verify your account, and start browsing verified suppliers, bulk orders, and wholesale pricing immediately.', icon: <Truck className="h-4 w-4" /> },
      { title: 'Need Help?', content: 'Contact our support team at support@zylod.com or call +880 1700-WHOLESALE for assistance. Our team is available 24/7.', icon: <MessageCircle className="h-4 w-4" /> },
    ],
    quickLinks: [
      { label: 'Home', pageId: 'home' }, { label: 'Help Center', pageId: 'help-center' },
      { label: 'Contact Us', pageId: 'contact-us' }, { label: 'About Us', pageId: 'about' },
      { label: 'Terms', pageId: 'terms' }, { label: 'Privacy', pageId: 'privacy' },
      { label: 'All Products', pageId: 'category-products' }, { label: 'FAQs', pageId: 'faq' },
    ],
  }
}

// ========== CUSTOM RENDER FUNCTIONS ==========

function SuppliersPage({ navigate }: { navigate: (page: string, params?: Record<string, string>) => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const { data: suppliers, loading } = useSuppliers({ search: debouncedSearch, limit: 50 })

  const allSuppliers = suppliers || []
  const locations = ['all', ...Array.from(new Set(allSuppliers.map(s => s.city).filter(Boolean)))] as string[]

  const filtered = allSuppliers.filter((s: SupplierListItem) => {
    if (locationFilter !== 'all' && s.city !== locationFilter) return false
    if (ratingFilter !== 'all' && s.ratingAvg < parseFloat(ratingFilter)) return false
    return true
  })

  const initials = (name: string) => name.charAt(0).toUpperCase()

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <Card className="border border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search suppliers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="h-8 text-xs w-[130px]"><MapPin className="h-3 w-3 mr-1" /><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>{locations.map(l => <SelectItem key={l} value={l}>{l === 'all' ? 'All Locations' : l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="h-8 text-xs w-[120px]"><Star className="h-3 w-3 mr-1" /><SelectValue placeholder="Rating" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="4.5">4.5+</SelectItem>
                <SelectItem value="4.0">4.0+</SelectItem>
                <SelectItem value="3.5">3.5+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} supplier{filtered.length !== 1 ? 's' : ''} found</p>
        </CardContent>
      </Card>

      {/* Supplier Cards */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
        ) : (
          <>
            {filtered.map((supplier: SupplierListItem) => (
              <Card key={supplier.id} className="border border-border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {initials(supplier.companyName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold">{supplier.companyName}</h3>
                        {supplier.verificationStatus === 'approved' && <Badge variant="default" className="text-[10px] h-5"><BadgeCheck className="h-3 w-3 mr-0.5" />Verified</Badge>}
                        {supplier.verificationStatus === 'pending' && <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{supplier.ratingAvg > 0 ? supplier.ratingAvg.toFixed(1) : 'New'}</span>
                        <span className="flex items-center gap-1"><Package className="h-3 w-3" />{supplier.productCount} products</span>
                        {supplier.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{supplier.city}</span>}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="h-7 text-xs" onClick={() => navigate('chat-detail', { supplierId: supplier.id, supplierName: supplier.companyName })}>
                          <MessageCircle className="h-3 w-3 mr-1" />Contact Supplier
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate('supplier-profile', { supplierId: supplier.id })}>
                          <Eye className="h-3 w-3 mr-1" />View Profile
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No suppliers found matching your criteria</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function BuyerComplaintsPage() {
  const [orderId, setOrderId] = useState('')
  const [complaintType, setComplaintType] = useState('')
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [complaints, setComplaints] = useState<{ id: string; orderId: string; type: string; status: string; date: string }[]>([])

  const handleSubmit = () => {
    if (!orderId || !complaintType || !description.trim()) return
    setComplaints(prev => [{
      id: `CMP-${String(prev.length + 1).padStart(3, '0')}`,
      orderId, type: complaintType, status: 'Pending', date: new Date().toISOString().split('T')[0],
    }, ...prev])
    setSubmitted(true)
    setOrderId('')
    setComplaintType('')
    setDescription('')
    setEvidence(null)
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className="space-y-4">
      {/* Complaint Form */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Submit New Complaint</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Order ID *</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select order" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ORD-001">ORD-001</SelectItem>
                <SelectItem value="ORD-002">ORD-002</SelectItem>
                <SelectItem value="ORD-003">ORD-003</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Complaint Type *</Label>
            <Select value={complaintType} onValueChange={setComplaintType}>
              <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Damaged Product">Damaged Product</SelectItem>
                <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                <SelectItem value="Late Delivery">Late Delivery</SelectItem>
                <SelectItem value="Product Quality">Product Quality</SelectItem>
                <SelectItem value="Missing Items">Missing Items</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description *</Label>
            <Textarea placeholder="Describe your issue in detail..." value={description} onChange={e => setDescription(e.target.value)} className="text-xs min-h-[80px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Attach Evidence</Label>
            <Input type="file" accept="image/*,.pdf" onChange={e => setEvidence(e.target.files?.[0] || null)} className="text-xs h-8" />
            {evidence && <p className="text-[10px] text-muted-foreground">📎 {evidence.name}</p>}
          </div>
          <Button className="w-full h-9 text-xs" onClick={handleSubmit} disabled={!orderId || !complaintType || !description.trim()}>
            <AlertCircle className="h-3 w-3 mr-1" />Submit Complaint
          </Button>
          {submitted && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 text-green-700 text-xs">
              <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>Complaint submitted successfully! We will review it within 24 hours.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Previous Complaints */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Previous Complaints</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {complaints.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs">
                <div>
                  <p className="font-medium">{c.id} — {c.type}</p>
                  <p className="text-muted-foreground">{c.orderId} · {c.date}</p>
                </div>
                <Badge variant={c.status === 'Resolved' ? 'default' : c.status === 'In Progress' ? 'secondary' : 'outline'} className="text-[10px]">
                  {c.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BuyerReturnsPage() {
  const [orderId, setOrderId] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [quantity, setQuantity] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [returns, setReturns] = useState<{ id: string; orderId: string; reason: string; qty: number; status: string; date: string }[]>([])

  const handleSubmit = () => {
    if (!orderId || !returnReason || !quantity || !description.trim()) return
    setReturns(prev => [{
      id: `RET-${String(prev.length + 1).padStart(3, '0')}`,
      orderId, reason: returnReason, qty: parseInt(quantity) || 0, status: 'Pending', date: new Date().toISOString().split('T')[0],
    }, ...prev])
    setSubmitted(true)
    setOrderId('')
    setReturnReason('')
    setQuantity('')
    setDescription('')
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4 text-blue-500" />Submit Return Request</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Order ID *</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select order" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ORD-001">ORD-001</SelectItem>
                <SelectItem value="ORD-002">ORD-002</SelectItem>
                <SelectItem value="ORD-003">ORD-003</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Return Reason *</Label>
            <Select value={returnReason} onValueChange={setReturnReason}>
              <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Damaged in transit">Damaged in transit</SelectItem>
                <SelectItem value="Wrong item received">Wrong item received</SelectItem>
                <SelectItem value="Product not as described">Product not as described</SelectItem>
                <SelectItem value="Defective product">Defective product</SelectItem>
                <SelectItem value="Quality issue">Quality issue</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quantity to Return *</Label>
            <Input type="number" min="1" placeholder="Enter quantity" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description *</Label>
            <Textarea placeholder="Describe the issue..." value={description} onChange={e => setDescription(e.target.value)} className="text-xs min-h-[80px]" />
          </div>
          <Button className="w-full h-9 text-xs" onClick={handleSubmit} disabled={!orderId || !returnReason || !quantity || !description.trim()}>
            <RefreshCw className="h-3 w-3 mr-1" />Submit Return Request
          </Button>
          {submitted && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 text-green-700 text-xs">
              <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>Return request submitted! We will process it within 48 hours.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" />Previous Returns</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {returns.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs">
                <div>
                  <p className="font-medium">{r.id} — {r.reason}</p>
                  <p className="text-muted-foreground">{r.orderId} · Qty: {r.qty} · {r.date}</p>
                </div>
                <Badge variant={r.status === 'Approved' ? 'default' : r.status === 'Processing' ? 'secondary' : 'outline'} className="text-[10px]">
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BuyerSettingsPage() {
  const [emailNotif, setEmailNotif] = useState(true)
  const [smsNotif, setSmsNotif] = useState(false)
  const [pushNotif, setPushNotif] = useState(true)
  const [language, setLanguage] = useState('en')
  const [profileVisible, setProfileVisible] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-4">
      {/* Notification Preferences */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" />Notification Preferences</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">Email Notifications</p>
              <p className="text-[10px] text-muted-foreground">Receive order updates and promotions via email</p>
            </div>
            <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">SMS Notifications</p>
              <p className="text-[10px] text-muted-foreground">Get text alerts for critical order updates</p>
            </div>
            <Switch checked={smsNotif} onCheckedChange={setSmsNotif} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">Push Notifications</p>
              <p className="text-[10px] text-muted-foreground">Browser push notifications for real-time updates</p>
            </div>
            <Switch checked={pushNotif} onCheckedChange={setPushNotif} />
          </div>
        </CardContent>
      </Card>

      {/* Language Preference */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Languages className="h-4 w-4" />Language Preference</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="bn">বাংলা (Bengali)</SelectItem>
              <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" />Privacy Settings</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">Profile Visibility</p>
              <p className="text-[10px] text-muted-foreground">Allow suppliers to see your profile and buying activity</p>
            </div>
            <Switch checked={profileVisible} onCheckedChange={setProfileVisible} />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-9 text-xs" onClick={handleSave}>
        <Save className="h-3 w-3 mr-1" />Save Settings
      </Button>
      {saved && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 text-green-700 text-xs">
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>Settings saved successfully!
        </div>
      )}
    </div>
  )
}

function BuyerLevelPage() {
  const [currentSpent] = useState(125000)
  const [currentLevel] = useState('Silver')

  const levels = [
    { name: 'Bronze', minSpent: 0, maxSpent: 50000, color: '#CD7F32', discount: '2%', benefits: ['Basic support', 'Standard shipping', 'Order tracking'] },
    { name: 'Silver', minSpent: 50000, maxSpent: 200000, color: '#C0C0C0', discount: '5%', benefits: ['Priority support', 'Free shipping (orders ৳5000+)', 'Early access to deals', 'Order tracking'] },
    { name: 'Gold', minSpent: 200000, maxSpent: 500000, color: '#FFD700', discount: '8%', benefits: ['24/7 dedicated support', 'Free shipping on all orders', 'Early access to deals', 'Exclusive discounts', 'Priority order processing'] },
    { name: 'Platinum', minSpent: 500000, maxSpent: Infinity, color: '#E5E4E2', discount: '12%', benefits: ['Personal account manager', 'Free shipping + express', 'VIP deals & flash sales', 'Maximum discounts', 'Priority processing', 'Custom payment terms'] },
  ]

  const currentLevelData = levels.find(l => l.name === currentLevel)!
  const nextLevel = levels[levels.indexOf(currentLevelData) + 1]
  const progressPercent = nextLevel
    ? Math.min(100, ((currentSpent - currentLevelData.minSpent) / (nextLevel.minSpent - currentLevelData.minSpent)) * 100)
    : 100

  return (
    <div className="space-y-4">
      {/* Current Level Card */}
      <Card className="border border-border overflow-hidden">
        <div className="h-2" style={{ background: currentLevelData.color }} />
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6" style={{ color: currentLevelData.color }} />
              <div>
                <h3 className="text-sm font-bold">{currentLevel} Buyer</h3>
                <p className="text-xs text-muted-foreground">Current discount: {currentLevelData.discount}</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">৳{currentSpent.toLocaleString()} spent</Badge>
          </div>
          {nextLevel && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress to {nextLevel.name}</span>
                <span className="font-medium">৳{nextLevel.minSpent.toLocaleString()}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-[10px] text-muted-foreground">৳{(nextLevel.minSpent - currentSpent).toLocaleString()} more to reach {nextLevel.name}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Benefits Comparison */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4" />Level Benefits</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Level</TableHead>
                  <TableHead className="text-xs">Discount</TableHead>
                  <TableHead className="text-xs">Key Benefits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map(level => (
                  <TableRow key={level.name} className={level.name === currentLevel ? 'bg-primary/5' : ''}>
                    <TableCell className="text-xs font-medium">
                      <span className="flex items-center gap-1">
                        <Crown className="h-3 w-3" style={{ color: level.color }} />
                        {level.name}
                        {level.name === currentLevel && <Badge variant="default" className="text-[8px] h-4 ml-1">Current</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{level.discount}</TableCell>
                    <TableCell className="text-xs">
                      <ul className="space-y-0.5">
                        {level.benefits.slice(0, 2).map((b, i) => <li key={i} className="flex items-center gap-1"><span className="material-symbols-outlined text-green-500" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>{b}</li>)}
                        {level.benefits.length > 2 && <li className="text-muted-foreground">+{level.benefits.length - 2} more</li>}
                      </ul>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* How to Level Up */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />How to Level Up</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          <div className="flex items-start gap-2 text-xs"><ShoppingBag className="h-4 w-4 text-primary mt-0.5" /><div><p className="font-medium">Place More Orders</p><p className="text-muted-foreground">Your total spending determines your level</p></div></div>
          <div className="flex items-start gap-2 text-xs"><Star className="h-4 w-4 text-primary mt-0.5" /><div><p className="font-medium">Leave Reviews</p><p className="text-muted-foreground">Active reviewers earn bonus points</p></div></div>
          <div className="flex items-start gap-2 text-xs"><Gift className="h-4 w-4 text-primary mt-0.5" /><div><p className="font-medium">Refer Other Buyers</p><p className="text-muted-foreground">Earn ৳500 for each successful referral</p></div></div>
        </CardContent>
      </Card>
    </div>
  )
}

function BuyerFavoritesPage({ navigate }: { navigate: (page: string) => void }) {
  return (
    <div className="space-y-4">
      <Card className="border border-border">
        <CardContent className="p-6 text-center space-y-3">
          <Heart className="h-12 w-12 mx-auto text-red-400" />
          <h3 className="text-sm font-semibold">Your Favorites Are in Your Wishlist</h3>
          <p className="text-xs text-muted-foreground">We&apos;ve moved all your favorite items to the wishlist for a better experience. Click below to access them.</p>
          <Button onClick={() => navigate('wishlist')} className="h-9 text-xs">
            <Heart className="h-3 w-3 mr-1" />Go to My Wishlist
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminUsersPage() {
  const { user: admin } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')

  const { data: users, loading, refresh } = useAdminUsers({
    search: searchQuery || undefined,
    role: roleFilter === 'all' ? undefined : roleFilter.toLowerCase(),
    status: statusFilter === 'all' ? undefined : statusFilter.toLowerCase(),
    limit: 100,
  })

  const all = (users || []) as AdminUser[]
  const stats = {
    total: all.length,
    active: all.filter(u => u.accountStatus === 'active').length,
    suspended: all.filter(u => u.accountStatus === 'suspended' || u.accountStatus === 'banned').length,
    pending: all.filter(u => u.userType === 'supplier' && u.verificationStatus === 'pending').length,
  }

  const handleAction = async (u: AdminUser, action: 'ban' | 'activate') => {
    if (!admin?.id) return
    setBusyId(u.id)
    try {
      await updateUserStatus(u.id, action === 'ban' ? 'suspend' : 'activate', admin.id)
      setActionMsg(`User ${action === 'ban' ? 'suspended' : 'activated'} successfully!`)
      setTimeout(() => setActionMsg(''), 3000)
      await refresh()
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold">{loading ? '…' : stats.total}</p><p className="text-[10px] text-muted-foreground">Total Users</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">{stats.active}</p><p className="text-[10px] text-muted-foreground">Active</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-red-600">{stats.suspended}</p><p className="text-[10px] text-muted-foreground">Suspended/Banned</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{stats.pending}</p><p className="text-[10px] text-muted-foreground">Pending Verify</p></CardContent></Card>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 text-green-700 text-xs">
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>{actionMsg}
        </div>
      )}

      {/* Search & Filter */}
      <Card className="border border-border">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Filter by role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Buyer">Buyers</SelectItem>
                <SelectItem value="Supplier">Suppliers</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
                <SelectItem value="Banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* User Table */}
      <Card className="border border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="text-xs">
                        <p className="font-medium">{user.fullName || user.companyName || user.businessName || '—'}</p>
                        <p className="text-muted-foreground">{user.email || user.phone || user.id}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">{user.userType === 'supplier' ? 'Supplier' : user.userType === 'buyer' ? 'Buyer' : 'Admin'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={user.accountStatus === 'active' ? 'default' : user.accountStatus === 'suspended' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {user.accountStatus === 'active' ? 'Active' : user.accountStatus === 'suspended' ? 'Suspended' : 'Banned'}
                        </Badge>
                        {user.userType === 'supplier' && user.verificationStatus === 'pending' && (
                          <Badge variant="secondary" className="text-[10px] ml-1"><AlertTriangle className="h-3 w-3 mr-0.5" />Verify Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <div className="flex gap-1 justify-end">
                          {user.accountStatus === 'active' ? (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={busyId === user.id} onClick={() => handleAction(user, 'ban')}>
                              <Ban className="h-3 w-3 mr-0.5" />Suspend
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={busyId === user.id} onClick={() => handleAction(user, 'activate')}>
                              <UserCheck className="h-3 w-3 mr-0.5" />Activate
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {all.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">No users found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AdminProductsPage() {
  const { user: admin } = useAuthStore()
  const { navigate } = useNavigationStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')

  const { data: pendingProducts, loading, refresh } = useAdminProducts({
    approved: false,
    search: searchQuery || undefined,
    limit: 50,
  })

  const products = (pendingProducts || []) as AdminProduct[]

  const handleAction = async (productId: string, action: 'approve' | 'reject') => {
    if (!admin?.id) return
    setBusyId(productId)
    try {
      await updateProductApproval(productId, action, admin.id)
      setActionMsg(`Product ${action === 'approve' ? 'approved' : 'rejected'} successfully!`)
      setTimeout(() => setActionMsg(''), 3000)
      await refresh()
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{loading ? '…' : products.length}</p><p className="text-[10px] text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">—</p><p className="text-[10px] text-muted-foreground">Approved</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-red-600">—</p><p className="text-[10px] text-muted-foreground">Rejected</p></CardContent></Card>
      </div>

      {actionMsg && (
        <div className={`flex items-center gap-2 p-2 rounded-md text-xs ${actionMsg.startsWith('Failed') || actionMsg.startsWith('Request') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>{actionMsg}
        </div>
      )}

      {/* Search */}
      <Card className="border border-border">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search pending products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* Pending Products */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          products.map(product => (
            <Card key={product.id} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{product.supplierName} · {product.categoryName}</p>
                    <p className="text-xs text-muted-foreground">Price: ৳{product.basePrice.toLocaleString()}{product.unit ? ` / ${product.unit}` : ''} · MOQ: {product.moq} · Stock: {product.stockQuantity}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Submitted: {new Date(product.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="h-7 text-xs" disabled={busyId === product.id} onClick={() => handleAction(product.id, 'approve')}>
                    <ThumbsUp className="h-3 w-3 mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={busyId === product.id} onClick={() => handleAction(product.id, 'reject')}>
                    <ThumbsDown className="h-3 w-3 mr-1" />Reject
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate('product-detail', { slug: product.slug })}>
                    <Eye className="h-3 w-3 mr-1" />View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {!loading && products.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <span className="material-symbols-outlined text-green-500" style={{ fontSize: 32, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>
            <p>All products reviewed! No pending items.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<{ id: string; complainant: string; against: string; type: string; status: string; priority: string; date: string }[]>([])
  const [actionMsg, setActionMsg] = useState('')

  const stats = {
    open: complaints.filter(c => c.status === 'Open').length,
    assigned: complaints.filter(c => c.status === 'Assigned').length,
    resolved: complaints.filter(c => c.status === 'Resolved').length,
  }

  const handleResolve = (id: string) => {
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'Resolved' } : c))
    setActionMsg('Complaint marked as resolved!')
    setTimeout(() => setActionMsg(''), 3000)
  }

  const handleAssign = (id: string) => {
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'Assigned' } : c))
    setActionMsg('Complaint assigned to support team!')
    setTimeout(() => setActionMsg(''), 3000)
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-red-600">{stats.open}</p><p className="text-[10px] text-muted-foreground">Open</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{stats.assigned}</p><p className="text-[10px] text-muted-foreground">Assigned</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">{stats.resolved}</p><p className="text-[10px] text-muted-foreground">Resolved</p></CardContent></Card>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 text-green-700 text-xs">
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>{actionMsg}
        </div>
      )}

      {/* Complaints List */}
      <div className="space-y-3">
        {complaints.map(complaint => (
          <Card key={complaint.id} className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">{complaint.type}</h3>
                    <Badge variant={complaint.priority === 'High' ? 'destructive' : complaint.priority === 'Medium' ? 'secondary' : 'outline'} className="text-[10px]">
                      {complaint.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{complaint.complainant} → {complaint.against}</p>
                  <p className="text-xs text-muted-foreground">{complaint.date}</p>
                </div>
                <Badge variant={complaint.status === 'Resolved' ? 'default' : complaint.status === 'Assigned' ? 'secondary' : 'outline'} className="text-[10px]">
                  {complaint.status}
                </Badge>
              </div>
              <div className="flex gap-2 mt-3">
                {complaint.status !== 'Resolved' && (
                  <>
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleResolve(complaint.id)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>Resolve
                    </Button>
                    {complaint.status === 'Open' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAssign(complaint.id)}>
                        <UserPlus className="h-3 w-3 mr-1" />Assign
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AdminReportsPage() {
  const [dateRange, setDateRange] = useState('30d')
  const [exportMsg, setExportMsg] = useState('')

  const handleExport = () => {
    setExportMsg('Report exported successfully! File will download shortly.')
    setTimeout(() => setExportMsg(''), 3000)
  }

  return (
    <div className="space-y-4">
      {/* Date Range & Export */}
      <Card className="border border-border">
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-8 text-xs w-[140px]"><CalendarDays className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" />Export
          </Button>
        </CardContent>
      </Card>

      {exportMsg && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 text-green-700 text-xs">
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>{exportMsg}
        </div>
      )}

      {/* Revenue Stats */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Revenue Overview</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold">৳12.5M</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+18.3%</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Commission Earned</p>
              <p className="text-lg font-bold">৳375K</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+12.1%</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Avg Order Value</p>
              <p className="text-lg font-bold">৳8,450</p>
              <p className="text-[10px] text-red-600 flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />-2.4%</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Refunds</p>
              <p className="text-lg font-bold">৳89K</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />-5.7%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Stats */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Order Statistics</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-lg font-bold">4,832</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+22.5%</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-lg font-bold">3,921</p>
              <p className="text-[10px] text-muted-foreground">81.1% rate</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="text-lg font-bold">678</p>
              <p className="text-[10px] text-muted-foreground">14.0%</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Cancelled</p>
              <p className="text-lg font-bold">233</p>
              <p className="text-[10px] text-red-600">4.8%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Growth */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" />User Growth</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">New Buyers</p>
              <p className="text-lg font-bold">1,245</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+15.8%</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">New Suppliers</p>
              <p className="text-lg font-bold">89</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+8.2%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminAnalyticsPage() {
  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="border border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center"><DollarSign className="h-4 w-4 text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-sm font-bold">৳12.5M</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center"><ShoppingBag className="h-4 w-4 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Orders</p>
                <p className="text-sm font-bold">4,832</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center"><Users className="h-4 w-4 text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Users</p>
                <p className="text-sm font-bold">50,247</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center"><Store className="h-4 w-4 text-purple-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Suppliers</p>
                <p className="text-sm font-bold">5,123</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Placeholder */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><LineChart className="h-4 w-4" />Revenue Trend</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-40 flex items-end gap-1 justify-center">
            {[40, 65, 55, 80, 70, 95, 85, 100, 75, 90, 110, 95].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-primary/80 transition-all hover:bg-primary" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" />Top Products</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-2">
            {[
              { name: 'Cotton T-Shirts', sold: 5200, revenue: '৳624K' },
              { name: 'LED Bulbs 12W', sold: 8900, revenue: '৳756K' },
              { name: 'Jute Shopping Bags', sold: 6700, revenue: '৳234K' },
              { name: 'Basmati Rice 5kg', sold: 3100, revenue: '৳1.39M' },
              { name: 'Silk Scarves', sold: 2400, revenue: '৳840K' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{i + 1}</span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{p.sold.toLocaleString()} sold</p>
                  <p className="text-[10px] text-muted-foreground">{p.revenue}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Suppliers */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Top Suppliers</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-2">
            {[
              { name: 'Dhaka Textiles Ltd', orders: 456, rating: 4.8 },
              { name: 'Gazipur Garments', orders: 389, rating: 4.6 },
              { name: 'Chittagong Spices Co', orders: 234, rating: 4.5 },
              { name: 'Sylhet Tea Exporters', orders: 178, rating: 4.9 },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{i + 1}</span>
                  <span className="font-medium">{s.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{s.orders} orders</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />{s.rating}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminCategoriesPage() {
  const [categories, setCategories] = useState<{ id: string; name: string; subcategories: number; products: number; order: number }[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  const handleAdd = () => {
    if (!newCatName.trim()) return
    const newCat = {
      id: `cat${categories.length + 1}`,
      name: newCatName.trim(),
      subcategories: 0,
      products: 0,
      order: categories.length + 1,
    }
    setCategories(prev => [...prev, newCat])
    setNewCatName('')
    setActionMsg('Category added successfully!')
    setTimeout(() => setActionMsg(''), 3000)
  }

  const handleDelete = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
    setActionMsg('Category deleted!')
    setTimeout(() => setActionMsg(''), 3000)
  }

  const handleEditStart = (id: string, name: string) => {
    setEditingId(id)
    setEditName(name)
  }

  const handleEditSave = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editName } : c))
    setEditingId(null)
    setActionMsg('Category updated!')
    setTimeout(() => setActionMsg(''), 3000)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newCats = [...categories]
    const temp = newCats[index]
    newCats[index] = newCats[index - 1]
    newCats[index - 1] = temp
    newCats.forEach((c, i) => { c.order = i + 1 })
    setCategories(newCats)
  }

  const handleMoveDown = (index: number) => {
    if (index === categories.length - 1) return
    const newCats = [...categories]
    const temp = newCats[index]
    newCats[index] = newCats[index + 1]
    newCats[index + 1] = temp
    newCats.forEach((c, i) => { c.order = i + 1 })
    setCategories(newCats)
  }

  return (
    <div className="space-y-4">
      {actionMsg && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 text-green-700 text-xs">
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>{actionMsg}
        </div>
      )}

      {/* Add New Category */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Add New Category</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex gap-2">
            <Input placeholder="Category name..." value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={!newCatName.trim()}>
              <Plus className="h-3 w-3 mr-1" />Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Category List */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><LayoutGrid className="h-4 w-4" />Categories ({categories.length})</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {categories.map((cat, index) => (
              <div key={cat.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => handleMoveUp(index)} className="text-muted-foreground hover:text-foreground"><ChevronUp className="h-3 w-3" /></button>
                    <button onClick={() => handleMoveDown(index)} className="text-muted-foreground hover:text-foreground"><ChevronDown className="h-3 w-3" /></button>
                  </div>
                  {editingId === cat.id ? (
                    <div className="flex gap-1">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-6 text-xs w-[120px]" />
                      <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => handleEditSave(cat.id)}>Save</Button>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">{cat.name}</p>
                      <p className="text-[10px] text-muted-foreground">{cat.subcategories} subcategories · {cat.products} products</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleEditStart(cat.id, cat.name)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-red-600" onClick={() => handleDelete(cat.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminSettingsPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [commissionRate, setCommissionRate] = useState('5')
  const [smtpServer, setSmtpServer] = useState('smtp.zylod.com')
  const [smtpPort, setSmtpPort] = useState('587')
  const [emailFrom, setEmailFrom] = useState('noreply@zylod.com')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-4">
      {/* Platform Settings */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" />Platform Settings</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">Maintenance Mode</p>
              <p className="text-[10px] text-muted-foreground">Temporarily disable the platform for maintenance</p>
            </div>
            <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
          </div>
          {maintenanceMode && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 text-amber-700 text-xs">
              <AlertTriangle className="h-4 w-4" />Platform is in maintenance mode. Users cannot access the site.
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Commission Rate (%)</Label>
            <Input type="number" min="0" max="50" step="0.5" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} className="h-8 text-xs w-[120px]" />
            <p className="text-[10px] text-muted-foreground">Percentage taken from each transaction as platform fee</p>
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" />Email Settings</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">SMTP Server</Label>
            <Input value={smtpServer} onChange={e => setSmtpServer(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">SMTP Port</Label>
            <Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} className="h-8 text-xs w-[100px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From Email</Label>
            <Input value={emailFrom} onChange={e => setEmailFrom(e.target.value)} className="h-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-9 text-xs" onClick={handleSave}>
        <Save className="h-3 w-3 mr-1" />Save Settings
      </Button>
      {saved && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 text-green-700 text-xs">
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>Settings saved successfully!
        </div>
      )}
    </div>
  )
}

function SupplierAnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d')

  return (
    <div className="space-y-4">
      {/* Date Range */}
      <Card className="border border-border">
        <CardContent className="p-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-8 text-xs w-[160px]"><CalendarDays className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Revenue Stats */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Revenue Overview</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold">৳2.8M</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+24.5%</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Net Profit</p>
              <p className="text-lg font-bold">৳840K</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+18.2%</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-lg font-bold">1,247</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+15.3%</p>
            </div>
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground">Avg Order Value</p>
              <p className="text-lg font-bold">৳2,246</p>
              <p className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+8.1%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />Monthly Revenue</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-32 flex items-end gap-1 justify-center">
            {[35, 50, 45, 65, 55, 80, 70, 90, 75, 85, 95, 100].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-primary/80 transition-all hover:bg-primary" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" />Top Products</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Package className="h-6 w-6 mx-auto opacity-50 mb-1" />
            <p className="text-xs">No sales data yet. Your top products will appear here once you receive orders.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SupplierWarehousePage() {
  const [inventory, setInventory] = useState<{ id: string; name: string; sku: string; stock: number; minStock: number; price: string; status: string }[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStock, setEditStock] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  const lowStockItems = inventory.filter(i => i.stock <= i.minStock)

  const handleUpdateStock = (id: string) => {
    const newStock = parseInt(editStock)
    if (isNaN(newStock) || newStock < 0) return
    setInventory(prev => prev.map(i => i.id === id ? {
      ...i,
      stock: newStock,
      status: newStock === 0 ? 'Out of Stock' : newStock <= i.minStock ? 'Low Stock' : 'In Stock',
    } : i))
    setEditingId(null)
    setEditStock('')
    setActionMsg('Stock updated successfully!')
    setTimeout(() => setActionMsg(''), 3000)
  }

  return (
    <div className="space-y-4">
      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800">Low Stock Alerts</h3>
            </div>
            <div className="space-y-1">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs text-amber-800">
                  <span>{item.name}</span>
                  <Badge variant={item.stock === 0 ? 'destructive' : 'secondary'} className="text-[10px]">
                    {item.stock === 0 ? 'Out of Stock' : `${item.stock} left (min: ${item.minStock})`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {actionMsg && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 text-green-700 text-xs">
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>{actionMsg}
        </div>
      )}

      {/* Inventory Table */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Box className="h-4 w-4" />Inventory ({inventory.length} items)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs">Stock</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">SKU: {item.sku}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {editingId === item.id ? (
                        <div className="flex gap-1">
                          <Input type="number" min="0" value={editStock} onChange={e => setEditStock(e.target.value)} className="h-6 text-xs w-[70px]" />
                          <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => handleUpdateStock(item.id)}>Save</Button>
                        </div>
                      ) : (
                        <span>{item.stock} <span className="text-muted-foreground">(min: {item.minStock})</span></span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={item.status === 'In Stock' ? 'default' : item.status === 'Low Stock' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {editingId !== item.id && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => { setEditingId(item.id); setEditStock(String(item.stock)) }}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SupplierInsightsPage() {
  return (
    <div className="space-y-4">
      {/* Trending Categories */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Trending Categories</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="text-center py-4 text-sm text-muted-foreground">
            <TrendingUp className="h-6 w-6 mx-auto opacity-50 mb-1" />
            <p className="text-xs">Category trends will appear here once you have sufficient order data.</p>
          </div>
        </CardContent>
      </Card>

      {/* Price Trends */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Price Trends</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="text-center py-4 text-sm text-muted-foreground">
            <DollarSign className="h-6 w-6 mx-auto opacity-50 mb-1" />
            <p className="text-xs">Price trend data will appear here once you have sufficient order data.</p>
          </div>
        </CardContent>
      </Card>

      {/* Demand Forecast */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />Demand Forecast (Next 30 Days)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Electronics</span>
            <div className="flex items-center gap-2">
              <Progress value={85} className="h-2 w-20" />
              <span className="text-muted-foreground">High demand</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Garments</span>
            <div className="flex items-center gap-2">
              <Progress value={72} className="h-2 w-20" />
              <span className="text-muted-foreground">Good demand</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Agriculture</span>
            <div className="flex items-center gap-2">
              <Progress value={60} className="h-2 w-20" />
              <span className="text-muted-foreground">Steady</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Construction</span>
            <div className="flex items-center gap-2">
              <Progress value={45} className="h-2 w-20" />
              <span className="text-muted-foreground">Moderate</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Home & Garden</span>
            <div className="flex items-center gap-2">
              <Progress value={30} className="h-2 w-20" />
              <span className="text-muted-foreground">Low season</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SupplierProfilePage({ navigate }: { navigate: (page: string, params?: Record<string, string>) => void }) {
  const pageParams = useNavigationStore(s => s.pageParams)
  const supplierId = pageParams.supplierId as string | undefined
  const { user } = useAuthStore()
  const { data: supplier, loading: loadingSupplier } = useSupplierDetail(supplierId || null)
  const { data: products, loading: loadingProducts } = useSupplierProducts(supplierId || null, 12)

  const detail = supplier as SupplierDetail | null
  const productList = (products || []) as SupplierProduct[]

  const memberSince = detail?.memberSince
    ? new Date(detail.memberSince).toLocaleDateString('en-BD', { year: 'numeric', month: 'short' })
    : '—'

  const onTimeRate = detail?.ratingCount && detail?.ratingCount > 20
    ? `${Math.min(99, 85 + Math.round(detail.ratingCount / 10))}%`
    : '—'

  return (
    <div className="space-y-4">
      {/* Cover + Company header */}
      <Card className="border border-border overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/80 to-primary flex items-center justify-center relative">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, white 0%, transparent 50%), radial-gradient(circle at 75% 50%, white 0%, transparent 50%)' }}
          />
          <Building2 className="h-10 w-10 text-white/70" />
        </div>
        <CardContent className="p-4 -mt-6">
          <div className="bg-background rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 border-2 border-background shadow-sm">
                {detail?.companyName?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold">{detail?.companyName || 'Loading...'}</h3>
                  {detail?.verificationStatus === 'approved' && (
                    <Badge variant="default" className="text-[10px] h-5"><BadgeCheck className="h-3 w-3 mr-0.5" />Verified</Badge>
                  )}
                  {detail?.verificationStatus === 'pending' && (
                    <Badge variant="secondary" className="text-[10px] h-5">Pending Verification</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                    {detail ? `${detail.ratingAvg.toFixed(1)} (${detail.ratingCount} reviews)` : '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {detail?.warehouseCity || '—'}{detail?.warehouseDistrict ? `, ${detail.warehouseDistrict}` : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Since {memberSince}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold">{loadingProducts ? '...' : detail?.productCount || 0}</p><p className="text-[10px] text-muted-foreground">Products</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold">{detail?.ratingCount || 0}</p><p className="text-[10px] text-muted-foreground">Reviews</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold">{onTimeRate}</p><p className="text-[10px] text-muted-foreground">On-time</p></CardContent></Card>
      </div>

      {/* About */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" />About</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {detail?.companyName || 'This supplier'} is a verified wholesale partner on Zylod.
            {detail?.warehouseCity ? ` Based in ${detail.warehouseCity}${detail.warehouseDistrict ? `, ${detail.warehouseDistrict}` : ''}.` : ''}
            {detail?.productCount ? ` Offering ${detail.productCount} products.` : ''}
          </p>
        </CardContent>
      </Card>

      {/* Verification Status */}
      {detail?.verificationStatus && (
        <Card className="border border-border">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-green-500" />Verification Status</CardTitle></CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className={`material-symbols-outlined ${detail.verificationStatus === 'approved' ? 'text-green-500' : 'text-amber-500'}`} style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                {detail.verificationStatus === 'approved' ? 'check_circle' : 'hourglass_empty'}
              </span>
              <span>
                {detail.verificationStatus === 'approved' ? 'Trade License Verified' :
                 detail.verificationStatus === 'rejected' ? 'Verification Rejected' :
                 'Verification Pending'}
              </span>
            </div>
            {detail.tradeLicenseNumber && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>description</span>
                <span>License: {detail.tradeLicenseNumber}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Product Showcase */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" />Products ({detail?.productCount || 0})</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          {loadingProducts ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
            </div>
          ) : productList.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {productList.map(p => (
                <div key={p.id} className="p-2 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => navigate('product-detail', { productId: p.id })}>
                  {p.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnailUrl} alt={p.name} className="h-16 w-full object-cover rounded mb-1.5" />
                  ) : (
                    <div className="h-16 rounded bg-muted/50 flex items-center justify-center mb-1.5"><Package className="h-6 w-6 text-muted-foreground/50" /></div>
                  )}
                  <p className="text-xs font-medium line-clamp-2 leading-tight">{p.name}</p>
                  <p className="text-xs font-bold text-primary mt-0.5">৳{p.basePrice.toLocaleString()}{p.unit ? `/${p.unit}` : ''}</p>
                  <p className="text-[10px] text-muted-foreground">MOQ: {p.moq} · {p.soldCount > 0 ? `${p.soldCount} sold` : 'New'}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Package className="h-8 w-8 mx-auto opacity-50 mb-2" />
              <p>No products listed yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />Supplier Reviews ({detail?.ratingCount || 0})</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          {detail?.reviews && detail.reviews.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {detail.reviews.map(r => (
                <div key={r.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                      {(r.buyer.name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{r.buyer.name}</p>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-2.5 w-2.5 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p className="text-xs text-muted-foreground ml-8">{r.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Star className="h-6 w-6 mx-auto opacity-50 mb-1" />
              <p className="text-xs">No reviews yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Button */}
      <Button className="w-full h-10 text-sm" onClick={() => navigate('chat-detail', { supplierId: supplierId || '', supplierName: detail?.companyName || 'Supplier' })}>
        <MessageCircle className="h-4 w-4 mr-2" />Contact Supplier
      </Button>
    </div>
  )
}

function AdminSuppliersPage() {
  const { user: admin } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')

  const { data: suppliers, loading, refresh } = useSuppliers({ search: searchQuery || undefined, limit: 50 })

  const list = (suppliers || []) as SupplierListItem[]
  const verifiedCount = list.filter(s => s.verificationStatus === 'approved').length

  const handleVerify = async (s: SupplierListItem, action: 'approve' | 'reject') => {
    if (!admin?.id) return
    setBusyId(s.id)
    try {
      await verifySupplier(s.id, action, admin.id)
      setActionMsg(`Supplier ${action === 'approve' ? 'verified' : 'rejected'} successfully!`)
      setTimeout(() => setActionMsg(''), 3000)
      await refresh()
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const handleSuspend = async (s: SupplierListItem) => {
    if (!admin?.id) return
    setBusyId(s.id)
    try {
      await updateUserStatus(s.userId, 'suspend', admin.id)
      setActionMsg('Supplier suspended successfully!')
      setTimeout(() => setActionMsg(''), 3000)
      await refresh()
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const handleActivate = async (s: SupplierListItem) => {
    if (!admin?.id) return
    setBusyId(s.id)
    try {
      await updateUserStatus(s.userId, 'activate', admin.id)
      setActionMsg('Supplier activated successfully!')
      setTimeout(() => setActionMsg(''), 3000)
      await refresh()
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const isActive = (s: SupplierListItem) => s.accountStatus === 'active'
  const isVerified = (s: SupplierListItem) => s.verificationStatus === 'approved'

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold">{loading ? '…' : list.length}</p><p className="text-[10px] text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">{verifiedCount}</p><p className="text-[10px] text-muted-foreground">Verified</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{list.length - verifiedCount}</p><p className="text-[10px] text-muted-foreground">Pending</p></CardContent></Card>
      </div>

      {actionMsg && (
        <div className={`flex items-center gap-2 p-2 rounded-md text-xs ${actionMsg.startsWith('Failed') || actionMsg.startsWith('Request') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>{actionMsg}
        </div>
      )}

      {/* Search */}
      <Card className="border border-border">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search suppliers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Supplier table */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="h-4 w-4" />Supplier Verification</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {s.companyName ? s.companyName.charAt(0).toUpperCase() : 'S'}
                        </span>
                        <div>
                          <p className="text-xs font-medium">{s.companyName}</p>
                          <p className="text-[10px] text-muted-foreground">{s.city || '—'}{s.district ? ` · ${s.district}` : ''} · {s.productCount} products</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isVerified(s) ? (
                        <Badge variant="default" className="text-[10px]"><BadgeCheck className="h-3 w-3 mr-0.5" />Verified</Badge>
                      ) : s.verificationStatus === 'rejected' ? (
                        <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-0.5" />Rejected</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-0.5" />Pending</Badge>
                      )}
                      {!isActive(s) && <Badge variant="destructive" className="text-[10px] ml-1">Suspended</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {!isVerified(s) ? (
                          <Button variant="default" size="sm" className="h-7 text-[10px]" disabled={busyId === s.id} onClick={() => handleVerify(s, 'approve')}>
                            <UserCheck className="h-3 w-3 mr-1" />Verify
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" disabled={busyId === s.id} onClick={() => handleVerify(s, 'reject')}>
                            <XCircle className="h-3 w-3 mr-1" />Unverify
                          </Button>
                        )}
                        {isActive(s) ? (
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" disabled={busyId === s.id} onClick={() => handleSuspend(s)}>
                            <Ban className="h-3 w-3 mr-1" />Suspend
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" disabled={busyId === s.id} onClick={() => handleActivate(s)}>
                            <UserCheck className="h-3 w-3 mr-1" />Activate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {list.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">No suppliers found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SupportPage() {
  const [category, setCategory] = useState('account')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const recentTickets = [
    { id: 'TK-1024', subject: 'Invoice not received', status: 'Open', date: '2026-08-05' },
    { id: 'TK-1009', subject: 'Payment issue with bKash', status: 'Resolved', date: '2026-07-28' },
    { id: 'TK-0991', subject: 'Account verification delay', status: 'In Progress', date: '2026-07-22' },
  ]

  const submitTicket = () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitted(true)
  }

  return (
    <div className="space-y-4">
      {/* Contact channels */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border border-border"><CardContent className="p-3 text-center"><Phone className="h-4 w-4 mx-auto mb-1 text-primary" /><p className="text-xs font-medium">Call</p><p className="text-[10px] text-muted-foreground">9am–6pm</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><Mail className="h-4 w-4 mx-auto mb-1 text-primary" /><p className="text-xs font-medium">Email</p><p className="text-[10px] text-muted-foreground">24h reply</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><MessageCircle className="h-4 w-4 mx-auto mb-1 text-primary" /><p className="text-xs font-medium">Live Chat</p><p className="text-[10px] text-muted-foreground">Instant</p></CardContent></Card>
      </div>

      {/* Ticket form */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Submit a Ticket</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          {submitted ? (
            <div className="text-center py-6 space-y-2">
              <span className="material-symbols-outlined text-green-500" style={{ fontSize: 40, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>
              <p className="text-sm font-medium">Ticket Submitted</p>
              <p className="text-xs text-muted-foreground">Our support team will respond within 24 hours.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Account &amp; Verification</SelectItem>
                    <SelectItem value="payment">Payments &amp; Invoices</SelectItem>
                    <SelectItem value="order">Orders &amp; Delivery</SelectItem>
                    <SelectItem value="technical">Technical Issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Input placeholder="Brief summary of your issue" value={subject} onChange={e => setSubject(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Message</Label>
                <Textarea placeholder="Describe your issue in detail..." value={message} onChange={e => setMessage(e.target.value)} className="text-sm" rows={4} />
              </div>
              <Button className="w-full h-9 text-xs" onClick={submitTicket}><Plus className="h-3 w-3 mr-1" />Submit Ticket</Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent tickets */}
      <Card className="border border-border">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Recent Tickets</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          {recentTickets.map(t => (
            <div key={t.id} className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30">
              <div>
                <p className="text-xs font-medium">{t.subject}</p>
                <p className="text-[10px] text-muted-foreground">{t.id} · {t.date}</p>
              </div>
              <Badge variant={t.status === 'Resolved' ? 'default' : 'secondary'} className="text-[10px]">{t.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ChatListPage({ navigate }: { navigate: (page: string, params?: Record<string, string>) => void }) {
  const [query, setQuery] = useState('')
  const { user } = useAuthStore()
  const { data: conversations, loading } = useConversations(user?.id || null, (user?.userType === 'supplier' ? 'supplier' : 'buyer'))

  const all = (conversations || []) as ChatConversation[]
  const filtered = all.filter(c =>
    !query || c.otherPartyName.toLowerCase().includes(query.toLowerCase())
  )

  const formatTime = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)
    if (diffMin < 1) return 'now'
    if (diffMin < 60) return `${diffMin}m`
    if (diffHr < 24) return `${diffHr}h`
    if (diffDay < 7) return `${diffDay}d`
    return d.toLocaleDateString()
  }

  const avatarColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search conversations..." value={query} onChange={e => setQuery(e.target.value)} className="pl-9 text-sm rounded-2xl bg-muted/40 border-none" />
      </div>
      {loading ? (
        [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
      ) : (
        <>
          {filtered.map((c, idx) => {
            const initial = c.otherPartyName.charAt(0).toUpperCase()
            const bgColor = avatarColors[idx % avatarColors.length]
            const lastMsgText = c.lastMessage?.messageText
              ? (c.lastMessage.attachmentType === 'image' ? '📷 Image' :
                 c.lastMessage.attachmentUrl ? '📎 File' : c.lastMessage.messageText)
              : c.product ? `About: ${c.product.name}` : 'No messages yet'
            return (
              <Card
                key={c.id}
                className="border-0 bg-white/70 backdrop-blur-sm shadow-sm cursor-pointer hover:bg-white hover:shadow-md transition-all rounded-2xl"
                onClick={() => navigate('chat-detail', { conversationId: c.id, supplierId: c.otherPartyId, supplierName: c.otherPartyName })}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm" style={{ backgroundColor: bgColor }}>
                      {initial}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{c.otherPartyName}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(c.lastMessageAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {lastMsgText}
                    </p>
                  </div>
                  {c.unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] bg-primary text-primary-foreground shadow-sm">
                      {c.unreadCount}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {filtered.length === 0 && (
            <Card className="border-0 bg-white/70 backdrop-blur-sm shadow-sm rounded-2xl">
              <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-2">
                <MessageSquare className="h-8 w-8 mx-auto opacity-50" />
                <p className="font-medium">{query ? 'No conversations found' : 'No conversations yet'}</p>
                <p className="text-xs">Start chatting with suppliers to get quotes and close deals</p>
                {!query && <Button size="sm" variant="default" className="h-8 text-xs rounded-xl mt-2" onClick={() => navigate('suppliers')}><MessageCircle className="h-3 w-3 mr-1" />Browse Suppliers</Button>}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function ChatDetailPage({ navigate }: { navigate: (page: string, params?: Record<string, string>) => void }) {
  const pageParams = useNavigationStore(s => s.pageParams)
  const conversationId = pageParams.conversationId as string | undefined
  const supplierProfileId = pageParams.supplierId as string | undefined
  const { user } = useAuthStore()
  const userId = user?.id || null
  const userType = user?.userType || 'buyer'

  // Resolve the real supplier user id + name (for auto-creating conversations)
  const { data: supplierDetail } = useSupplierDetail(supplierProfileId && !conversationId ? supplierProfileId : null)
  const supplierUserId = conversationId ? pageParams.supplierUserId as string | undefined : supplierDetail?.userId

  const { data: messages, loading, refresh } = useMessages(conversationId || null, userId)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [attachment, setAttachment] = useState<{ preview: string; file: File } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [creatingConv, setCreatingConv] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const allMessages = (messages || []) as ChatMessage[]

  const otherName = (pageParams.supplierName as string)
    || (userType === 'supplier' ? pageParams.buyerName as string : '')
    || supplierDetail?.companyName
    || (conversationId ? (allMessages.find(m => m.senderId !== userId)?.senderName || 'Conversation') : 'Supplier')

  // If we arrived with only a supplierId, create (or reuse) the conversation
  useEffect(() => {
    const createIfNeeded = async () => {
      if (conversationId || !supplierProfileId || !supplierUserId || !userId) return
      if (userType !== 'buyer') return // only buyers start conversations
      setCreatingConv(true)
      setError(null)
      try {
        const conv = await createConversation(userId, supplierUserId, pageParams.productId as string | undefined)
        if (conv?.id) {
          navigate('chat-detail', {
            conversationId: conv.id,
            supplierId: supplierProfileId,
            supplierUserId,
            supplierName: pageParams.supplierName as string || supplierDetail?.companyName || 'Supplier',
          })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start conversation')
      } finally {
        setCreatingConv(false)
      }
    }
    createIfNeeded()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, supplierProfileId, supplierUserId, userId, userType])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [allMessages.length, sending])

  const send = async () => {
    const text = draft.trim()
    if ((!text && !attachment) || !conversationId || !userId) return
    setSending(true)
    setUploadError(null)
    try {
      let attachmentData: { url: string; type: string; name: string } | null = null
      if (attachment) {
        attachmentData = await uploadChatAttachment(attachment.file)
      }
      await sendMessage(conversationId, {
        senderId: userId,
        messageText: text || '',
        attachmentUrl: attachmentData?.url,
        attachmentType: attachmentData?.type,
        attachmentName: attachmentData?.name,
        replyToId: replyingTo?.id,
      })
      setDraft('')
      setAttachment(null)
      setReplyingTo(null)
      setSent(true)
      setTimeout(() => setSent(false), 2000)
      await refresh()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('File too large (max 8MB)')
      return
    }
    if (!file.type.startsWith('image/') && !['application/pdf', 'text/plain', 'text/csv'].includes(file.type)) {
      setUploadError('Only images, PDF and text files are supported')
      return
    }
    setUploadError(null)
    setAttachment({ preview: URL.createObjectURL(file), file })
    e.target.value = ''
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
  }

  // Group messages by day
  const groups: { label: string; items: ChatMessage[] }[] = []
  for (const m of allMessages) {
    const label = formatDateLabel(m.sentAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(m)
    else groups.push({ label, items: [m] })
  }

  const quickReplies = ['MOQ?', 'Unit price?', 'Shipping time?', 'Sample available?']

  return (
    <div className="flex flex-col h-[calc(100dvh-9.5rem)] min-h-[420px] max-h-[640px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 pb-3">
        <div className="relative shrink-0">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {(allMessages.find(m => m.senderId !== userId)?.senderName || 'S').charAt(0).toUpperCase()}
          </div>
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {otherName}
          </p>
          <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />Active now
          </p>
        </div>
        {supplierProfileId && (
          <Button variant="ghost" className="h-8 text-xs rounded-xl" onClick={() => navigate('supplier-profile', { supplierId: supplierProfileId })}>
            <Building className="h-3 w-3 mr-1" />Shop
          </Button>
        )}
      </div>

      {/* Messages area */}
      <Card className="border-0 bg-[#F2F3F5] shadow-inner flex-1 overflow-hidden rounded-2xl">
        <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-3 space-y-4 scroll-smooth">
          {creatingConv ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Starting conversation...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <p className="text-xs text-red-600 font-medium">{error}</p>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => navigate('suppliers')}>Browse Suppliers</Button>
            </div>
          ) : loading && allMessages.length === 0 ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-10 w-2/3 ml-auto rounded-2xl" />
              <Skeleton className="h-10 w-1/2 rounded-2xl" />
              <Skeleton className="h-10 w-3/5 ml-auto rounded-2xl" />
            </div>
          ) : groups.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2">
              <div className="h-14 w-14 rounded-full bg-white shadow-sm flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Say hello to start the conversation!</p>
              <p className="text-xs text-muted-foreground/70">Ask about MOQ, pricing, samples and delivery</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label} className="space-y-2.5">
                <div className="flex justify-center">
                  <span className="text-[10px] font-medium text-muted-foreground bg-white/80 px-3 py-1 rounded-full shadow-sm">{group.label}</span>
                </div>
                {group.items.map(m => {
                  const mine = m.senderId === userId
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!mine && (
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#4ECDC4] to-[#45B7D1] flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-auto">
                          {m.senderName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className={`max-w-[76%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                        {m.replyTo && (
                          <button
                            onClick={() => m.replyTo?.id && allMessages.find(x => x.id === m.replyTo!.id) && scrollRef.current?.querySelector(`[data-msg-id="${m.replyTo.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            className={`mt-1 mb-0.5 max-w-full rounded-xl px-3 py-1.5 text-left border-l-2 border-primary/60 bg-black/5 ${mine ? 'mr-0' : ''}`}
                          >
                            <p className="text-[9px] font-semibold text-primary truncate">↩ {m.replyTo.senderName}</p>
                            {m.replyTo.attachmentType === 'image' && m.replyTo.attachmentUrl ? (
                              <p className="text-[10px] text-muted-foreground truncate">📷 Photo</p>
                            ) : m.replyTo.attachmentUrl ? (
                              <p className="text-[10px] text-muted-foreground truncate">📎 Attachment</p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground truncate">{m.replyTo.messageText}</p>
                            )}
                          </button>
                        )}
                        <button
                          data-msg-id={m.id}
                          onClick={() => setReplyingTo(m)}
                          className={`group relative text-left block max-w-full px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-sm transition-all hover:shadow-md ${
                            mine
                              ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md'
                              : 'bg-white text-foreground rounded-bl-md'
                          }`}
                        >
                          {m.attachmentUrl && m.attachmentType === 'image' && (
                            <div className="mb-1.5 overflow-hidden rounded-xl">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.attachmentUrl} alt={m.attachmentName || 'attachment'} className="max-h-56 w-auto max-w-full object-cover" />
                            </div>
                          )}
                          {m.attachmentUrl && m.attachmentType !== 'image' && (
                            <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 mb-1.5 p-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors">
                              <Paperclip className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-[10px] font-medium truncate">{m.attachmentName || 'Download file'}</span>
                            </a>
                          )}
                          {m.messageText}
                          <span className={`block text-[9px] mt-1 flex items-center gap-1 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatTime(m.sentAt)}
                            {mine && <CheckCheck className="h-3 w-3" />}
                          </span>
                          <span className={`absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity ${mine ? 'bg-white text-foreground' : 'bg-primary text-primary-foreground'} text-[9px] px-2 py-0.5 rounded-full shadow text-[10px]`}>
                            Reply
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-2xl">
          <CornerUpLeft className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-primary">Replying to {replyingTo.senderName}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {replyingTo.attachmentType === 'image' ? '📷 Photo' : replyingTo.attachmentUrl ? '📎 Attachment' : replyingTo.messageText}
            </p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-white border border-border rounded-2xl shadow-sm">
          {attachment.file.type.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.preview} alt="preview" className="h-10 w-10 object-cover rounded-lg" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Paperclip className="h-4 w-4 text-muted-foreground" /></div>
          )}
          <span className="text-xs text-muted-foreground truncate flex-1">{attachment.file.name}</span>
          <button onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      {uploadError && <p className="text-[10px] text-red-600 mt-1.5 px-1">{uploadError}</p>}

      {/* Composer */}
      <Card className="border-0 shadow-sm rounded-2xl mt-2">
        <CardContent className="p-2.5">
          <div className="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar">
            {quickReplies.map(q => (
              <button key={q} className="text-[10px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted whitespace-nowrap" onClick={() => setDraft(q)}>{q}</button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.csv" className="hidden" onChange={handleFilePick} />
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground" onClick={() => fileInputRef.current?.click()} disabled={uploading || sending}>
              {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </Button>
            <Input
              placeholder="Type a message..."
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              className="text-sm rounded-2xl bg-muted/40 border-none flex-1"
              disabled={sending || uploading}
            />
            <Button className="h-9 w-9 px-0 rounded-full shrink-0" onClick={send} disabled={sending || uploading || (!draft.trim() && !attachment)}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {sent && <p className="text-[10px] text-green-600 mt-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Message sent</p>}
        </CardContent>
      </Card>
    </div>
  )
}

function QuoteRequestPage() {
  const pageParams = useNavigationStore(s => s.pageParams)
  const { user, token } = useAuthStore()
  const product = pageParams.productId || ''
  const [form, setForm] = useState({ product: product, quantity: '', unit: 'pcs', budget: '', deadline: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const submit = async () => {
    if (!form.product.trim() || !form.quantity.trim()) return
    if (!user?.id) {
      setError('Please sign in to submit an RFQ')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.product.trim(),
          description: form.message || form.product.trim(),
          quantity: parseInt(form.quantity) || null,
          unit: form.unit,
          targetPrice: form.budget ? parseFloat(form.budget) : null,
          deadline: form.deadline || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to submit')
      setCreatedId(json.data.id)
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit RFQ')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card className="border border-border text-center">
        <CardContent className="p-8 space-y-3">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-base font-semibold">Quote Request Sent</h2>
          <p className="text-xs text-muted-foreground">Your RFQ <span className="font-medium text-foreground">{createdId ? `#${createdId.slice(-6).toUpperCase()}` : ''}</span> has been submitted. Suppliers will send offers within 48 hours.</p>
          <Button variant="outline" className="h-9 text-xs" onClick={() => { setSubmitted(false); setCreatedId(null) }}>Submit Another</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>
      )}
      <Card className="border border-border">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Product / Service</Label>
            <Input placeholder="e.g. Cotton fabric 200 GSM" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Quantity</Label>
              <Input placeholder="e.g. 2000" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit</Label>
              <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pcs', 'kg', 'meter', 'roll', 'dozen', 'set'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Target price / unit (৳)</Label>
              <Input placeholder="e.g. 170" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery deadline</Label>
              <Input placeholder="e.g. 2026-08-30" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className="text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Requirements</Label>
            <Textarea placeholder="Specs, color, packaging, sample needs..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="text-sm" rows={3} />
          </div>
          <Button className="w-full h-9 text-xs" onClick={submit} disabled={submitting}>
            <FileText className="h-3 w-3 mr-1" />{submitting ? 'Submitting...' : 'Request Quote from Suppliers'}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">Your request is visible to verified suppliers in matching categories only.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function RfqListPage() {
  const { user } = useAuthStore()
  const { data: rfqs, loading } = useRfqs(user?.id || null, (user?.userType === 'supplier' ? 'supplier' : 'buyer'))
  const badgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = { open: 'default', quoted: 'secondary', awarded: 'outline', closed: 'secondary', expired: 'secondary' }
  const allRfqs = (rfqs || []) as RfqItem[]

  return (
    <div className="space-y-3">
      {loading ? (
        [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
      ) : allRfqs.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-2">
            <FileText className="h-8 w-8 mx-auto opacity-50" />
            <p>No RFQs yet</p>
          </CardContent>
        </Card>
      ) : (
        allRfqs.map(r => (
          <Card key={r.id} className="border border-border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{r.title}</p>
                <Badge variant={badgeVariant[r.status] || 'secondary'} className="text-[10px] capitalize">{r.status}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">#{r.id.slice(-6).toUpperCase()} · Submitted {new Date(r.createdAt).toLocaleDateString()}</p>
              {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {r.quantity ? `${r.quantity.toLocaleString()} ${r.unit}` : 'Qty TBD'}
                  {r.targetPrice && ` · Target ৳${r.targetPrice}/${r.unit}`}
                </span>
                <span className="text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" />{r.quoteCount} quote{r.quoteCount === 1 ? '' : 's'}</span>
              </div>
            </CardContent>
          </Card>
        ))
      )}
      <Card className="border border-border bg-muted/30">
        <CardContent className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <p>RFQs stay active until their deadline. Accept the best quote or negotiate directly in chat.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function AddAddressPage() {
  const { user, token } = useAuthStore()
  const userId = user?.id || null
  const { data: addresses, loading: loadingAddr, refresh } = useAddresses(userId)
  const [form, setForm] = useState({ label: 'Home', name: '', phone: '', address: '', city: '', postal: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Name, phone, and address are required')
      return
    }
    if (!userId) {
      setError('Please sign in to save an address')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: form.label,
          addressLine1: form.address,
          city: form.city || 'Dhaka',
          district: form.city || 'Dhaka',
          postalCode: form.postal || '0000',
          country: 'Bangladesh',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save')
      setSaved(true)
      await refresh()
      setForm({ label: 'Home', name: '', phone: '', address: '', city: '', postal: '' })
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save address')
    } finally {
      setSaving(false)
    }
  }

  const allAddresses = (addresses || []) as Address[]

  return (
    <div className="space-y-4">
      {saved && (
        <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-3 text-xs text-green-700 flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" />Address saved successfully</CardContent></Card>
      )}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>
      )}
      <Card className="border border-border">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {['Home', 'Office', 'Store'].map(l => (
              <button key={l} className={`text-xs py-2 rounded-md border transition-colors ${form.label === l ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground'}`} onClick={() => setForm({ ...form, label: l })}>{l}</button>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Full name</Label>
            <Input placeholder="Recipient name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone number</Label>
            <Input placeholder="+880 1XXX-XXXXXX" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Address</Label>
            <Textarea placeholder="House, road, area" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="text-sm" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">City / District</Label>
              <Input placeholder="e.g. Dhaka" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Postal code</Label>
              <Input placeholder="e.g. 1205" value={form.postal} onChange={e => setForm({ ...form, postal: e.target.value })} className="text-sm" />
            </div>
          </div>
          <Button className="w-full h-9 text-xs" onClick={save} disabled={saving}>
            <Save className="h-3 w-3 mr-1" />{saving ? 'Saving...' : 'Save Address'}
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Saved addresses</p>
        {loadingAddr ? (
          [1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
        ) : allAddresses.length === 0 ? (
          <Card className="border border-border"><CardContent className="p-6 text-center text-xs text-muted-foreground">No saved addresses yet</CardContent></Card>
        ) : (
          allAddresses.map(a => (
            <Card key={a.id} className="border border-border">
              <CardContent className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium flex items-center gap-1"><Home className="h-3 w-3" />{a.label}{a.isDefault && <Badge className="ml-1 h-4 px-1.5 text-[9px]">Default</Badge>}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{a.addressLine1}{a.addressLine2 ? `, ${a.addressLine2}` : ''}</p>
                  <p className="text-[11px] text-muted-foreground">{a.city}, {a.district} {a.postalCode}</p>
                </div>
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

// ========== NOTIFICATIONS PAGE ==========

function NotificationsPage() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } = useNotificationStore()
  const { navigate } = useNavigationStore()

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  useEffect(() => { if (isAuthenticated) fetchNotifications() }, [isAuthenticated, fetchNotifications])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString()
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'order-update': return <Package className="h-4 w-4" />
      case 'new-message': return <MessageSquare className="h-4 w-4" />
      case 'price-drop': return <TrendingDown className="h-4 w-4" />
      case 'verification-status': return <Shield className="h-4 w-4" />
      case 'deal-alert': return <Zap className="h-4 w-4" />
      case 'review': return <Star className="h-4 w-4" />
      case 'promotion': return <Megaphone className="h-4 w-4" />
      default: return <Bell className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-3">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground rounded-full">{unreadCount} unread</Badge>
          )}
          <span className="text-xs text-muted-foreground">{notifications.length} total</span>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
            <CheckCheck className="h-3 w-3 mr-1" />Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
      ) : notifications.length === 0 ? (
        <Card className="border-0 bg-white/70 backdrop-blur-sm shadow-sm rounded-2xl">
          <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-2">
            <Bell className="h-8 w-8 mx-auto opacity-50" />
            <p className="font-medium">No notifications yet</p>
            <p className="text-xs">Order updates, messages, and deals will appear here</p>
          </CardContent>
        </Card>
      ) : (
        notifications.map((n) => (
          <Card
            key={n.id}
            className={`border-0 backdrop-blur-sm shadow-sm cursor-pointer hover:shadow-md transition-all rounded-2xl ${n.isRead ? 'bg-white/50' : 'bg-white/90 border-l-4 border-l-primary'}`}
            onClick={() => { if (!n.isRead) markAsRead(n.id) }}
          >
            <CardContent className="p-3 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: n.isRead ? '#f5f5f5' : '#FEE2E2' }}>
                {typeIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${n.isRead ? 'text-muted-foreground' : 'font-semibold'}`}>{n.title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(n.timestamp)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
              </div>
              {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

// ========== SELLER STOREFRONT PAGE ==========

function SellerStorefrontPage() {
  const { user, token } = useAuthStore()
  const { navigate } = useNavigationStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storefront, setStorefront] = useState<any>(null)

  // Customization form state
  const [theme, setTheme] = useState('default')
  const [layout, setLayout] = useState('grid')
  const [font, setFont] = useState('inter')
  const [showRatings, setShowRatings] = useState(true)
  const [showContactInfo, setShowContactInfo] = useState(true)
  const [showCategories, setShowCategories] = useState(true)
  const [showRecentOrders, setShowRecentOrders] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function fetchStorefront() {
      if (!token) { setLoading(false); return }
      try {
        const res = await fetch('/api/suppliers/storefront', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load')
        setStorefront(json.data)
        const c = json.data.customization
        setTheme(c.theme || 'default')
        setLayout(c.layout || 'grid')
        setFont(c.font || 'inter')
        setShowRatings(c.showRatings ?? true)
        setShowContactInfo(c.showContactInfo ?? true)
        setShowCategories(c.showCategories ?? true)
        setShowRecentOrders(c.showRecentOrders ?? false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load storefront')
      } finally {
        setLoading(false)
      }
    }
    fetchStorefront()
  }, [token])

  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/suppliers/storefront', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ theme, layout, font, showRatings, showContactInfo, showCategories, showRecentOrders }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-4">
      {saved && (
        <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-3 text-xs text-green-700 flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" />Storefront saved successfully</CardContent></Card>
      )}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>
      )}

      {/* Storefront Preview */}
      <Card className="border border-border overflow-hidden">
        <div className="bg-gradient-to-br from-primary/90 to-primary/60 h-32 relative">
          {storefront?.customization?.bannerUrl && (
            <img src={storefront.customization.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          )}
          <div className="absolute bottom-3 left-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg">
              {storefront?.customization?.logoUrl ? (
                <img src={storefront.customization.logoUrl} alt="Logo" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <Store className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <p className="text-white font-bold text-sm">{storefront?.supplier?.companyName || 'Your Store'}</p>
              <div className="flex items-center gap-1 text-white/80 text-xs">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span>{(storefront?.supplier?.ratingAvg ?? 0).toFixed(1)}</span>
                <span className="ml-1">({storefront?.stats?.activeProducts || 0} products)</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Customization Form */}
      <Card className="border border-border">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Palette className="h-4 w-4 text-primary" />Appearance</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Layout</Label>
              <Select value={layout} onValueChange={setLayout}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="masonry">Masonry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Font</Label>
            <Select value={font} onValueChange={setFont}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inter">Inter</SelectItem>
                <SelectItem value="roboto">Roboto</SelectItem>
                <SelectItem value="poppins">Poppins</SelectItem>
                <SelectItem value="open_sans">Open Sans</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <h3 className="text-sm font-semibold flex items-center gap-2 pt-2"><Settings className="h-4 w-4 text-primary" />Display Options</h3>

          <div className="space-y-3">
            {[
              { label: 'Show Ratings', desc: 'Display product and store ratings', value: showRatings, toggle: setShowRatings },
              { label: 'Show Contact Info', desc: 'Display phone and email on storefront', value: showContactInfo, toggle: setShowContactInfo },
              { label: 'Show Categories', desc: 'Display product category navigation', value: showCategories, toggle: setShowCategories },
              { label: 'Show Recent Orders', desc: 'Display recent order activity', value: showRecentOrders, toggle: setShowRecentOrders },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={item.value} onCheckedChange={item.toggle} />
              </div>
            ))}
          </div>

          <Button className="w-full h-9 text-xs" onClick={handleSave} disabled={saving}>
            <Save className="h-3 w-3 mr-1" />{saving ? 'Saving...' : 'Save Storefront'}
          </Button>
        </CardContent>
      </Card>

      {/* Quick stats */}
      {storefront && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{storefront.stats?.totalProducts || 0}</p><p className="text-[11px] text-muted-foreground">Total Products</p></CardContent></Card>
          <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">{storefront.stats?.activeProducts || 0}</p><p className="text-[11px] text-muted-foreground">Active</p></CardContent></Card>
          <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{(storefront.supplier?.ratingAvg ?? 0).toFixed(1)}</p><p className="text-[11px] text-muted-foreground">Rating</p></CardContent></Card>
        </div>
      )}
    </div>
  )
}

// ========== MY COUPONS PAGE ==========

function MyCouponsPage() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [coupons, setCoupons] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCoupons() {
      if (!token) { setLoading(false); return }
      try {
        const res = await fetch('/api/coupons/my', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load coupons')
        setCoupons(json.data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load coupons')
      } finally {
        setLoading(false)
      }
    }
    fetchCoupons()
  }, [token])

  const active = coupons.filter(c => c.status === 'active')
  const used = coupons.filter(c => c.status === 'used')
  const expired = coupons.filter(c => c.status === 'expired')

  const renderCoupon = (c: any, dimmed: boolean) => (
    <Card key={c.id} className={`border ${dimmed ? 'border-border/50 opacity-60' : 'border-dashed border-primary/40 bg-primary/5'}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: dimmed ? '#f5f5f5' : '#FEE2E2' }}>
          <Gift className={`h-5 w-5 ${dimmed ? 'text-muted-foreground' : 'text-primary'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{c.title || c.code || 'Coupon'}</p>
          <p className="text-xs text-muted-foreground">
            {c.discountType === 'percentage' ? `${c.discountValue}% off` : `৳${c.discountValue} off`}
            {c.minOrderAmount ? ` · min ৳${c.minOrderAmount}` : ''}
          </p>
          {c.validUntil && (
            <p className="text-[10px] text-muted-foreground">Valid until {new Date(c.validUntil).toLocaleDateString()}</p>
          )}
        </div>
        {c.code && (
          <Badge variant={dimmed ? 'outline' : 'default'} className="text-[10px] font-mono shrink-0">{c.code}</Badge>
        )}
      </CardContent>
    </Card>
  )

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{active.length}</p><p className="text-[11px] text-muted-foreground">Active</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-muted-foreground">{used.length}</p><p className="text-[11px] text-muted-foreground">Used</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-muted-foreground">{expired.length}</p><p className="text-[11px] text-muted-foreground">Expired</p></CardContent></Card>
      </div>

      {active.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Active</h3>
          {active.map(c => renderCoupon(c, false))}
        </div>
      )}
      {used.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Used</h3>
          {used.map(c => renderCoupon(c, true))}
        </div>
      )}
      {expired.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Expired</h3>
          {expired.map(c => renderCoupon(c, true))}
        </div>
      )}
      {coupons.length === 0 && !error && (
        <Card className="border border-border">
          <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-2">
            <Gift className="h-8 w-8 mx-auto opacity-50" />
            <p className="font-medium">No coupons yet</p>
            <p className="text-xs">Earn coupons by checking in daily, writing reviews, and referring businesses</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ========== EARN COUPONS PAGE ==========

function EarnCouponsPage() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTasks() {
      if (!token) { setLoading(false); return }
      try {
        const res = await fetch('/api/coupons/earn', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load tasks')
        setTasks(json.data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load earning tasks')
      } finally {
        setLoading(false)
      }
    }
    fetchTasks()
  }, [token])

  const typeIcon = (type: string) => {
    switch (type) {
      case 'share': return <Send className="h-5 w-5" />
      case 'review': case 'review_photo': return <Star className="h-5 w-5" />
      case 'bulk': case 'first_order': case 'milestone': return <ShoppingBag className="h-5 w-5" />
      case 'referral': return <UserPlus className="h-5 w-5" />
      case 'checkin': return <CalendarDays className="h-5 w-5" />
      case 'spin': return <Award className="h-5 w-5" />
      case 'wishlist': return <Heart className="h-5 w-5" />
      default: return <Zap className="h-5 w-5" />
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-3">
      {error && (
        <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>
      )}
      {tasks.length === 0 && !error && (
        <Card className="border border-border">
          <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-2">
            <Zap className="h-8 w-8 mx-auto opacity-50" />
            <p className="font-medium">No earning tasks available right now</p>
            <p className="text-xs">Check back later for new ways to earn coupons</p>
          </CardContent>
        </Card>
      )}
      {tasks.map(t => (
        <Card key={t.id} className="border border-border">
          <CardContent className="p-3 flex items-start gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: t.iconColor || '#C8102E' }}>
              {typeIcon(t.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold truncate">{t.title}</p>
                <Badge variant="outline" className="text-[10px] shrink-0 border-primary/30 text-primary">{t.rewardLabel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ========== SEARCH HOME PAGE ==========

function SearchHomePage({ navigate }: { navigate: (page: string, params?: Record<string, string>) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query.trim())}&limit=20`)
      const json = await res.json()
      if (res.ok) setResults(json.data || json.products || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products, suppliers, categories..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-10 text-sm rounded-xl bg-white border-border"
          autoFocus
        />
      </form>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : searched ? (
        results.length === 0 ? (
          <Card className="border border-border">
            <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-2">
              <Search className="h-8 w-8 mx-auto opacity-50" />
              <p className="font-medium">No results for &quot;{query}&quot;</p>
              <p className="text-xs">Try different keywords or browse categories</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate('category-products')}>Browse All Products</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{results.length} results for &quot;{query}&quot;</p>
            <div className="space-y-2">
              {results.map(p => (
                <Card key={p.id} className="border border-border cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('product-detail', { productId: p.id })}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {p.thumbnailUrl ? (
                        <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">MOQ: {p.moq} {p.unit || 'pcs'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">৳{p.basePrice}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )
      ) : (
        <Card className="border border-border">
          <CardContent className="p-6 text-center space-y-3">
            <Search className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
            <p className="text-sm font-medium">Search Zylod</p>
            <p className="text-xs text-muted-foreground">Find wholesale products from verified suppliers across Bangladesh</p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {['t-shirt', 'rice', 'electronics', 'packaging', 'textile'].map(term => (
                <button key={term} className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors" onClick={() => { setQuery(term); setTimeout(() => handleSearch(), 0) }}>{term}</button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ========== LOYALTY POINTS PAGE ==========

function LoyaltyPointsPage() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRewards() {
      if (!token) { setLoading(false); return }
      try {
        const res = await fetch('/api/rewards', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load rewards')
        setData(json.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load rewards')
      } finally {
        setLoading(false)
      }
    }
    fetchRewards()
  }, [token])

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
  }

  if (error) {
    return <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>
  }

  const tierColors: Record<string, string> = { bronze: '#CD7F32', silver: '#9E9E9E', gold: '#FFD700', platinum: '#E5E4E2' }

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <Card className="border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-5 text-center space-y-3">
          <Crown className="h-8 w-8 mx-auto" style={{ color: tierColors[data.tier] || '#CD7F32' }} />
          <div>
            <p className="text-3xl font-bold text-primary">{data.balance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">points available</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="capitalize" style={{ borderColor: tierColors[data.tier], color: tierColors[data.tier] }}>{data.tier}</Badge>
            {data.nextTier && (
              <span className="text-[11px] text-muted-foreground">
                {data.nextTier.pointsNeeded.toLocaleString()} pts to {data.nextTier.tier}
              </span>
            )}
          </div>
          {data.nextTier && <Progress value={data.nextTier.progressPct} className="h-2" />}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">{data.totalEarned.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">Total Earned</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-muted-foreground">{data.totalRedeemed.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">Total Redeemed</p></CardContent></Card>
      </div>

      {/* Recent history */}
      {data.history?.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold">Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.history.slice(0, 10).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <p className="truncate">{t.description || t.type}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={t.points >= 0 ? 'text-green-600 font-semibold shrink-0' : 'text-destructive font-semibold shrink-0'}>
                  {t.points >= 0 ? '+' : ''}{t.points}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ========== REDEEM POINTS PAGE ==========

function RedeemPointsPage() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch('/api/rewards', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rewards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const handleRedeem = async (redeemId: string) => {
    if (!token) return
    setRedeeming(redeemId)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ redeemId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to redeem')
      setMessage(json.message)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to redeem')
    } finally {
      setRedeeming(null)
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-4">
      {message && <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-3 text-xs text-green-700 flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" />{message}</CardContent></Card>}
      {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>}

      {data && (
        <Card className="border border-primary/30 bg-primary/5">
          <CardContent className="p-3 text-center">
            <p className="text-sm font-semibold text-primary">{data.balance.toLocaleString()} points available</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(data?.redeemOptions || []).map((opt: any) => {
          const canAfford = data.balance >= opt.points
          return (
            <Card key={opt.id} className={`border ${canAfford ? 'border-border' : 'border-border/50 opacity-60'}`}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Gift className="h-4 w-4 text-primary" /></div>
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.points.toLocaleString()} points</p>
                  </div>
                </div>
                <Button size="sm" className="h-8 text-xs shrink-0" disabled={!canAfford || redeeming === opt.id} onClick={() => handleRedeem(opt.id)}>
                  {redeeming === opt.id ? 'Redeeming...' : 'Redeem'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ========== DAILY CHECK-IN PAGE ==========

function DailyCheckinPage() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<any>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch('/api/rewards/checkin', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setState(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load check-in status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const handleCheckin = async () => {
    if (!token) return
    setCheckingIn(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/rewards/checkin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to check in')
      setMessage(json.message)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check in')
    } finally {
      setCheckingIn(false)
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
  }

  const streak = state?.streak || 0
  const checkedInToday = state?.checkedInToday

  return (
    <div className="space-y-4">
      {message && <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-3 text-xs text-green-700 flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" />{message}</CardContent></Card>}
      {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>}

      <Card className="border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-6 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-3xl font-bold text-primary">{streak} day{streak === 1 ? '' : 's'}</p>
            <p className="text-xs text-muted-foreground">current streak</p>
          </div>
          <Button className="w-full" disabled={checkedInToday || checkingIn} onClick={handleCheckin}>
            {checkingIn ? 'Checking in...' : checkedInToday ? '✓ Checked in today' : 'Check In — Earn 10 pts'}
          </Button>
          <p className="text-[11px] text-muted-foreground">Every 7-day streak earns a +50 point bonus</p>
        </CardContent>
      </Card>

      {/* 7-day visual */}
      <Card className="border border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const daysDone = streak % 7 === 0 && streak > 0 ? 7 : streak % 7
              const dayInStreak = i < daysDone
              return (
                <div key={i} className="text-center space-y-1">
                  <div className={`h-9 w-full rounded-lg flex items-center justify-center text-xs font-bold ${dayInStreak ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {i === 6 ? <Gift className="h-4 w-4" /> : dayInStreak ? '✓' : i + 1}
                  </div>
                  <p className="text-[9px] text-muted-foreground">{i === 6 ? 'Bonus' : `Day ${i + 1}`}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ========== SPIN & WIN PAGE ==========

function SpinWinPage() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch('/api/rewards/spin', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spin status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const handleSpin = async () => {
    if (!token || spinning) return
    setSpinning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/rewards/spin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to spin')
      // Simulate wheel animation, then reveal
      setTimeout(() => {
        setResult(json.data)
        setSpinning(false)
        load()
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to spin')
      setSpinning(false)
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
  }

  const spinsRemaining = data?.spinsRemaining ?? 0

  return (
    <div className="space-y-4">
      {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>}

      <Card className="border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-6 text-center space-y-5">
          <div className={`h-32 w-32 rounded-full border-8 border-primary/30 bg-white mx-auto flex items-center justify-center transition-transform duration-1000 ${spinning ? 'animate-spin' : ''}`}>
            {result && !spinning ? (
              <div className="text-center">
                <Award className="h-8 w-8 text-primary mx-auto" />
                <p className="text-xs font-bold text-primary mt-1">{result.prizeLabel}</p>
              </div>
            ) : (
              <Award className="h-10 w-10 text-primary/50" />
            )}
          </div>

          {result && !spinning && (
            <p className="text-sm font-semibold text-primary">{result.prizeType === 'try-again' ? 'No luck — try again!' : `🎉 You won ${result.prizeLabel}!`}</p>
          )}

          <div>
            <p className="text-xs text-muted-foreground">{spinsRemaining} of {data?.maxSpins ?? 3} spins remaining today</p>
          </div>

          <Button className="w-full" size="lg" disabled={spinning || spinsRemaining === 0} onClick={handleSpin}>
            {spinning ? 'Spinning...' : spinsRemaining === 0 ? 'Come back tomorrow' : 'SPIN NOW'}
          </Button>
        </CardContent>
      </Card>

      {/* Prize pool */}
      {data?.wheel?.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold">Prize Pool</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.wheel.map((p: any, i: number) => (
              <Badge key={i} variant="outline" className="text-[10px]">{p.prizeLabel}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {data?.history?.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold">Recent Spins</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.history.slice(0, 10).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span>{h.prizeLabel}</span>
                <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ========== REFERRAL PROGRAM PAGE ==========

function ReferralProgramPage() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchReferral() {
      if (!token) { setLoading(false); return }
      try {
        const res = await fetch('/api/referrals', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load')
        setData(json.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load referral info')
      } finally {
        setLoading(false)
      }
    }
    fetchReferral()
  }, [token])

  const handleCopy = async () => {
    if (!data?.code) return
    try {
      await navigator.clipboard.writeText(data.shareUrl || data.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
  }

  if (error) {
    return <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-3 text-xs text-destructive">{error}</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <Card className="border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <UserPlus className="h-10 w-10 text-primary mx-auto" />
            <h3 className="text-lg font-bold">Refer a Business, Earn ৳500</h3>
            <p className="text-xs text-muted-foreground">Earn {data?.rewardPointsPerReferral || 500} points when each referral completes their first order</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white rounded-lg border-2 border-dashed border-primary/40 px-3 py-2.5 text-center">
              <p className="font-mono font-bold text-primary tracking-wider">{data?.code || '—'}</p>
            </div>
            <Button size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4" /> : 'Copy'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{data?.totalInvited || 0}</p><p className="text-[11px] text-muted-foreground">Invited</p></CardContent></Card>
        <Card className="border border-border"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">{data?.successfulReferrals || 0}</p><p className="text-[11px] text-muted-foreground">Successful</p></CardContent></Card>
      </div>

      {data?.uses?.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold">Referral History</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.uses.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Joined {new Date(u.joinedAt).toLocaleDateString()}</span>
                <Badge variant={u.rewardGiven ? 'default' : 'secondary'} className="text-[10px]">
                  {u.rewardGiven ? 'Rewarded' : 'Pending first order'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ========== WRITE REVIEW PAGE ==========

function WriteReviewPage() {
  const pageParams = useNavigationStore(s => s.pageParams)
  const { token } = useAuthStore()
  const productId = pageParams.productId as string | undefined

  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/reviews/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Upload failed')
      setImages(prev => [...prev, json.data.url])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    if (!productId) { setError('No product selected'); return }
    if (rating < 1) { setError('Please select a star rating'); return }
    if (comment.trim().length < 10) { setError('Please write at least 10 characters'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ rating, comment: comment.trim(), images }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to submit review')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Card className="border border-border">
        <CardContent className="p-8 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
          <p className="font-semibold">Review submitted!</p>
          <p className="text-xs text-muted-foreground">Thanks for helping other wholesale buyers make better decisions.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border">
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Your rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i)}>
                  <Star className={`h-7 w-7 transition-colors ${i <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">{rating > 0 ? `${rating}/5` : 'Tap to rate'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Your review</Label>
            <Textarea
              placeholder="Share your experience with product quality, packaging, and delivery..."
              rows={5}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{comment.trim().length}/10 minimum characters</p>
          </div>

          <div className="space-y-2">
            <Label>Photos (optional)</Label>
            <div className="flex flex-wrap gap-3">
              {images.map(url => (
                <div key={url} className="relative h-20 w-20 rounded-lg overflow-hidden border border-border">
                  <img src={url} alt="review" className="h-full w-full object-cover" />
                  <button type="button" className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5" onClick={() => setImages(prev => prev.filter(u => u !== url))}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors text-muted-foreground">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                <span className="text-[10px] mt-1">Add photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button className="w-full" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit Review
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ========== RETURN REQUEST PAGE ==========

function ReturnRequestPage() {
  const pageParams = useNavigationStore(s => s.pageParams)
  const { token } = useAuthStore()
  const orderId = pageParams.orderId as string | undefined

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('')
  const [comments, setComments] = useState('')
  const [shippingMethod, setShippingMethod] = useState('courier')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!orderId) { setLoading(false); return }
    fetch(`/api/orders/${orderId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(json => { if (json.success) setOrder(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orderId, token])

  const allItems = (order?.subOrders || []).flatMap((so: any) =>
    (so.items || []).map((it: any) => ({ ...it, supplierName: so.supplier?.companyName || 'Supplier' }))
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (!orderId) { setError('No order selected'); return }
    if (selected.size === 0) { setError('Select at least one item to return'); return }
    if (reason.length < 5) { setError('Please provide a return reason (min 5 characters)'); return }
    setSubmitting(true)
    setError(null)
    try {
      const items = [...selected].map(itemId => ({ itemId, reason, quantity: 1, comments }))
      const res = await fetch(`/api/orders/${orderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ shippingMethod, items }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Return request failed')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Return request failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Card className="border border-border">
        <CardContent className="p-8 text-center space-y-3">
          <RefreshCw className="h-10 w-10 mx-auto text-primary" />
          <p className="font-semibold">Return request submitted</p>
          <p className="text-xs text-muted-foreground">Our team will review it and update you via notification.</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
  }

  if (!order) {
    return (
      <Card className="border border-border">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">Order not found.</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border">
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold text-sm">Select items to return</p>
          {allItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">No items found on this order.</p>
          ) : (
            <div className="space-y-2">
              {allItems.map((it: any) => (
                <label key={it.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected.has(it.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} className="h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.product?.name || 'Product'}</p>
                    <p className="text-xs text-muted-foreground">{it.supplierName} · Qty {it.quantity} · ৳{it.totalPrice}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="border border-border">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Return reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Choose a reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Damaged on arrival">Damaged on arrival</SelectItem>
                  <SelectItem value="Wrong item received">Wrong item received</SelectItem>
                  <SelectItem value="Quality not as described">Quality not as described</SelectItem>
                  <SelectItem value="Missing items">Missing items</SelectItem>
                  <SelectItem value="Ordered by mistake">Ordered by mistake</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea rows={4} placeholder="Describe what went wrong..." value={comments} onChange={e => setComments(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Return shipping method</Label>
              <Select value={shippingMethod} onValueChange={setShippingMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="courier">Courier pickup</SelectItem>
                  <SelectItem value="dropoff">Self drop-off</SelectItem>
                  <SelectItem value="replace">Replacement (no return needed)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" disabled={submitting} onClick={submit}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit Return Request
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ========== DISPUTE CENTER PAGE ==========

function DisputeCenterPage() {
  const { token } = useAuthStore()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('order_issue')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/support/tickets', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) setTickets(json.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token])

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ category, subject, description, priority }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to open ticket')
      setSubject(''); setDescription('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const statusColor = (s: string) => s === 'open' ? 'bg-blue-500/10 text-blue-600' : s === 'resolved' || s === 'closed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'

  return (
    <div className="space-y-4">
      <Card className="border border-border">
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold text-sm">Open a new dispute / support ticket</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="order_issue">Order issue</SelectItem>
                  <SelectItem value="payment_issue">Payment issue</SelectItem>
                  <SelectItem value="account_issue">Account issue</SelectItem>
                  <SelectItem value="product_issue">Product issue</SelectItem>
                  <SelectItem value="seller_issue">Seller issue</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input placeholder="Short summary of the issue" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={4} placeholder="Describe the issue in detail (min 20 characters)..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button className="w-full" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Submit Ticket
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Your tickets ({tickets.length})</p>
        {loading ? (
          [1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : tickets.length === 0 ? (
          <Card className="border border-border"><CardContent className="p-6 text-center text-xs text-muted-foreground">No tickets yet.</CardContent></Card>
        ) : (
          tickets.map(t => (
            <Card key={t.id} className="border border-border">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.category.replace(/_/g, ' ')} · {new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                <Badge className={statusColor(t.status)}>{t.status}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

// ========== VOICE SEARCH PAGE ==========

function VoiceSearchPage() {
  const { token } = useAuthStore()
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)

  const runSearch = async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=20`)
      const json = await res.json()
      if (res.ok) setResults(json.data || json.products || [])
      // Record the voice search into real history
      fetch('/api/search/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query, searchType: 'voice', resultCount: (json.data || []).length }),
      }).catch(() => {})
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    if (listening) {
      setListening(false)
      recognitionRef.current?.stop()
      return
    }
    // Native Android shell — the WebView does not implement the Web Speech API.
    if (hasNativeVoiceRecognition()) {
      setListening(true)
      setTranscript('')
      setError(null)
      recognizeSpeechWithNative()
        .then((text) => {
          setTranscript(text)
          setListening(false)
          if (text.trim()) runSearch(text.trim())
        })
        .catch((err: Error) => {
          setListening(false)
          setError(err.message || 'Voice recognition failed')
        })
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice search is not supported in this browser. Try Chrome.')
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.onresult = (ev: any) => {
      const text = ev.results[0][0].transcript as string
      setTranscript(text)
      setListening(false)
      if (text.trim()) runSearch(text.trim())
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    setTranscript('')
    rec.start()
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border">
        <CardContent className="p-6 text-center space-y-4">
          <button
            onClick={toggle}
            className={`h-20 w-20 rounded-full mx-auto flex items-center justify-center transition-all ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-primary-foreground'}`}
          >
            {listening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
          </button>
          <div>
            <p className="font-semibold">{listening ? 'Listening...' : 'Tap to search by voice'}</p>
            <p className="text-xs text-muted-foreground mt-1">Speak a product, category, or brand name</p>
          </div>
          {transcript && <p className="text-sm italic text-muted-foreground">"{transcript}"</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {loading ? (
        [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
      ) : transcript && results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} results</p>
          {results.map(p => (
            <Card key={p.id} className="border border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0">
                  {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package className="h-5 w-5 m-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">MOQ: {p.moq} {p.unit || 'pcs'}</p>
                </div>
                <p className="text-sm font-bold text-primary">৳{p.basePrice}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ========== IMAGE SEARCH PAGE ==========

function ImageSearchPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [keywords, setKeywords] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [matchedBy, setMatchedBy] = useState<string>('keywords')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const onFile = (f: File) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    if (!file && !keywords.trim()) { setError('Upload an image or enter keywords'); return }
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const formData = new FormData()
      if (file) formData.append('image', file)
      if (keywords.trim()) formData.append('keywords', keywords.trim())
      const res = await fetch('/api/search/image', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Search failed')
      setResults(json.data?.products || [])
      setMatchedBy(json.data?.matchedBy || 'keywords')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border">
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Upload a product photo</Label>
            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary transition-colors">
              {preview ? (
                <img src={preview} alt="preview" className="h-32 w-32 object-cover rounded-lg" />
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-2">Tap to choose an image</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
            </label>
          </div>
          <div className="space-y-2">
            <Label>Keywords (optional)</Label>
            <Input placeholder="e.g. cotton, shirt, red" value={keywords} onChange={e => setKeywords(e.target.value)} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button className="w-full" disabled={loading} onClick={submit}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />} Search by Image
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
      ) : searched && results.length === 0 ? (
        <Card className="border border-border"><CardContent className="p-6 text-center text-xs text-muted-foreground">No matching products found.</CardContent></Card>
      ) : results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {results.length} {matchedBy === 'visual-clip' ? 'visually similar products (AI match)' : 'products'} · {matchedBy === 'visual-clip' ? 'sorted by visual similarity' : `matched by ${matchedBy}`}
          </p>
          {results.map(p => (
            <Card key={p.id} className="border border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0">
                  {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package className="h-5 w-5 m-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category?.name || ''}</p>
                </div>
                <p className="text-sm font-bold text-primary">৳{p.basePrice}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ========== BARCODE SCANNER PAGE ==========

function BarcodeScannerPage() {
  const { navigate } = useNavigationStore()
  const [code, setCode] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ─── Live camera scanning state ─── */
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [detected, setDetected] = useState<string | null>(null)
  const stopScanRef = useRef<(() => void) | null>(null)
  const handledRef = useRef(false) // debounce: one detection per scan session

  const search = async (value: string) => {
    if (!value.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(value.trim())}&limit=20`)
      const json = await res.json()
      if (res.ok) setResults(json.data || json.products || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  /** Handle a decoded payload: QR → deep link / product, barcode → SKU search */
  const handleDetection = (payload: string) => {
    if (handledRef.current) return
    handledRef.current = true
    stopCamera()
    setDetected(payload)

    // Zylod QR deep link (?page=product-detail&productId=…)
    const productIdMatch = payload.match(/[?&]productId=([^&]+)/)
    if (productIdMatch) {
      navigate('product-detail', { productId: decodeURIComponent(productIdMatch[1]) })
      return
    }
    // Plain product URL fallback
    const slugMatch = payload.match(/product\/([^/?#]+)/)
    if (slugMatch) {
      navigate('product-detail', { productId: decodeURIComponent(slugMatch[1]) })
      return
    }
    // Barcode / SKU
    setCode(payload)
    search(payload)
  }

  const stopCamera = () => {
    if (stopScanRef.current) { stopScanRef.current(); stopScanRef.current = null }
    setScanning(false)
  }

  /** Start live scanning — native BarcodeDetector, else ZXing fallback. */
  const startCamera = async () => {
    setCameraError(null)
    setDetected(null)
    setResults([])
    setSearched(false)
    handledRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setScanning(true)

      const cleanup = () => {
        stream.getTracks().forEach(t => t.stop())
        if (video.srcObject) video.srcObject = null
      }
      stopScanRef.current = cleanup

      const BarcodeDetectorCtor = (window as any).BarcodeDetector
      if (BarcodeDetectorCtor) {
        // Native path — Chrome/Edge/Android
        const detector = new BarcodeDetectorCtor({
          formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
        })
        const tick = async () => {
          if (!stopScanRef.current) return
          try {
            const codes = await detector.detect(video)
            if (codes.length > 0 && codes[0].rawValue) {
              handleDetection(String(codes[0].rawValue))
              return
            }
          } catch { /* frame skipped */ }
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      } else {
        // ZXing fallback — Safari/Firefox/iOS
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        const callback = (result: any) => {
          if (result?.getText?.()) handleDetection(result.getText())
        }
        const controls = await reader.decodeFromVideoElement(video, callback)
        const prevStop = stopScanRef.current
        stopScanRef.current = () => { controls.stop(); prevStop?.() }
      }
    } catch (e) {
      setScanning(false)
      setCameraError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Camera permission denied. Enter the code manually below.'
          : 'Camera unavailable on this device. Enter the code manually below.'
      )
    }
  }

  useEffect(() => () => { stopScanRef.current?.() }, [])

  return (
    <div className="space-y-4">
      {/* Live camera scanner */}
      <Card className="border border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="relative bg-black aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
              muted
            />
            {scanning && (
              <>
                <div className="absolute inset-x-[15%] inset-y-[25%] border-2 border-primary/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/90">Point at a barcode, QR, or product label</p>
              </>
            )}
            {!scanning && (
              <div className="relative z-10 text-center space-y-3 px-4">
                <ScanLine className="h-10 w-10 text-white/80 mx-auto" />
                <p className="text-sm text-white/90 font-medium">Scan barcode, QR, or product code</p>
                <Button size="sm" onClick={startCamera}>
                  <Camera className="mr-1.5 h-4 w-4" /> Start Camera
                </Button>
                {cameraError && <p className="text-xs text-amber-300">{cameraError}</p>}
              </div>
            )}
            {detected && (
              <div className="relative z-10 bg-black/70 absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <p className="text-xs text-white/90 font-mono break-all">{detected}</p>
                <Button size="sm" variant="outline" onClick={startCamera}>Scan Again</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual entry */}
      <Card className="border border-border">
        <CardContent className="p-5 space-y-3 text-center">
          <p className="text-sm font-semibold">Or enter a code manually</p>
          <div className="flex gap-2 max-w-sm mx-auto">
            <Input placeholder="Barcode, SKU, or paste a QR link..." value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && search(code)} />
            <Button onClick={() => search(code)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {loading ? (
        [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
      ) : searched && results.length === 0 ? (
        <Card className="border border-border"><CardContent className="p-6 text-center text-xs text-muted-foreground">No product matched &quot;{code}&quot;.</CardContent></Card>
      ) : results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} matches for &quot;{code}&quot;</p>
          {results.map(p => (
            <Card key={p.id} className="border border-border cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('product-detail', { productId: p.id })}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0">
                  {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package className="h-5 w-5 m-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {p.sku || '—'} · MOQ {p.moq} {p.unit || 'pcs'}</p>
                </div>
                <p className="text-sm font-bold text-primary">৳{p.basePrice}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ========== CATEGORY BROWSER PAGE ==========

function CategoryBrowserPage() {
  const { navigate } = useNavigationStore()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(json => { if (json.success && Array.isArray(json.data)) setCategories(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const palette = ['#E2136E', '#F6921E', '#7B2FBE', '#1976D2', '#0E9F6E', '#C81E1E', '#4F46E5', '#0891B2']

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : categories.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No categories available yet.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {categories.map((cat, i) => {
            const color = palette[i % palette.length]
            return (
              <Card
                key={cat.id}
                className="border border-border cursor-pointer hover:shadow-md transition-all overflow-hidden"
                onClick={() => navigate('category-products', { category: cat.slug })}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
                    {cat.iconUrl ? <img src={cat.iconUrl} alt={cat.name} className="h-6 w-6 object-contain" /> : cat.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold truncate">{cat.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cat.productCount} products · {cat.supplierCount} suppliers
                    </p>
                  </div>
                  {cat.children?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cat.children.slice(0, 2).map((sub: any) => (
                        <span key={sub.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground truncate max-w-full">{sub.name}</span>
                      ))}
                      {cat.children.length > 2 && <span className="text-[10px] text-muted-foreground">+{cat.children.length - 2}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ========== MAIN COMPONENT ==========

export function GenericInfoPage({ pageId }: { pageId: string }) {
  const { navigate } = useNavigationStore()
  const config = getInfoConfig(pageId)

  const renderSpecialContent = () => {
    switch (config.specialType) {
      case 'suppliers': return <SuppliersPage navigate={navigate} />
      case 'buyer-complaints': return <BuyerComplaintsPage />
      case 'buyer-returns': return <BuyerReturnsPage />
      case 'buyer-settings': return <BuyerSettingsPage />
      case 'buyer-level': return <BuyerLevelPage />
      case 'buyer-favorites': return <BuyerFavoritesPage navigate={navigate} />
      case 'admin-users': return <AdminUsersPage />
      case 'admin-products': return <AdminProductsPage />
      case 'admin-complaints': return <AdminComplaintsPage />
      case 'admin-reports': return <AdminReportsPage />
      case 'admin-analytics': return <AdminAnalyticsPage />
      case 'admin-categories': return <AdminCategoriesPage />
      case 'admin-suppliers': return <AdminSuppliersPage />
      case 'admin-settings': return <AdminSettingsPage />
      case 'supplier-analytics': return <SupplierAnalyticsPage />
      case 'supplier-warehouse': return <SupplierWarehousePage />
      case 'supplier-insights': return <SupplierInsightsPage />
      case 'supplier-profile': return <SupplierProfilePage navigate={navigate} />
      case 'support': return <SupportPage />
      case 'chat-list': return <ChatListPage navigate={navigate} />
      case 'chat-detail': return <ChatDetailPage navigate={navigate} />
      case 'quote-request': return <QuoteRequestPage />
      case 'rfq-list': return <RfqListPage />
      case 'add-address': return <AddAddressPage />
      case 'notifications': return <NotificationsPage />
      case 'seller-storefront': return <SellerStorefrontPage />
      case 'my-coupons': return <MyCouponsPage />
      case 'earn-coupons': return <EarnCouponsPage />
      case 'search-home': return <SearchHomePage navigate={navigate} />
      case 'loyalty-points': return <LoyaltyPointsPage />
      case 'points-history': return <LoyaltyPointsPage />
      case 'redeem-points': return <RedeemPointsPage />
      case 'daily-checkin': return <DailyCheckinPage />
      case 'spin-win': return <SpinWinPage />
      case 'referral-program': return <ReferralProgramPage />
      case 'write-review': return <WriteReviewPage />
      case 'return-request': return <ReturnRequestPage />
      case 'dispute-center': return <DisputeCenterPage />
      case 'voice-search': return <VoiceSearchPage />
      case 'image-search': return <ImageSearchPage />
      case 'barcode-scanner': return <BarcodeScannerPage />
      case 'category-browser': return <CategoryBrowserPage />
      default: return null
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pb-20 md:pb-8 bg-muted">
      <div className="text-white bg-gradient-to-br from-primary to-primary/80">
        <div className="max-w-[1280px] mx-auto px-4 py-5 md:py-8">
          <Button variant="ghost" className="text-white hover:bg-card/10 mb-2 text-xs" onClick={() => navigate('home')}>
            <ArrowLeft className="w-3 h-3 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2 mb-1">{config.icon}<h1 className="text-xl md:text-2xl font-bold">{config.name}</h1></div>
          <p className="text-white/80 text-sm">{config.description}</p>
        </div>
      </div>
      <div className="max-w-[800px] mx-auto px-4 py-6 space-y-4 md:max-w-4xl md:px-6 md:py-8 md:space-y-5">
        {config.specialType ? (
          renderSpecialContent()
        ) : (
          <>
            {config.sections.map((section, idx) => (
              <Card key={idx} className="border border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: '#FEE2E2' }}>
                      {section.icon}
                    </div>
                    <h2 className="text-sm font-semibold">{section.title}</h2>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#424242' }}>{section.content}</p>
                </CardContent>
              </Card>
            ))}
          </>
        )}
        {config.quickLinks && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold">Related Pages</h3>
            <div className="flex flex-wrap gap-2">
              {config.quickLinks.map(link => (
                <Button key={link.pageId} variant="outline" size="sm" className="text-xs h-7 text-primary border-primary" onClick={() => navigate(link.pageId)}>
                  {link.label} <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default GenericInfoPage
