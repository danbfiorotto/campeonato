-- ============================================
-- V2.0 - Sistema de Streams Públicos (24h)
-- ============================================

-- 1. Criar tabela streams
CREATE TABLE IF NOT EXISTS public.streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twitch_url TEXT NOT NULL,
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
  created_by TEXT, -- Pode ser null para streams anônimos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT TRUE
);

-- 2. Remover campo stream_url da tabela series (se existir)
-- Não vamos deletar, apenas não usar mais
-- ALTER TABLE public.series DROP COLUMN IF EXISTS stream_url;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_streams_expires_at ON public.streams(expires_at);
CREATE INDEX IF NOT EXISTS idx_streams_is_active ON public.streams(is_active);
CREATE INDEX IF NOT EXISTS idx_streams_series_id ON public.streams(series_id);
CREATE INDEX IF NOT EXISTS idx_streams_game_id ON public.streams(game_id);

-- 4. Função para marcar streams expirados como inativos
CREATE OR REPLACE FUNCTION public.update_expired_streams()
RETURNS void AS $$
BEGIN
  UPDATE public.streams
  SET is_active = FALSE
  WHERE expires_at < NOW() AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para atualizar automaticamente (opcional - pode ser feito via cron job)
-- Ou executar manualmente periodicamente

-- 6. RLS Policies para streams
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

-- SELECT: público pode ver streams ativos
CREATE POLICY "Public read access for active streams" 
ON public.streams 
FOR SELECT 
USING (is_active = TRUE AND expires_at > NOW());

-- INSERT: qualquer um pode criar stream (público)
CREATE POLICY "Public insert access for streams" 
ON public.streams 
FOR INSERT 
WITH CHECK (true);

-- UPDATE: apenas o criador ou admin pode atualizar (opcional)
CREATE POLICY "Creator or admin update access for streams" 
ON public.streams 
FOR UPDATE 
USING (
  created_by = current_setting('request.jwt.claims', true)::json->>'sub' OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- DELETE: apenas admins podem deletar
CREATE POLICY "Admin delete access for streams" 
ON public.streams 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- 7. Comentários
COMMENT ON TABLE public.streams IS 'Streams ao vivo da Twitch com expiração de 24 horas';
COMMENT ON COLUMN public.streams.expires_at IS 'Data/hora de expiração do stream (24h após criação)';
COMMENT ON COLUMN public.streams.is_active IS 'Indica se o stream está ativo e não expirado';

