-- Criar tabela player_games para associar jogadores aos jogos
CREATE TABLE IF NOT EXISTS player_games (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  PRIMARY KEY (player_id, game_id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_player_games_player_id ON player_games(player_id);
CREATE INDEX IF NOT EXISTS idx_player_games_game_id ON player_games(game_id);

-- Habilitar RLS
ALTER TABLE player_games ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (remover se existirem antes de criar)
DROP POLICY IF EXISTS "Public read access for player_games" ON player_games;
DROP POLICY IF EXISTS "Admin insert player_games" ON player_games;
DROP POLICY IF EXISTS "Admin delete player_games" ON player_games;

CREATE POLICY "Public read access for player_games" ON player_games FOR SELECT USING (true);
CREATE POLICY "Admin insert player_games" ON player_games FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin delete player_games" ON player_games FOR DELETE USING (auth.role() = 'authenticated');

