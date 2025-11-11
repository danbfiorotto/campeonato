import { createClient } from '@/lib/supabase/server'
import { HallOfFame } from '@/components/hof/hall-of-fame'

export default async function HallDaFamaPage() {
  const supabase = await createClient()

  // Buscar todos os jogos para o filtro
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('name')

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-white mb-4">
            🏆 Hall da Fama
          </h1>
          <p className="text-lg text-neutral-300">
            Os maiores destaques do campeonato
          </p>
        </div>

        <HallOfFame games={games || []} />
      </div>
    </div>
  )
}

