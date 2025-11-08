'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SeriesManagement } from './series-management'
import { MatchesManagement } from './matches-management'
import { PlayersManagement } from './players-management'
import { Trophy, Gamepad2, Users } from 'lucide-react'

export function AdminPanel() {
  return (
    <div className="max-w-7xl mx-auto">
      <Tabs defaultValue="series" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-neutral-900/50 border border-neutral-700 p-1">
          <TabsTrigger 
            value="series" 
            className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border-blue-500/50 flex items-center gap-2"
          >
            <Trophy className="w-4 h-4" />
            Séries
          </TabsTrigger>
          <TabsTrigger 
            value="matches"
            className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border-blue-500/50 flex items-center gap-2"
          >
            <Gamepad2 className="w-4 h-4" />
            Partidas
          </TabsTrigger>
          <TabsTrigger 
            value="players"
            className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border-blue-500/50 flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Jogadores
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="series" className="mt-8">
          <SeriesManagement />
        </TabsContent>
        
        <TabsContent value="matches" className="mt-8">
          <MatchesManagement />
        </TabsContent>
        
        <TabsContent value="players" className="mt-8">
          <PlayersManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}

