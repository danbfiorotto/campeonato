import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StreamForm } from '@/components/streams/stream-form'
import { ActiveStreams } from '@/components/streams/active-streams'
import { Video, Clock } from 'lucide-react'

export default async function StreamsPage() {
  const supabase = await createClient()

  // Verificar se o usuário é admin_super
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdminSuper = false
  if (user) {
    // Tentar buscar por id primeiro
    let { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    
    // Se não encontrar, tentar por user_id
    if (!profile) {
      const { data: profile2 } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      profile = profile2
    }
    
    isAdminSuper = profile?.role === 'super'
  }

  // Atualizar streams expirados primeiro (se a função existir)
  try {
    await supabase.rpc('update_expired_streams')
  } catch {
    // Ignora erro se a função não existir ainda
  }

  // Buscar streams ativos (não expirados)
  const { data: activeStreams } = await supabase
    .from('streams')
    .select(`
      *,
      games (*),
      series (
        id,
        games (*)
      )
    `)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  // Buscar todos os jogos para o formulário
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('name')

  // Buscar séries em andamento
  const { data: series } = await supabase
    .from('series')
    .select(`
      *,
      games (*)
    `)
    .eq('is_completed', false)
    .order('created_at')

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Video className="w-8 h-8 text-purple-400" />
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-white">
            Streams ao Vivo
          </h1>
        </div>
        <p className="text-lg text-neutral-300">
          Adicione links de transmissões ao vivo da Twitch
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-neutral-400">
          <Clock className="w-4 h-4" />
          <span>Os streams ficam visíveis por 24 horas</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulário de Adicionar Stream */}
        <div className="lg:col-span-1">
          <Card className="bg-neutral-900/50 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-white">Adicionar Stream</CardTitle>
              <CardDescription className="text-neutral-400">
                Compartilhe um link de transmissão ao vivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StreamForm games={games || []} series={series || []} />
            </CardContent>
          </Card>
        </div>

        {/* Lista de Streams Ativos */}
        <div className="lg:col-span-2">
          <ActiveStreams streams={activeStreams || []} isAdminSuper={isAdminSuper} />
        </div>
      </div>
    </div>
  )
}

