'use client'

import React from 'react'
import { HardDrive, ArrowLeft, Layers, FileArchive, ShieldAlert, Cpu } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function StorageBreakdownPage() {
  const { navigate } = useNavigationStore()

  const items = [
    { title: 'Room SQLite Database (`zylod_offline_db`)', size: '3.4 MB', files: '4 tables, 120 records', type: 'Database' },
    { title: 'Glide & Coil Image WebP Cache', size: '45.0 MB', files: '1,240 thumbnails', type: 'Cache' },
    { title: 'PDF Invoice & Mushak 6.3 Downloads', size: '1.8 MB', files: '14 documents', type: 'Documents' },
    { title: 'Font Assets & SVG Icons', size: '2.2 MB', files: 'Inter & Hind Siliguri WebFonts', type: 'Static Assets' },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('storage-management')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Storage Manager
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Storage Allocation Details</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Granular file-level inspect of Android sandbox directories and SQLite indices</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.title} className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-bold text-sm text-foreground">{item.title}</div>
                <p className="text-xs text-muted-foreground">{item.files} • {item.type}</p>
              </div>
              <div className="font-mono text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                {item.size}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default StorageBreakdownPage
