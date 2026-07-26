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

import type { GameOp } from './ops';
import { rule } from './policy';

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

/**
 * Modèle de Surincantation en vigueur pour une source — POINT DE LECTURE UNIQUE du delta
 * `VDM 02 l.194-215` (règle optionnelle `magic-vdm-incantation`). Les Bénédictions (LDB 41) et les
 * Miracles (LDB 42) ne sont pas des Tests d'Incantation : VDM ne les révise pas.
 */
function overcastModel(source: OvercastSource): 'ldb' | 'vdm' {
  return source === 'arcane' && rule('magic-vdm-incantation') === true ? 'vdm' : 'ldb';
}

/** TABLEAU DE SURINCANTATION (`VDM 02 l.207-215`) : DR dépensés sur UNE colonne → effet obtenu.
 *  `targets` = Cibles ADDITIONNELLES ; `range`/`zone`/`duration` = multiplicateurs de la valeur
 *  listée. La colonne « Dégât en plus » (Projectiles) n'a pas d'axe d'allocation dans le moteur. */
const VDM_OVERCAST: { dr: number; targets: number; range: number; zone: number; duration: number }[] = [
  { dr: 21, targets: 3, range: 4, zone: 3, duration: 3 },
  { dr: 13, targets: 2, range: 3, zone: 2, duration: 3 },
  { dr: 8, targets: 2, range: 3, zone: 2, duration: 3 },
  { dr: 5, targets: 2, range: 3, zone: 2, duration: 2 },
  { dr: 3, targets: 1, range: 2, zone: 2, duration: 2 },
  { dr: 2, targets: 1, range: 2, zone: 1, duration: 2 },
  { dr: 1, targets: 1, range: 2, zone: 1, duration: 1 },
];

/** Rangée atteinte par `dr` DR dépensés sur une colonne (la plus haute ≤ `dr`) ; `null` en dessous de 1. */
function vdmRow(dr: number): (typeof VDM_OVERCAST)[number] | null {
  return VDM_OVERCAST.find((r) => dr >= r.dr) ?? null;
}

/**
 * BUDGET de Surincantation d'un lancement — SOURCE UNIQUE (modale, allocation de store, plan IA).
 * LDB 47 l.13-17 / 41 / 42 : un pas coûte +2 DR au-dessus du NI. `VDM 02 l.196` : « le lanceur de
 * sorts peut dépenser les DR restants » — le surplus se dépense DR par DR, sans division.
 */
export function overcastBudget(source: OvercastSource, sl: number, ni: number): number {
  const surplus = Math.max(0, sl - ni);
  return overcastModel(source) === 'vdm' ? surplus : Math.floor(surplus / 2);
}

/** Cibles SUPPLÉMENTAIRES débloquées par `steps` pas alloués à l'axe Cible. Arcane/Miracle : ×initial
 *  (chaque pas ajoute la valeur de Cible initiale du sort) ; Bénédiction : +1 par pas (FIXE). Sous VDM,
 *  `steps` = DR dépensés sur la colonne « Cible additionnelle » du Tableau de Surincantation. */
export function extraTargetCapacity(source: OvercastSource, steps: number, initialTargets: number): number {
  if (overcastModel(source) === 'vdm') return vdmRow(steps)?.targets ?? 0;
  return source === 'blessing' ? steps : steps * Math.max(1, initialTargets);
}

/** Multiplicateur du DIAMÈTRE de Zone d'Effet après `steps` pas alloués à l'axe Zone (arcane seulement).
 *  LDB 47 l.29 : chaque pas ajoute la ZdE initiale (×(1+n)) ; VDM : colonne « ZdE étendue » du Tableau. */
export function zoneDiameterMultiplier(source: OvercastSource, steps: number): number {
  if (overcastModel(source) === 'vdm') return vdmRow(steps)?.zone ?? 1;
  return 1 + steps;
}

/** Décomposition de la Durée surincantée pour l'application : `rounds = base × mult + bonusRounds`.
 *  Arcane/Miracle : mult = 1 + pas, bonus = 0 (×initial — le multiplicateur joue aussi sur une durée
 *  d'HORLOGE). Bénédiction : mult = 1, bonus = 6 Rounds × pas (FIXE, donc rounds-only). SOURCE UNIQUE
 *  de la règle de durée — `effectiveDurationRounds` et `applyCast` la consomment. */
export function overcastDurationParts(source: OvercastSource, steps: number): { mult: number; bonusRounds: number } {
  if (overcastModel(source) === 'vdm') return { mult: vdmRow(steps)?.duration ?? 1, bonusRounds: 0 };
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
  if (overcastModel(source) === 'vdm') return baseMetres * (vdmRow(steps)?.range ?? 1);
  return source === 'blessing' ? baseMetres + BLESSING_STEP * steps : baseMetres * (1 + steps);
}

/** Le sort porte-t-il un jet sur Tableau COUPLÉ à la Surincantation de Durée (EDOC 13 l.276) ? Détection
 *  PAR LA DONNÉE (`rollTable.extraRollsPerStep` dans son Flow), jamais par id de sort — pilote l'affichage
 *  du choix « Jets sur le Tableau » (déclinable) dans la modale d'incantation. */
export function spellHasOvercastTableRoll(ops: GameOp[]): boolean {
  return ops.some((o) => o.op === 'rollTable' && !!o.extraRollsPerStep);
}
