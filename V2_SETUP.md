# V2.0 - Fase 1: Setup e Instalação

## 📋 Pré-requisitos

- Projeto Next.js configurado
- Supabase configurado e funcionando
- Variáveis de ambiente configuradas

## 🗄️ Banco de Dados

### 1. Executar Migração SQL

Execute o arquivo `supabase/migrations/v2_0_phase1.sql` no SQL Editor do Supabase:

```sql
-- Este arquivo cria:
-- 1. Tabela match_media (prints/clipes)
-- 2. Campo stream_url na tabela series
-- 3. Índices e políticas RLS
```

### 2. Criar Bucket no Storage

1. Acesse o Supabase Dashboard
2. Vá em **Storage**
3. Clique em **New bucket**
4. Nome: `proofs`
5. Configurações:
   - **Public bucket**: ✅ Sim (para leitura pública)
   - **File size limit**: 5MB (ou conforme necessário)
   - **Allowed MIME types**: `image/*` (opcional, para restringir)

### 3. Configurar Políticas do Bucket

No SQL Editor, execute:

```sql
-- Política de leitura pública
CREATE POLICY "Public read access for proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'proofs');

-- Política de upload (apenas autenticados)
CREATE POLICY "Authenticated upload access for proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proofs' AND
  auth.role() = 'authenticated'
);

-- Política de deleção (apenas autenticados)
CREATE POLICY "Authenticated delete access for proofs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'proofs' AND
  auth.role() = 'authenticated'
);
```

## 🔧 Variáveis de Ambiente

Adicione ao arquivo `.env.local`:

```env
# Discord Webhooks (opcional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
# Ou URLs específicas por time:
DISCORD_WEBHOOK_URL_RAC=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_URL_AST=https://discord.com/api/webhooks/...
```

### Como obter Webhook do Discord:

1. No Discord, vá em **Configurações do Servidor** > **Integrações** > **Webhooks**
2. Clique em **Novo Webhook**
3. Copie a URL do webhook
4. Cole no `.env.local`

## ✅ Verificação

Após configurar:

1. ✅ Tabela `match_media` criada
2. ✅ Campo `stream_url` adicionado em `series`
3. ✅ Bucket `proofs` criado e configurado
4. ✅ Políticas RLS configuradas
5. ✅ Variáveis de ambiente configuradas

## 🚀 Funcionalidades Implementadas

### ✅ Fase 1 - Completa

- [x] Upload de imagens (prints) para partidas
- [x] Adicionar clipes (URLs do YouTube/Twitch)
- [x] Galeria pública com lightbox
- [x] Campo stream_url nas séries
- [x] Botão "Assistir" na página pública
- [x] Webhook Discord ao concluir série
- [x] Interface admin para gerenciar mídia

## 📝 Próximos Passos

- **Fase 2**: Animações visuais (framer-motion, confetti)
- **Fase 3**: Hall da Fama (MVPs & Estatísticas)

## 🐛 Troubleshooting

### Erro ao fazer upload de imagem:
- Verifique se o bucket `proofs` existe
- Verifique as políticas do bucket
- Verifique se o arquivo é menor que 5MB

### Webhook Discord não funciona:
- Verifique se a URL está correta no `.env.local`
- Verifique os logs do servidor
- Teste a URL do webhook manualmente

### Mídia não aparece na página pública:
- Verifique as políticas RLS da tabela `match_media`
- Verifique se o bucket está público

