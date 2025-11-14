import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DraftReview } from '@/components/admin/ingest/draft-review'

export default async function DraftReviewPage({
  params,
}: {
  params: { draftId: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verificar role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !['super', 'rac', 'ast'].includes(profile.role)) {
    redirect('/admin')
  }

  // Buscar draft
  const { data: draft, error } = await supabase
    .from('match_drafts')
    .select(`
      *,
      ingest_jobs (*),
      series (
        *,
        games (*)
      )
    `)
    .eq('id', params.draftId)
    .single()

  if (error || !draft) {
    redirect('/admin/ingest')
  }

  // Buscar players e aliases
  const [playersRes, aliasesRes, teamsRes] = await Promise.all([
    supabase.from('players').select('*').order('name'),
    supabase.from('player_aliases').select('*').order('alias'),
    supabase.from('teams').select('*'),
  ])

  const players = playersRes.data || []
  const aliases = aliasesRes.data || []
  const teams = teamsRes.data || []

  return (
    <DraftReview
      draft={draft}
      players={players}
      aliases={aliases}
      teams={teams}
    />
  )
}

