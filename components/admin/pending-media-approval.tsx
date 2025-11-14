'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, Image as ImageIcon, X, Maximize2, Loader2, Sparkles } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'

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
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [approvingMediaId, setApprovingMediaId] = useState<string | null>(null)
  const [processingMediaId, setProcessingMediaId] = useState<string | null>(null)
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
    setApprovingMediaId(mediaId)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Aprovar a mídia
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
        setApprovingMediaId(null)
        return
      }

      // Se for uma imagem, iniciar análise automática
      const media = pendingMedia.find(m => m.id === mediaId)
      if (media && media.type === 'image') {
        setApprovingMediaId(null)
        setProcessingMediaId(mediaId)
        
        try {
          console.log('[APPROVAL] Iniciando análise automática para mídia:', mediaId)
          const response = await fetch('/api/media/auto-parse', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mediaId }),
          })

          const result = await response.json()

          if (response.ok) {
            console.log('[APPROVAL] ✅ Análise automática iniciada:', result.draftId)
            // Aguardar um pouco para mostrar o feedback visual
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            console.error('[APPROVAL] ⚠️ Erro ao iniciar análise automática:', result.error)
          }
        } catch (error) {
          console.error('[APPROVAL] ⚠️ Erro ao chamar API de análise:', error)
        } finally {
          setProcessingMediaId(null)
        }
      } else {
        setApprovingMediaId(null)
      }

      loadPendingMedia()
    } catch (error: any) {
      console.error('[APPROVAL] Erro ao aprovar:', error)
      alert('Erro ao aprovar: ' + (error.message || 'Erro desconhecido'))
      setApprovingMediaId(null)
      setProcessingMediaId(null)
    }
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
                    <div 
                      className="relative aspect-video bg-neutral-800 rounded-md overflow-hidden border border-neutral-700 group"
                    >
                      <div
                        className={`w-full h-full cursor-pointer ${(approvingMediaId === item.id || processingMediaId === item.id) ? 'pointer-events-none' : ''}`}
                        onClick={() => setSelectedImage(item.url)}
                      >
                        <img
                          src={item.url}
                          alt="Imagem pendente"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      {/* Overlay de processamento */}
                      {(approvingMediaId === item.id || processingMediaId === item.id) && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 z-20">
                          {approvingMediaId === item.id ? (
                            <>
                              <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
                              <p className="text-white text-sm font-medium">Aprovando...</p>
                            </>
                          ) : processingMediaId === item.id ? (
                            <>
                              <Sparkles className="w-10 h-10 text-purple-400 animate-pulse" />
                              <p className="text-white text-sm font-medium">Enviando para IA analisar...</p>
                              <p className="text-neutral-400 text-xs">Isso pode levar alguns segundos</p>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(item.id)}
                      disabled={approvingMediaId === item.id || processingMediaId === item.id}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {approvingMediaId === item.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Aprovando...
                        </>
                      ) : processingMediaId === item.id ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Aprovar
                        </>
                      )}
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

      {/* Lightbox para visualizar imagem ampliada */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] bg-neutral-900 border-neutral-700 p-0 overflow-hidden">
          {selectedImage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={selectedImage}
                alt="Imagem ampliada"
                className="w-full h-auto max-h-[85vh] object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-black/50 bg-black/30"
                onClick={() => setSelectedImage(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

