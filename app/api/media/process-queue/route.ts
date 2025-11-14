import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cliente com service role para bypass de RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(req: Request) {
  try {
    // Buscar itens pendentes na fila
    const { data: queueItems, error: queueError } = await supabaseAdmin
      .from('auto_parse_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5) // Processar até 5 por vez

    if (queueError) {
      console.error('[QUEUE] Erro ao buscar fila:', queueError)
      return NextResponse.json(
        { error: 'Erro ao buscar fila', detail: queueError.message },
        { status: 500 }
      )
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'Nenhum item pendente na fila'
      })
    }

    console.log(`[QUEUE] Processando ${queueItems.length} item(s) da fila`)

    const results = []

    for (const item of queueItems) {
      try {
        // Marcar como processando
        await supabaseAdmin
          .from('auto_parse_queue')
          .update({ status: 'processing' })
          .eq('id', item.id)

        // Chamar API de análise (usando service role key)
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000'
        const response = await fetch(`${baseUrl}/api/media/auto-parse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`, // Passar service key como auth
          },
          body: JSON.stringify({ mediaId: item.media_id }),
        })

        const result = await response.json()

        if (response.ok) {
          // Marcar como concluído
          await supabaseAdmin
            .from('auto_parse_queue')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString()
            })
            .eq('id', item.id)

          results.push({ id: item.id, status: 'success', draftId: result.draftId })
          console.log(`[QUEUE] ✅ Item ${item.id} processado com sucesso`)
        } else {
          // Marcar como falhou
          await supabaseAdmin
            .from('auto_parse_queue')
            .update({
              status: 'failed',
              error: result.error || result.detail || 'Erro desconhecido',
              processed_at: new Date().toISOString()
            })
            .eq('id', item.id)

          results.push({ id: item.id, status: 'failed', error: result.error })
          console.error(`[QUEUE] ❌ Item ${item.id} falhou:`, result.error)
        }
      } catch (error: any) {
        // Marcar como falhou
        await supabaseAdmin
          .from('auto_parse_queue')
          .update({
            status: 'failed',
            error: error.message || 'Erro desconhecido',
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id)

        results.push({ id: item.id, status: 'failed', error: error.message })
        console.error(`[QUEUE] ❌ Erro ao processar item ${item.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    })
  } catch (error: any) {
    console.error('[QUEUE] ❌ Erro geral:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', detail: error.message },
      { status: 500 }
    )
  }
}

