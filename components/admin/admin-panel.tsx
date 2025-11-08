'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SeriesManagement } from './series-management'
import { MatchesManagement } from './matches-management'
import { PlayersManagement } from './players-management'

export function AdminPanel() {
  return (
    <Tabs defaultValue="series" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="series">Séries</TabsTrigger>
        <TabsTrigger value="matches">Partidas</TabsTrigger>
        <TabsTrigger value="players">Jogadores</TabsTrigger>
      </TabsList>
      
      <TabsContent value="series" className="mt-6">
        <SeriesManagement />
      </TabsContent>
      
      <TabsContent value="matches" className="mt-6">
        <MatchesManagement />
      </TabsContent>
      
      <TabsContent value="players" className="mt-6">
        <PlayersManagement />
      </TabsContent>
    </Tabs>
  )
}

