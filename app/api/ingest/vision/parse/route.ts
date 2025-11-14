import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Schema flexível que aceita strings e números, convertendo quando necessário
// Aceita tanto "rawName" quanto "nickname" (OpenAI pode usar qualquer um)
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
  // Normalizar: usar nickname se rawName não existir
  if (!data.rawName && data.nickname) {
    data.rawName = data.nickname
  }
  // Garantir que rawName existe
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

// Schema que aceita tanto a estrutura esperada quanto a estrutura retornada pela OpenAI
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

// Schema flexível que aceita diferentes estruturas
const ParsedSchema = z.object({
  winner: z.union([z.enum(['E1', 'E2']), z.null(), z.string()]).transform((val) => {
    if (val === null || val === 'null' || val === '') return null
    if (val === 'E1' || val === 'E2') return val
    return null
  }),
  team1: Team,
  team2: Team,
  // Aceita players no nível raiz também (estrutura alternativa)
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
  // Normalizar estrutura: mover players do nível raiz para dentro de team1/team2 se necessário
  if (data.players) {
    if (data.players.team1 && !data.team1.players) {
      data.team1.players = data.players.team1
    }
    if (data.players.team2 && !data.team2.players) {
      data.team2.players = data.players.team2
    }
  }
  
  // Garantir que players exista (mesmo que vazio)
  if (!data.team1.players) {
    data.team1.players = []
  }
  if (!data.team2.players) {
    data.team2.players = []
  }
  
  // Garantir confidence
  if (data.confidence === undefined || data.confidence === null) {
    data.confidence = 0.5
  }
  
  return data
})

const SYSTEM_PROMPT = `Você é um extrator de dados altamente preciso. Recebe uma captura de tela do placar final do League of Legends (tela de "PLACAR" ou "SCOREBOARD"). Sua tarefa é ler e retornar SOMENTE um JSON válido conforme o schema a seguir.

IMPORTANTE: Você DEVE extrair os dados de CADA JOGADOR individualmente, incluindo:
- O NICKNAME/IN-GAME NAME exato de cada jogador (como aparece na tela)
- Kills (K) de cada jogador
- Deaths (D) de cada jogador  
- Assists (A) de cada jogador

Schema JSON:
{
  "winner": "E1" ou "E2" ou null,
  "team1": {
    "kills": número total (soma dos kills dos jogadores),
    "deaths": número total (soma das deaths dos jogadores),
    "assists": número total (soma dos assists dos jogadores),
    "players": [
      {
        "rawName": "NICKNAME_EXATO_DO_JOGADOR",
        "kills": número,
        "deaths": número,
        "assists": número
      },
      ... (até 5 jogadores)
    ]
  },
  "team2": {
    "kills": número total,
    "deaths": número total,
    "assists": número total,
    "players": [
      {
        "rawName": "NICKNAME_EXATO_DO_JOGADOR",
        "kills": número,
        "deaths": número,
        "assists": número
      },
      ... (até 5 jogadores)
    ]
  },
  "confidence": 0.0 a 1.0,
  "notes": "opcional - observações sobre a extração"
}

Regras CRÍTICAS:
1. Para CADA jogador visível na tela, você DEVE extrair:
   - O nome/nickname EXATO como aparece (pode estar em caracteres especiais, emojis, etc)
   - Os números de K/D/A da linha desse jogador específico
   
2. Se a estrutura for diferente (ex: players em um objeto separado), use esta estrutura alternativa:
   {
     "winner": "E1" ou "E2" ou null,
     "team1": { "kills": X, "deaths": Y, "assists": Z },
     "team2": { "kills": X, "deaths": Y, "assists": Z },
     "players": {
       "team1": [
         { "nickname": "NOME", "kills": K, "deaths": D, "assists": A },
         ...
       ],
       "team2": [
         { "nickname": "NOME", "kills": K, "deaths": D, "assists": A },
         ...
       ]
     }
   }

3. winner: "E1" = equipe de cima (topo da tela), "E2" = equipe de baixo. Se houver "VITÓRIA" no topo, geralmente E1 venceu.

4. NÃO invente dados. Se não conseguir ver claramente, coloque 0 ou o melhor palpite e reduza confidence.

5. Ignore painéis laterais, popups, chat. Foque APENAS no placar principal com os jogadores.

6. Retorne SOMENTE JSON válido, sem markdown, sem comentários, sem texto extra.`

export async function POST(req: Request) {
  // Ler body uma vez e salvar valores
  let seriesId: string | null = null
  let imageUrl: string | null = null
  
  try {
    const body = await req.json()
    seriesId = body.seriesId
    imageUrl = body.imageUrl

    if (!seriesId || !imageUrl) {
      return NextResponse.json(
        { error: 'seriesId and imageUrl are required' },
        { status: 400 }
      )
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      )
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })
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

    // Chamar OpenAI Vision
    console.log('[PARSE] Iniciando chamada OpenAI Vision...')
    console.log('[PARSE] Series ID:', seriesId)
    console.log('[PARSE] Image URL:', imageUrl?.substring(0, 100) + '...')

    const userPrompt = `Extraia os dados do placar dessa imagem e retorne o JSON do schema.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 600,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    })

    console.log('[PARSE] OpenAI response recebida')
    console.log('[PARSE] Tokens usado:', completion.usage)

    const outputText = completion.choices[0]?.message?.content
    if (!outputText) {
      console.error('[PARSE] Erro: Sem resposta da OpenAI')
      throw new Error('No response from OpenAI')
    }

    console.log('[PARSE] Output text (primeiros 200 chars):', outputText.substring(0, 200))

    // Parse e validar JSON
    let parsed
    try {
      const jsonData = JSON.parse(outputText)
      console.log('[PARSE] JSON parseado com sucesso')
      console.log('[PARSE] Dados recebidos:', JSON.stringify(jsonData, null, 2))

      parsed = ParsedSchema.parse(jsonData)
      console.log('[PARSE] Schema validado com sucesso')
      console.log('[PARSE] Dados validados:', JSON.stringify(parsed, null, 2))
    } catch (e: any) {
      console.error('[PARSE] Erro na validação:', e)
      console.error('[PARSE] Erro details:', {
        message: e.message,
        issues: e.issues || 'N/A',
        outputText: outputText.substring(0, 500),
      })

      // Tentar salvar job com erro
      await supabase.from('ingest_jobs').insert({
        image_url: imageUrl,
        series_id: seriesId,
        provider: 'openai',
        status: 'failed',
        error: `Invalid JSON/Schema: ${e.message}. Issues: ${JSON.stringify(e.issues || [])}`,
        payload_json: { raw_output: outputText, error: e.message, issues: e.issues },
        created_by: user.id,
      })

      return NextResponse.json(
        {
          error: 'invalid-json',
          detail: e.message,
          issues: e.issues || [],
          raw: outputText.substring(0, 500),
        },
        { status: 422 }
      )
    }

    // Calcular custo estimado (gpt-4o-mini vision)
    const tokensInput = completion.usage?.prompt_tokens || 0
    const tokensOutput = completion.usage?.completion_tokens || 0
    // Preços aproximados: $0.15/1M input tokens, $0.60/1M output tokens
    const costUsd =
      (tokensInput / 1_000_000) * 0.15 + (tokensOutput / 1_000_000) * 0.6

    // Criar ingest_job
    console.log('[PARSE] Criando ingest_job...')
    const { data: job, error: jErr } = await supabase
      .from('ingest_jobs')
      .insert({
        image_url: imageUrl,
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
        created_by: user.id,
      })
      .select()
      .single()

    if (jErr) {
      console.error('[PARSE] Erro ao criar ingest_job:', jErr)
      throw jErr
    }

    console.log('[PARSE] Ingest job criado:', job.id)

    // Criar match_draft
    console.log('[PARSE] Criando match_draft...')
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
      console.error('[PARSE] Erro ao criar match_draft:', dErr)
      throw dErr
    }

    console.log('[PARSE] Match draft criado:', draft.id)
    console.log('[PARSE] ✅ Processo concluído com sucesso!')

    return NextResponse.json({ draftId: draft.id })
  } catch (e: any) {
    console.error('[PARSE] ❌ Erro geral no processo:', e)
    console.error('[PARSE] Stack:', e?.stack)
    console.error('[PARSE] Message:', e?.message)

    // Tentar salvar erro no job
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      await supabase.from('ingest_jobs').insert({
        image_url: imageUrl || 'unknown',
        series_id: seriesId,
        status: 'failed',
        provider: 'openai',
        error: String(e?.message || e),
        payload_json: { error: e?.message, stack: e?.stack },
        created_by: user?.id || null,
      })
      console.log('[PARSE] Erro salvo no banco de dados')
    } catch (saveErr) {
      console.error('[PARSE] Erro ao salvar job com falha:', saveErr)
    }

    return NextResponse.json(
      {
        error: 'parse-failed',
        detail: String(e?.message || e),
        code: e?.code || 'unknown',
      },
      { status: 500 }
    )
  }
}

