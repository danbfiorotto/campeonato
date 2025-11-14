'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function VisionUploader() {
  const [series, setSeries] = useState<any[]>([])
  const [selectedSeriesId, setSelectedSeriesId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<'idle' | 'uploading' | 'processing'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  // Carregar séries ativas
  const loadSeries = async () => {
    const { data, error } = await supabase
      .from('series')
      .select(`
        *,
        games (*)
      `)
      .eq('is_completed', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar séries:', error)
    } else {
      setSeries(data || [])
    }
    setLoading(false)
  }

  // Upload e parse
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!selectedSeriesId) {
      alert('Por favor, selecione uma série primeiro')
      return
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem (JPG, PNG, etc.)')
      return
    }

    // Validar tamanho (máximo 10MB para vision)
    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo é muito grande. Tamanho máximo: 10MB')
      return
    }

    setUploading(true)
    setCurrentStep('uploading')
    setProgress(0)

    try {
      console.log('[UPLOADER] Iniciando upload...')
      console.log('[UPLOADER] File name:', file.name)
      console.log('[UPLOADER] File size:', file.size, 'bytes')
      console.log('[UPLOADER] File type:', file.type)

      // Simular progresso do upload
      setProgress(20)

      // Upload para Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `ingest/${Date.now()}.${fileExt}`
      const filePath = `proofs/${fileName}`

      console.log('[UPLOADER] Upload path:', filePath)

      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('[UPLOADER] ❌ Erro no upload:', uploadError)
        throw uploadError
      }

      console.log('[UPLOADER] ✅ Upload concluído com sucesso')
      setProgress(50)

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('proofs')
        .getPublicUrl(filePath)

      console.log('[UPLOADER] Public URL gerada:', publicUrl.substring(0, 100) + '...')
      setProgress(60)

      // Mudar para etapa de processamento
      setCurrentStep('processing')
      setProgress(70)

      // Chamar API de parse
      console.log('[UPLOADER] Chamando API de parse...')
      console.log('[UPLOADER] Series ID:', selectedSeriesId)
      console.log('[UPLOADER] Image URL:', publicUrl.substring(0, 100) + '...')

      const response = await fetch('/api/ingest/vision/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seriesId: selectedSeriesId,
          imageUrl: publicUrl,
        }),
      })

      console.log('[UPLOADER] Response status:', response.status)
      const result = await response.json()
      console.log('[UPLOADER] Response data:', result)

      if (!response.ok) {
        console.error('[UPLOADER] ❌ Erro na API:', {
          status: response.status,
          error: result.error,
          detail: result.detail,
          issues: result.issues,
        })
        throw new Error(result.detail || result.error || 'Erro ao processar imagem')
      }

      console.log('[UPLOADER] ✅ Parse realizado com sucesso!')
      console.log('[UPLOADER] Draft ID:', result.draftId)

      setProgress(100)

      // Pequeno delay para mostrar 100%
      await new Promise(resolve => setTimeout(resolve, 300))

      // Redirecionar para página de revisão
      router.push(`/admin/ingest/${result.draftId}`)
    } catch (error: any) {
      console.error('[UPLOADER] ❌ Erro ao processar:', error)
      console.error('[UPLOADER] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      })
      alert('Erro ao processar imagem: ' + (error.message || 'Erro desconhecido'))
      setProgress(0)
      setCurrentStep('idle')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Carregar séries ao montar
  useEffect(() => {
    loadSeries()
  }, [])

  if (loading) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Carregando séries...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="border border-neutral-700 rounded-lg p-6 bg-neutral-900/50">
        <h3 className="text-lg font-semibold text-white mb-4">
          Extrair Placar via OpenAI Vision
        </h3>
        <p className="text-sm text-neutral-400 mb-4">
          Faça upload de um print do placar final do League of Legends. O sistema irá extrair automaticamente os dados usando IA.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="series-select">Série</Label>
            <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma série" />
              </SelectTrigger>
              <SelectContent>
                {series.map((s) => {
                  const game = s.games as any
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {game?.name || 'Série'} {s.is_completed ? '(Concluída)' : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image-upload">Imagem do Placar</Label>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !selectedSeriesId}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {currentStep === 'uploading' ? 'Enviando...' : 'Processando com IA...'}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Selecionar Imagem
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            
            {/* Barra de Progresso */}
            {uploading && (
              <div className="space-y-2">
                <div className="w-full bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 ease-out relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>
                    {currentStep === 'uploading' 
                      ? 'Enviando imagem...' 
                      : 'Extraindo dados com IA...'}
                  </span>
                  <span className="font-medium">{progress}%</span>
                </div>
              </div>
            )}
            
            {!uploading && (
              <p className="text-xs text-neutral-500">
                Formatos aceitos: JPG, PNG. Tamanho máximo: 10MB
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

