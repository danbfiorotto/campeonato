import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Reutilizar os schemas do parse route
const ParsedPlayer = z.object({
  rawName: z.string().min(1).optional(),
  nickname: z.string().min(1).optional(),
  kills: z.union([z.number().int().nonnegative(), z.string()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
  deaths: z.union([z.number().int().nonnegative(), z.string()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
  assists: z.union([z.number().int().nonnegative(), z.string()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
}).transform((data) => {
  if (!data.rawName && data.nickname) {
    data.rawName = data.nickname
  }
  if (!data.rawName) {
    data.rawName = 'Unknown'
  }
  return {
    rawName: data.rawName,
    kills: data.kills,
    deaths: data.deaths,
    assists: data.assists,
  }
})

const Team = z.object({
  kills: z.union([z.number().int().nonnegative(), z.string()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
  deaths: z.union([z.number().int().nonnegative(), z.string()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
  assists: z.union([z.number().int().nonnegative(), z.string()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
  players: z.array(ParsedPlayer).max(5).optional(),
})

const ParsedSchema = z.object({
  winner: z.union([z.enum(['E1', 'E2']), z.null(), z.string()]).transform((val) => {
    if (val === null || val === 'null' || val === '') return null
    if (val === 'E1' || val === 'E2') return val
    return null
  }),
  team1: Team,
  team2: Team,
  players: z.object({
    team1: z.array(ParsedPlayer).optional(),
    team2: z.array(ParsedPlayer).optional(),
  }).optional(),
  confidence: z.union([z.number().min(0).max(1), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null) return 0.5
    const num = typeof val === 'string' ? parseFloat(val) : val
    if (isNaN(num)) return 0.5
    return Math.max(0, Math.min(1, num))
  }),
  notes: z.union([z.string(), z.null()]).optional().transform((val) => val || undefined),
}).transform((data) => {
  if (data.players) {
    if (data.players.team1 && !data.team1.players) {
      data.team1.players = data.players.team1
    }
    if (data.players.team2 && !data.team2.players) {
      data.team2.players = data.players.team2
    }
  }
  if (!data.team1.players) {
    data.team1.players = []
  }
  if (!data.team2.players) {
    data.team2.players = []
  }
  if (data.confidence === undefined || data.confidence === null) {
    data.confidence = 0.5
  }
  return data
})

const SYSTEM_PROMPT = `Você é um especialista em análise de placares de League of Legends. Analise a imagem fornecida e extraia os seguintes dados:

1. Vencedor: "E1" (equipe de cima) ou "E2" (equipe de baixo), ou null se não for possível determinar
2. Team 1 (E1 - equipe de cima):
   - Total de kills, deaths e assists
   - Lista de até 5 jogadores com:
     * rawName: nome exato como aparece no placar (nickname in-game)
     * kills: número de kills
     * deaths: número de deaths
     * assists: número de assists
3. Team 2 (E2 - equipe de baixo):
   - Total de kills, deaths e assists
   - Lista de até 5 jogadores com:
     * rawName: nome exato como aparece no placar (nickname in-game)
     * kills: número de kills
     * deaths: número de deaths
     * assists: número de assists
4. confidence: nível de confiança da extração (0.0 a 1.0)
5. notes: observações relevantes (opcional)

IMPORTANTE:
- Extraia os nomes EXATOS dos jogadores como aparecem no placar
- Extraia os números de K/D/A de cada jogador
- Se algum dado não estiver visível, use null ou 0 conforme apropriado
- Retorne APENAS JSON válido, sem markdown ou texto adicional

Formato JSON esperado:
{
  "winner": "E1" | "E2" | null,
  "team1": {
    "kills": number,
    "deaths": number,
    "assists": number,
    "players": [
      {
        "rawName": "string",
        "kills": number,
        "deaths": number,
        "assists": number
      }
    ]
  },
  "team2": {
    "kills": number,
    "deaths": number,
    "assists": number,
    "players": [
      {
        "rawName": "string",
        "kills": number,
        "deaths": number,
        "assists": number
      }
    ]
  },
  "confidence": number,
  "notes": "string (opcional)"
}`

export async function POST(req: Request) {
  try {
    const { mediaId } = await req.json()

    if (!mediaId) {
      return NextResponse.json(
        { error: 'mediaId é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar autenticação (pode ser chamado por service role ou admin)
    const authHeader = req.headers.get('authorization')
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const isServiceRole = authHeader?.startsWith('Bearer ') && authHeader.includes(serviceRoleKey)
    
    let supabase
    
    if (isServiceRole) {
      // Usar service role client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    } else {
      // Usar server client que lê cookies automaticamente
      supabase = await createClient()
      
      // Verificar se é admin
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Tentar buscar por id primeiro, depois por user_id
      let { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!profile) {
        const { data: profile2 } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()
        profile = profile2
      }

      if (!profile || !['super', 'rac', 'ast'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Buscar a mídia
    const { data: media, error: mediaError } = await supabase
      .from('match_media')
      .select(`
        *,
        matches!inner (
          id,
          series_id,
          series!inner (
            id,
            game_id
          )
        )
      `)
      .eq('id', mediaId)
      .eq('type', 'image')
      .single()

    if (mediaError || !media) {
      console.error('[AUTO_PARSE] Erro ao buscar mídia:', mediaError)
      return NextResponse.json(
        { error: 'Mídia não encontrada ou não é uma imagem' },
        { status: 404 }
      )
    }

    // Verificar se já foi processada (evitar duplicatas)
    const { data: existingJob } = await supabase
      .from('ingest_jobs')
      .select('id')
      .eq('image_url', media.url)
      .eq('status', 'parsed')
      .maybeSingle()

    if (existingJob) {
      console.log('[AUTO_PARSE] Imagem já foi processada anteriormente')
      return NextResponse.json({
        success: true,
        message: 'Imagem já foi processada anteriormente',
        draftId: null
      })
    }

    const match = media.matches as any
    const series = match.series as any
    const seriesId = series.id

    if (!seriesId) {
      return NextResponse.json(
        { error: 'Série não encontrada' },
        { status: 404 }
      )
    }

    console.log('[AUTO_PARSE] Iniciando análise automática da mídia:', mediaId)
    console.log('[AUTO_PARSE] Series ID:', seriesId)
    console.log('[AUTO_PARSE] Image URL:', media.url.substring(0, 100) + '...')

    // Chamar OpenAI Vision
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analise este placar de League of Legends e extraia todos os dados no formato JSON especificado.',
            },
            {
              type: 'image_url',
              image_url: {
                url: media.url,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Resposta vazia do OpenAI')
    }

    console.log('[AUTO_PARSE] Resposta do OpenAI:', content.substring(0, 200) + '...')

    // Parse e validação
    let parsed: any
    try {
      const rawJson = JSON.parse(content)
      parsed = ParsedSchema.parse(rawJson)
      console.log('[AUTO_PARSE] ✅ JSON validado com sucesso')
    } catch (parseError: any) {
      console.error('[AUTO_PARSE] ❌ Erro na validação:', parseError)
      throw new Error(`Erro na validação: ${parseError.message}`)
    }

    // Calcular custos
    const tokensInput = response.usage?.prompt_tokens || 0
    const tokensOutput = response.usage?.completion_tokens || 0
    const costUsd = (tokensOutput / 1_000_000) * 0.6

    // Obter usuário atual (se houver)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Criar ingest_job
    console.log('[AUTO_PARSE] Criando ingest_job...')
    const { data: job, error: jErr } = await supabase
      .from('ingest_jobs')
      .insert({
        image_url: media.url,
        series_id: seriesId,
        provider: 'openai',
        status: 'parsed',
        parsed_json: parsed,
        confidence: parsed.confidence,
        prompt_used: SYSTEM_PROMPT,
        model_used: 'gpt-4o-mini',
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost_usd: costUsd,
        created_by: user?.id || null,
      })
      .select()
      .single()

    if (jErr) {
      console.error('[AUTO_PARSE] Erro ao criar ingest_job:', jErr)
      throw jErr
    }

    console.log('[AUTO_PARSE] Ingest job criado:', job.id)

    // Criar match_draft
    console.log('[AUTO_PARSE] Criando match_draft...')
    const { data: draft, error: dErr } = await supabase
      .from('match_drafts')
      .insert({
        job_id: job.id,
        series_id: seriesId,
        parsed_json: parsed,
        confidence: parsed.confidence,
      })
      .select()
      .single()

    if (dErr) {
      console.error('[AUTO_PARSE] Erro ao criar match_draft:', dErr)
      throw dErr
    }

    console.log('[AUTO_PARSE] Match draft criado:', draft.id)
    console.log('[AUTO_PARSE] ✅ Processo concluído com sucesso!')

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      message: 'Análise automática concluída com sucesso'
    })
  } catch (e: any) {
    console.error('[AUTO_PARSE] ❌ Erro geral no processo:', e)
    return NextResponse.json(
      {
        error: 'Erro ao processar análise automática',
        detail: e.message || 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}

