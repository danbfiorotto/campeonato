/**
 * Determina se um jogo é melhor de 3 (MD3) ou melhor de 5 (MD5)
 * baseado no slug do jogo
 */
export function getSeriesFormat(gameSlug: string | null | undefined): 'MD3' | 'MD5' {
  if (!gameSlug) return 'MD3'
  
  const md5Games = ['brawlhalla']
  const slugLower = gameSlug.toLowerCase()
  
  return md5Games.includes(slugLower) ? 'MD5' : 'MD3'
}

/**
 * Retorna o número de vitórias necessárias para vencer a série
 */
export function getWinsNeeded(gameSlug: string | null | undefined): number {
  return getSeriesFormat(gameSlug) === 'MD5' ? 3 : 2
}

/**
 * Verifica se uma série pode ser encerrada baseado no placar
 */
export function canCompleteSeries(
  scoreRac: number,
  scoreAst: number,
  gameSlug: string | null | undefined
): boolean {
  const winsNeeded = getWinsNeeded(gameSlug)
  return scoreRac >= winsNeeded || scoreAst >= winsNeeded
}

/**
 * Determina qual time venceu a série baseado no placar
 * Retorna 'RAC', 'AST' ou null se ainda não há vencedor
 */
export function getSeriesWinner(
  scoreRac: number,
  scoreAst: number,
  gameSlug: string | null | undefined
): 'RAC' | 'AST' | null {
  const winsNeeded = getWinsNeeded(gameSlug)
  
  if (scoreRac >= winsNeeded) return 'RAC'
  if (scoreAst >= winsNeeded) return 'AST'
  return null
}

