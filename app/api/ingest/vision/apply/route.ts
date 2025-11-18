import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { draftId, matchNumber, mvpPlayerId, playerMappings, team1IsRac, editedStats } = await req.json()

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar role admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || !['super', 'rac', 'ast'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Buscar draft com job e series
    const { data: draft, error: draftError } = await supabase
      .from('match_drafts')
      .select(
        `
        *,
        ingest_jobs (*),
        series (*)
      `
      )
      .eq('id', draftId)
      .single()

    if (draftError || !draft) {
      return NextResponse.json(
        { error: 'draft-not-found' },
        { status: 404 }
      )
    }

    // Usar valores editados se existirem, senão usar valores originais
    const baseParsed = draft.parsed_json as any
    const parsed = editedStats ? {
      ...baseParsed,
      team1: {
        ...baseParsed.team1,
        kills: editedStats.team1?.kills ?? baseParsed.team1?.kills ?? 0,
        deaths: editedStats.team1?.deaths ?? baseParsed.team1?.deaths ?? 0,
        assists: editedStats.team1?.assists ?? baseParsed.team1?.assists ?? 0,
        players: editedStats.team1?.players ?? baseParsed.team1?.players ?? [],
      },
      team2: {
        ...baseParsed.team2,
        kills: editedStats.team2?.kills ?? baseParsed.team2?.kills ?? 0,
        deaths: editedStats.team2?.deaths ?? baseParsed.team2?.deaths ?? 0,
        assists: editedStats.team2?.assists ?? baseParsed.team2?.assists ?? 0,
        players: editedStats.team2?.players ?? baseParsed.team2?.players ?? [],
      },
    } : baseParsed
    
    console.log('[APPLY] Usando valores editados:', !!editedStats)

    // Buscar times RAC e AST
    const { data: teams } = await supabase.from('teams').select('*')
    const rac = teams?.find((t) => t.name === 'RAC')?.id
    const ast = teams?.find((t) => t.name === 'AST')?.id

    if (!rac || !ast) {
      return NextResponse.json(
        { error: 'Teams RAC or AST not found' },
        { status: 500 }
      )
    }

    // Determinar winner_team_id baseado na atribuição de times
    let winnerTeamId = null
    if (parsed.winner === 'E1') {
      winnerTeamId = team1IsRac === true ? rac : team1IsRac === false ? ast : null
    } else if (parsed.winner === 'E2') {
      winnerTeamId = team1IsRac === true ? ast : team1IsRac === false ? rac : null
    } else {
      winnerTeamId = draft.winner_team_id || null
    }
    
    console.log('[APPLY] Team 1 é RAC?', team1IsRac)
    console.log('[APPLY] Winner (E1/E2):', parsed.winner)
    console.log('[APPLY] Winner Team ID:', winnerTeamId)

    // Determinar match_number
    const finalMatchNumber = matchNumber || draft.match_number || 1

    // Verificar se já existe match com esse número na série
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('id, winner_team_id, mvp_player_id')
      .eq('series_id', draft.series_id)
      .eq('match_number', finalMatchNumber)
      .maybeSingle()
    
    // Buscar jogadores da partida separadamente (se existir)
    let existingMatchPlayers: any[] = []
    if (existingMatch) {
      const { data: playersData } = await supabase
        .from('match_players')
        .select('player_id')
        .eq('match_id', existingMatch.id)
      existingMatchPlayers = playersData || []
    }

    let match: any

    if (existingMatch) {
      console.log('[APPLY] Partida já existe:', existingMatch.id)
      
      // Verificar se a partida está completa
      const hasWinner = !!existingMatch.winner_team_id
      const hasMVP = !!existingMatch.mvp_player_id
      const hasPlayers = existingMatchPlayers.length > 0
      
      console.log('[APPLY] Status da partida:', {
        hasWinner,
        hasMVP,
        hasPlayers,
        playersCount: existingMatchPlayers.length
      })

      // Se a partida estiver completa, não permitir atualização
      if (hasWinner && hasMVP && hasPlayers) {
        return NextResponse.json(
          {
            error: 'match-complete',
            detail: `A partida #${finalMatchNumber} já está completa (tem vencedor, MVP e jogadores). Não é possível atualizar.`,
          },
          { status: 400 }
        )
      }

      // Atualizar partida existente com dados do draft
      console.log('[APPLY] Partida incompleta, atualizando com dados do draft...')
      
      const updateData: any = {}
      
      // Atualizar vencedor se não tiver
      if (!hasWinner && winnerTeamId) {
        updateData.winner_team_id = winnerTeamId
        console.log('[APPLY] Atualizando winner_team_id:', winnerTeamId)
      }
      
      // Atualizar MVP se não tiver
      const finalMVPId = mvpPlayerId || draft.mvp_player_id || null
      if (!hasMVP && finalMVPId) {
        updateData.mvp_player_id = finalMVPId
        console.log('[APPLY] Atualizando mvp_player_id:', finalMVPId)
      }

      // Aplicar atualizações se houver algo para atualizar
      if (Object.keys(updateData).length > 0) {
        const { data: updatedMatch, error: updateErr } = await supabase
          .from('matches')
          .update(updateData)
          .eq('id', existingMatch.id)
          .select()
          .single()

        if (updateErr) {
          console.error('[APPLY] Erro ao atualizar partida:', updateErr)
          return NextResponse.json(
            { error: updateErr.message },
            { status: 400 }
          )
        }

        match = updatedMatch
        console.log('[APPLY] Partida atualizada:', match.id)
      } else {
        match = existingMatch
      }
    } else {
      // Criar nova partida
      console.log('[APPLY] Criando nova partida...')
      const { data: newMatch, error: mErr } = await supabase
        .from('matches')
        .insert({
          series_id: draft.series_id,
          match_number: finalMatchNumber,
          winner_team_id: winnerTeamId,
          mvp_player_id: mvpPlayerId || draft.mvp_player_id || null,
        })
        .select()
        .single()

      if (mErr) {
        console.error('[APPLY] Error creating match:', mErr)
        return NextResponse.json(
          { error: mErr.message },
          { status: 400 }
        )
      }

      match = newMatch
      console.log('[APPLY] Nova partida criada:', match.id)
    }

        // Buscar aliases e players
        const [aliasesRes, playersRes] = await Promise.all([
          supabase
            .from('player_aliases')
            .select('alias, player_id')
            .order('alias'),
          supabase
            .from('players')
            .select('id, name, team_id'),
        ])

        const aliases = aliasesRes.data || []
        const players = playersRes.data || []
        const playerTeamMap = new Map(players.map((p: any) => [p.id, p.team_id]))

        // Criar mapa que inclui tanto aliases quanto nomes dos jogadores
        // IMPORTANTE: Tudo é normalizado para lowercase para comparação case-insensitive
        const aliasMap = new Map()
        
        // Adicionar aliases (normalizar para lowercase)
        aliases.forEach((a: any) => {
          // Normalizar alias para lowercase (garantir case-insensitive)
          const key = String(a.alias || '').toLowerCase().trim()
          if (key) {
            aliasMap.set(key, {
              player_id: a.player_id,
              team_id: playerTeamMap.get(a.player_id) || null,
            })
            console.log(`[APPLY] Alias mapeado: "${a.alias}" -> "${key}" (player: ${a.player_id})`)
          }
        })
        
        // Adicionar nomes dos jogadores (normalizar para lowercase)
        // Se não existir alias com mesmo valor
        players.forEach((p: any) => {
          // Normalizar nome para lowercase (garantir case-insensitive)
          const key = String(p.name || '').toLowerCase().trim()
          if (key && !aliasMap.has(key)) {
            aliasMap.set(key, {
              player_id: p.id,
              team_id: p.team_id || null,
            })
            console.log(`[APPLY] Nome mapeado: "${p.name}" -> "${key}" (player: ${p.id})`)
          }
        })
        
        console.log(`[APPLY] Total de chaves no aliasMap: ${aliasMap.size}`)

    // Verificar se a partida já tem jogadores (buscar novamente após criar/atualizar a partida)
    const { data: currentMatchPlayers } = await supabase
      .from('match_players')
      .select('player_id')
      .eq('match_id', match.id)

    const hasExistingPlayers = (currentMatchPlayers?.length || 0) > 0
    console.log('[APPLY] Partida tem jogadores existentes?', hasExistingPlayers, 'Count:', currentMatchPlayers?.length || 0)

    // Função para processar equipe
    const upsertTeam = async (teamBlock: any, teamId: string, teamKey: string) => {
      for (let idx = 0; idx < (teamBlock.players || []).length; idx++) {
        const p = teamBlock.players[idx]
        
        // Priorizar mapeamento manual, depois alias
        const mappingKey = `${teamKey}_${idx}`
        const manualMapping = playerMappings?.[mappingKey]
        
        let playerId: string | null = null
        let playerTeamId: string | null = null

        if (manualMapping) {
          // Usar mapeamento manual
          playerId = manualMapping
          playerTeamId = playerTeamMap.get(manualMapping) || null
          console.log(`[APPLY] Usando mapeamento manual: ${p.rawName} -> ${playerId}`)
        } else {
          // Tentar usar alias (busca exata primeiro, depois busca por substring)
          // IMPORTANTE: Normalizar para lowercase para comparação case-insensitive
          const aliasKey = String(p.rawName || '').toLowerCase().trim()
          console.log(`[APPLY] Buscando jogador para nickname: "${p.rawName}" (normalizado: "${aliasKey}") no time ${teamId}`)
          
          // 1. Tentar match exato (case-insensitive)
          let aliasData = aliasMap.get(aliasKey)
          
          if (aliasData) {
            console.log(`[APPLY] ✅ Match exato encontrado: "${aliasKey}" -> player ${aliasData.player_id}`)
          }
          
          // 2. Se não encontrou, tentar busca por substring (alias contido no nickname)
          // Apenas se o alias for menor ou igual ao nickname (evita falsos positivos)
          if (!aliasData) {
            const candidates: Array<{ data: any; storedAlias: string }> = []
            
            for (const [storedAlias, data] of aliasMap.entries()) {
              // Verificar se o alias está contido no nickname (ex: "jonreluht" em "jonreluht.rac")
              // Apenas se o alias for menor ou igual (evita match de "john" em "johnny")
              if (storedAlias.length <= aliasKey.length && aliasKey.includes(storedAlias)) {
                candidates.push({ data, storedAlias })
              }
            }
            
            // Se encontrou múltiplos candidatos, usar o contexto do time para desambiguar
            if (candidates.length > 1) {
              console.log(`[APPLY] Múltiplos candidatos encontrados para "${aliasKey}":`, candidates.map(c => c.storedAlias))
              
              // Filtrar candidatos que pertencem ao time correto
              const teamMatches = candidates.filter(c => c.data.team_id === teamId)
              
              if (teamMatches.length === 1) {
                // Encontrou exatamente um match no time correto
                aliasData = teamMatches[0].data
                console.log(`[APPLY] Desambiguado por time: "${aliasKey}" -> "${teamMatches[0].storedAlias}" (time ${teamId})`)
              } else if (teamMatches.length > 1) {
                // Ainda há ambiguidade, usar o primeiro (ou o mais longo para priorizar matches mais específicos)
                aliasData = teamMatches.sort((a, b) => b.storedAlias.length - a.storedAlias.length)[0].data
                console.log(`[APPLY] Múltiplos matches no time, usando o mais longo: "${aliasKey}" -> "${teamMatches[0].storedAlias}"`)
              } else {
                // Nenhum match no time correto, usar o primeiro candidato (comportamento anterior)
                aliasData = candidates[0].data
                console.log(`[APPLY] Nenhum match no time correto, usando primeiro candidato: "${aliasKey}" -> "${candidates[0].storedAlias}"`)
              }
            } else if (candidates.length === 1) {
              // Apenas um candidato encontrado
              aliasData = candidates[0].data
              console.log(`[APPLY] Match por substring: "${aliasKey}" contém "${candidates[0].storedAlias}"`)
            }
          }
          
          if (aliasData) {
            playerId = aliasData.player_id
            playerTeamId = aliasData.team_id
            
            // Verificar se o jogador pertence ao time correto (já verificado acima, mas log para debug)
            if (playerTeamId !== teamId) {
              console.warn(`[APPLY] ⚠️ Jogador ${playerId} pertence ao time ${playerTeamId}, mas está sendo adicionado ao time ${teamId}`)
            }
            
            console.log(`[APPLY] Usando alias/nome: ${p.rawName} -> ${playerId} (time: ${playerTeamId})`)
          }
        }

        if (!playerId) {
          console.warn(`[APPLY] Jogador sem mapeamento: ${p.rawName} (índice ${idx} do ${teamKey})`)
          continue // Pula jogador sem mapeamento
        }

        // Verificar se o jogador pertence ao time correto
        // (A verificação já foi feita na desambiguação acima, mas mantemos aqui como segurança)
        if (playerTeamId !== teamId) {
          console.warn(`[APPLY] ⚠️ Jogador ${playerId} não pertence ao time ${teamId} (pertence a ${playerTeamId}), pulando...`)
          continue
        }

        // Se a partida já tem jogadores, apenas atualizar/inserir os novos
        // Se não tem jogadores, inserir todos
        if (hasExistingPlayers) {
          // Verificar se o jogador já está na partida
          const playerExists = currentMatchPlayers?.some((mp: any) => mp.player_id === playerId)
          if (playerExists) {
            console.log(`[APPLY] Jogador ${playerId} já está na partida, atualizando estatísticas`)
            // Ainda assim, atualizar as estatísticas
          } else {
            console.log(`[APPLY] Adicionando novo jogador ${playerId} à partida`)
          }
        }

        // Inserir/atualizar match_players
        await supabase.from('match_players').upsert({
          match_id: match.id,
          player_id: playerId,
          team_id: teamId,
        }, {
          onConflict: 'match_id,player_id',
        })

        // Calcular K/D: kills / deaths (sem assists)
        const deaths = Math.max(1, p.deaths || 0)
        const kda = (p.kills || 0) / deaths

        // Inserir/atualizar player_match_stats
        // Salvar dados extras do jogador (se existirem)
        const playerExtra = p.extra || {}
        await supabase.from('player_match_stats').upsert({
          match_id: match.id,
          player_id: playerId,
          team_id: teamId,
          kills: p.kills || 0,
          deaths: p.deaths || 0,
          assists: p.assists || 0,
          kda: kda,
          extra: playerExtra,
        }, {
          onConflict: 'match_id,player_id',
        })
      }
    }

    // Processar equipes baseado na atribuição
    const team1ActualId = team1IsRac === true ? rac : team1IsRac === false ? ast : null
    const team2ActualId = team1IsRac === true ? ast : team1IsRac === false ? rac : null

    if (!team1ActualId || !team2ActualId) {
      return NextResponse.json(
        { error: 'team-assignment-required', detail: 'Atribuição de times não definida' },
        { status: 400 }
      )
    }

    console.log('[APPLY] Processando equipe 1 (E1)...')
    await upsertTeam(parsed.team1, team1ActualId, 'team1')
    console.log('[APPLY] Processando equipe 2 (E2)...')
    await upsertTeam(parsed.team2, team2ActualId, 'team2')

    // Atualizar status do job
    await supabase
      .from('ingest_jobs')
      .update({ status: 'applied' })
      .eq('id', (draft as any).job_id)

    // Anexar prova (imagem) ao match_media
    const job = (draft as any).ingest_jobs
    if (job?.image_url) {
      await supabase.from('match_media').insert({
        match_id: match.id,
        type: 'image',
        url: job.image_url,
        provider: 'file',
        uploader_user_id: user.id,
        status: 'approved', // Auto-aprovado pois foi processado por admin
      })
    }

    return NextResponse.json({ ok: true, matchId: match.id })
  } catch (e: any) {
    console.error('Apply error:', e)
    return NextResponse.json(
      {
        error: 'apply-failed',
        detail: String(e?.message || e),
      },
      { status: 500 }
    )
  }
}

