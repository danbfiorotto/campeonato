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
    const formData = await req.formData()
    const file = formData.get('file') as File
    const matchId = formData.get('matchId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo fornecido' },
        { status: 400 }
      )
    }

    if (!matchId) {
      return NextResponse.json(
        { error: 'ID da partida não fornecido' },
        { status: 400 }
      )
    }

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Por favor, selecione apenas arquivos de imagem (JPG, PNG, etc.)' },
        { status: 400 }
      )
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'O arquivo é muito grande. Tamanho máximo: 5MB' },
        { status: 400 }
      )
    }

    // Verificar se a partida existe
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json(
        { error: 'Partida não encontrada' },
        { status: 404 }
      )
    }

    // Gerar nome único para o arquivo
    const fileExt = file.name.split('.').pop()
    const fileName = `public/${matchId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `proofs/${fileName}`

    // Converter File para ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload para Supabase Storage usando service role
    const { error: uploadError } = await supabaseAdmin.storage
      .from('proofs')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })

    if (uploadError) {
      console.error('[PUBLIC_UPLOAD] Erro no upload:', uploadError)
      return NextResponse.json(
        { error: 'Erro ao fazer upload do arquivo', detail: uploadError.message },
        { status: 500 }
      )
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('proofs')
      .getPublicUrl(filePath)

    // Criar registro na tabela match_media (status será 'pending' automaticamente)
    const { data: media, error: dbError } = await supabaseAdmin
      .from('match_media')
      .insert({
        match_id: matchId,
        type: 'image',
        url: publicUrl,
        provider: 'file',
        uploader_user_id: null, // Usuário não autenticado
        status: 'pending' // Será auto-aprovado se for admin (via trigger), mas não há admin aqui
      })
      .select()
      .single()

    if (dbError) {
      // Se falhar ao criar registro, tentar deletar o arquivo do storage
      await supabaseAdmin.storage.from('proofs').remove([filePath])
      console.error('[PUBLIC_UPLOAD] Erro ao criar registro:', dbError)
      return NextResponse.json(
        { error: 'Erro ao salvar registro', detail: dbError.message },
        { status: 500 }
      )
    }

    console.log('[PUBLIC_UPLOAD] ✅ Upload público realizado com sucesso:', media.id)

    return NextResponse.json({
      success: true,
      mediaId: media.id,
      message: 'Imagem enviada com sucesso! Aguardando aprovação de um administrador.'
    })
  } catch (error: any) {
    console.error('[PUBLIC_UPLOAD] ❌ Erro geral:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', detail: error.message },
      { status: 500 }
    )
  }
}



