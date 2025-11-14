-- Atualizar função update_series_scores para usar get_wins_needed
-- e encerrar automaticamente a série quando um time atingir o número necessário de vitórias

CREATE OR REPLACE FUNCTION update_series_scores()
RETURNS TRIGGER AS $$
DECLARE
  rac_team_id UUID;
  ast_team_id UUID;
  rac_wins INTEGER;
  ast_wins INTEGER;
  v_game_slug TEXT;
  v_wins_needed INTEGER;
BEGIN
  -- Get team IDs
  SELECT id INTO rac_team_id FROM teams WHERE name = 'RAC';
  SELECT id INTO ast_team_id FROM teams WHERE name = 'AST';
  
  -- Count wins for each team in this series
  SELECT COUNT(*) INTO rac_wins
  FROM matches
  WHERE series_id = NEW.series_id AND winner_team_id = rac_team_id;
  
  SELECT COUNT(*) INTO ast_wins
  FROM matches
  WHERE series_id = NEW.series_id AND winner_team_id = ast_team_id;
  
  -- Get game slug to determine wins needed
  SELECT g.slug INTO v_game_slug
  FROM series s
  INNER JOIN games g ON s.game_id = g.id
  WHERE s.id = NEW.series_id;
  
  -- Get wins needed based on game
  v_wins_needed := get_wins_needed(v_game_slug);
  
  -- Update series scores and auto-complete if needed
  UPDATE series
  SET 
    score_rac = rac_wins,
    score_ast = ast_wins,
    winner_team_id = CASE 
      WHEN rac_wins >= v_wins_needed THEN rac_team_id
      WHEN ast_wins >= v_wins_needed THEN ast_team_id
      ELSE NULL
    END,
    is_completed = (rac_wins >= v_wins_needed OR ast_wins >= v_wins_needed),
    updated_at = NOW()
  WHERE id = NEW.series_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar função update_series_scores_on_delete também
CREATE OR REPLACE FUNCTION update_series_scores_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  rac_team_id UUID;
  ast_team_id UUID;
  rac_wins INTEGER;
  ast_wins INTEGER;
  v_game_slug TEXT;
  v_wins_needed INTEGER;
BEGIN
  -- Get team IDs
  SELECT id INTO rac_team_id FROM teams WHERE name = 'RAC';
  SELECT id INTO ast_team_id FROM teams WHERE name = 'AST';
  
  -- Count wins for each team in this series
  SELECT COUNT(*) INTO rac_wins
  FROM matches
  WHERE series_id = OLD.series_id AND winner_team_id = rac_team_id;
  
  SELECT COUNT(*) INTO ast_wins
  FROM matches
  WHERE series_id = OLD.series_id AND winner_team_id = ast_team_id;
  
  -- Get game slug to determine wins needed
  SELECT g.slug INTO v_game_slug
  FROM series s
  INNER JOIN games g ON s.game_id = g.id
  WHERE s.id = OLD.series_id;
  
  -- Get wins needed based on game
  v_wins_needed := get_wins_needed(v_game_slug);
  
  -- Update series scores and auto-complete if needed
  UPDATE series
  SET 
    score_rac = rac_wins,
    score_ast = ast_wins,
    winner_team_id = CASE 
      WHEN rac_wins >= v_wins_needed THEN rac_team_id
      WHEN ast_wins >= v_wins_needed THEN ast_team_id
      ELSE NULL
    END,
    is_completed = (rac_wins >= v_wins_needed OR ast_wins >= v_wins_needed),
    updated_at = NOW()
  WHERE id = OLD.series_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;



