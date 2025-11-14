-- Script para corrigir políticas RLS da tabela profiles
-- Execute este script no SQL Editor do Supabase

-- Adicionar política de SELECT para profiles (permite usuários lerem seu próprio perfil)
CREATE POLICY IF NOT EXISTS "Users can read own profile" ON profiles FOR SELECT 
  USING (auth.uid() = id OR auth.uid() = user_id);

-- Verificar se a política foi criada
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles';









