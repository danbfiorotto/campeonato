-- Script para atualizar as políticas RLS de players com restrições por time
-- Execute este script no SQL Editor do Supabase para aplicar as restrições

-- Remover políticas antigas de players
DROP POLICY IF EXISTS "Admin insert players" ON players;
DROP POLICY IF EXISTS "Admin update players" ON players;
DROP POLICY IF EXISTS "Admin delete players" ON players;

-- Criar novas políticas com restrições por time
CREATE POLICY "Admin insert players" ON players FOR INSERT 
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      -- Super admin can insert any player
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super')
      OR
      -- Team admins can only insert players for their own team
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.team_id = players.team_id
        AND p.role IN ('rac', 'ast')
      )
    )
  );

CREATE POLICY "Admin update players" ON players FOR UPDATE 
  USING (
    auth.role() = 'authenticated' AND (
      -- Super admin can update any player
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super')
      OR
      -- Team admins can only update players from their own team
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.team_id = players.team_id
        AND p.role IN ('rac', 'ast')
      )
    )
  );

CREATE POLICY "Admin delete players" ON players FOR DELETE 
  USING (
    auth.role() = 'authenticated' AND (
      -- Super admin can delete any player
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super')
      OR
      -- Team admins can only delete players from their own team
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.team_id = players.team_id
        AND p.role IN ('rac', 'ast')
      )
    )
  );

