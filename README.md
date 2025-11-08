# Campeonato RAC vs AST

Aplicação web de campeonato entre dois grupos (RAC e AST) que competem em 5 jogos diferentes (R6, LoL, CS, Brawlhalla, Valorant).

## Tecnologias

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Supabase** (PostgreSQL + Auth)

## Configuração

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente:
```bash
cp .env.local.example .env.local
```

Edite `.env.local` com suas credenciais do Supabase:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (opcional, para operações admin)

3. Execute o projeto em desenvolvimento:
```bash
npm run dev
```

## Estrutura do Banco de Dados

O projeto requer as seguintes tabelas no Supabase:
- `teams` - Times (RAC, AST)
- `players` - Jogadores
- `games` - Jogos/Modalidades
- `series` - Séries de confrontos
- `matches` - Partidas individuais
- `match_players` - Participação de jogadores nas partidas
- `profiles` - Perfis de usuários/admin

Veja o arquivo `Guia de Projeto_ Campeonato Web (Next.js, Shadcn_UI, Tailwind, Supabase).txt` para o esquema completo.

## Usuários Admin

O sistema possui três usuários admin fixos:
- `admin_super` - Super Admin (acesso total)
- `admin_rac` - Admin do time RAC
- `admin_ast` - Admin do time AST

Estes usuários devem ser criados manualmente no Supabase Auth.

## Deploy

O projeto está configurado para deploy na Vercel. Certifique-se de adicionar as variáveis de ambiente no dashboard da Vercel.

