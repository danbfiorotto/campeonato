-- ============================================
-- V2.0 - Ingestão via OpenAI Vision (LoL)
-- ============================================

-- 1. Jobs de ingestão
CREATE TABLE IF NOT EXISTS public.ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'parsed', 'failed', 'applied')),
  confidence NUMERIC,
  prompt_used TEXT,
  model_used TEXT,
  tokens_input INT,
  tokens_output INT,
  cost_usd NUMERIC,
  payload_json JSONB,
  parsed_json JSONB,
  error TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Drafts revisáveis antes de gravar definitivo
CREATE TABLE IF NOT EXISTS public.match_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ingest_jobs(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  match_number INT,
  winner_team_id UUID REFERENCES teams(id),
  mvp_player_id UUID REFERENCES players(id),
  parsed_json JSONB NOT NULL,
  confidence NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Aliases (nick in-game -> player_id)
CREATE TABLE IF NOT EXISTS public.player_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, alias)
);

-- 4. Estatísticas por jogador
CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  kills INT,
  deaths INT,
  assists INT,
  kda NUMERIC,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, player_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_series_id ON public.ingest_jobs(series_id);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_status ON public.ingest_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_created_at ON public.ingest_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_match_drafts_job_id ON public.match_drafts(job_id);
CREATE INDEX IF NOT EXISTS idx_match_drafts_series_id ON public.match_drafts(series_id);
CREATE INDEX IF NOT EXISTS idx_player_aliases_player_id ON public.player_aliases(player_id);
CREATE INDEX IF NOT EXISTS idx_player_aliases_alias ON public.player_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_match_id ON public.player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_player_id ON public.player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_team_id ON public.player_match_stats(team_id);

-- Trigger para atualizar updated_at em ingest_jobs
CREATE OR REPLACE FUNCTION update_ingest_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ingest_jobs_updated_at
  BEFORE UPDATE ON public.ingest_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_ingest_jobs_updated_at();

-- RLS Policies

-- ingest_jobs
ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for ingest_jobs"
ON public.ingest_jobs
FOR SELECT
USING (true);

CREATE POLICY "Admin insert access for ingest_jobs"
ON public.ingest_jobs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

CREATE POLICY "Admin update access for ingest_jobs"
ON public.ingest_jobs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- match_drafts
ALTER TABLE public.match_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for match_drafts"
ON public.match_drafts
FOR SELECT
USING (true);

CREATE POLICY "Admin insert access for match_drafts"
ON public.match_drafts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

CREATE POLICY "Admin update access for match_drafts"
ON public.match_drafts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

CREATE POLICY "Admin delete access for match_drafts"
ON public.match_drafts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- player_aliases
ALTER TABLE public.player_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for player_aliases"
ON public.player_aliases
FOR SELECT
USING (true);

CREATE POLICY "Admin insert access for player_aliases"
ON public.player_aliases
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

CREATE POLICY "Admin update access for player_aliases"
ON public.player_aliases
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

CREATE POLICY "Admin delete access for player_aliases"
ON public.player_aliases
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- player_match_stats
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for player_match_stats"
ON public.player_match_stats
FOR SELECT
USING (true);

CREATE POLICY "Admin insert access for player_match_stats"
ON public.player_match_stats
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

CREATE POLICY "Admin update access for player_match_stats"
ON public.player_match_stats
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

CREATE POLICY "Admin delete access for player_match_stats"
ON public.player_match_stats
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

