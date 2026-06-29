/**
 * Surincantation — math PURE source-aware. SOURCE UNIQUE du « que fait un pas de surplus » selon le
 * type de magie, dérivée de la donnée (`spell.family`) — aucun champ manuel ajouté sur les sorts.
 *
 * RAW :
 *  - Arcane (LDB 47 l.13-17) : pour chaque +2 DR au-dessus du NI, +VALEUR INITIALE sur Portée / Zone
 *    d'Effet / Durée / Cible (×initial). Même axe répétable. « Vous »/« Contact »/« Spécial » non extensibles.
 *  - Miracle (LDB 42 l.7-13) : pour chaque +2 DR (Test de Prière, sans NI), +initial Portée / Durée /
 *    Cible (×initial, comme l'arcane). PAS de Zone d'Effet. « Vous » non augmentable.
 *  - Bénédiction (LDB 41 l.21-27) : pour chaque +2 DR, +6 m Portée / +1 Cible / +6 Rounds Durée (FIXE,
 *    PAS ×initial). PAS de Zone d'Effet. « Instantané » → pas de Durée à prolonger.
 *
 * Pur ; ne dépend de rien (consommé par castAllocOvercast/castConfirm/overcastTargetCandidates + CastModal).
 */

export type OvercastSource = 'arcane' | 'blessing' | 'miracle';
export type OvercastAxis = 'range' | 'zone' | 'duration' | 'targets';

/** +6 m / +6 Rounds : l'incrément FIXE des Bénédictions (LDB 41 l.23-25). */
const BLESSING_STEP = 6;

/** Type de surincantation d'un sort, DÉRIVÉ de sa famille (spells.json) : `beni` → Bénédiction (FIXE),
 *  `invocation` → Miracle (×initial, sans ZdE), tout le reste (arcane/mineure/chaos/domaines) → Arcane. */
export function overcastSourceOf(spell: { family?: string }): OvercastSource {
  if (spell.family === 'beni') return 'blessing';
  if (spell.family === 'invocation') return 'miracle';
  return 'arcane';
}

/** Axes surincantables d'une source (RAW) : la Zone d'Effet est RÉSERVÉE à l'arcane — ni les
 *  Bénédictions ni les Miracles n'augmentent de ZdE. L'ordre est celui d'affichage de la modale. */
export function overcastAxes(source: OvercastSource): OvercastAxis[] {
  return source === 'arcane'
    ? ['range', 'zone', 'duration', 'targets']
    : ['range', 'duration', 'targets'];
}

/** Cibles SUPPLÉMENTAIRES débloquées par `steps` pas alloués à l'axe Cible. Arcane/Miracle : ×initial
 *  (chaque pas ajoute la valeur de Cible initiale du sort) ; Bénédiction : +1 par pas (FIXE). */
export function extraTargetCapacity(source: OvercastSource, steps: number, initialTargets: number): number {
  return source === 'blessing' ? steps : steps * Math.max(1, initialTargets);
}

/** Décomposition de la Durée surincantée pour l'application : `rounds = base × mult + bonusRounds`.
 *  Arcane/Miracle : mult = 1 + pas, bonus = 0 (×initial — le multiplicateur joue aussi sur une durée
 *  d'HORLOGE). Bénédiction : mult = 1, bonus = 6 Rounds × pas (FIXE, donc rounds-only). SOURCE UNIQUE
 *  de la règle de durée — `effectiveDurationRounds` et `applyCast` la consomment. */
export function overcastDurationParts(source: OvercastSource, steps: number): { mult: number; bonusRounds: number } {
  return source === 'blessing' ? { mult: 1, bonusRounds: BLESSING_STEP * steps } : { mult: 1 + steps, bonusRounds: 0 };
}

/** Durée EFFECTIVE (Rounds) après `steps` pas de Durée — dérive de `overcastDurationParts`. */
export function effectiveDurationRounds(source: OvercastSource, baseRounds: number, steps: number): number {
  const { mult, bonusRounds } = overcastDurationParts(source, steps);
  return baseRounds * mult + bonusRounds;
}

/** Portée EFFECTIVE (mètres) après `steps` pas de Portée. Arcane/Miracle : base × (1 + pas) ;
 *  Bénédiction : base + 6 m × pas (FIXE — étend même une portée Contact, 0 m, LDB 41 l.27). */
export function effectiveRangeMetres(source: OvercastSource, baseMetres: number, steps: number): number {
  return source === 'blessing' ? baseMetres + BLESSING_STEP * steps : baseMetres * (1 + steps);
}
