# Guia de Configuração - Campeonato RAC vs AST

Este guia fornece instruções passo a passo para configurar o projeto.

## Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase (gratuita)
- Git (opcional)

## Passo 1: Instalar Dependências

```bash
npm install
```

## Passo 2: Configurar Supabase

### 2.1 Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie uma nova conta ou faça login
3. Crie um novo projeto
4. Anote a **Project URL** e a **anon/public key**

### 2.2 Executar Schema SQL

1. No dashboard do Supabase, vá em **SQL Editor**
2. Abra o arquivo `supabase/schema.sql` deste projeto
3. Copie todo o conteúdo e cole no SQL Editor
4. Execute o script (isso criará todas as tabelas, triggers e políticas RLS)

### 2.3 Criar Usuários Admin

1. No dashboard do Supabase, vá em **Authentication > Users**
2. Clique em **Add user** > **Create new user**
3. Crie três usuários:

   **Admin Super:**
   - Email: `admin_super@exemplo.com` (ou seu email)
   - Senha: (escolha uma senha forte)
   - Marque como "Auto Confirm User"

   **Admin RAC:**
   - Email: `admin_rac@exemplo.com`
   - Senha: (escolha uma senha forte)
   - Marque como "Auto Confirm User"

   **Admin AST:**
   - Email: `admin_ast@exemplo.com`
   - Senha: (escolha uma senha forte)
   - Marque como "Auto Confirm User"

4. Após criar cada usuário, vá em **SQL Editor** e execute:

```sql
-- Para admin_super
INSERT INTO profiles (id, user_id, role)
SELECT id, id, 'super'
FROM auth.users
WHERE email = 'admin_super@exemplo.com'
ON CONFLICT (id) DO NOTHING;

-- Para admin_rac
INSERT INTO profiles (id, user_id, role, team_id)
SELECT u.id, u.id, 'rac', t.id
FROM auth.users u
CROSS JOIN teams t
WHERE u.email = 'admin_rac@exemplo.com' AND t.name = 'RAC'
ON CONFLICT (id) DO NOTHING;

-- Para admin_ast
INSERT INTO profiles (id, user_id, role, team_id)
SELECT u.id, u.id, 'ast', t.id
FROM auth.users u
CROSS JOIN teams t
WHERE u.email = 'admin_ast@exemplo.com' AND t.name = 'AST'
ON CONFLICT (id) DO NOTHING;
```

## Passo 3: Configurar Variáveis de Ambiente

1. Copie o arquivo `.env.local.example` para `.env.local`:

```bash
cp .env.local.example .env.local
```

2. Edite `.env.local` e adicione suas credenciais do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

**Onde encontrar:**
- **NEXT_PUBLIC_SUPABASE_URL**: Settings > API > Project URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Settings > API > anon public key
- **SUPABASE_SERVICE_ROLE_KEY**: Settings > API > service_role key (mantenha secreto!)

## Passo 4: Executar o Projeto

```bash
npm run dev
```

O projeto estará disponível em [http://localhost:3000](http://localhost:3000)

## Passo 5: Testar a Aplicação

1. Acesse a página inicial - você verá o placar geral (inicialmente 0 x 0)
2. Faça login com uma das contas admin criadas
3. Acesse o painel admin (`/admin`)
4. Teste as funcionalidades:
   - Criar uma série
   - Adicionar jogadores
   - Registrar partidas

## Atualizar Políticas RLS (Importante!)

Após criar os usuários admin, você precisa atualizar as políticas RLS para restringir que admins de time só possam gerenciar jogadores do próprio time:

1. No dashboard do Supabase, vá em **SQL Editor**
2. Abra o arquivo `supabase/update_rls_policies.sql` deste projeto
3. Copie e execute o conteúdo no SQL Editor

Isso garantirá que:
- `admin_rac` só pode criar/editar/deletar jogadores do time RAC
- `admin_ast` só pode criar/editar/deletar jogadores do time AST
- `admin_super` pode gerenciar jogadores de ambos os times

## Estrutura do Banco de Dados

O schema SQL já cria automaticamente:

- **teams**: RAC e AST
- **games**: R6, LoL, CS, Brawlhalla, Valorant
- **series**: Séries de confrontos (criadas via admin)
- **matches**: Partidas individuais
- **players**: Jogadores (cadastrados via admin)
- **match_players**: Participação de jogadores nas partidas
- **profiles**: Perfis de usuários admin

## Funcionalidades Implementadas

✅ Autenticação com Supabase Auth
✅ Proteção de rotas (middleware)
✅ Página Home com placar geral
✅ Página de Jogos (listagem de séries)
✅ Página de Partidas (histórico completo)
✅ Página de Times (estatísticas)
✅ Painel Admin com CRUD:
  - Gerenciar Séries
  - Gerenciar Partidas
  - Gerenciar Jogadores
✅ Cálculo automático de rankings
✅ Triggers para atualizar placares automaticamente

## Próximos Passos

1. Adicione jogadores via painel admin
2. Crie séries para cada jogo
3. Registre partidas conforme forem disputadas
4. O sistema calculará automaticamente:
   - Placar geral
   - Vencedor de cada série
   - Estatísticas de jogadores (vitórias e MVPs)

## Adicionar Tabela de Jogos dos Jogadores

Para permitir que cada jogador possa participar de múltiplos jogos:

1. Execute o script SQL no Supabase SQL Editor:
   ```sql
   -- Execute o arquivo: supabase/add_player_games_table.sql
   ```

   Ou copie e cole o conteúdo do arquivo `supabase/add_player_games_table.sql` no SQL Editor do Supabase.

## Deploy na Vercel

1. Faça push do código para um repositório Git (GitHub, GitLab, etc.)
2. Acesse [vercel.com](https://vercel.com)
3. Importe o projeto
4. Adicione as variáveis de ambiente no dashboard da Vercel
5. Faça o deploy!

## Suporte

Em caso de problemas:
- Verifique se todas as variáveis de ambiente estão configuradas
- Confirme que o schema SQL foi executado completamente
- Verifique os logs do Supabase e do Next.js
- Certifique-se de que os usuários admin foram criados corretamente

