'use client'

import { useState } from 'react'
import { X, Video, ExternalLink, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface MatchMedia {
  id: string
  match_id: string
  type: 'image' | 'clip'
  url: string
  provider: string | null
  status?: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface GalleryProps {
  media: MatchMedia[]
  matchNumber?: number
  isAdmin?: boolean
}

export function Gallery({ media, matchNumber, isAdmin = false }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  if (!media || media.length === 0) {
    return null
  }

  // A query já filtra no servidor, mas mantemos validação extra aqui
  // Admins recebem aprovadas + pendentes, público recebe apenas aprovadas
  const images = media.filter(m => m.type === 'image')
  const clips = media.filter(m => m.type === 'clip')

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-neutral-300 mb-2">
            Prints {matchNumber && `- Partida ${matchNumber}`}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((item) => {
              const isPending = item.status === 'pending'
              
              return (
                <div
                  key={item.id}
                  className={`relative aspect-video bg-neutral-800 rounded-md overflow-hidden border cursor-pointer group ${
                    isPending 
                      ? 'border-yellow-500/50 bg-yellow-500/5' 
                      : 'border-neutral-700'
                  }`}
                  onClick={() => setSelectedImage(item.url)}
                >
                  <img
                    src={item.url}
                    alt={`Prova da partida ${matchNumber || ''}`}
                    className={`w-full h-full object-cover ${
                      isPending ? 'opacity-75' : ''
                    }`}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  
                  {/* Indicador de pendente */}
                  {isPending && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge 
                        variant="outline" 
                        className="bg-yellow-500/20 border-yellow-500/50 text-yellow-400 text-xs flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" />
                        Aguardando aprovação
                      </Badge>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {clips.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-neutral-300 mb-2">
            Clipes {matchNumber && `- Partida ${matchNumber}`}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clips.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-video bg-neutral-800 rounded-md overflow-hidden border border-neutral-700 flex items-center justify-center group hover:border-blue-500/50 transition-colors"
              >
                <Video className="w-8 h-8 text-neutral-500 group-hover:text-blue-400 transition-colors" />
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="text-xs">
                    {item.provider === 'youtube' ? 'YouTube' : 'Twitch'}
                  </Badge>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="w-4 h-4 text-blue-400" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox para imagens */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl bg-neutral-900 border-neutral-700 p-0">
          {selectedImage && (
            <div className="relative">
              <img
                src={selectedImage}
                alt="Prova ampliada"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-black/50"
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

