-- Adicionar política de DELETE para ingest_jobs
CREATE POLICY "Admin delete access for ingest_jobs"
ON public.ingest_jobs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super', 'rac', 'ast')
  )
);



