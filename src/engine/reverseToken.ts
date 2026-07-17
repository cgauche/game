/**
 * Jeton d'INVERSION de Test CONSOMMABLE « pour votre prochaine aventure » (LDB 23 l.209 « Entraînement
 * au Combat » / l.218 « Observer une cible ») : posé par l'op `grantReverseToken` (`ActiveEffect.reverseToken`,
 * `duration:{scale:'adventure'}`) — MÊME canal que `statusMod` (Réputation, l.228-234), purgé s'il n'est
 * jamais consommé à l'ouverture de l'interlude suivant (`state/upkeep.purgeAdventureEffects`).
 *
 * « Inverser un Test » (LDB 12 l.42) = intervertir le chiffre des unités et des dizaines du d100
 * (`reverseRoll`, engine/combat.ts) — PAS une relance. Talent PERMANENT équivalent : `talentReverseFailed`
 * (combatFeatures/dispatch.ts), appliqué automatiquement sur échec. Le jeton, LIMITÉ, suit le MÊME point
 * d'application (une seule utilisation, `skill` absent = tout Test — scope « concernant votre cible »).
 */
import type { Combatant } from './types';

/** Un jeton d'inversion couvre-t-il le Test `{skill, spec}` ? `skill` absent sur le jeton = tout Test
 *  (« Observer une cible », l.218) ; sinon match STRUCTURÉ par id (comme `talentReverseFailed`). */
function tokenMatches(tok: { skill?: string; spec?: string }, q: { skill?: string; spec?: string }): boolean {
  if (tok.skill == null) return true;
  return tok.skill === q.skill && (tok.spec == null || tok.spec === q.spec);
}

/** Consomme le PREMIER jeton d'inversion de `c` couvrant `{skill, spec}`, le retire de `c.activeEffects`
 *  et renvoie `true` — `false` si aucun jeton ne correspond (rien de consommé, 0 excédent = 0 effet). */
export function consumeReverseToken(c: Combatant, q: { skill?: string; spec?: string }): boolean {
  const effects = c.activeEffects ?? [];
  const idx = effects.findIndex((e) => e.reverseToken && tokenMatches(e.reverseToken, q));
  if (idx < 0) return false;
  c.activeEffects = [...effects.slice(0, idx), ...effects.slice(idx + 1)];
  return true;
}
