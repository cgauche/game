/**
 * Coûts-temps des actions (« tout est horodaté », Phase T1). En MINUTES.
 * RAW où cité ; à l'échelle d'une scène/d'un round, le canon est muet → valeurs PARAMÉTRABLES
 * (ne rien inventer comme « règle »). Voyage/repos/activités = #T2/#T3 (non ici).
 */
export const TIME_COST = {
  combatRound: 1,      // un Round WFRP ≈ quelques secondes → arrondi à 1 min/Round (paramétrable)
  sceneMovePerTile: 0, // déplacement intra-scène : négligeable (paramétrable)
  search: 10,          // fouiller un corps/coffre ≈ 10 min (paramétrable)
  dialogue: 5,         // une conversation ≈ 5 min (paramétrable)
  sceneTransition: 0,  // franchir une porte/zone (intérieur) ≈ 0 (paramétrable)
} as const;
