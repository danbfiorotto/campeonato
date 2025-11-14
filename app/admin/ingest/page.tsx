import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VisionUploader } from '@/components/admin/ingest/vision-uploader'
import { DeleteButton } from '@/components/admin/ingest/delete-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function IngestPage() {
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

  // Carregar jobs e drafts
  const [jobsRes, draftsRes] = await Promise.all([
    supabase
      .from('ingest_jobs')
      .select(`
        *,
        series (
          id,
          games (*)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('match_drafts')
      .select(`
        *,
        ingest_jobs (*),
        series (
          id,
          games (*)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const jobs = jobsRes.data || []
  const drafts = draftsRes.data || []

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-white mb-2">
          Ingestão de Placares
        </h1>
        <p className="text-lg text-neutral-300">
          Extraia automaticamente placares do League of Legends usando OpenAI Vision
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Uploader */}
        <div className="lg:col-span-1">
          <VisionUploader />
        </div>

        {/* Lista de Jobs e Drafts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drafts Pendentes */}
          <Card className="bg-neutral-900/50 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-white">Drafts Pendentes</CardTitle>
              <CardDescription>
                Revisar e aplicar extrações de placares
              </CardDescription>
            </CardHeader>
            <CardContent>
              {drafts.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">
                  Nenhum draft pendente
                </p>
              ) : (
                <div className="space-y-2">
                  {drafts.map((draft: any) => {
                    const series = draft.series as any
                    const game = series?.games as any
                    const confidence = draft.confidence || 0
                    const needsReview = confidence < 0.7

                    return (
                      <div
                        key={draft.id}
                        className="group p-4 border border-neutral-700 rounded-lg hover:bg-neutral-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/admin/ingest/${draft.id}`}
                            className="flex-1"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white">
                                  {game?.name || 'Série'} - Draft #{draft.id.slice(0, 8)}
                                </span>
                                {needsReview && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Revisar
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-neutral-400">
                                Confiança: {(confidence * 100).toFixed(0)}% •{' '}
                                {new Date(draft.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Link
                              href={`/admin/ingest/${draft.id}`}
                              className="inline-flex items-center justify-center h-8 w-8 p-0 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <DeleteButton type="draft" id={draft.id} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico de Jobs */}
          <Card className="bg-neutral-900/50 border-neutral-700">
            <CardHeader>
              <CardTitle className="text-white">Histórico de Processamento</CardTitle>
              <CardDescription>
                Últimos jobs de ingestão processados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">
                  Nenhum job processado ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {jobs.map((job: any) => {
                    const series = job.series as any
                    const game = series?.games as any

                    const statusBadgeMap: Record<string, JSX.Element> = {
                      queued: <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50"><Clock className="w-3 h-3 mr-1" />Fila</Badge>,
                      parsed: <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50"><Eye className="w-3 h-3 mr-1" />Processado</Badge>,
                      applied: <Badge className="bg-green-500/20 text-green-400 border-green-500/50"><CheckCircle2 className="w-3 h-3 mr-1" />Aplicado</Badge>,
                      failed: <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Erro</Badge>,
                    }
                    const statusBadge = statusBadgeMap[job.status] || <Badge>{job.status}</Badge>

                    return (
                      <div
                        key={job.id}
                        className="p-4 border border-neutral-700 rounded-lg"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white">
                                {game?.name || 'Série'} - Job #{job.id.slice(0, 8)}
                              </span>
                              {statusBadge}
                            </div>
                            <p className="text-xs text-neutral-400">
                              {job.model_used || 'N/A'} •{' '}
                              {job.tokens_input ? `${job.tokens_input} tokens` : 'N/A'} •{' '}
                              {new Date(job.created_at).toLocaleString('pt-BR')}
                            </p>
                            {job.error && (
                              <p className="text-xs text-red-400 mt-1">
                                Erro: {job.error}
                              </p>
                            )}
                          </div>
                          <DeleteButton type="job" id={job.id} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

