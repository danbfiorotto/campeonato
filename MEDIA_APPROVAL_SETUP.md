# Sistema de Aprovação de Mídia - Setup

Este documento descreve como configurar o sistema de aprovação de prints de resultado.

## Funcionalidades

1. **Upload Público**: Usuários não-admin podem fazer upload de prints de resultado
2. **Status Pendente**: Imagens ficam "pendentes de aprovação" até serem revisadas
3. **Auto-aprovação para Admins**: Imagens enviadas por admins são aprovadas automaticamente
4. **Interface de Aprovação**: Admins podem aprovar ou rejeitar imagens pendentes
5. **Visualização Pública**: Apenas imagens aprovadas são exibidas publicamente

## Passo 1: Executar Migração SQL

1. Acesse o **SQL Editor** no Supabase Dashboard
2. Abra o arquivo `supabase/migrations/v2_0_media_approval.sql`
3. Copie todo o conteúdo e cole no SQL Editor
4. Execute o script

Esta migração irá:
- Adicionar campos `status`, `reviewed_by` e `reviewed_at` na tabela `match_media`
- Criar índices para consultas rápidas
- Atualizar políticas RLS para permitir uploads públicos e controle de aprovação
- Criar trigger para auto-aprovar mídia de admins
- Atualizar registros existentes para `approved` (retrocompatibilidade)

## Passo 2: Verificar Políticas RLS

As políticas RLS foram configuradas para:
- **SELECT**: Público vê apenas mídia aprovada; Admins veem todas
- **INSERT**: Qualquer um pode criar mídia (fica pendente se não for admin)
- **UPDATE**: Apenas admins podem atualizar (aprovar/rejeitar)
- **DELETE**: Apenas admins podem deletar

## Passo 3: Testar Funcionalidades

### Upload Público
1. Acesse uma página de série (ex: `/jogos/[id]`)
2. Role até uma partida específica
3. Você verá um formulário "Enviar Print do Resultado"
4. Faça upload de uma imagem
5. A imagem ficará com status "Pendente"

### Aprovação Admin
1. Acesse `/admin`
2. Vá para a aba "Aprovações"
3. Você verá todas as imagens pendentes
4. Clique em "Aprovar" ou "Rejeitar" para cada imagem

### Visualização Pública
1. Imagens aprovadas aparecem na galeria pública
2. Imagens pendentes/rejeitadas não são exibidas publicamente
3. Admins veem todas as imagens (com badges de status) no painel admin

## Estrutura de Dados

### Tabela `match_media`
- `status`: `'pending' | 'approved' | 'rejected'` (padrão: `'pending'`)
- `reviewed_by`: UUID do admin que aprovou/rejeitou (nullable)
- `reviewed_at`: Timestamp da aprovação/rejeição (nullable)

### Trigger de Auto-aprovação
- Verifica se `uploader_user_id` é um admin
- Se for admin, define `status = 'approved'` automaticamente
- Se não for admin, mantém `status = 'pending'`

## Componentes Criados

1. **`PublicMediaUploader`**: Componente para upload público de prints
2. **`PendingMediaApproval`**: Interface admin para aprovar/rejeitar
3. **Atualização do `MediaUploader`**: Mostra status e botões de aprovação
4. **Atualização do `Gallery`**: Filtra apenas mídia aprovada

## Notas Importantes

- Imagens enviadas por admins são aprovadas automaticamente
- Imagens enviadas por usuários não-admin ficam pendentes
- Apenas imagens aprovadas aparecem na galeria pública
- Admins podem ver todas as imagens (pendentes, aprovadas, rejeitadas) no painel admin
- Imagens rejeitadas não são exibidas publicamente, mas permanecem no banco

