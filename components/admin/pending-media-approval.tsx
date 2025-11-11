'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, Image as ImageIcon } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface PendingMedia {
  id: string
  match_id: string
  type: 'image' | 'clip'
  url: string
  created_at: string
  matches: {
    match_number: number
    series: {
      games: {
        name: string
      }
    }
  }
}

export function PendingMediaApproval() {
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadPendingMedia()
  }, [])

  const loadPendingMedia = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('match_media')
      .select(`
        *,
        matches!inner (
          match_number,
          series!inner (
            games (*)
          )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar mídia pendente:', error)
    } else {
      setPendingMedia(data || [])
    }
    setLoading(false)
  }

  const handleApprove = async (mediaId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase
      .from('match_media')
      .update({
        status: 'approved',
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', mediaId)

    if (error) {
      alert('Erro ao aprovar: ' + error.message)
      return
    }

    loadPendingMedia()
  }

  const handleReject = async (mediaId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase
      .from('match_media')
      .update({
        status: 'rejected',
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', mediaId)

    if (error) {
      alert('Erro ao rejeitar: ' + error.message)
      return
    }

    loadPendingMedia()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-neutral-400">
          Carregando...
        </CardContent>
      </Card>
    )
  }

  if (pendingMedia.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <p className="text-neutral-400 text-lg mb-2">Nenhuma imagem pendente</p>
          <p className="text-neutral-500 text-sm">
            Todas as imagens foram revisadas
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Imagens Pendentes ({pendingMedia.length})
        </h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pendingMedia.map((item) => {
          const match = item.matches as any
          const game = match?.series?.games as any

          return (
            <Card key={item.id} className="bg-neutral-900/50 border-yellow-500/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm">
                    {game?.name || 'Jogo'} - Partida {match?.match_number || 'N/A'}
                  </CardTitle>
                  <Badge className="bg-yellow-500/90 text-yellow-900 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pendente
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {item.type === 'image' && (
                    <div className="relative aspect-video bg-neutral-800 rounded-md overflow-hidden border border-neutral-700">
                      <img
                        src={item.url}
                        alt="Imagem pendente"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(item.id)}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Aprovar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Rejeitar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-neutral-900 border-neutral-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Rejeitar Imagem</AlertDialogTitle>
                          <AlertDialogDescription className="text-neutral-400">
                            Tem certeza que deseja rejeitar esta imagem? Ela não será exibida publicamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleReject(item.id)}
                            className="bg-red-600 hover:bg-red-500 text-white"
                          >
                            Rejeitar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

