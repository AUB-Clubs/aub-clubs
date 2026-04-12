'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DiscoverFeedTab } from '@/modules/students/ui/components/DiscoverFeedTab'
import { TrendingFeedTab } from '@/modules/students/ui/components/TrendingFeedTab'

export function DiscoverPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Discover
        </h1>
        <p className="mt-1 text-muted-foreground">
          Explore content from clubs across AUB
        </p>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="discover" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="mt-0">
          <DiscoverFeedTab />
        </TabsContent>

        <TabsContent value="trending" className="mt-0">
          <TrendingFeedTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}