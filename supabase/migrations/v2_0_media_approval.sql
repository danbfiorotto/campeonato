-- ============================================
-- V2.0 - Sistema de Aprovação de Mídia
-- ============================================

-- 1. Adicionar campo status na tabela match_media
ALTER TABLE public.match_media
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- 2. Adicionar campo reviewed_by (admin que aprovou/rejeitou)
ALTER TABLE public.match_media
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Adicionar campo reviewed_at (data da aprovação/rejeição)
ALTER TABLE public.match_media
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 4. Atualizar registros existentes para 'approved' (retrocompatibilidade)
UPDATE public.match_media
SET status = 'approved'
WHERE status IS NULL;

-- 5. Criar índice para consultas rápidas de pendentes
CREATE INDEX IF NOT EXISTS idx_match_media_status ON public.match_media(status);
CREATE INDEX IF NOT EXISTS idx_match_media_match_status ON public.match_media(match_id, status);

-- 6. Atualizar políticas RLS

-- SELECT: público pode ver apenas mídia aprovada
DROP POLICY IF EXISTS "Public read access for match_media" ON public.match_media;
CREATE POLICY "Public read approved media" 
ON public.match_media 
FOR SELECT 
USING (status = 'approved');

-- SELECT: admins podem ver todas (incluindo pendentes)
CREATE POLICY "Admin read all media" 
ON public.match_media 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- INSERT: qualquer um pode criar mídia (mas fica pendente se não for admin)
CREATE POLICY "Public insert media" 
ON public.match_media 
FOR INSERT 
WITH CHECK (true);

-- UPDATE: apenas admins podem atualizar (aprovar/rejeitar)
CREATE POLICY "Admin update media" 
ON public.match_media 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- DELETE: apenas admins podem deletar
CREATE POLICY "Admin delete media" 
ON public.match_media 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);

-- 7. Função para auto-aprovar se for admin
CREATE OR REPLACE FUNCTION public.auto_approve_admin_media()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o uploader for admin, aprovar automaticamente
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = NEW.uploader_user_id
    AND profiles.role IN ('super', 'rac', 'ast')
  ) THEN
    NEW.status := 'approved';
  ELSE
    NEW.status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger para auto-aprovar mídia de admins
DROP TRIGGER IF EXISTS trigger_auto_approve_admin_media ON public.match_media;
CREATE TRIGGER trigger_auto_approve_admin_media
  BEFORE INSERT ON public.match_media
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_admin_media();

-- 9. Comentários
COMMENT ON COLUMN public.match_media.status IS 'Status da mídia: pending (aguardando aprovação), approved (aprovada), rejected (rejeitada)';
COMMENT ON COLUMN public.match_media.reviewed_by IS 'ID do admin que aprovou ou rejeitou a mídia';
COMMENT ON COLUMN public.match_media.reviewed_at IS 'Data/hora da aprovação ou rejeição';

