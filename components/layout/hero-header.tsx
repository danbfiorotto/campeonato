import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { AnimatedHeroScore } from './animated-hero-score'
import { ScoreChangeNotification } from '@/components/score/score-change-notification'

export async function HeroHeader() {
  const supabase = await createClient()
  
  // Get teams
  const { data: teams } = await supabase.from('teams').select('*').order('name')
  
  // Get series with games
  const { data: series } = await supabase
    .from('series')
    .select(`
      *,
      games (*),
      teams!series_winner_team_id_fkey (*)
    `)
    .order('created_at')
  
  // Calculate overall score
  const racTeam = teams?.find(t => t.name === 'RAC')
  const astTeam = teams?.find(t => t.name === 'AST')
  const racWins = series?.filter(s => s.winner_team_id === racTeam?.id).length || 0
  const astWins = series?.filter(s => s.winner_team_id === astTeam?.id).length || 0

  return (
    <div className="relative w-full min-h-[900px] sm:min-h-[1000px] md:min-h-[1100px] lg:min-h-[1200px] bg-dark-futuristic overflow-hidden" style={{ zIndex: 1 }}>
      <ScoreChangeNotification racWins={racWins} astWins={astWins} />
      {/* Background Overlay for better text readability - mais escuro */}
      <div className="absolute inset-0 bg-black/60" style={{ zIndex: 1 }}></div>
      
      {/* LED Bars Effect */}
      <div className="absolute top-0 left-0 right-0 h-1 flex gap-1" style={{ zIndex: 10 }}>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="led-bar flex-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 pt-4 md:pt-6 pb-8 md:pb-12" style={{ zIndex: 10 }}>
        <div className="flex flex-col items-center justify-start h-full min-h-[500px] sm:min-h-[600px] md:min-h-[700px] pt-2 md:pt-4">
          {/* Top Section - Titles */}
          <div className="flex flex-col items-center space-y-4 md:space-y-6 w-full">
            {/* Championship Title */}
            <div className="text-center space-y-3 md:space-y-4">
              <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold text-white championship-title">
                CAMPEONATO
              </h1>
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-heading font-extrabold">
                <span className="team-name-rac">RAC</span>{' '}
                <span className="text-gray-400 mx-2 md:mx-4">VS</span>{' '}
                <span className="team-name-ast">AST</span>
              </h2>
            </div>
          </div>

          {/* Team Logos and Score - Separado e mais abaixo */}
          <div className="flex flex-col items-center space-y-6 md:space-y-8 w-full mt-48 md:mt-64 lg:mt-80 xl:mt-96">
            <div className="flex items-center justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-16 w-full flex-wrap">
              {/* RAC Logo */}
              <div className="flex flex-col items-center space-y-2 md:space-y-3 order-1">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-4 border-orange-500/70 shadow-[0_0_40px_rgba(249,115,22,0.8)] logo-hover">
                  <Image
                    src="/logo-rac.jpeg"
                    alt="RAC Logo"
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 112px"
                    priority
                  />
                </div>
                <div className="text-xs sm:text-sm md:text-base text-orange-400 font-semibold tracking-wider hidden sm:block">RAC</div>
              </div>

              {/* Score Display */}
              <AnimatedHeroScore racWins={racWins} astWins={astWins} />

              {/* AST Logo */}
              <div className="flex flex-col items-center space-y-2 md:space-y-3 order-3">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-4 border-red-500/70 shadow-[0_0_40px_rgba(220,38,38,0.8)] logo-hover">
                  <Image
                    src="/logo-ast.jpeg"
                    alt="AST Logo"
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 112px"
                    priority
                  />
                </div>
                <div className="text-xs sm:text-sm md:text-base text-red-400 font-semibold tracking-wider hidden sm:block">AST</div>
              </div>
            </div>

            {/* Subtitle - abaixo do placar */}
            <div className="mt-6 md:mt-8 text-center px-4">
              <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-neutral-200 tracking-widest font-light italic relative inline-block">
                <span className="relative z-10">5 JOGOS. 2 TIMES. 1 VENCEDOR.</span>
                <span className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-transparent to-red-500/20 blur-xl -z-0"></span>
              </p>
              <div className="mt-4 flex items-center justify-center gap-4">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-orange-500/50"></div>
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-red-500/50"></div>
              </div>
            </div>
          </div>

          {/* Champion Banner */}
          {(racWins >= 3 || astWins >= 3) && (
            <div className="mt-6 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500/50 rounded-lg shadow-[0_0_40px_rgba(234,179,8,0.6)]">
              <div className="text-center">
                <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-yellow-400 neon-glow">
                  🏆 {racWins >= 3 ? 'RAC' : 'AST'} CAMPEÃO! 🏆
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

