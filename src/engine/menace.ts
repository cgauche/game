/**
 * Talent « Résistance (Menace) » — LDB 10 l.1015-1021 : « Vous pouvez réussir automatiquement le
 * premier Test pour résister à la menace spécifiée, telle que Magie, Poison, Maladie, Mutation, à
 * chaque séance de jeu. Si le DR requis est important, utilisez votre Bonus d'Endurance comme DR
 * pour le Test. »
 *
 * Moteur PUR : ce module ne fait que DÉCIDER (spec disponible ?) et COMPTER (1 usage par spec et
 * par séance — compteur `Combatant.resistanceUsed`, remis à zéro par la couture de début de séance
 * `restoreFortune`, engine/fortune). L'auto-succès lui-même passe par le MÊME mécanisme que la
 * Résilience « Je ne faillirai pas ! » : le résolveur du flux reçoit `ForcedResolve { sl: BE }`
 * (cf. state/rollFlow — verbe `resist`).
 *
 * Un Test est ÉLIGIBLE quand son pending/étape porte un tag `menace` (posé par le SITE du Test :
 * Contraction de maladie, Exposition à la Corruption, seuil → Mutation, opposition à un Sort ; ou
 * en DONNÉE via `FlowTest.menace` — Venin/poisons). Comparaison de la spec du talent au tag par
 * `norm` (tolère casse/accents). Talent JOUEUR : l'IA n'ouvre pas de modale → ne l'exploite pas.
 */
import type { Combatant } from './types';
import { bonus, effectiveChar } from './characteristics';
import { norm } from '../lib/normalize';

/** La spec du talent Résistance de `c` couvrant `menace` et NON consommée cette séance — sinon null.
 *  (Le talent peut être pris plusieurs fois avec des specs différentes : chacune a SON usage.) */
export function availableResistance(c: Combatant, menace: string): string | null {
  const m = norm(menace);
  const spec = (c.talents ?? []).find(
    (t) => t.talentId === 'resistance' && t.spec != null && norm(t.spec) === m,
  )?.spec;
  if (spec == null) return null;
  return (c.resistanceUsed ?? []).includes(norm(spec)) ? null : spec;
}

/** Consomme l'usage de séance de la spec (mute `c.resistanceUsed`, clé normalisée). */
export function markResistanceUsed(c: Combatant, spec: string): void {
  const key = norm(spec);
  if (!(c.resistanceUsed ?? []).includes(key)) c.resistanceUsed = [...(c.resistanceUsed ?? []), key];
}

/** DR de l'auto-succès : « utilisez votre Bonus d'Endurance comme DR pour le Test » (LDB 10). */
export function resistanceForcedSL(c: Combatant): number {
  return bonus(effectiveChar(c, 'E'));
}
