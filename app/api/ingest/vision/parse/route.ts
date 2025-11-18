import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Schema flexível que aceita strings e números, convertendo quando necessário
// Aceita tanto "rawName" quanto "nickname" (OpenAI pode usar qualquer um)
// NOVO: usa columns como fonte da verdade para K/D/A
const ParsedPlayer = z.object({
  rawName: z.string().min(1).optional(),
  nickname: z.string().min(1).optional(),
  // NOVO: array com os quatro números pós-score [kills, deaths, assists, outro_stat]
  columns: z
    .array(z.union([z.number().int(), z.string()]))
    .min(4)
    .max(4)
    .optional(),
  kills: z.union([z.number().int().nonnegative(), z.string()]).optional(),
  deaths: z.union([z.number().int().nonnegative(), z.string()]).optional(),
  assists: z.union([z.number().int().nonnegative(), z.string()]).optional(),
  extra: z.record(z.any()).optional(),
}).transform((data) => {
  // Normalizar: usar nickname se rawName não existir
  if (!data.rawName && data.nickname) {
    data.rawName = data.nickname
  }
  // Garantir que rawName existe
  if (!data.rawName) {
    data.rawName = 'Unknown'
  }

  // Função auxiliar para converter para número
  const toNum = (v: any) => {
    if (v === undefined || v === null) return 0
    if (typeof v === 'string') {
      const parsed = parseInt(v, 10)
      return isNaN(parsed) ? 0 : Math.max(0, parsed)
    }
    return Math.max(0, v ?? 0)
  }

  // Se veio columns, usamos ela como fonte da verdade
  let kills = 0
  let deaths = 0
  let assists = 0

  if (data.columns && data.columns.length >= 3) {
    kills = toNum(data.columns[0])
    deaths = toNum(data.columns[1])
    assists = toNum(data.columns[2])
  } else {
    // Fallback para kills/deaths/assists diretos (compatibilidade com LoL)
    kills = toNum(data.kills)
    deaths = toNum(data.deaths)
    assists = toNum(data.assists)
  }

  return {
    rawName: data.rawName,
    kills,
    deaths,
    assists,
    extra: data.extra || {},
  }
})

// Schema que aceita tanto a estrutura esperada quanto a estrutura retornada pela OpenAI
const Team = z.object({
  nameHint: z.string().optional(),
  score: z.union([z.number().int().nonnegative(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null) return 0
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
  kills: z.union([z.number().int().nonnegative(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null) return 0
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
  deaths: z.union([z.number().int().nonnegative(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null) return 0
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
  assists: z.union([z.number().int().nonnegative(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null) return 0
    const num = typeof val === 'string' ? parseInt(val, 10) : val
    return isNaN(num) ? 0 : Math.max(0, num)
  }),
  players: z.array(ParsedPlayer).max(5).optional(),
})

// Schema unificado multi-jogo
const ParsedSchema = z.object({
  game: z.enum(['lol', 'r6']).optional(),
  winner: z
    .union([z.enum(['E1', 'E2']), z.null(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === 'null' || val === '') return null
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
  extra: z.record(z.any()).optional(),
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
  
  // Garantir extra
  if (!data.extra) {
    data.extra = {}
  }
  
  return data
})

// Prompt para League of Legends
const SYSTEM_PROMPT_LOL = `Você é um extrator de dados altamente preciso. Recebe uma captura de tela do placar final do League of Legends (tela de "PLACAR" ou "SCOREBOARD"). Sua tarefa é ler e retornar SOMENTE um JSON válido conforme o schema fornecido.

IMPORTANTE: Você DEVE extrair os dados de CADA JOGADOR individualmente, incluindo:
- O NICKNAME/IN-GAME NAME exato de cada jogador (como aparece na tela)
- Kills (K) de cada jogador
- Deaths (D) de cada jogador  
- Assists (A) de cada jogador

Regras CRÍTICAS:
1. Para CADA jogador visível na tela, você DEVE extrair:
   - O nome/nickname EXATO como aparece (pode estar em caracteres especiais, emojis, etc)
   - Os números de K/D/A da linha desse jogador específico
   
2. winner: "E1" = equipe de cima (topo da tela), "E2" = equipe de baixo. Se houver "VITÓRIA" no topo, geralmente E1 venceu.

3. team1.score e team2.score: pode ser 0 ou ignorado (não é crítico para LoL).

4. No root.extra você pode incluir: { "team1KDA": "19/6/15", "team2KDA": "6/19/6" } (opcional).

5. NÃO invente dados. Se não conseguir ver claramente, coloque 0 ou o melhor palpite e reduza confidence.

6. Ignore painéis laterais, popups, chat. Foque APENAS no placar principal com os jogadores.

7. Retorne SOMENTE JSON válido do schema fornecido, sem markdown, sem comentários, sem texto extra.`

// Prompt para Rainbow Six Siege
const SYSTEM_PROMPT_R6 = `Você é um extrator de dados para "Rainbow Six Siege" (tela de placar pós-partida). Retorne SOMENTE JSON válido no schema fornecido.

⚠️ CRÍTICO: Você DEVE extrair os dados de CADA JOGADOR INDIVIDUALMENTE, linha por linha do placar. NÃO invente valores para jogadores que você não consegue ver claramente.

Regras CRÍTICAS:
1. A equipe da metade de cima é "E1" (geralmente BLUE TEAM); a de baixo é "E2" (ORANGE TEAM).

2. winner: se a tela mostrar "VICTORY/DERROTA", isso indica o vencedor; caso ausente, use a maior pontuação de rounds (team*.score).

3. team1.score e team2.score: rounds vencidos no placar final (ex.: 7–5). OBRIGATÓRIO para R6. Procure por números grandes no placar que representam os rounds.

4. team1.kills, team1.deaths, team1.assists: NÃO são necessários para R6. Deixe como 0.

5. players: até 5 por equipe. ⚠️ EXTRAÇÃO INDIVIDUAL OBRIGATÓRIA:
   
   Para CADA jogador visível na tela, você DEVE:
   a) Identificar a LINHA específica desse jogador no placar
   b) Ler o NICKNAME exato como aparece nessa linha (pode ter caracteres especiais, emojis, etc)
   c) Ler os números de KILLS dessa linha específica (não invente, não copie de outro jogador)
   d) Ler os números de DEATHS dessa linha específica (não invente, não copie de outro jogador)
   e) Ler os números de ASSISTS dessa linha específica (não invente, não copie de outro jogador)
   
   ⚠️ NÃO copie valores de um jogador para outro. Cada jogador tem seus próprios valores na sua própria linha.
   ⚠️ Se você não conseguir ver claramente os dados de um jogador específico, coloque 0 para K/D/A desse jogador e reduza "confidence".

6. Estrutura visual do placar R6 - IMPORTANTE ENTENDER:
   
   O placar do Rainbow Six Siege geralmente tem esta estrutura visual:
   
   [EQUIPE 1 - TOPO DA TELA - AZUL]
   Jogador1 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping
   Jogador2 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping  
   Jogador3 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping
   Jogador4 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping
   Jogador5 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping
   
   [EQUIPE 2 - BAIXO DA TELA]
   Jogador1 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping
   Jogador2 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping
   Jogador3 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping
   Jogador4 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping
   Jogador5 | [outros dados] | pontuação | K: X | D: Y | A: Z | ping
   
   ⚠️ ATENÇÃO ESPECIAL:
   - As colunas de K/D/A podem aparecer como: "K", "D", "A" ou como números separados
   - A ordem geralmente é: Kills primeiro, depois Deaths, depois Assists
   - Cada número está na MESMA LINHA do jogador correspondente
   - NÃO confunda os valores entre linhas diferentes
   - Se houver cabeçalhos de coluna (K, D, A), use-os como referência para identificar as colunas corretas, mas o normal é que seja um simbolo de mira para Kills, um personagem com x para deaths, e uma mao para assists e de um grafico de barras para ping, e uma estrela para pontuacao.
   - Os valores podem estar alinhados verticalmente em colunas, mas cada linha representa um jogador diferente
   
   ⚠️ Você DEVE ler CADA linha individualmente, começando do primeiro jogador até o último. Não pule linhas. Não assuma que todos os jogadores têm os mesmos valores.

7. Processo de extração passo a passo:
   
   PASSO 1: Identifique visualmente onde estão as colunas de K/D/A no placar
   PASSO 2: Identifique quantos jogadores estão visíveis em cada equipe (máximo 5 por equipe)
   PASSO 3: Para a primeira equipe (E1 - topo):
      - Localize a primeira linha de jogador
      - Leia o nickname dessa linha
      - Encontre os números de K/D/A na MESMA LINHA (não pegue de outra linha)
      - Anote: jogador 1 = {rawName: "...", kills: X, deaths: Y, assists: Z}
      - Repita para cada linha subsequente até processar todos os jogadores da equipe 1
   PASSO 4: Para a segunda equipe (E2 - baixo):
      - Repita o mesmo processo linha por linha
      - Certifique-se de ler os valores da linha correta de cada jogador
   
   ⚠️ VALIDAÇÃO FINAL: Antes de retornar, verifique:
   - Cada jogador tem seus próprios valores de K/D/A (não são todos iguais)
   - Você extraiu dados de TODOS os jogadores visíveis, não apenas alguns
   - Os valores fazem sentido (não são todos zeros a menos que realmente sejam)

8. No root.extra inclua quando possível: { "map": "Clubhouse" } (nome do mapa visível na tela).

9. Se você não conseguir ver claramente os dados de algum jogador específico:
   - Coloque 0 para K/D/A desse jogador
   - Reduza "confidence" proporcionalmente
   - NÃO invente valores baseados em outros jogadores

10. NÃO some os valores dos jogadores para criar totais do time. O foco é extrair os dados INDIVIDUAIS de cada jogador.

Saída: apenas JSON válido do schema unificado (sem comentários ou markdown).`

// Função para obter o prompt baseado no jogo
function getSystemPrompt(game: 'lol' | 'r6'): string {
  return game === 'r6' ? SYSTEM_PROMPT_R6 : SYSTEM_PROMPT_LOL
}

// Schema JSON para Responses API
// Nota: kills/deaths/assists do time são opcionais (apenas LoL precisa, R6 não)
const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    team1: {
      type: 'object',
      additionalProperties: false,
      properties: {
        score: { type: 'number', description: 'Score da equipe (rounds para R6 - OBRIGATÓRIO, pode ser 0 para LoL)' },
        players: {
          type: 'array',
          maxItems: 5,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              rawName: { type: 'string', description: 'Nickname exato do jogador como aparece no placar' },
              // NOVO: os 4 números após o score [kills, deaths, assists, outro_stat]
              columns: {
                type: 'array',
                items: { type: 'number' },
                minItems: 4,
                maxItems: 4,
                description: 'Os QUATRO números da linha do jogador, logo após o score, na ordem exata em que aparecem: [kills, deaths, assists, outro_stat_ignorado]'
              }
            },
            required: ['rawName', 'columns']
          }
        }
      },
      required: ['players', 'score']
    },
    team2: {
      type: 'object',
      additionalProperties: false,
      properties: {
        score: { type: 'number', description: 'Score da equipe (rounds para R6 - OBRIGATÓRIO, pode ser 0 para LoL)' },
        players: {
          type: 'array',
          maxItems: 5,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              rawName: { type: 'string', description: 'Nickname exato do jogador como aparece no placar' },
              // NOVO: os 4 números após o score [kills, deaths, assists, outro_stat]
              columns: {
                type: 'array',
                items: { type: 'number' },
                minItems: 4,
                maxItems: 4,
                description: 'Os QUATRO números da linha do jogador, logo após o score, na ordem exata em que aparecem: [kills, deaths, assists, outro_stat_ignorado]'
              }
            },
            required: ['rawName', 'columns']
          }
        }
      },
      required: ['players', 'score']
    }
  },
  required: ['team1', 'team2']
}

export async function POST(req: Request) {
  // Ler body uma vez e salvar valores
  let seriesId: string | null = null
  let imageUrl: string | null = null
  let game: 'lol' | 'r6' = 'lol' // Default para LoL para manter compatibilidade
  
  try {
    const body = await req.json()
    seriesId = body.seriesId
    imageUrl = body.imageUrl
    game = body.game || 'lol' // Aceita game do body, default 'lol'

    if (!seriesId || !imageUrl) {
      return NextResponse.json(
        { error: 'seriesId and imageUrl are required' },
        { status: 400 }
      )
    }

    // Validar game
    if (game !== 'lol' && game !== 'r6') {
      return NextResponse.json(
        { error: 'game must be "lol" or "r6"' },
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
    console.log('[PARSE] Game:', game)
    console.log('[PARSE] Image URL:', imageUrl?.substring(0, 100) + '...')

    const systemPrompt = getSystemPrompt(game)
    const userPrompt = `Extraia os dados do placar dessa imagem e retorne o JSON do schema.`

    // Adicionar schema JSON ao prompt para guiar a resposta
    // Para R6, adicionar instruções específicas sobre extração individual
    const schemaInstructions =
      game === 'r6'
        ? `
⚠️ INSTRUÇÕES CRÍTICAS PARA R6 - LEIA COM ATENÇÃO:

Você receberá uma IMAGEM do placar do Rainbow Six Siege.

Para CADA jogador:

1) Identifique a linha do jogador.
2) Localize o SCORE (número grande à esquerda da parte numérica).
3) Logo depois do SCORE existem **QUATRO números**, sempre na mesma ordem visual da esquerda para a direita.
   Você deve devolver esses quatro números no campo "columns", assim:

   columns = [n1, n2, n3, n4]

   onde:
   - n1 = primeiro número após o score
   - n2 = segundo número após o score
   - n3 = terceiro número após o score
   - n4 = quarto número após o score (será ignorado pelo backend)

Exemplos REAIS:
- Linha: "5328  11  2  4  25"  -> columns: [11, 2, 4, 25]
- Linha: "5245  10  5  3  18" -> columns: [10, 5, 3, 18]
- Linha: "1585  6  7  1  13"  -> columns: [6, 7, 1, 13]

⚠️ REGRAS OBRIGATÓRIAS:
- NÃO reordene esses números.
- NÃO pule nenhum número.
- NÃO tente somar nem interpretar: apenas copie os QUATRO números na ordem em que aparecem depois do score.
- Se não conseguir ver claramente algum número, use 0 naquele lugar.
- O backend vai calcular kills/deaths/assists a partir de columns[0], columns[1], columns[2].

TIMES E PLACAR:
- A equipe da metade de cima é "E1" (geralmente BLUE TEAM); a de baixo é "E2" (ORANGE TEAM).
- winner: se a tela mostrar "VICTORY/DERROTA", isso indica o vencedor; caso ausente, use a maior pontuação de rounds (team*.score).
- team1.score e team2.score: rounds vencidos no placar final (ex.: 7–5). OBRIGATÓRIO para R6. Procure por números grandes no placar que representam os rounds.

PROCESSO:
- Para cada equipe, processe TODOS os jogadores visíveis (até 5 por equipe)
- Para cada jogador, preencha o campo "columns" com os 4 números após o score
- O campo "columns" é OBRIGATÓRIO para cada jogador`
        : ''

    const promptWithSchema = `${systemPrompt}${schemaInstructions}

    Schema JSON esperado:
    ${JSON.stringify(JSON_SCHEMA, null, 2)}

    IMPORTANTE: Retorne APENAS um objeto JSON válido seguindo este schema, sem markdown, sem comentários.`

    const completion = await openai.chat.completions.create({
      // Usar gpt-4o para R6 (números pequenos, precisa de mais precisão) e gpt-4o-mini para LoL (economia)
      model: game === 'r6' ? 'gpt-4o' : 'gpt-4o-mini',
      temperature: 0, // Temperatura zero para não inventar números
      top_p: 0, // Reduz variação aleatória, ajuda a não "inventar" números quando está em dúvida
      max_tokens: game === 'r6' ? 1000 : 600, // Mais tokens para R6 que tem mais dados para extrair
      messages: [
        { role: 'system', content: promptWithSchema },
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
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'parsed_scoreboard',
          strict: false, // Desabilitado para permitir campos opcionais - Zod faz a validação final
          schema: JSON_SCHEMA,
        },
      },
    })

    console.log('[PARSE] OpenAI response recebida')
    console.log('[PARSE] Tokens usado:', completion.usage)

    const outputText = completion.choices[0]?.message?.content
    if (!outputText) {
      console.error('[PARSE] Erro: Sem resposta da OpenAI')
      throw new Error('No response from OpenAI')
    }

    // Log completo do raw response ANTES de qualquer transformação
    console.log('[PARSE] ========== RAW RESPONSE (COMPLETO) ==========')
    console.log('[PARSE] Raw output:', outputText)
    console.log('[PARSE] Raw output length:', outputText.length)
    console.log('[PARSE] ==============================================')

    // Log do JSON_SCHEMA usado para referência
    console.log('[PARSE] ========== JSON_SCHEMA USADO ==========')
    console.log('[PARSE] JSON_SCHEMA:', JSON.stringify(JSON_SCHEMA, null, 2))
    console.log('[PARSE] =======================================')

    // Parse e validar JSON
    let parsed
    try {
      const jsonData = JSON.parse(outputText)
      // Adicionar game se não estiver presente
      if (!jsonData.game) {
        jsonData.game = game
      }
      console.log('[PARSE] JSON parseado com sucesso')
      console.log('[PARSE] ========== JSON RECEBIDO (ANTES VALIDAÇÃO) ==========')
      console.log('[PARSE] JSON recebido:', JSON.stringify(jsonData, null, 2))
      console.log('[PARSE] ======================================================')

      parsed = ParsedSchema.parse(jsonData)
      console.log('[PARSE] Schema validado com sucesso')
      console.log('[PARSE] ========== DADOS VALIDADOS (DEPOIS ZOD) ==========')
      console.log('[PARSE] Dados validados:', JSON.stringify(parsed, null, 2))
      console.log('[PARSE] ===================================================')
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

    // Calcular custo estimado baseado no modelo usado
    const tokensInput = completion.usage?.prompt_tokens || 0
    const tokensOutput = completion.usage?.completion_tokens || 0
    // Preços aproximados (vision):
    // gpt-4o-mini: $0.15/1M input, $0.60/1M output
    // gpt-4o: $2.50/1M input, $10.00/1M output
    const isR6 = game === 'r6'
    const inputPricePerM = isR6 ? 2.50 : 0.15
    const outputPricePerM = isR6 ? 10.00 : 0.60
    const costUsd =
      (tokensInput / 1_000_000) * inputPricePerM + (tokensOutput / 1_000_000) * outputPricePerM

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
        prompt_used: systemPrompt,
        model_used: game === 'r6' ? 'gpt-4o' : 'gpt-4o-mini',
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

