# Sistema de Streams Públicos - Setup

## 📋 Visão Geral

Sistema de streams públicos onde qualquer pessoa pode adicionar links de transmissões ao vivo da Twitch. Os streams ficam visíveis por 24 horas e depois precisam ser adicionados novamente.

## 🗄️ Banco de Dados

### 1. Executar Migração SQL

Execute o arquivo `supabase/migrations/v2_0_streams.sql` no SQL Editor do Supabase:

```sql
-- Este arquivo cria:
-- 1. Tabela streams (com expiração de 24h)
-- 2. Função update_expired_streams()
-- 3. Índices e políticas RLS
```

### 2. Políticas RLS

As políticas permitem:
- **SELECT**: Qualquer um pode ver streams ativos (não expirados)
- **INSERT**: Qualquer um pode adicionar streams (público)
- **UPDATE**: Apenas o criador ou admin pode atualizar
- **DELETE**: Apenas admins podem deletar

## 🎯 Funcionalidades

### Página `/streams`

1. **Formulário de Adicionar Stream** (lado esquerdo):
   - Campo para link da Twitch (obrigatório)
   - Seleção de jogo (opcional)
   - Seleção de série (opcional, depende do jogo)
   - Validação de URL da Twitch
   - Qualquer pessoa pode adicionar (não precisa estar logado)

2. **Lista de Streams Ativos** (lado direito):
   - Mostra apenas streams não expirados
   - Exibe tempo restante até expiração
   - Botão para assistir na Twitch
   - Link para série relacionada (se houver)

### Expiração Automática

- Streams expiram automaticamente após 24 horas
- A função `update_expired_streams()` marca streams expirados como inativos
- Streams expirados não aparecem mais na lista
- Para continuar, é necessário adicionar um novo stream

### Integração com Séries

- Na página de detalhes da série (`/jogos/[id]`), se houver um stream ativo relacionado, aparece o botão "Assistir ao Vivo"
- O stream pode ser associado a uma série específica ou apenas a um jogo

## 🔧 Como Usar

1. Acesse `/streams` no menu
2. Cole o link da Twitch no formulário
3. (Opcional) Selecione o jogo e/ou série relacionada
4. Clique em "Adicionar Stream"
5. O stream ficará visível por 24 horas

## 📝 Notas Técnicas

- A validação de URL aceita: `twitch.tv`, `m.twitch.tv`
- O campo `created_by` armazena o ID do usuário se estiver logado, ou `null` se for anônimo
- A expiração é calculada automaticamente: `created_at + 24 horas`
- A função `update_expired_streams()` pode ser chamada manualmente ou via cron job

## 🚀 Próximos Passos

Após executar a migração SQL, o sistema estará pronto para uso!

