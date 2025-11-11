-- ============================================
-- V2.0 - Permitir Partidas sem Resultado
-- ============================================

-- 1. Tornar winner_team_id opcional (nullable)
ALTER TABLE public.matches
  ALTER COLUMN winner_team_id DROP NOT NULL;

-- 2. Comentário explicativo
COMMENT ON COLUMN public.matches.winner_team_id IS 'Time vencedor da partida. NULL se a partida ainda não foi disputada ou o resultado não foi registrado.';

-- 3. Atualizar trigger de atualização de scores para lidar com partidas sem resultado
-- O trigger atual já deve funcionar, mas vamos garantir que não quebre com NULL

-- Verificar se a função update_series_scores existe e atualizar se necessário
CREATE OR REPLACE FUNCTION public.update_series_scores()
RETURNS TRIGGER AS $$
DECLARE
  rac_team_id UUID;
  ast_team_id UUID;
  rac_wins INTEGER;
  ast_wins INTEGER;
BEGIN
  -- Get team IDs
  SELECT id INTO rac_team_id FROM teams WHERE name = 'RAC';
  SELECT id INTO ast_team_id FROM teams WHERE name = 'AST';

  -- Count wins for each team (only for matches with a winner)
  SELECT COUNT(*) INTO rac_wins
  FROM matches
  WHERE series_id = COALESCE(NEW.series_id, OLD.series_id)
    AND winner_team_id = rac_team_id;

  SELECT COUNT(*) INTO ast_wins
  FROM matches
  WHERE series_id = COALESCE(NEW.series_id, OLD.series_id)
    AND winner_team_id = ast_team_id;

  -- Update series scores
  UPDATE series
  SET 
    score_rac = rac_wins,
    score_ast = ast_wins,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.series_id, OLD.series_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;


