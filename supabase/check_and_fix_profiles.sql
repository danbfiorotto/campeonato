-- Script para verificar e corrigir perfis de usuários admin
-- Execute este script no SQL Editor do Supabase

-- IMPORTANTE: Primeiro, execute o arquivo supabase/fix_profiles_rls.sql
-- para adicionar a política de SELECT na tabela profiles

-- 1. Verificar todos os perfis existentes
SELECT 
  p.id,
  p.user_id,
  p.role,
  p.team_id,
  t.name as team_name,
  u.email
FROM profiles p
LEFT JOIN teams t ON p.team_id = t.id
LEFT JOIN auth.users u ON p.id = u.id OR p.user_id = u.id
ORDER BY p.role;

-- 2. Verificar usuários sem perfil
SELECT 
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id OR p.user_id = u.id
WHERE p.id IS NULL;

-- 3. Se algum perfil estiver faltando, execute os comandos abaixo
-- (Substitua os emails pelos emails reais dos seus admins)

-- Para admin_super (ajuste o email):
/*
INSERT INTO profiles (id, user_id, role, team_id)
SELECT 
  u.id,
  u.id,
  'super',
  NULL
FROM auth.users u
WHERE u.email = 'admin_super@exemplo.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'super',
  team_id = NULL;
*/

-- Para admin_rac (ajuste o email):
/*
INSERT INTO profiles (id, user_id, role, team_id)
SELECT 
  u.id,
  u.id,
  'rac',
  t.id
FROM auth.users u
CROSS JOIN teams t
WHERE u.email = 'admin_rac@exemplo.com' 
  AND t.name = 'RAC'
ON CONFLICT (id) DO UPDATE SET
  role = 'rac',
  team_id = (SELECT id FROM teams WHERE name = 'RAC');
*/

-- Para admin_ast (ajuste o email):
/*
INSERT INTO profiles (id, user_id, role, team_id)
SELECT 
  u.id,
  u.id,
  'ast',
  t.id
FROM auth.users u
CROSS JOIN teams t
WHERE u.email = 'admin_ast@exemplo.com' 
  AND t.name = 'AST'
ON CONFLICT (id) DO UPDATE SET
  role = 'ast',
  team_id = (SELECT id FROM teams WHERE name = 'AST');
*/

-- 4. Verificar se os team_ids estão corretos
SELECT 
  p.role,
  p.team_id,
  t.name as team_name,
  COUNT(*) as count
FROM profiles p
LEFT JOIN teams t ON p.team_id = t.id
GROUP BY p.role, p.team_id, t.name;

