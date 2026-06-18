/**
 * Tempo du combat — délais de chorégraphie CENTRALISÉS (fin des nombres magiques dispersés
 * 350/450/500/750 dans combatFlow). Un seul endroit pour régler le rythme.
 *
 * NB : le déplacement animé NE se cale PAS sur un délai fixe mais sur la durée RÉELLE de marche
 * (`walkMs(path)` de gameIso/walkPath) — c'est ce qui supprime la « téléportation » perçue
 * (la modale de défense ne s'ouvre qu'une fois l'ennemi arrivé).
 */
export const TEMPO = {
  /** Réticule de tir ennemi affiché AVANT le tir (télégraphe d'intention). */
  aimTelegraph: 750,
  /** Beat avant de résoudre une attaque (laisse voir l'amorce). */
  preAttack: 350,
  /** Beat après une attaque résolue, avant de passer la main. */
  postAttack: 500,
  /** Beat après un déplacement, avant la suite (attaque ou fin de tour). */
  afterMove: 350,
  /** Passage au tour de l'IA (laisse lire « tour de l'ennemi »). */
  turnHandoff: 450,
  /** Avant `advanceTurn` après une action instantanée de l'IA (incantation, reprise…). */
  enemyAdvance: 500,
  /** Cadence Rapide/Auto : beat entre deux étapes auto-résolues (jet → application), laisse lire le résultat. */
  autoResolve: 260,
} as const;
