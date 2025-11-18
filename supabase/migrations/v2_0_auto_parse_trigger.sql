-- ============================================
-- V2.0 - Trigger para Análise Automática de Placar
-- ============================================

-- Criar tabela de fila para análise automática
CREATE TABLE IF NOT EXISTS public.auto_parse_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.match_media(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error TEXT
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_auto_parse_queue_status ON public.auto_parse_queue(status);
CREATE INDEX IF NOT EXISTS idx_auto_parse_queue_media_id ON public.auto_parse_queue(media_id);

-- RLS Policies
ALTER TABLE public.auto_parse_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for auto_parse_queue"
ON public.auto_parse_queue
FOR SELECT
USING (true);

CREATE POLICY "Service insert access for auto_parse_queue"
ON public.auto_parse_queue
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service update access for auto_parse_queue"
ON public.auto_parse_queue
FOR UPDATE
USING (true);

-- Função para adicionar à fila quando imagem é aprovada
CREATE OR REPLACE FUNCTION public.queue_auto_parse_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a imagem foi aprovada e é do tipo 'image', adicionar à fila
  IF NEW.status = 'approved' AND NEW.type = 'image' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Verificar se já existe na fila (evitar duplicatas)
    IF NOT EXISTS (
      SELECT 1 FROM public.auto_parse_queue 
      WHERE media_id = NEW.id 
      AND status IN ('pending', 'processing')
    ) THEN
      INSERT INTO public.auto_parse_queue (media_id, status)
      VALUES (NEW.id, 'pending');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para detectar quando imagem é aprovada
DROP TRIGGER IF EXISTS trigger_queue_auto_parse_on_approval ON public.match_media;
CREATE TRIGGER trigger_queue_auto_parse_on_approval
  AFTER INSERT OR UPDATE ON public.match_media
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND NEW.type = 'image')
  EXECUTE FUNCTION public.queue_auto_parse_on_approval();

-- Comentários
COMMENT ON TABLE public.auto_parse_queue IS 'Fila de processamento para análise automática de placares';
COMMENT ON COLUMN public.auto_parse_queue.media_id IS 'ID da mídia a ser analisada';
COMMENT ON COLUMN public.auto_parse_queue.status IS 'Status do processamento: pending, processing, completed, failed';





