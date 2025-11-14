-- Trigger para criar automaticamente a próxima partida quando uma partida é concluída
-- Verifica se a série ainda não foi vencida antes de criar

-- Função para determinar vitórias necessárias baseado no slug do jogo
CREATE OR REPLACE FUNCTION get_wins_needed(game_slug TEXT)
RETURNS INTEGER AS $$
BEGIN
  -- Brawlhalla é MD5 (3 vitórias), outros são MD3 (2 vitórias)
  IF LOWER(game_slug) = 'brawlhalla' THEN
    RETURN 3;
  ELSE
    RETURN 2;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para criar próxima partida automaticamente
CREATE OR REPLACE FUNCTION auto_create_next_match()
RETURNS TRIGGER AS $$
DECLARE
  v_series_id UUID;
  v_is_completed BOOLEAN;
  v_game_slug TEXT;
  v_wins_needed INTEGER;
  v_rac_team_id UUID;
  v_ast_team_id UUID;
  v_rac_wins INTEGER;
  v_ast_wins INTEGER;
  v_next_match_number INTEGER;
  v_existing_match_count INTEGER;
BEGIN
  -- Só processar se a partida foi atualizada com um vencedor (e não tinha antes)
  -- OU se foi inserida com um vencedor
  IF NEW.winner_team_id IS NOT NULL AND (OLD IS NULL OR OLD.winner_team_id IS NULL OR OLD.winner_team_id != NEW.winner_team_id) THEN
    v_series_id := NEW.series_id;
    
    -- Buscar informações da série
    SELECT 
      s.is_completed,
      g.slug
    INTO 
      v_is_completed,
      v_game_slug
    FROM series s
    INNER JOIN games g ON s.game_id = g.id
    WHERE s.id = v_series_id;
    
    -- Só criar se a série estiver em andamento
    IF v_is_completed = FALSE AND v_game_slug IS NOT NULL THEN
      -- Buscar IDs dos times
      SELECT id INTO v_rac_team_id FROM teams WHERE name = 'RAC' LIMIT 1;
      SELECT id INTO v_ast_team_id FROM teams WHERE name = 'AST' LIMIT 1;
      
      -- Contar vitórias de cada time na série (incluindo a partida atual)
      SELECT 
        COUNT(*) FILTER (WHERE winner_team_id = v_rac_team_id),
        COUNT(*) FILTER (WHERE winner_team_id = v_ast_team_id)
      INTO 
        v_rac_wins,
        v_ast_wins
      FROM matches
      WHERE series_id = v_series_id
        AND winner_team_id IS NOT NULL;
      
      -- Determinar vitórias necessárias
      v_wins_needed := get_wins_needed(v_game_slug);
      
      -- Verificar se algum time já venceu a série
      IF v_rac_wins < v_wins_needed AND v_ast_wins < v_wins_needed THEN
        -- Nenhum time venceu ainda, criar próxima partida
        -- Encontrar o próximo número de partida
        SELECT COALESCE(MAX(match_number), 0) + 1
        INTO v_next_match_number
        FROM matches
        WHERE series_id = v_series_id;
        
        -- Verificar se já existe uma partida com esse número (evitar duplicatas)
        SELECT COUNT(*)
        INTO v_existing_match_count
        FROM matches
        WHERE series_id = v_series_id
          AND match_number = v_next_match_number;
        
        -- Criar nova partida apenas se não existir
        IF v_existing_match_count = 0 THEN
          INSERT INTO matches (
            series_id,
            match_number,
            winner_team_id,
            mvp_player_id,
            created_at
          ) VALUES (
            v_series_id,
            v_next_match_number,
            NULL, -- Sem vencedor
            NULL, -- Sem MVP
            NOW()
          );
          
          RAISE NOTICE 'Nova partida #% criada automaticamente para série %', v_next_match_number, v_series_id;
        END IF;
      ELSE
        RAISE NOTICE 'Série % já foi vencida (RAC: %, AST: %, necessário: %). Não criando nova partida.', 
          v_series_id, v_rac_wins, v_ast_wins, v_wins_needed;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para UPDATE
DROP TRIGGER IF EXISTS trigger_auto_create_next_match_update ON matches;
CREATE TRIGGER trigger_auto_create_next_match_update
  AFTER UPDATE ON matches
  FOR EACH ROW
  WHEN (NEW.winner_team_id IS NOT NULL AND (OLD.winner_team_id IS NULL OR OLD.winner_team_id != NEW.winner_team_id))
  EXECUTE FUNCTION auto_create_next_match();

-- Criar trigger para INSERT (caso uma partida seja criada já com vencedor)
DROP TRIGGER IF EXISTS trigger_auto_create_next_match_insert ON matches;
CREATE TRIGGER trigger_auto_create_next_match_insert
  AFTER INSERT ON matches
  FOR EACH ROW
  WHEN (NEW.winner_team_id IS NOT NULL)
  EXECUTE FUNCTION auto_create_next_match();

-- Comentários
COMMENT ON FUNCTION auto_create_next_match() IS 'Cria automaticamente a próxima partida quando uma partida é concluída, desde que a série ainda não tenha sido vencida';
COMMENT ON FUNCTION get_wins_needed(TEXT) IS 'Retorna o número de vitórias necessárias para vencer a série baseado no slug do jogo';

