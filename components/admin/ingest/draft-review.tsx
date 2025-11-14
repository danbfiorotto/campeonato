'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, UserPlus } from 'lucide-react'
import Link from 'next/link'

interface DraftReviewProps {
  draft: any
  players: any[]
  aliases: any[]
  teams: any[]
}

export function DraftReview({ draft, players, aliases, teams }: DraftReviewProps) {
  const router = useRouter()
  const [matchNumber, setMatchNumber] = useState(draft.match_number || '')
  const [winner, setWinner] = useState<'E1' | 'E2' | null>(
    draft.parsed_json?.winner || null
  )
  const [mvpPlayerId, setMvpPlayerId] = useState(draft.mvp_player_id || '')
  const [applying, setApplying] = useState(false)
  const [editedPlayers, setEditedPlayers] = useState<any>(null)
  const [playerMappings, setPlayerMappings] = useState<Record<string, string>>({})
  const [team1IsRac, setTeam1IsRac] = useState<boolean | null>(null) // null = não definido ainda
  // Estado para armazenar K/D/A editados por jogador
  const [editedStats, setEditedStats] = useState<Record<string, { kills: number; deaths: number; assists: number }>>({})
  // Estado para armazenar stats totais do time editados
  const [editedTeamStats, setEditedTeamStats] = useState<{
    team1?: { kills: number; deaths: number; assists: number }
    team2?: { kills: number; deaths: number; assists: number }
  }>({})

  const parsed = draft.parsed_json as any
  const job = draft.ingest_jobs as any
  const series = draft.series as any
  const game = series?.games as any

  // Criar mapa que inclui tanto aliases quanto nomes dos jogadores (memoizado)
  // IMPORTANTE: Tudo é normalizado para lowercase para comparação case-insensitive
  const aliasMap = useMemo(() => {
    const map = new Map<string, string>()
    
    // Adicionar aliases (normalizar para lowercase)
    aliases.forEach((a: any) => {
      // Normalizar alias para lowercase (garantir case-insensitive)
      const key = String(a.alias || '').toLowerCase().trim()
      if (key) {
        map.set(key, a.player_id)
        console.log(`[DRAFT] Alias mapeado: "${a.alias}" -> "${key}" (player: ${a.player_id})`)
      }
    })
    
    // Adicionar nomes dos jogadores (normalizar para lowercase)
    // Se não existir alias com mesmo valor
    players.forEach((p: any) => {
      // Normalizar nome para lowercase (garantir case-insensitive)
      const key = String(p.name || '').toLowerCase().trim()
      if (key && !map.has(key)) {
        map.set(key, p.id)
        console.log(`[DRAFT] Nome mapeado: "${p.name}" -> "${key}" (player: ${p.id})`)
      }
    })
    
    console.log(`[DRAFT] Total de chaves no aliasMap: ${map.size}`)
    return map
  }, [aliases, players])

  // Função auxiliar para buscar player_id por alias ou nome (com fallback para substring)
  // Aceita teamId opcional para desambiguação por time
  // IMPORTANTE: Tudo é normalizado para lowercase para comparação case-insensitive
  const findPlayerByAlias = useCallback((nickname: string, teamId?: string): string | null => {
    // Normalizar nickname para lowercase (garantir case-insensitive)
    const aliasKey = String(nickname || '').toLowerCase().trim()
    if (!aliasKey) return null
    
    console.log(`[DRAFT] Buscando jogador para nickname: "${nickname}" (normalizado: "${aliasKey}")${teamId ? ` no time ${teamId}` : ''}`)
    
    // 1. Tentar match exato (alias ou nome) - case-insensitive
    const exactMatch = aliasMap.get(aliasKey)
    
    if (exactMatch) {
      console.log(`[DRAFT] ✅ Match exato encontrado: "${aliasKey}" -> player ${exactMatch}`)
      
      // Se temos teamId, verificar se o jogador pertence ao time correto
      if (teamId) {
        const player = players.find((p) => p.id === exactMatch)
        if (player && player.team_id === teamId) {
          return exactMatch
        } else if (player && player.team_id !== teamId) {
          // Match exato mas time errado, continuar para buscar substring
          console.log(`[DRAFT] Match exato "${aliasKey}" mas time incorreto (${player.team_id} != ${teamId}), tentando substring...`)
        } else {
          return exactMatch // Se não encontrou o player, retorna mesmo assim
        }
      } else {
        return exactMatch
      }
    }
    
    // 2. Tentar busca por substring (alias/nome contido no nickname)
    // Apenas se o alias/nome for menor ou igual ao nickname (evita falsos positivos)
    const candidates: Array<{ playerId: string; storedKey: string }> = []
    
    for (const [storedKey, playerId] of aliasMap.entries()) {
      // Verificar se o alias/nome está contido no nickname (ex: "jonreluht" em "jonreluht.rac")
      // Apenas se o alias/nome for menor ou igual (evita match de "john" em "johnny")
      if (storedKey.length <= aliasKey.length && aliasKey.includes(storedKey)) {
        candidates.push({ playerId, storedKey })
      }
    }
    
    if (candidates.length === 0) {
      return null
    }
    
    // Se encontrou múltiplos candidatos e temos teamId, usar o contexto do time para desambiguar
    if (candidates.length > 1 && teamId) {
      console.log(`[DRAFT] Múltiplos candidatos encontrados para "${aliasKey}":`, candidates.map(c => c.storedKey))
      
      // Filtrar candidatos que pertencem ao time correto
      const teamMatches = candidates.filter(c => {
        const player = players.find((p) => p.id === c.playerId)
        return player && player.team_id === teamId
      })
      
      if (teamMatches.length === 1) {
        // Encontrou exatamente um match no time correto
        console.log(`[DRAFT] ✅ Desambiguado por time: "${aliasKey}" -> "${teamMatches[0].storedKey}" (time ${teamId})`)
        return teamMatches[0].playerId
      } else if (teamMatches.length > 1) {
        // Ainda há ambiguidade, usar o mais longo (prioriza matches mais específicos)
        const bestMatch = teamMatches.sort((a, b) => b.storedKey.length - a.storedKey.length)[0]
        console.log(`[DRAFT] Múltiplos matches no time, usando o mais longo: "${aliasKey}" -> "${bestMatch.storedKey}"`)
        return bestMatch.playerId
      } else {
        // Nenhum match no time correto, usar o primeiro candidato (comportamento anterior)
        console.log(`[DRAFT] ⚠️ Nenhum match no time correto, usando primeiro candidato: "${aliasKey}" -> "${candidates[0].storedKey}"`)
        return candidates[0].playerId
      }
    } else if (candidates.length === 1) {
      // Apenas um candidato encontrado
      return candidates[0].playerId
    } else {
      // Múltiplos candidatos mas sem teamId para desambiguar, usar o primeiro
      return candidates[0].playerId
    }
  }, [aliasMap, players])

  const rac = teams.find((t) => t.name === 'RAC')
  const ast = teams.find((t) => t.name === 'AST')

  // Log dos dados extraídos para debug
  useEffect(() => {
    console.log('[DRAFT] Dados extraídos:', JSON.stringify(parsed, null, 2))
    console.log('[DRAFT] Players Team 1:', parsed?.team1?.players?.length || 0)
    console.log('[DRAFT] Players Team 2:', parsed?.team2?.players?.length || 0)
  }, [parsed])

  // Detectar automaticamente qual time é qual baseado nos aliases
  useEffect(() => {
    if (team1IsRac === null && rac && ast && parsed?.team1?.players) {
      // Verificar se algum jogador do team1 tem alias que pertence ao RAC
      // Passar rac.id para desambiguação por time
      const team1HasRac = (parsed.team1.players || []).some((p: any) => {
        const playerId = findPlayerByAlias(p.rawName || '', rac.id)
        const player = players.find((pl) => pl.id === playerId)
        return player?.team_id === rac.id
      })

      // Verificar se algum jogador do team1 tem alias que pertence ao AST
      // Passar ast.id para desambiguação por time
      const team1HasAst = (parsed.team1.players || []).some((p: any) => {
        const playerId = findPlayerByAlias(p.rawName || '', ast.id)
        const player = players.find((pl) => pl.id === playerId)
        return player?.team_id === ast.id
      })

      // Se encontrou RAC no team1, team1 é RAC
      if (team1HasRac && !team1HasAst) {
        setTeam1IsRac(true)
        console.log('[DRAFT] ✅ Team 1 identificado automaticamente como RAC')
      }
      // Se encontrou AST no team1, team1 é AST
      else if (team1HasAst && !team1HasRac) {
        setTeam1IsRac(false)
        console.log('[DRAFT] ✅ Team 1 identificado automaticamente como AST')
      }
    }
  }, [parsed, findPlayerByAlias, players, rac, ast, team1IsRac])

  // Determinar times baseado na seleção
  const team1ActualTeam = team1IsRac === true ? rac : team1IsRac === false ? ast : null
  const team2ActualTeam = team1IsRac === true ? ast : team1IsRac === false ? rac : null

  // Mapear players para cada time
  const team1Players = (parsed?.team1?.players || []).map((p: any, idx: number) => {
    // Priorizar mapeamento manual sobre alias automático
    // Passar team1ActualTeam?.id para desambiguação por time
    const mappedPlayerId = playerMappings[`team1_${idx}`] || findPlayerByAlias(p.rawName || '', team1ActualTeam?.id)
    const player = players.find((pl) => pl.id === mappedPlayerId)
    const wasAutoDetected = !!findPlayerByAlias(p.rawName || '', team1ActualTeam?.id) && !playerMappings[`team1_${idx}`]
    const isManuallyMapped = !!playerMappings[`team1_${idx}`]
    
    // Usar valores editados se existirem, senão usar valores originais
    const statsKey = `team1_${idx}`
    const editedStat = editedStats[statsKey]
    const kills = editedStat?.kills ?? p.kills ?? 0
    const deaths = editedStat?.deaths ?? p.deaths ?? 0
    const assists = editedStat?.assists ?? p.assists ?? 0

    return {
      ...p,
      kills,
      deaths,
      assists,
      playerId: mappedPlayerId || null,
      playerName: player?.name || null,
      hasAlias: !!mappedPlayerId,
      wasAutoDetected,
      isManuallyMapped,
      index: idx,
      team: 'team1',
      actualTeam: team1ActualTeam,
    }
  })

  const team2Players = (parsed?.team2?.players || []).map((p: any, idx: number) => {
    // Priorizar mapeamento manual sobre alias automático
    // Passar team2ActualTeam?.id para desambiguação por time
    const mappedPlayerId = playerMappings[`team2_${idx}`] || findPlayerByAlias(p.rawName || '', team2ActualTeam?.id)
    const player = players.find((pl) => pl.id === mappedPlayerId)
    const wasAutoDetected = !!findPlayerByAlias(p.rawName || '', team2ActualTeam?.id) && !playerMappings[`team2_${idx}`]
    const isManuallyMapped = !!playerMappings[`team2_${idx}`]
    
    // Usar valores editados se existirem, senão usar valores originais
    const statsKey = `team2_${idx}`
    const editedStat = editedStats[statsKey]
    const kills = editedStat?.kills ?? p.kills ?? 0
    const deaths = editedStat?.deaths ?? p.deaths ?? 0
    const assists = editedStat?.assists ?? p.assists ?? 0

    return {
      ...p,
      kills,
      deaths,
      assists,
      playerId: mappedPlayerId || null,
      playerName: player?.name || null,
      hasAlias: !!mappedPlayerId,
      wasAutoDetected,
      isManuallyMapped,
      index: idx,
      team: 'team2',
      actualTeam: team2ActualTeam,
    }
  })

  const confidence = draft.confidence || parsed?.confidence || 0
  const needsReview = confidence < 0.7

  // Determinar qual time é o campeão
  const winnerTeam = winner === 'E1' 
    ? team1ActualTeam 
    : winner === 'E2' 
    ? team2ActualTeam 
    : null

  // Filtrar jogadores do time campeão para MVP
  const championPlayers = winnerTeam 
    ? players.filter((p) => p.team_id === winnerTeam.id)
    : []

  // Limpar MVP se não for do time campeão
  useEffect(() => {
    if (winnerTeam && mvpPlayerId) {
      const mvpPlayer = players.find((p) => p.id === mvpPlayerId)
      if (mvpPlayer && mvpPlayer.team_id !== winnerTeam.id) {
        console.log('[DRAFT] MVP atual não é do time campeão, limpando seleção')
        setMvpPlayerId('')
      }
    } else if (!winnerTeam && mvpPlayerId) {
      // Se não há time campeão definido, limpar MVP
      setMvpPlayerId('')
    }
  }, [winnerTeam, mvpPlayerId, players])

  const handleMapPlayer = async (nickname: string, playerId: string, team: string, index: number) => {
    console.log(`[DRAFT] Mapeando jogador: ${nickname} -> ${playerId}`)
    const key = `${team}_${index}`
    setPlayerMappings((prev) => ({ ...prev, [key]: playerId }))

    // Criar alias automaticamente se não existir
    if (playerId && nickname) {
      try {
        const supabase = createClient()
        const aliasKey = nickname.toLowerCase().trim()
        
        // Verificar se já existe alias
        const { data: existing } = await supabase
          .from('player_aliases')
          .select('*')
          .eq('player_id', playerId)
          .eq('alias', aliasKey)
          .maybeSingle()

        if (!existing) {
          // Criar novo alias
          const { error } = await supabase.from('player_aliases').insert({
            player_id: playerId,
            alias: aliasKey,
          })
          
          if (error) {
            console.error(`[DRAFT] Erro ao criar alias:`, error)
          } else {
            console.log(`[DRAFT] ✅ Alias criado: ${aliasKey} -> ${playerId}`)
          }
        } else {
          console.log(`[DRAFT] Alias já existe: ${aliasKey} -> ${playerId}`)
        }
      } catch (error) {
        console.error(`[DRAFT] Erro ao processar alias:`, error)
      }
    }
  }

  const handleApply = async () => {
    if (!matchNumber) {
      alert('Por favor, informe o número da partida')
      return
    }

    if (team1IsRac === null) {
      alert('Por favor, selecione qual time é a equipe de cima (E1)')
      return
    }

    // Validar se o MVP foi selecionado
    if (!mvpPlayerId || mvpPlayerId === '') {
      alert('Por favor, selecione o MVP antes de aplicar o draft')
      return
    }

    // Verificar se todos os jogadores estão mapeados
    const unmappedPlayers = [
      ...team1Players.filter((p: any) => !p.playerId),
      ...team2Players.filter((p: any) => !p.playerId),
    ]

    if (unmappedPlayers.length > 0) {
      const confirm = window.confirm(
        `${unmappedPlayers.length} jogador(es) não está(ão) mapeado(s). ` +
        `Eles serão ignorados ao aplicar. Deseja continuar?`
      )
      if (!confirm) return
    }

    setApplying(true)

    try {
      // Preparar dados com valores editados de K/D/A
      const editedTeam1Players = team1Players.map((p: any, idx: number) => {
        const statsKey = `team1_${idx}`
        const editedStat = editedStats[statsKey]
        return {
          ...p,
          kills: editedStat?.kills ?? p.kills ?? 0,
          deaths: editedStat?.deaths ?? p.deaths ?? 0,
          assists: editedStat?.assists ?? p.assists ?? 0,
        }
      })
      
      const editedTeam2Players = team2Players.map((p: any, idx: number) => {
        const statsKey = `team2_${idx}`
        const editedStat = editedStats[statsKey]
        return {
          ...p,
          kills: editedStat?.kills ?? p.kills ?? 0,
          deaths: editedStat?.deaths ?? p.deaths ?? 0,
          assists: editedStat?.assists ?? p.assists ?? 0,
        }
      })

      const response = await fetch('/api/ingest/vision/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          draftId: draft.id,
          matchNumber: parseInt(matchNumber),
          mvpPlayerId: mvpPlayerId || null,
          playerMappings, // Enviar mapeamentos manuais
          team1IsRac, // Enviar qual time é qual
          editedStats: {
            team1: {
              players: editedTeam1Players,
              kills: editedTeamStats.team1?.kills ?? parsed?.team1?.kills ?? 0,
              deaths: editedTeamStats.team1?.deaths ?? parsed?.team1?.deaths ?? 0,
              assists: editedTeamStats.team1?.assists ?? parsed?.team1?.assists ?? 0,
            },
            team2: {
              players: editedTeam2Players,
              kills: editedTeamStats.team2?.kills ?? parsed?.team2?.kills ?? 0,
              deaths: editedTeamStats.team2?.deaths ?? parsed?.team2?.deaths ?? 0,
              assists: editedTeamStats.team2?.assists ?? parsed?.team2?.assists ?? 0,
            },
          },
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || result.error || 'Erro ao aplicar')
      }

      // Redirecionar para página de partidas ou admin
      router.push('/admin')
    } catch (error: any) {
      console.error('Erro ao aplicar:', error)
      alert('Erro ao aplicar: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-6">
        <Link
          href="/admin/ingest"
          className="inline-flex items-center text-sm text-neutral-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Ingestão
        </Link>
        <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-white mb-2">
          Revisar Draft
        </h1>
        <p className="text-lg text-neutral-300">
          {game?.name || 'Série'} - Revise os dados extraídos antes de aplicar
        </p>
      </div>

      {needsReview && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-400">Revisão Recomendada</p>
            <p className="text-sm text-neutral-400 mt-1">
              A confiança da extração é baixa ({(confidence * 100).toFixed(0)}%). Por favor, revise os dados cuidadosamente.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Preview da Imagem */}
        <Card className="bg-neutral-900/50 border-neutral-700">
          <CardHeader>
            <CardTitle className="text-white">Imagem Original</CardTitle>
            <CardDescription>Print do placar enviado</CardDescription>
          </CardHeader>
          <CardContent>
            {job?.image_url ? (
              <div className="relative">
                <img
                  src={job.image_url}
                  alt="Placar extraído"
                  className="w-full rounded-lg border border-neutral-700"
                />
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Imagem não disponível</p>
            )}
          </CardContent>
        </Card>

        {/* Formulário de Revisão */}
        <Card className="bg-neutral-900/50 border-neutral-700">
          <CardHeader>
            <CardTitle className="text-white">Dados Extraídos</CardTitle>
            <CardDescription>
              Revise e ajuste os dados antes de aplicar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Match Number */}
            <div className="space-y-2">
              <Label htmlFor="match-number">Número da Partida</Label>
              <Input
                id="match-number"
                type="number"
                min="1"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                placeholder="1"
              />
            </div>

            {/* Team Assignment */}
            <div className="space-y-2">
              <Label htmlFor="team-assignment">Atribuição de Times</Label>
              <Select
                value={team1IsRac === null ? 'none' : team1IsRac ? 'rac' : 'ast'}
                onValueChange={(value) => {
                  if (value === 'rac') {
                    setTeam1IsRac(true)
                  } else if (value === 'ast') {
                    setTeam1IsRac(false)
                  } else {
                    setTeam1IsRac(null)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione qual time é E1" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  <SelectItem value="rac">E1 (Equipe de Cima) = RAC</SelectItem>
                  <SelectItem value="ast">E1 (Equipe de Cima) = AST</SelectItem>
                </SelectContent>
              </Select>
              {team1IsRac !== null && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-green-400">
                    ✓ E1 = {team1IsRac ? 'RAC' : 'AST'}, E2 = {team1IsRac ? 'AST' : 'RAC'}
                  </p>
                  {(() => {
                    // Verificar se foi detectado automaticamente
                    const wasAutoDetected = (parsed?.team1?.players || []).some((p: any) => {
                      return !!findPlayerByAlias(p.rawName || '', team1ActualTeam?.id)
                    })
                    return wasAutoDetected ? (
                      <Badge variant="outline" className="text-xs text-blue-400">
                        ✓ Identificado automaticamente
                      </Badge>
                    ) : null
                  })()}
                </div>
              )}
              {team1IsRac === null && (
                <p className="text-xs text-yellow-400">
                  ⚠️ Selecione qual time é a equipe de cima (E1) para mapear os jogadores corretamente
                </p>
              )}
            </div>

            {/* Winner */}
            <div className="space-y-2">
              <Label htmlFor="winner">Vencedor</Label>
              <Select
                value={winner === null ? 'none' : winner || 'none'}
                onValueChange={(value) =>
                  setWinner(value === 'none' ? null : (value as 'E1' | 'E2'))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vencedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não definido</SelectItem>
                  <SelectItem value="E1">E1 ({team1IsRac === true ? 'RAC' : team1IsRac === false ? 'AST' : '?'} - Equipe de Cima)</SelectItem>
                  <SelectItem value="E2">E2 ({team1IsRac === true ? 'AST' : team1IsRac === false ? 'RAC' : '?'} - Equipe de Baixo)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500">
                E1 = Equipe de cima, E2 = Equipe de baixo
              </p>
            </div>

            {/* MVP */}
            <div className="space-y-2">
              <Label htmlFor="mvp">MVP <span className="text-red-400">*</span></Label>
              {!winnerTeam ? (
                <div className="space-y-2">
                  <Select disabled value="none">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o vencedor primeiro" />
                    </SelectTrigger>
                  </Select>
                  <p className="text-xs text-yellow-400">
                    ⚠️ Selecione o vencedor primeiro para escolher o MVP
                  </p>
                </div>
              ) : (
                <Select
                  value={mvpPlayerId || ''}
                  onValueChange={(value) => setMvpPlayerId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o MVP (obrigatório)" />
                  </SelectTrigger>
                  <SelectContent>
                    {championPlayers.length > 0 ? (
                      championPlayers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        Nenhum jogador do time campeão encontrado
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
              {winnerTeam && (
                <p className="text-xs text-neutral-500">
                  Apenas jogadores do time campeão ({winnerTeam.name}) podem ser selecionados como MVP
                </p>
              )}
              {winnerTeam && !mvpPlayerId && (
                <p className="text-xs text-red-400">
                  ⚠️ MVP é obrigatório para aplicar o draft
                </p>
              )}
            </div>

            {/* Team 1 Stats */}
            <div className="space-y-2">
              <Label className="text-white">
                Equipe 1 (E1) - {team1IsRac === true ? 'RAC' : team1IsRac === false ? 'AST' : 'Selecione o time'}
              </Label>
              <div className="flex items-center gap-4 mb-2">
                <div className="text-sm text-neutral-400">
                  <span className="mr-2">K:</span>
                  <Input
                    type="number"
                    min="0"
                    value={editedTeamStats.team1?.kills ?? parsed?.team1?.kills ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team1: { ...prev.team1, kills: value, deaths: prev.team1?.deaths ?? parsed?.team1?.deaths ?? 0, assists: prev.team1?.assists ?? parsed?.team1?.assists ?? 0 }
                      }))
                    }}
                    onBlur={(e) => {
                      // Normalizar valor removendo zeros à esquerda
                      const value = parseInt(e.target.value) || 0
                      e.target.value = value.toString()
                      // Atualizar estado com valor normalizado
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team1: { ...prev.team1, kills: value, deaths: prev.team1?.deaths ?? parsed?.team1?.deaths ?? 0, assists: prev.team1?.assists ?? parsed?.team1?.assists ?? 0 }
                      }))
                    }}
                    className="w-16 h-8 text-center inline-block"
                  />
                </div>
                <div className="text-sm text-neutral-400">
                  <span className="mr-2">D:</span>
                  <Input
                    type="number"
                    min="0"
                    value={editedTeamStats.team1?.deaths ?? parsed?.team1?.deaths ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team1: { ...prev.team1, kills: prev.team1?.kills ?? parsed?.team1?.kills ?? 0, deaths: value, assists: prev.team1?.assists ?? parsed?.team1?.assists ?? 0 }
                      }))
                    }}
                    onBlur={(e) => {
                      // Normalizar valor removendo zeros à esquerda
                      const value = parseInt(e.target.value) || 0
                      e.target.value = value.toString()
                      // Atualizar estado com valor normalizado
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team1: { ...prev.team1, kills: value, deaths: prev.team1?.deaths ?? parsed?.team1?.deaths ?? 0, assists: prev.team1?.assists ?? parsed?.team1?.assists ?? 0 }
                      }))
                    }}
                    className="w-16 h-8 text-center inline-block"
                  />
                </div>
                <div className="text-sm text-neutral-400">
                  <span className="mr-2">A:</span>
                  <Input
                    type="number"
                    min="0"
                    value={editedTeamStats.team1?.assists ?? parsed?.team1?.assists ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team1: { ...prev.team1, kills: prev.team1?.kills ?? parsed?.team1?.kills ?? 0, deaths: prev.team1?.deaths ?? parsed?.team1?.deaths ?? 0, assists: value }
                      }))
                    }}
                    onBlur={(e) => {
                      // Normalizar valor removendo zeros à esquerda
                      const value = parseInt(e.target.value) || 0
                      e.target.value = value.toString()
                      // Atualizar estado com valor normalizado
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team1: { ...prev.team1, kills: value, deaths: prev.team1?.deaths ?? parsed?.team1?.deaths ?? 0, assists: prev.team1?.assists ?? parsed?.team1?.assists ?? 0 }
                      }))
                    }}
                    className="w-16 h-8 text-center inline-block"
                  />
                </div>
                {team1Players.length === 0 && (
                  <span className="ml-2 text-yellow-400 text-sm">⚠️ Nenhum jogador extraído</span>
                )}
              </div>
              {team1Players.length === 0 ? (
                <div className="p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
                  <p className="text-sm text-yellow-400">
                    ⚠️ A IA não conseguiu extrair os dados dos jogadores desta equipe. 
                    Isso pode acontecer se a imagem estiver cortada ou com baixa qualidade.
                  </p>
                </div>
              ) : (
                <div className="border border-neutral-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neutral-700">
                        <TableHead className="text-neutral-300">Jogador</TableHead>
                        <TableHead className="text-neutral-300">K</TableHead>
                        <TableHead className="text-neutral-300">D</TableHead>
                        <TableHead className="text-neutral-300">A</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team1Players.map((p: any, idx: number) => (
                      <TableRow
                        key={idx}
                        className={!p.hasAlias ? 'bg-red-500/10' : ''}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{p.rawName || 'Sem nome'}</span>
                              {!p.hasAlias && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Sem alias
                                </Badge>
                              )}
                              {p.hasAlias && (
                                <Badge variant="outline" className="text-xs text-green-400">
                                  {p.playerName}
                                </Badge>
                              )}
                            </div>
                            {/* Mostrar Select sempre para permitir trocar, mesmo se tiver alias */}
                            {team1ActualTeam ? (
                              <Select
                                value={playerMappings[`team1_${idx}`] || (p.hasAlias && !p.isManuallyMapped && p.playerId ? String(p.playerId) : 'none')}
                                onValueChange={(value) => {
                                  console.log(`[DRAFT] Team1[${idx}] mudando seleção:`, value)
                                  if (value === 'none') {
                                    // Permitir remover seleção (volta para alias automático se existir)
                                    setPlayerMappings((prev) => {
                                      const newMappings = { ...prev }
                                      delete newMappings[`team1_${idx}`]
                                      console.log(`[DRAFT] Team1[${idx}] removido mapeamento manual, voltando para automático`)
                                      return newMappings
                                    })
                                  } else {
                                    // Verificar se o jogador já foi selecionado em outro slot da mesma equipe
                                    const alreadySelected = Object.entries(playerMappings).some(
                                      ([key, playerId]) => 
                                        key.startsWith('team1_') && 
                                        key !== `team1_${idx}` && 
                                        playerId === value
                                    )
                                    
                                    // Também verificar aliases automáticos
                                    const alreadySelectedAuto = team1Players.some(
                                      (otherP: any, otherIdx: number) => 
                                        otherIdx !== idx && 
                                        !otherP.isManuallyMapped &&
                                        otherP.playerId === value
                                    )
                                    
                                    if (alreadySelected || alreadySelectedAuto) {
                                      alert('Este jogador já foi selecionado nesta equipe. Escolha outro jogador.')
                                      return
                                    }
                                    
                                    handleMapPlayer(p.rawName, value, 'team1', idx)
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Selecione o jogador" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    {p.hasAlias && !p.isManuallyMapped ? 'Usar alias automático' : 'Selecione...'}
                                  </SelectItem>
                                  {players
                                    .filter((pl: any) => {
                                      // Filtrar jogadores do time correto
                                      if (pl.team_id !== team1ActualTeam.id) return false
                                      
                                      // Filtrar jogadores já selecionados nesta equipe (exceto o atual)
                                      const isAlreadySelectedManual = Object.entries(playerMappings).some(
                                        ([key, playerId]) => 
                                          key.startsWith('team1_') && 
                                          key !== `team1_${idx}` && 
                                          playerId === pl.id
                                      )
                                      
                                      // Verificar aliases automáticos também
                                      const isAlreadySelectedAuto = team1Players.some(
                                        (otherP: any, otherIdx: number) => 
                                          otherIdx !== idx && 
                                          !otherP.isManuallyMapped &&
                                          otherP.playerId === pl.id
                                      )
                                      
                                      return !isAlreadySelectedManual && !isAlreadySelectedAuto
                                    })
                                    .map((pl: any) => (
                                      <SelectItem key={pl.id} value={pl.id}>
                                        {pl.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-xs text-yellow-400">
                                ⚠️ Selecione qual time é E1 primeiro
                              </p>
                            )}
                            {p.wasAutoDetected && !p.isManuallyMapped && (
                              <Badge variant="outline" className="text-xs text-blue-400 mt-1">
                                ✓ Identificado automaticamente
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={p.kills}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0
                              setEditedStats(prev => ({
                                ...prev,
                                [`team1_${idx}`]: {
                                  ...prev[`team1_${idx}`],
                                  kills: value,
                                  deaths: prev[`team1_${idx}`]?.deaths ?? p.deaths,
                                  assists: prev[`team1_${idx}`]?.assists ?? p.assists
                                }
                              }))
                            }}
                            onBlur={(e) => {
                              // Normalizar valor removendo zeros à esquerda
                              const value = parseInt(e.target.value) || 0
                              e.target.value = value.toString()
                              // Atualizar estado com valor normalizado
                              setEditedStats(prev => ({
                                ...prev,
                                [`team1_${idx}`]: {
                                  ...prev[`team1_${idx}`],
                                  kills: value,
                                  deaths: prev[`team1_${idx}`]?.deaths ?? p.deaths,
                                  assists: prev[`team1_${idx}`]?.assists ?? p.assists
                                }
                              }))
                            }}
                            className="w-16 h-8 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={p.deaths}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0
                              setEditedStats(prev => ({
                                ...prev,
                                [`team1_${idx}`]: {
                                  ...prev[`team1_${idx}`],
                                  kills: prev[`team1_${idx}`]?.kills ?? p.kills,
                                  deaths: value,
                                  assists: prev[`team1_${idx}`]?.assists ?? p.assists
                                }
                              }))
                            }}
                            onBlur={(e) => {
                              // Normalizar valor removendo zeros à esquerda
                              const value = parseInt(e.target.value) || 0
                              e.target.value = value.toString()
                              // Atualizar estado com valor normalizado
                              setEditedStats(prev => ({
                                ...prev,
                                [`team1_${idx}`]: {
                                  ...prev[`team1_${idx}`],
                                  kills: prev[`team1_${idx}`]?.kills ?? p.kills,
                                  deaths: value,
                                  assists: prev[`team1_${idx}`]?.assists ?? p.assists
                                }
                              }))
                            }}
                            className="w-16 h-8 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={p.assists}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0
                              setEditedStats(prev => ({
                                ...prev,
                                [`team1_${idx}`]: {
                                  ...prev[`team1_${idx}`],
                                  kills: prev[`team1_${idx}`]?.kills ?? p.kills,
                                  deaths: prev[`team1_${idx}`]?.deaths ?? p.deaths,
                                  assists: value
                                }
                              }))
                            }}
                            onBlur={(e) => {
                              // Normalizar valor removendo zeros à esquerda
                              const value = parseInt(e.target.value) || 0
                              e.target.value = value.toString()
                              // Atualizar estado com valor normalizado
                              setEditedStats(prev => ({
                                ...prev,
                                [`team1_${idx}`]: {
                                  ...prev[`team1_${idx}`],
                                  kills: prev[`team1_${idx}`]?.kills ?? p.kills,
                                  deaths: prev[`team1_${idx}`]?.deaths ?? p.deaths,
                                  assists: value
                                }
                              }))
                            }}
                            className="w-16 h-8 text-center"
                          />
                        </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Team 2 Stats */}
            <div className="space-y-2">
              <Label className="text-white">
                Equipe 2 (E2) - {team1IsRac === true ? 'AST' : team1IsRac === false ? 'RAC' : 'Selecione o time'}
              </Label>
              <div className="flex items-center gap-4 mb-2">
                <div className="text-sm text-neutral-400">
                  <span className="mr-2">K:</span>
                  <Input
                    type="number"
                    min="0"
                    value={editedTeamStats.team2?.kills ?? parsed?.team2?.kills ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team2: { ...prev.team2, kills: value, deaths: prev.team2?.deaths ?? parsed?.team2?.deaths ?? 0, assists: prev.team2?.assists ?? parsed?.team2?.assists ?? 0 }
                      }))
                    }}
                    onBlur={(e) => {
                      // Normalizar valor removendo zeros à esquerda
                      const value = parseInt(e.target.value) || 0
                      e.target.value = value.toString()
                      // Atualizar estado com valor normalizado
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team2: { ...prev.team2, kills: value, deaths: prev.team2?.deaths ?? parsed?.team2?.deaths ?? 0, assists: prev.team2?.assists ?? parsed?.team2?.assists ?? 0 }
                      }))
                    }}
                    className="w-16 h-8 text-center inline-block"
                  />
                </div>
                <div className="text-sm text-neutral-400">
                  <span className="mr-2">D:</span>
                  <Input
                    type="number"
                    min="0"
                    value={editedTeamStats.team2?.deaths ?? parsed?.team2?.deaths ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team2: { ...prev.team2, kills: prev.team2?.kills ?? parsed?.team2?.kills ?? 0, deaths: value, assists: prev.team2?.assists ?? parsed?.team2?.assists ?? 0 }
                      }))
                    }}
                    onBlur={(e) => {
                      // Normalizar valor removendo zeros à esquerda
                      const value = parseInt(e.target.value) || 0
                      e.target.value = value.toString()
                      // Atualizar estado com valor normalizado
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team2: { ...prev.team2, kills: prev.team2?.kills ?? parsed?.team2?.kills ?? 0, deaths: value, assists: prev.team2?.assists ?? parsed?.team2?.assists ?? 0 }
                      }))
                    }}
                    className="w-16 h-8 text-center inline-block"
                  />
                </div>
                <div className="text-sm text-neutral-400">
                  <span className="mr-2">A:</span>
                  <Input
                    type="number"
                    min="0"
                    value={editedTeamStats.team2?.assists ?? parsed?.team2?.assists ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team2: { ...prev.team2, kills: prev.team2?.kills ?? parsed?.team2?.kills ?? 0, deaths: prev.team2?.deaths ?? parsed?.team2?.deaths ?? 0, assists: value }
                      }))
                    }}
                    onBlur={(e) => {
                      // Normalizar valor removendo zeros à esquerda
                      const value = parseInt(e.target.value) || 0
                      e.target.value = value.toString()
                      // Atualizar estado com valor normalizado
                      setEditedTeamStats(prev => ({
                        ...prev,
                        team2: { ...prev.team2, kills: prev.team2?.kills ?? parsed?.team2?.kills ?? 0, deaths: prev.team2?.deaths ?? parsed?.team2?.deaths ?? 0, assists: value }
                      }))
                    }}
                    className="w-16 h-8 text-center inline-block"
                  />
                </div>
                {team2Players.length === 0 && (
                  <span className="ml-2 text-yellow-400">⚠️ Nenhum jogador extraído</span>
                )}
              </div>
              {team2Players.length === 0 ? (
                <div className="p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
                  <p className="text-sm text-yellow-400">
                    ⚠️ A IA não conseguiu extrair os dados dos jogadores desta equipe. 
                    Isso pode acontecer se a imagem estiver cortada ou com baixa qualidade.
                  </p>
                </div>
              ) : (
                <div className="border border-neutral-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neutral-700">
                        <TableHead className="text-neutral-300">Jogador</TableHead>
                        <TableHead className="text-neutral-300">K</TableHead>
                        <TableHead className="text-neutral-300">D</TableHead>
                        <TableHead className="text-neutral-300">A</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team2Players.map((p: any, idx: number) => (
                      <TableRow
                        key={idx}
                        className={!p.hasAlias ? 'bg-red-500/10' : ''}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{p.rawName || 'Sem nome'}</span>
                              {!p.hasAlias && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Sem alias
                                </Badge>
                              )}
                              {p.hasAlias && (
                                <Badge variant="outline" className="text-xs text-green-400">
                                  {p.playerName}
                                </Badge>
                              )}
                            </div>
                            {/* Mostrar Select sempre para permitir trocar, mesmo se tiver alias */}
                            {team2ActualTeam ? (
                              <Select
                                value={playerMappings[`team2_${idx}`] || (p.hasAlias && !p.isManuallyMapped && p.playerId ? String(p.playerId) : 'none')}
                                onValueChange={(value) => {
                                  console.log(`[DRAFT] Team2[${idx}] mudando seleção:`, value)
                                  if (value === 'none') {
                                    // Permitir remover seleção (volta para alias automático se existir)
                                    setPlayerMappings((prev) => {
                                      const newMappings = { ...prev }
                                      delete newMappings[`team2_${idx}`]
                                      console.log(`[DRAFT] Team2[${idx}] removido mapeamento manual, voltando para automático`)
                                      return newMappings
                                    })
                                  } else {
                                    // Verificar se o jogador já foi selecionado em outro slot da mesma equipe
                                    const alreadySelected = Object.entries(playerMappings).some(
                                      ([key, playerId]) => 
                                        key.startsWith('team2_') && 
                                        key !== `team2_${idx}` && 
                                        playerId === value
                                    )
                                    
                                    // Também verificar aliases automáticos
                                    const alreadySelectedAuto = team2Players.some(
                                      (otherP: any, otherIdx: number) => 
                                        otherIdx !== idx && 
                                        !otherP.isManuallyMapped &&
                                        otherP.playerId === value
                                    )
                                    
                                    if (alreadySelected || alreadySelectedAuto) {
                                      alert('Este jogador já foi selecionado nesta equipe. Escolha outro jogador.')
                                      return
                                    }
                                    
                                    handleMapPlayer(p.rawName, value, 'team2', idx)
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Selecione o jogador" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    {p.hasAlias && !p.isManuallyMapped ? 'Usar alias automático' : 'Selecione...'}
                                  </SelectItem>
                                  {players
                                    .filter((pl: any) => {
                                      // Filtrar jogadores do time correto
                                      if (pl.team_id !== team2ActualTeam.id) return false
                                      
                                      // Filtrar jogadores já selecionados nesta equipe (exceto o atual)
                                      const isAlreadySelectedManual = Object.entries(playerMappings).some(
                                        ([key, playerId]) => 
                                          key.startsWith('team2_') && 
                                          key !== `team2_${idx}` && 
                                          playerId === pl.id
                                      )
                                      
                                      // Verificar aliases automáticos também
                                      const isAlreadySelectedAuto = team2Players.some(
                                        (otherP: any, otherIdx: number) => 
                                          otherIdx !== idx && 
                                          !otherP.isManuallyMapped &&
                                          otherP.playerId === pl.id
                                      )
                                      
                                      return !isAlreadySelectedManual && !isAlreadySelectedAuto
                                    })
                                    .map((pl: any) => (
                                      <SelectItem key={pl.id} value={pl.id}>
                                        {pl.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-xs text-yellow-400">
                                ⚠️ Selecione qual time é E1 primeiro
                              </p>
                            )}
                            {p.wasAutoDetected && !p.isManuallyMapped && (
                              <Badge variant="outline" className="text-xs text-blue-400 mt-1">
                                ✓ Identificado automaticamente
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={p.kills}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0
                              setEditedStats(prev => ({
                                ...prev,
                                [`team2_${idx}`]: {
                                  ...prev[`team2_${idx}`],
                                  kills: value,
                                  deaths: prev[`team2_${idx}`]?.deaths ?? p.deaths,
                                  assists: prev[`team2_${idx}`]?.assists ?? p.assists
                                }
                              }))
                            }}
                            onBlur={(e) => {
                              // Normalizar valor removendo zeros à esquerda
                              const value = parseInt(e.target.value) || 0
                              e.target.value = value.toString()
                              // Atualizar estado com valor normalizado
                              setEditedStats(prev => ({
                                ...prev,
                                [`team2_${idx}`]: {
                                  ...prev[`team2_${idx}`],
                                  kills: value,
                                  deaths: prev[`team2_${idx}`]?.deaths ?? p.deaths,
                                  assists: prev[`team2_${idx}`]?.assists ?? p.assists
                                }
                              }))
                            }}
                            className="w-16 h-8 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={p.deaths}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0
                              setEditedStats(prev => ({
                                ...prev,
                                [`team2_${idx}`]: {
                                  ...prev[`team2_${idx}`],
                                  kills: prev[`team2_${idx}`]?.kills ?? p.kills,
                                  deaths: value,
                                  assists: prev[`team2_${idx}`]?.assists ?? p.assists
                                }
                              }))
                            }}
                            onBlur={(e) => {
                              // Normalizar valor removendo zeros à esquerda
                              const value = parseInt(e.target.value) || 0
                              e.target.value = value.toString()
                              // Atualizar estado com valor normalizado
                              setEditedStats(prev => ({
                                ...prev,
                                [`team2_${idx}`]: {
                                  ...prev[`team2_${idx}`],
                                  kills: prev[`team2_${idx}`]?.kills ?? p.kills,
                                  deaths: value,
                                  assists: prev[`team2_${idx}`]?.assists ?? p.assists
                                }
                              }))
                            }}
                            className="w-16 h-8 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={p.assists}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0
                              setEditedStats(prev => ({
                                ...prev,
                                [`team2_${idx}`]: {
                                  ...prev[`team2_${idx}`],
                                  kills: prev[`team2_${idx}`]?.kills ?? p.kills,
                                  deaths: prev[`team2_${idx}`]?.deaths ?? p.deaths,
                                  assists: value
                                }
                              }))
                            }}
                            onBlur={(e) => {
                              // Normalizar valor removendo zeros à esquerda
                              const value = parseInt(e.target.value) || 0
                              e.target.value = value.toString()
                              // Atualizar estado com valor normalizado
                              setEditedStats(prev => ({
                                ...prev,
                                [`team2_${idx}`]: {
                                  ...prev[`team2_${idx}`],
                                  kills: prev[`team2_${idx}`]?.kills ?? p.kills,
                                  deaths: prev[`team2_${idx}`]?.deaths ?? p.deaths,
                                  assists: value
                                }
                              }))
                            }}
                            className="w-16 h-8 text-center"
                          />
                        </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Notes */}
            {parsed?.notes && (
              <div className="p-3 bg-neutral-800 rounded-lg">
                <p className="text-xs text-neutral-400">
                  <strong>Notas do modelo:</strong> {parsed.notes}
                </p>
              </div>
            )}

            {/* Apply Button */}
            <Button
              onClick={handleApply}
              disabled={applying || !matchNumber || !mvpPlayerId || team1IsRac === null}
              className="w-full"
              size="lg"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Aplicar e Criar Partida
                </>
              )}
            </Button>

            {team1Players.some((p: any) => !p.hasAlias) ||
            team2Players.some((p: any) => !p.hasAlias) ? (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                <p className="text-xs text-yellow-400">
                  <strong>Atenção:</strong> Alguns jogadores não têm alias configurado. Eles serão ignorados ao aplicar. Configure os aliases em Admin &gt; Jogadores.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

