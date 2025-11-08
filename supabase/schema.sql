-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, team_id)
);

-- Player games table (jogadores podem jogar múltiplos jogos)
CREATE TABLE player_games (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  PRIMARY KEY (player_id, game_id)
);

-- Series table
CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  date TIMESTAMP WITH TIME ZONE,
  winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  score_rac INTEGER DEFAULT 0,
  score_ast INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  match_number INTEGER NOT NULL,
  winner_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  mvp_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(series_id, match_number)
);

-- Match players table (junction table)
CREATE TABLE match_players (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  PRIMARY KEY (match_id, player_id)
);

-- Profiles table (for admin roles)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super', 'rac', 'ast')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_series_game_id ON series(game_id);
CREATE INDEX idx_series_winner_team_id ON series(winner_team_id);
CREATE INDEX idx_matches_series_id ON matches(series_id);
CREATE INDEX idx_matches_winner_team_id ON matches(winner_team_id);
CREATE INDEX idx_matches_mvp_player_id ON matches(mvp_player_id);
CREATE INDEX idx_match_players_match_id ON match_players(match_id);
CREATE INDEX idx_match_players_player_id ON match_players(player_id);
CREATE INDEX idx_match_players_team_id ON match_players(team_id);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_team_id ON profiles(team_id);
CREATE INDEX idx_player_games_player_id ON player_games(player_id);
CREATE INDEX idx_player_games_game_id ON player_games(game_id);

-- Function to update series scores and winner
CREATE OR REPLACE FUNCTION update_series_scores()
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
  
  -- Count wins for each team in this series
  SELECT COUNT(*) INTO rac_wins
  FROM matches
  WHERE series_id = NEW.series_id AND winner_team_id = rac_team_id;
  
  SELECT COUNT(*) INTO ast_wins
  FROM matches
  WHERE series_id = NEW.series_id AND winner_team_id = ast_team_id;
  
  -- Update series scores
  UPDATE series
  SET 
    score_rac = rac_wins,
    score_ast = ast_wins,
    winner_team_id = CASE 
      WHEN rac_wins >= 2 THEN rac_team_id
      WHEN ast_wins >= 2 THEN ast_team_id
      ELSE NULL
    END,
    is_completed = (rac_wins >= 2 OR ast_wins >= 2),
    updated_at = NOW()
  WHERE id = NEW.series_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update series scores when a match is inserted
CREATE TRIGGER trigger_update_series_scores
AFTER INSERT ON matches
FOR EACH ROW
EXECUTE FUNCTION update_series_scores();

-- Trigger to update series scores when a match is updated
CREATE TRIGGER trigger_update_series_scores_on_update
AFTER UPDATE ON matches
FOR EACH ROW
WHEN (OLD.winner_team_id IS DISTINCT FROM NEW.winner_team_id)
EXECUTE FUNCTION update_series_scores();

-- Trigger to update series scores when a match is deleted
CREATE OR REPLACE FUNCTION update_series_scores_on_delete()
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
  
  -- Count wins for each team in this series
  SELECT COUNT(*) INTO rac_wins
  FROM matches
  WHERE series_id = OLD.series_id AND winner_team_id = rac_team_id;
  
  SELECT COUNT(*) INTO ast_wins
  FROM matches
  WHERE series_id = OLD.series_id AND winner_team_id = ast_team_id;
  
  -- Update series scores
  UPDATE series
  SET 
    score_rac = rac_wins,
    score_ast = ast_wins,
    winner_team_id = CASE 
      WHEN rac_wins >= 2 THEN rac_team_id
      WHEN ast_wins >= 2 THEN ast_team_id
      ELSE NULL
    END,
    is_completed = (rac_wins >= 2 OR ast_wins >= 2),
    updated_at = NOW()
  WHERE id = OLD.series_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_series_scores_on_delete
AFTER DELETE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_series_scores_on_delete();

-- Row Level Security (RLS) Policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_games ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access for teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read access for players" ON players FOR SELECT USING (true);
CREATE POLICY "Public read access for games" ON games FOR SELECT USING (true);
CREATE POLICY "Public read access for series" ON series FOR SELECT USING (true);
CREATE POLICY "Public read access for matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public read access for match_players" ON match_players FOR SELECT USING (true);
CREATE POLICY "Public read access for player_games" ON player_games FOR SELECT USING (true);

-- Profiles: usuários autenticados podem ler seu próprio perfil
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT 
  USING (auth.uid() = id OR auth.uid() = user_id);

-- Admin write access (authenticated users only)
CREATE POLICY "Admin insert teams" ON teams FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update teams" ON teams FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete teams" ON teams FOR DELETE USING (auth.role() = 'authenticated');

-- Players policies with team restrictions
CREATE POLICY "Admin insert players" ON players FOR INSERT 
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      -- Super admin can insert any player
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super')
      OR
      -- Team admins can only insert players for their own team
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.team_id = players.team_id
        AND p.role IN ('rac', 'ast')
      )
    )
  );

CREATE POLICY "Admin update players" ON players FOR UPDATE 
  USING (
    auth.role() = 'authenticated' AND (
      -- Super admin can update any player
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super')
      OR
      -- Team admins can only update players from their own team
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.team_id = players.team_id
        AND p.role IN ('rac', 'ast')
      )
    )
  );

CREATE POLICY "Admin delete players" ON players FOR DELETE 
  USING (
    auth.role() = 'authenticated' AND (
      -- Super admin can delete any player
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super')
      OR
      -- Team admins can only delete players from their own team
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.team_id = players.team_id
        AND p.role IN ('rac', 'ast')
      )
    )
  );

CREATE POLICY "Admin insert games" ON games FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update games" ON games FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete games" ON games FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert series" ON series FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update series" ON series FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete series" ON series FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert matches" ON matches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update matches" ON matches FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete matches" ON matches FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert match_players" ON match_players FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin delete match_players" ON match_players FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert player_games" ON player_games FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin delete player_games" ON player_games FOR DELETE USING (auth.role() = 'authenticated');

-- Initial data
INSERT INTO teams (name) VALUES ('RAC'), ('AST');

INSERT INTO games (name, slug) VALUES
  ('Rainbow Six Siege', 'R6'),
  ('League of Legends', 'LoL'),
  ('Counter-Strike', 'CS'),
  ('Brawlhalla', 'Brawlhalla'),
  ('Valorant', 'Valorant');

