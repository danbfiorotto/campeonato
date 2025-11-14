-- Criar a primeira partida (partida #1) para todas as séries que ainda não têm partidas

INSERT INTO matches (
  series_id,
  match_number,
  winner_team_id,
  mvp_player_id,
  created_at
)
SELECT 
  s.id AS series_id,
  1 AS match_number,
  NULL AS winner_team_id, -- Sem vencedor
  NULL AS mvp_player_id,  -- Sem MVP
  NOW() AS created_at
FROM series s
WHERE s.is_completed = FALSE -- Apenas séries em andamento
  AND NOT EXISTS (
    -- Verificar se já existe alguma partida para esta série
    SELECT 1 
    FROM matches m 
    WHERE m.series_id = s.id
  )
ON CONFLICT (series_id, match_number) DO NOTHING; -- Evitar duplicatas se já existir

-- Comentário
COMMENT ON FUNCTION auto_create_next_match() IS 'Cria automaticamente a próxima partida quando uma partida é concluída, desde que a série ainda não tenha sido vencida. A primeira partida deve ser criada manualmente ou via migration.';



