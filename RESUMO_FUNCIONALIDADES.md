# 📋 Resumo Completo de Funcionalidades - Campeonato RAC vs AST

## 🎯 Visão Geral
Sistema completo de gerenciamento de campeonato entre dois times (RAC e AST) com múltiplas modalidades de jogos, sistema de partidas, séries, estatísticas e integrações.

---

## 🌐 Páginas Públicas

### 1. **Home (`/`)**
- **Hero Header** com placar geral animado (RAC vs AST)
- **Agenda**: Lista de próximos confrontos (séries não completadas)
- **Modalidades**: Cards de todas as séries com:
  - Status (Em andamento / Concluída)
  - Placar atual animado
  - Formato da série (MD3 ou MD5)
  - Vitórias necessárias para vencer
  - Data da série
  - Link para detalhes
- **Animações**:
  - Placar animado quando visível na tela
  - Notificação de mudança de placar com confetti
  - Efeito glow nos cards das séries vencedoras

### 2. **Jogos (`/jogos`)**
- Lista todas as séries
- Filtro por status (Todas / Em andamento / Concluídas)
- Cards com informações básicas da série

### 3. **Detalhes da Série (`/jogos/[id]`)**
- Informações completas da série:
  - Status e placar atual
  - Formato (MD3/MD5) e vitórias necessárias
  - Lista de todas as partidas da série
  - Vencedor e MVP de cada partida
  - **Galeria de Mídia**: Prints e clipes aprovados
  - **Upload Público**: Usuários não-admin podem enviar prints (pendentes de aprovação)
  - Botão "Assistir ao Vivo" se houver stream ativo
- **Animações**:
  - Confetti ao visualizar série concluída
  - Placar animado

### 4. **Partidas (`/partidas`)**
- Lista todas as partidas de todas as séries
- Informações de cada partida:
  - Jogo/modalidade
  - Número da partida
  - Vencedor
  - MVP (se houver)

### 5. **Times (`/times`)**
- Informações sobre os times RAC e AST
- Lista de jogadores de cada time
- Estatísticas dos jogadores

### 6. **Streams (`/streams`)**
- **Formulário de Stream**: Qualquer usuário autenticado pode postar link da Twitch
- **Validação**: Apenas URLs da Twitch são aceitas
- **Expiração**: Streams expiram automaticamente após 24 horas
- **Lista de Streams Ativos**: Exibe todos os streams ativos
- **Filtros**: Por jogo ou série (opcional)
- **Admin**: `admin_super` pode deletar streams de qualquer usuário

### 7. **Hall da Fama (`/hall-da-fama`)**
- **Top MVPs**: Ranking dos jogadores com mais MVPs
- **Mais Partidas**: Ranking dos jogadores que mais jogaram
- **Filtros**:
  - Por jogo/modalidade
  - Tabs para alternar entre MVPs e Mais Partidas
- **Badges e Medalhas**: 
  - 🥇 1º lugar
  - 🥈 2º lugar
  - 🥉 3º lugar
- **Animações**: Cards com hover effects e glow effects

### 8. **Login (`/login`)**
- Autenticação via Supabase Auth
- Redirecionamento automático se já logado
- Proteção de rotas admin

---

## 🔐 Painel Administrativo (`/admin`)

### Sistema de Tabs
O painel admin possui 4 abas principais:

#### 1. **Séries** (Tab: Séries)
- **Criar Série**:
  - Selecionar jogo/modalidade
  - Definir data (opcional)
- **Listar Séries**:
  - Visualizar todas as séries
  - Status (Em andamento / Concluída)
  - Placar atual
  - Formato (MD3/MD5)
  - Vitórias necessárias
- **Encerrar Série**:
  - Botão aparece apenas quando série pode ser concluída
  - Validação automática (2 vitórias para MD3, 3 para MD5)
  - Confetti ao encerrar
  - Webhook Discord automático
- **Editar Série**: Data e outras informações

#### 2. **Partidas** (Tab: Partidas)
- **Criar Partida**:
  - Selecionar série
  - Vencedor (opcional - pode criar sem resultado)
  - MVP (opcional)
  - Selecionar jogadores participantes (RAC e AST)
  - Sistema inteligente de numeração (evita duplicatas)
  - Validação de série completa
  - Prevenção de race conditions
- **Listar Partidas**:
  - Todas as partidas com informações completas
  - Cards com glow effect baseado no vencedor
  - Badges de status
- **Editar Partida**:
  - Modificar vencedor
  - Adicionar/remover jogadores
  - Alterar MVP
  - Atualização automática de scores da série
- **Excluir Partida**:
  - Confirmação via AlertDialog
  - Recalcula automaticamente scores da série
- **Upload de Mídia**:
  - Upload de imagens (prints)
  - Adicionar clipes (URLs YouTube/Twitch)
  - Galeria com preview
  - Remover mídia

#### 3. **Jogadores** (Tab: Jogadores)
- **Criar Jogador**:
  - Nome do jogador
  - Selecionar time (RAC ou AST)
  - Associar jogos/modalidades que o jogador joga
- **Listar Jogadores**:
  - Tabela com todos os jogadores
  - Time de cada jogador
  - Jogos associados
  - Foto do jogador (se houver)
- **Editar Jogador**:
  - Modificar nome
  - Alterar time
  - Adicionar/remover jogos
  - Upload de foto
- **Excluir Jogador**:
  - Confirmação necessária
- **Permissões por Time**:
  - `admin_rac` só gerencia jogadores do time RAC
  - `admin_ast` só gerencia jogadores do time AST
  - `admin_super` gerencia todos

#### 4. **Aprovações** (Tab: Aprovações)
- **Lista de Mídia Pendente**:
  - Prints enviados por usuários não-admin
  - Informações da partida relacionada
  - Preview da imagem
- **Aprovar Mídia**:
  - Botão de aprovação
  - Mídia fica visível publicamente após aprovação
- **Rejeitar Mídia**:
  - Remove mídia e arquivo do storage
  - Confirmação necessária
- **Auto-aprovação**: Mídia enviada por admins é aprovada automaticamente

---

## 🎨 Funcionalidades Visuais e Animações

### Animações de Placar
- **AnimatedScore**: Componente que anima mudanças de números
- **ScoreDisplay**: Wrapper para exibir placares animados
- **AnimatedHeroScore**: Placar principal na home com animação quando visível
- **ScoreChangeNotification**: Notificação quando placar geral muda

### Confetti e Celebrações
- **ConfettiTrigger**: Componente para disparar confetti
- **SeriesCompletionCelebration**: Confetti ao visualizar série concluída
- Cores personalizadas por time (laranja para RAC, vermelho para AST)

### Efeitos Visuais
- **Glow Effects**: Cards com brilho baseado no vencedor
- **Neon Cards**: Efeito neon nos cards das séries
- **Hover Effects**: Animações ao passar o mouse
- **Transitions**: Transições suaves com framer-motion

---

## 🔧 Funcionalidades Técnicas

### Sistema de Séries
- **Formato MD3**: CS, Rainbow Six, Valorant, League of Legends (melhor de 3)
- **Formato MD5**: Brawlhalla (melhor de 5)
- **Cálculo Automático**: Scores calculados via triggers do banco
- **Validação**: Sistema impede encerrar série antes do necessário

### Sistema de Partidas
- **Numeração Inteligente**: Encontra primeiro número disponível (1, 2, 3...)
- **Prevenção de Duplicatas**: Validação final antes de inserir
- **Race Condition Protection**: Verificação dupla para evitar conflitos
- **Resultados Opcionais**: Pode criar partida sem vencedor/MVP

### Sistema de Mídia
- **Upload de Imagens**: Para bucket `proofs` no Supabase Storage
- **Clipes Externos**: URLs do YouTube/Twitch
- **Sistema de Aprovação**: 
  - Uploads públicos ficam pendentes
  - Admins aprovam/rejeitam
  - Auto-aprovação para admins
- **Galeria Pública**: Lightbox para visualização
- **Filtros**: Apenas mídia aprovada é exibida publicamente

### Sistema de Streams
- **Postagem Pública**: Qualquer usuário autenticado pode postar
- **Validação de URL**: Apenas Twitch
- **Expiração Automática**: 24 horas após criação
- **Função RPC**: `update_expired_streams()` para desativar streams expirados
- **Deleção Admin**: `admin_super` pode deletar qualquer stream

### Integrações

#### Discord Webhook
- **Disparo Automático**: Quando série é concluída
- **Mensagem Personalizada**: 
  - Nome do jogo
  - Time vencedor
  - Placar final
  - Link para a série
- **Webhooks Separados**: Opção de webhook por time (RAC/AST)
- **Rota API**: `/api/notify/discord/route.ts`

---

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais
1. **games**: Modalidades de jogos
2. **teams**: Times (RAC e AST)
3. **players**: Jogadores
4. **series**: Séries/confrontos
5. **matches**: Partidas individuais
6. **match_players**: Relação jogadores-partidas
7. **match_media**: Mídia (prints/clipes) das partidas
8. **streams**: Streams ao vivo
9. **profiles**: Perfis de usuários com roles
10. **player_games**: Relação jogadores-jogos

### Triggers e Funções
- **update_series_scores**: Recalcula scores automaticamente
- **auto_approve_admin_media**: Auto-aprova mídia de admins
- **update_expired_streams**: Desativa streams expirados

### Políticas RLS (Row Level Security)
- Leitura pública para dados de visualização
- Escrita apenas para usuários autenticados
- Controle granular por role (super, rac, ast)

---

## 🎮 Sistema de Jogos/Modalidades

### Jogos Suportados
- Counter-Strike (CS)
- Rainbow Six
- Valorant
- League of Legends
- Brawlhalla

### Regras por Jogo
- **MD3** (Melhor de 3): CS, Rainbow Six, Valorant, LoL
  - Necessário 2 vitórias para vencer
- **MD5** (Melhor de 5): Brawlhalla
  - Necessário 3 vitórias para vencer

---

## 👥 Sistema de Autenticação e Permissões

### Roles
1. **admin_super**: Acesso total
   - Gerencia tudo
   - Pode deletar streams de qualquer usuário
   - Auto-aprovação de mídia
2. **admin_rac**: Admin do time RAC
   - Gerencia apenas jogadores do RAC
   - Pode criar/editar partidas
   - Auto-aprovação de mídia
3. **admin_ast**: Admin do time AST
   - Gerencia apenas jogadores do AST
   - Pode criar/editar partidas
   - Auto-aprovação de mídia
4. **Usuário Autenticado**: Usuário comum
   - Pode postar streams
   - Pode enviar prints (pendentes)
   - Visualiza apenas mídia aprovada

### Proteção de Rotas
- Middleware protege `/admin`
- Redireciona para `/login` se não autenticado
- Verifica role para funcionalidades específicas

---

## 📱 Responsividade

- **Mobile First**: Design responsivo
- **Menu Mobile**: Hamburger menu para dispositivos móveis
- **Cards Adaptativos**: Layout que se adapta ao tamanho da tela
- **Tabelas Responsivas**: Scroll horizontal quando necessário

---

## 🎯 Componentes Principais

### Layout
- **Navbar**: Navegação principal com menu mobile
- **HeroHeader**: Cabeçalho hero com placar animado
- **AnimatedHeroScore**: Placar animado do hero

### Admin
- **AdminPanel**: Container principal com tabs
- **SeriesManagement**: Gerenciamento de séries
- **MatchesManagement**: Gerenciamento de partidas
- **PlayersManagement**: Gerenciamento de jogadores
- **PendingMediaApproval**: Aprovação de mídia
- **MediaUploader**: Upload de mídia para partidas

### Público
- **SeriesCard**: Card de série com animações
- **Gallery**: Galeria de mídia com lightbox
- **PublicMediaUploader**: Upload público de prints
- **HallOfFame**: Página de hall da fama
- **HallCards**: Cards de jogadores no hall
- **StreamForm**: Formulário de stream
- **ActiveStreams**: Lista de streams ativos

### Score/Animações
- **AnimatedScore**: Número animado
- **ScoreDisplay**: Display de placar
- **ConfettiTrigger**: Disparador de confetti
- **ScoreChangeNotification**: Notificação de mudança

---

## 🔌 APIs e Integrações

### API Routes
- `/api/notify/discord`: Webhook Discord para notificações

### Supabase
- **Auth**: Autenticação de usuários
- **Database**: PostgreSQL com RLS
- **Storage**: Bucket `proofs` para imagens
- **Realtime**: (Não implementado, mas suportado)

---

## 🛠️ Utilitários e Helpers

### Funções de Séries (`lib/utils/series.ts`)
- `getSeriesFormat(gameSlug)`: Retorna MD3 ou MD5
- `getWinsNeeded(gameSlug)`: Retorna vitórias necessárias
- `canCompleteSeries(scoreRac, scoreAst, gameSlug)`: Verifica se pode encerrar
- `getSeriesWinner(scoreRac, scoreAst, gameSlug)`: Determina vencedor

### Clientes Supabase
- `lib/supabase/client.ts`: Cliente para uso no browser
- `lib/supabase/server.ts`: Cliente para uso no servidor

---

## 📦 Dependências Principais

- **Next.js 14**: Framework React
- **React**: Biblioteca UI
- **TypeScript**: Tipagem estática
- **Tailwind CSS**: Estilização
- **Shadcn/ui**: Componentes UI
- **Supabase**: Backend (Auth, DB, Storage)
- **Framer Motion**: Animações
- **Canvas Confetti**: Efeitos de confetti
- **date-fns**: Manipulação de datas
- **Lucide React**: Ícones

---

## 🎨 Estilos e Temas

### Cores dos Times
- **RAC**: Laranja (#ff4d00)
- **AST**: Vermelho (#ff004d)

### Efeitos Visuais
- Neon glow effects
- Shadow effects com cores dos times
- Gradientes e transparências
- Backdrop blur

---

## 📊 Estatísticas e Rankings

### Hall da Fama
- Top MVPs (com filtro por jogo)
- Jogadores com mais partidas
- Badges e medalhas para top 3
- Cards animados

### Estatísticas Gerais
- Placar geral (RAC vs AST)
- Vitórias por série
- MVPs por jogador
- Partidas por jogador

---

## 🔒 Segurança

### Row Level Security (RLS)
- Políticas granulares por tabela
- Controle de acesso por role
- Proteção de dados sensíveis

### Validações
- Validação de URLs (Twitch)
- Validação de tipos de arquivo
- Limite de tamanho de arquivo (5MB)
- Sanitização de inputs

---

## 📝 Migrações do Banco

### Migrações Implementadas
1. `v2_0_phase1.sql`: Tabela match_media, stream_url
2. `v2_0_streams.sql`: Tabela streams com expiração
3. `v2_0_media_approval.sql`: Sistema de aprovação de mídia
4. `v2_0_optional_match_result.sql`: Resultados opcionais em partidas

---

## 🚀 Funcionalidades Futuras (Não Implementadas)

- Sistema de comentários
- Notificações push
- Histórico de mudanças
- Exportação de dados
- Dashboard de estatísticas avançadas

---

## 📞 Suporte e Documentação

### Arquivos de Documentação
- `V2_SETUP.md`: Setup da versão 2.0
- `STREAMS_SETUP.md`: Setup do sistema de streams
- `.env.local.example`: Exemplo de variáveis de ambiente

---

**Última atualização**: Baseado no estado atual do código
**Versão**: 2.0 (com todas as fases implementadas)



