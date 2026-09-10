'use client'

import React from 'react'
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  ClipboardList,
  MessageSquare,
  Shield,
  Store,
  BarChart3,
  Users,
  Tags,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNavigationStore, type PageId } from '@/store/navigation-store'
import { useAuthStore, type UserRole } from '@/store/auth-store'
import { cn } from '@/lib/utils'

interface SidebarItem {
  label: string
  pageId: PageId
  icon: React.ReactNode
}

const supplierSidebarItems: SidebarItem[] = [
  { label: 'Dashboard', pageId: 'supplier-dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Products', pageId: 'supplier-products', icon: <Package className="h-4 w-4" /> },
  { label: 'Add Product', pageId: 'supplier-add-product', icon: <PlusCircle className="h-4 w-4" /> },
  { label: 'Orders', pageId: 'supplier-orders', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Chat', pageId: 'chat-list', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'Verification', pageId: 'supplier-verification-status', icon: <Shield className="h-4 w-4" /> },
  { label: 'Store Settings', pageId: 'supplier-profile', icon: <Store className="h-4 w-4" /> },
]

const adminSidebarItems: SidebarItem[] = [
  { label: 'Dashboard', pageId: 'admin-dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Suppliers', pageId: 'admin-suppliers', icon: <Shield className="h-4 w-4" /> },
  { label: 'Products', pageId: 'admin-products', icon: <Tags className="h-4 w-4" /> },
  { label: 'Orders', pageId: 'admin-orders', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Users', pageId: 'admin-users', icon: <Users className="h-4 w-4" /> },
  { label: 'Categories', pageId: 'admin-categories', icon: <Package className="h-4 w-4" /> },
  { label: 'Reports', pageId: 'admin-reports', icon: <BarChart3 className="h-4 w-4" /> },
]

function getSidebarItems(role: UserRole): SidebarItem[] {
  switch (role) {
    case 'supplier':
      return supplierSidebarItems
    case 'admin':
      return adminSidebarItems
    default:
      return []
  }
}

export function Sidebar() {
  const { currentPage, navigate } = useNavigationStore()
  const { user } = useAuthStore()
  const [collapsed, setCollapsed] = React.useState(false)

  const items = getSidebarItems(user?.userType ?? null)
  const title = user?.userType === 'admin' ? 'Admin Panel' : 'Supplier Panel'

  if (items.length === 0) return null

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r bg-card transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Sidebar Header */}
      <div className={cn('p-4 flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <Separator />

      {/* Sidebar Items */}
      <nav className="flex-1 p-2 space-y-1">
        {items.map((item) => (
          <button
            key={item.pageId}
            onClick={() => navigate(item.pageId)}
            className={cn(
              'flex items-center gap-3 w-full rounded-md transition-colors text-sm font-medium',
              collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5',
              currentPage === item.pageId
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            title={collapsed ? item.label : undefined}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  )
}
