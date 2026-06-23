/**
 * DISSIPATION DE SORTS PERMANENTS (LDB 46 l.204-207) — partie PURE.
 *
 * « Si un Sort a un effet durable, vous pouvez tenter de le dissiper pour votre Action. Il faut pour cela
 *  effectuer un Test étendu de Langue (Magick). Quand votre DR atteint la NI du Sort, vous le dissipez
 *  avec succès. » (l.204-205). « Plusieurs lanceurs … effectuent leur lancer séparément. S'ils incantent
 *  en utilisant le même Domaine, ils peuvent décider d'effectuer un Test Soutenu à la place. » (l.207).
 *
 * Le CUMUL du DR → NI est porté par `extendedTestStep` (engine/tests, mutualisé), le bonus de coopération
 * par `assistedTest`. Ici : ÉNUMÉRER les sorts permanents actifs (effets marqués `ActiveEffect.spell` à
 * l'incantation, cf. Stage 1) et les RETIRER proprement à la dissipation (réversion des octrois via
 * `removeActiveEffects`). NB : ne couvre que les imprints portés par `ActiveEffect` (buffs/débuffs, traits
 * octroyés, armes invoquées, ops `perRound`) — un État pur à durée (`Condition.roundsLeft`) n'est pas marqué.
 */
import { Combatant, ActiveEffect } from './types';
import { removeActiveEffects } from './conditions';

/** Un Sort PERMANENT actif et dissipable : identité + NI (le DR à atteindre) + porteurs de ses effets. */
export interface DispellableSpell {
  spellId: string;
  casterId: string;
  label: string;
  ni: number;
  /** ids des combattants portant ≥ 1 effet actif de ce sort (un sort de zone touche plusieurs cibles). */
  carriers: string[];
}

/** Énumère les Sorts permanents actifs sur un ensemble de combattants (effets durables marqués à
 *  l'incantation), REGROUPÉS par (sort, lanceur) — un même sort sur plusieurs cibles = UNE entrée. */
export function dispellableSpellsOn(combatants: Combatant[]): DispellableSpell[] {
  const byKey = new Map<string, DispellableSpell>();
  for (const c of combatants) {
    for (const e of c.activeEffects ?? []) {
      if (!e.spell) continue;
      const key = `${e.spell.spellId}@${e.spell.casterId}`;
      let d = byKey.get(key);
      if (!d) {
        d = { spellId: e.spell.spellId, casterId: e.spell.casterId, label: e.spell.label, ni: e.spell.ni, carriers: [] };
        byKey.set(key, d);
      }
      if (!d.carriers.includes(c.id)) d.carriers.push(c.id);
    }
  }
  return [...byKey.values()];
}

/** Vrai si l'effet appartient au sort (sort, lanceur) donné. */
export function isFromSpell(e: ActiveEffect, spellId: string, casterId: string): boolean {
  return e.spell?.spellId === spellId && e.spell?.casterId === casterId;
}

/** Retire de TOUS les combattants les effets actifs d'un Sort DISSIPÉ (réversion propre des octrois via
 *  `removeActiveEffects`, comme l'expiration naturelle). Renvoie le nombre de combattants nettoyés. */
export function dissipateSpell(combatants: Combatant[], spellId: string, casterId: string): number {
  let cleaned = 0;
  for (const c of combatants) {
    if (removeActiveEffects(c, (e) => isFromSpell(e, spellId, casterId)).length) cleaned++;
  }
  return cleaned;
}
