'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, Image as ImageIcon, CheckCircle2, Clock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PublicMediaUploaderProps {
  matchId: string
  matchNumber: number
}

export function PublicMediaUploader({ matchId, matchNumber }: PublicMediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor, selecione apenas arquivos de imagem (JPG, PNG, etc.)' })
      return
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'O arquivo é muito grande. Tamanho máximo: 5MB' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      // Obter ID do usuário atual (se logado)
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null

      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${matchId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('proofs')
        .getPublicUrl(fileName)

      // Criar registro na tabela match_media (status será 'pending' automaticamente se não for admin)
      const { error: dbError } = await supabase
        .from('match_media')
        .insert({
          match_id: matchId,
          type: 'image',
          url: publicUrl,
          provider: 'file',
          uploader_user_id: userId,
          status: 'pending' // Será auto-aprovado se for admin (via trigger)
        })

      if (dbError) {
        // Se falhar ao criar registro, tentar deletar o arquivo do storage
        await supabase.storage.from('proofs').remove([fileName])
        throw dbError
      }

      setMessage({ 
        type: 'success', 
        text: 'Imagem enviada com sucesso! Aguardando aprovação de um administrador.' 
      })

      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Recarregar página após 2 segundos para mostrar a imagem pendente
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error)
      setMessage({ 
        type: 'error', 
        text: 'Erro ao fazer upload: ' + (error.message || 'Erro desconhecido') 
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3 pt-4 border-t border-neutral-700">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-neutral-400" />
        <Label className="text-sm text-neutral-300">
          Enviar Print do Resultado (Partida {matchNumber})
        </Label>
      </div>
      
      <div className="space-y-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="bg-neutral-800 border-neutral-700 text-sm cursor-pointer"
        />
        <p className="text-xs text-neutral-500">
          Formatos aceitos: JPG, PNG. Tamanho máximo: 5MB
        </p>
      </div>

      {message && (
        <Alert className={message.type === 'success' ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <Clock className="h-4 w-4 text-red-400" />
          )}
          <AlertDescription className={message.type === 'success' ? 'text-green-400' : 'text-red-400'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Upload className="w-4 h-4 animate-pulse" />
          <span>Enviando imagem...</span>
        </div>
      )}
    </div>
  )
}

