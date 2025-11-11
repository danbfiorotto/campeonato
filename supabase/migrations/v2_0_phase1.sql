-- ============================================
-- V2.0 - Fase 1: Mídia, Webhook e Espectador
-- ============================================

-- 1. Criar tabela match_media (prints/clipes por partida)
CREATE TABLE IF NOT EXISTS public.match_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'clip')),
  url TEXT NOT NULL,
  provider TEXT, -- 'youtube', 'twitch', 'file'
  uploader_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Adicionar campo stream_url na tabela series
ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS stream_url TEXT;

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_match_media_match_id ON public.match_media(match_id);
CREATE INDEX IF NOT EXISTS idx_match_media_type ON public.match_media(type);

-- 4. RLS Policies para match_media
ALTER TABLE public.match_media ENABLE ROW LEVEL SECURITY;

-- SELECT: público pode ver
CREATE POLICY "Public read access for match_media" 
ON public.match_media 
FOR SELECT 
USING (true);

-- INSERT: apenas admins autenticados
CREATE POLICY "Admin insert access for match_media" 
ON public.match_media 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- UPDATE: apenas admins autenticados
CREATE POLICY "Admin update access for match_media" 
ON public.match_media 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- DELETE: apenas admins autenticados
CREATE POLICY "Admin delete access for match_media" 
ON public.match_media 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- 5. Função helper para validar URLs de clipes
CREATE OR REPLACE FUNCTION public.is_valid_clip_url(url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN url ~* '^(https?://)?(www\.)?(youtube\.com|youtu\.be|twitch\.tv|clips\.twitch\.tv)';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Comentários para documentação
COMMENT ON TABLE public.match_media IS 'Armazena mídias (prints e clipes) associadas a partidas';
COMMENT ON COLUMN public.match_media.type IS 'Tipo: image (arquivo) ou clip (URL externa)';
COMMENT ON COLUMN public.match_media.provider IS 'Provedor: youtube, twitch, ou file (para uploads)';
COMMENT ON COLUMN public.series.stream_url IS 'URL do stream da Twitch para assistir a série';

