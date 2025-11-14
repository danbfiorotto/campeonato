'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X, Upload, Link as LinkIcon, Image as ImageIcon, Video, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface MatchMedia {
  id: string
  match_id: string
  type: 'image' | 'clip'
  url: string
  provider: string | null
  status?: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface MediaUploaderProps {
  matchId: string
  onMediaAdded?: () => void
}

export function MediaUploader({ matchId, onMediaAdded }: MediaUploaderProps) {
  const [media, setMedia] = useState<MatchMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [clipUrl, setClipUrl] = useState('')
  const [showClipForm, setShowClipForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Carregar mídia existente
  const loadMedia = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('match_media')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar mídia:', error)
    } else {
      setMedia(data || [])
    }
    setLoading(false)
  }

  // Upload de imagem
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem (JPG, PNG, etc.)')
      return
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('O arquivo é muito grande. Tamanho máximo: 5MB')
      return
    }

    setUploading(true)

    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${matchId}/${Date.now()}.${fileExt}`
      const filePath = `proofs/${fileName}`

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('proofs')
        .getPublicUrl(filePath)

      // Obter ID do usuário atual (se logado)
      const { data: { user } } = await supabase.auth.getUser()

      // Criar registro na tabela match_media (status será auto-aprovado se for admin via trigger)
      const { data: insertedMedia, error: insertError } = await supabase
        .from('match_media')
        .insert({
          match_id: matchId,
          type: 'image',
          url: publicUrl,
          provider: 'file',
          uploader_user_id: user?.id || null,
          status: 'pending' // Será auto-aprovado se for admin (via trigger)
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      console.log('[UPLOADER] Mídia inserida:', {
        id: insertedMedia?.id,
        status: insertedMedia?.status,
        type: insertedMedia?.type,
        uploader_user_id: insertedMedia?.uploader_user_id
      })

      // Verificar novamente o status (pode ter sido atualizado pelo trigger)
      const { data: refreshedMedia } = await supabase
        .from('match_media')
        .select('status, type')
        .eq('id', insertedMedia.id)
        .single()

      const finalStatus = refreshedMedia?.status || insertedMedia?.status
      console.log('[UPLOADER] Status final após trigger:', finalStatus)

      // Se for admin e a imagem foi auto-aprovada, iniciar análise automática
      if (insertedMedia && finalStatus === 'approved' && insertedMedia.type === 'image') {
        try {
          console.log('[UPLOADER] ✅ Imagem auto-aprovada, iniciando análise automática...')
          console.log('[UPLOADER] Media ID:', insertedMedia.id)
          
          const response = await fetch('/api/media/auto-parse', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mediaId: insertedMedia.id }),
          })

          console.log('[UPLOADER] Response status:', response.status)
          const result = await response.json()
          console.log('[UPLOADER] Response data:', result)

          if (response.ok) {
            console.log('[UPLOADER] ✅ Análise automática iniciada com sucesso!')
            console.log('[UPLOADER] Draft ID:', result.draftId)
            alert('Imagem aprovada e análise automática iniciada! Verifique os drafts pendentes.')
          } else {
            console.error('[UPLOADER] ❌ Erro ao iniciar análise automática:', result.error, result.detail)
            alert('Imagem aprovada, mas houve erro ao iniciar análise automática: ' + (result.error || result.detail))
          }
        } catch (error: any) {
          console.error('[UPLOADER] ❌ Erro ao chamar API de análise:', error)
          alert('Erro ao iniciar análise automática: ' + (error.message || 'Erro desconhecido'))
        }
      } else {
        console.log('[UPLOADER] Imagem não foi auto-aprovada ou não é do tipo image:', {
          status: insertedMedia?.status,
          type: insertedMedia?.type
        })
      }

      // Limpar input e recarregar
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      await loadMedia()
      onMediaAdded?.()
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error)
      alert('Erro ao fazer upload: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setUploading(false)
    }
  }

  // Adicionar clipe (URL)
  const handleAddClip = async () => {
    if (!clipUrl.trim()) {
      alert('Por favor, insira uma URL válida')
      return
    }

    // Validar URL
    const isValidUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|twitch\.tv|clips\.twitch\.tv)/i.test(clipUrl)
    if (!isValidUrl) {
      alert('URL inválida. Use links do YouTube ou Twitch')
      return
    }

    // Determinar provider
    let provider = 'youtube'
    if (clipUrl.includes('twitch')) {
      provider = 'twitch'
    }

    setUploading(true)

    try {
      const { error } = await supabase
        .from('match_media')
        .insert({
          match_id: matchId,
          type: 'clip',
          url: clipUrl.trim(),
          provider
        })

      if (error) {
        throw error
      }

      setClipUrl('')
      setShowClipForm(false)
      await loadMedia()
      onMediaAdded?.()
    } catch (error: any) {
      console.error('Erro ao adicionar clipe:', error)
      alert('Erro ao adicionar clipe: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setUploading(false)
    }
  }

  // Aprovar mídia
  const handleApproveMedia = async (mediaId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Aprovar a mídia
    const { data: updatedMedia, error } = await supabase
      .from('match_media')
      .update({
        status: 'approved',
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', mediaId)
      .select()
      .single()

    if (error) {
      alert('Erro ao aprovar: ' + error.message)
      return
    }

    // Se for uma imagem, iniciar análise automática
    if (updatedMedia && updatedMedia.type === 'image') {
      try {
        console.log('[UPLOADER] Iniciando análise automática para mídia:', mediaId)
        const response = await fetch('/api/media/auto-parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mediaId }),
        })

        const result = await response.json()

        if (response.ok) {
          console.log('[UPLOADER] ✅ Análise automática iniciada:', result.draftId)
        } else {
          console.error('[UPLOADER] ⚠️ Erro ao iniciar análise automática:', result.error)
        }
      } catch (error) {
        console.error('[UPLOADER] ⚠️ Erro ao chamar API de análise:', error)
      }
    }

    await loadMedia()
    onMediaAdded?.()
  }

  const handleRejectMedia = async (mediaId: string) => {
    if (!confirm('Tem certeza que deseja rejeitar esta imagem?')) return

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

    await loadMedia()
    onMediaAdded?.()
  }

  const handleDeleteMedia = async (mediaId: string, url: string, type: string) => {
    try {
      // Se for imagem, deletar do storage também
      if (type === 'image' && url.includes('/storage/v1/object/public/proofs/')) {
        const path = url.split('/storage/v1/object/public/proofs/')[1]
        await supabase.storage
          .from('proofs')
          .remove([path])
      }

      // Deletar registro
      const { error } = await supabase
        .from('match_media')
        .delete()
        .eq('id', mediaId)

      if (error) {
        throw error
      }

      await loadMedia()
      onMediaAdded?.()
    } catch (error: any) {
      console.error('Erro ao deletar mídia:', error)
      alert('Erro ao deletar: ' + (error.message || 'Erro desconhecido'))
    }
  }

  // Carregar mídia ao montar
  useEffect(() => {
    if (matchId) {
      loadMedia()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Provas (Prints & Clipes)</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-neutral-300"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Imagem
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClipForm(!showClipForm)}
            disabled={uploading}
            className="text-neutral-300"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Adicionar Clipe
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {showClipForm && (
        <div className="border border-neutral-700 rounded-md p-4 space-y-2 bg-neutral-900/50">
          <Label htmlFor="clip-url">URL do Clipe (YouTube ou Twitch)</Label>
          <div className="flex gap-2">
            <Input
              id="clip-url"
              type="url"
              placeholder="https://youtube.com/watch?v=... ou https://clips.twitch.tv/..."
              value={clipUrl}
              onChange={(e) => setClipUrl(e.target.value)}
              className="bg-neutral-800 border-neutral-700"
            />
            <Button
              onClick={handleAddClip}
              disabled={uploading || !clipUrl.trim()}
              size="sm"
            >
              Adicionar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowClipForm(false)
                setClipUrl('')
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="text-sm text-neutral-400 text-center py-2">
          Processando...
        </div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-400 text-center py-4">
          Carregando mídia...
        </div>
      ) : media.length === 0 ? (
        <div className="text-sm text-neutral-500 text-center py-4 border border-dashed border-neutral-700 rounded-md">
          Nenhuma prova adicionada ainda
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => {
            const isPending = item.status === 'pending'
            const isApproved = item.status === 'approved'
            const isRejected = item.status === 'rejected'

            return (
              <div key={item.id} className="relative group">
                {item.type === 'image' ? (
                  <div className={`
                    relative aspect-video bg-neutral-800 rounded-md overflow-hidden border
                    ${isPending ? 'border-yellow-500/50' : isApproved ? 'border-green-500/50' : isRejected ? 'border-red-500/50' : 'border-neutral-700'}
                  `}>
                    <img
                      src={item.url}
                      alt={`Prova da partida ${matchId}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Badge de status */}
                    <div className="absolute top-2 left-2 z-10">
                      {isPending && (
                        <Badge className="bg-yellow-500/90 text-yellow-900 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pendente
                        </Badge>
                      )}
                      {isApproved && (
                        <Badge className="bg-green-500/90 text-white text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Aprovada
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge className="bg-red-500/90 text-white text-xs flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Rejeitada
                        </Badge>
                      )}
                    </div>
                    {/* Botões de ação no hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        {isPending && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApproveMedia(item.id)}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRejectMedia(item.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-neutral-900 border-neutral-700">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">Excluir Prova</AlertDialogTitle>
                              <AlertDialogDescription className="text-neutral-400">
                                Tem certeza que deseja excluir esta prova? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteMedia(item.id, item.url, item.type)}
                                className="bg-red-600 hover:bg-red-500"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
              ) : (
                <div className="relative aspect-video bg-neutral-800 rounded-md overflow-hidden border border-neutral-700 flex items-center justify-center">
                  <Video className="w-8 h-8 text-neutral-500" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(item.url, '_blank')}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Abrir
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-neutral-900 border-neutral-700">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Excluir Clipe</AlertDialogTitle>
                            <AlertDialogDescription className="text-neutral-400">
                              Tem certeza que deseja excluir este clipe? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteMedia(item.id, item.url, item.type)}
                              className="bg-red-600 hover:bg-red-500"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary" className="text-xs">
                      {item.provider === 'youtube' ? 'YouTube' : 'Twitch'}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        </div>
      )}
    </div>
  )
}

