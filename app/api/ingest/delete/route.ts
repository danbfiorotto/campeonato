import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || !['super', 'rac', 'ast'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'job' ou 'draft'
    const id = searchParams.get('id')

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing type or id parameter' },
        { status: 400 }
      )
    }

    if (type === 'draft') {
      // Deletar draft
      console.log(`[DELETE] Deletando draft: ${id}`)
      const { error } = await supabase
        .from('match_drafts')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[DELETE] Erro ao deletar draft:', error)
        return NextResponse.json(
          { error: 'Failed to delete draft', detail: error.message },
          { status: 500 }
        )
      }

      console.log('[DELETE] ✅ Draft deletado com sucesso')
      return NextResponse.json({ success: true, message: 'Draft deleted' })
    } else if (type === 'job') {
      // Deletar job (isso também deleta os drafts relacionados por CASCADE)
      console.log(`[DELETE] Deletando job: ${id}`)
      const { error } = await supabase
        .from('ingest_jobs')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[DELETE] Erro ao deletar job:', error)
        return NextResponse.json(
          { error: 'Failed to delete job', detail: error.message },
          { status: 500 }
        )
      }

      console.log('[DELETE] ✅ Job deletado com sucesso')
      return NextResponse.json({ success: true, message: 'Job deleted' })
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "job" or "draft"' },
        { status: 400 }
      )
    }
  } catch (e: any) {
    console.error('[DELETE] ❌ Erro geral:', e)
    return NextResponse.json(
      { error: 'Internal server error', detail: e.message },
      { status: 500 }
    )
  }
}



