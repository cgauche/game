/**
 * EFFETS des **Traits & Améliorations** de navire (MDG ch.12) — couche PURE. Distinction RAW (ch.12 l.81,169) :
 * les **Traits** sont intégrés à la construction (fixes, `ship.traits` du type), les **Améliorations**
 * s'ajoutent/retirent plus tard (par INSTANCE, `Combatant.upgrades`). L'appelant (state) concatène les deux ;
 * ce module ne lit que des `string[]`.
 *
 * ✅ DATA-DRIVEN : les valeurs d'effet ne sont PAS codées ici — elles vivent dans le catalogue
 * `src/data/naval-traits.json` (éditable au Codex : `desc` verbatim + champs `hullAP`/`moveBonus`/`maneuverDR`/
 * `ramIC`/`ramAP`), lu via `findNavalTrait`. Ce module ne fait que SOMMER l'effet d'une liste de libellés et
 * l'exposer là où une brique EXISTANTE le consomme (spawn → PA de coque ; manœuvre → M/DR ; collision → Bélier ;
 * pont → Sabord), sans système parallèle.
 *
 * ⚠ Anti-double-compte : les colonnes E/B des navires NOMMÉS de `vehicles.json` sont DÉJÀ finales (elles
 * intègrent Renforcé/Solide) → ces Traits-là n'ont PAS de champ d'effet runtime dans le catalogue (desc seule).
 * Man et « Peu maniable » sont en revanche des colonnes DISTINCTES → Peu maniable porte bien un `maneuverDR`.
 */
import { findNavalTrait } from '../data';
import type { DeckPosteSlot } from './types';

/** Champ d'effet NUMÉRIQUE du catalogue naval. */
type NavalNumericEffect = 'hullAP' | 'moveBonus' | 'maneuverDR' | 'ramIC' | 'ramAP';

/** Indice (niveau) d'un Trait naval dans les libellés VERBATIM (insensible à la casse) : « Renforcé 2 » → 2,
 *  libellé NU (« Bélier », « Peu maniable ») → 1, absent → 0. PUR. Source UNIQUE de lecture de l'Indice. */
export function navalTraitLevel(traits: string[] | undefined, name: string): number {
  const n = name.toLowerCase();
  for (const t of traits ?? []) {
    const lt = t.toLowerCase();
    if (lt === n) return 1; // libellé nu = Indice 1
    if (lt.startsWith(n + ' ')) {
      const rank = parseInt(lt.slice(n.length).trim(), 10);
      return Number.isFinite(rank) ? rank : 1;
    }
  }
  return 0;
}

/** Une coque possède-t-elle ce Trait/Amélioration naval ? (présence par libellé, tout Indice ≥ 1). PUR. */
export function shipHasNavalTrait(traits: string[] | undefined, name: string): boolean {
  return navalTraitLevel(traits, name) > 0;
}

/** Somme d'un champ d'effet NUMÉRIQUE du catalogue sur une liste de libellés (× Indice pour un Trait `ranked`).
 *  PUR — toute la valeur vient de `naval-traits.json` (rien de codé en dur). Source UNIQUE de lecture d'effet. */
export function navalEffectSum(traits: string[] | undefined, field: NavalNumericEffect): number {
  let total = 0;
  for (const label of traits ?? []) {
    const e = findNavalTrait(label);
    const v = e?.[field];
    if (e === undefined || typeof v !== 'number') continue;
    total += v * (e.ranked ? navalTraitLevel([label], e.label) : 1);
  }
  return total;
}

/** PA de coque conférés par l'Amélioration **Blindage** (MDG ch.12 l.234/236 ; valeurs en donnée : bronze 1 /
 *  fer 2). Appliqué au spawn sur `armour.corps`, mitigé par les dégâts navals. PUR. */
export function hullArmourBonus(traits: string[] | undefined): number {
  return navalEffectSum(traits, 'hullAP');
}

/** Bonus de collision du **Bélier** (MDG ch.12 l.221 ; valeurs en donnée) : `ic` ajouté à l'Indice de Collision
 *  quand le porteur éperonne de sa proue, `ap` = PA frontaux. Injecté dans `resolveCollision` par l'appelant. PUR. */
export function belierRam(traits: string[] | undefined): { ic: number; ap: number } {
  return { ic: navalEffectSum(traits, 'ramIC'), ap: navalEffectSum(traits, 'ramAP') };
}

/** La coque offre-t-elle un COUVERT à ses postes ? — vrai si l'un de ses Traits/Améliorations porte le drapeau
 *  `deckCover` du catalogue (ex. **Sabord**, MDG ch.12 l.364). DATA-DRIVEN (pas de nom littéral codé). PUR.
 *  Booléen à passer à `effectiveDeckPostes`. */
export function hasDeckCover(traits: string[] | undefined): boolean {
  return (traits ?? []).some((label) => findNavalTrait(label)?.deckCover === true);
}

/**
 * Couvert des postes selon l'Amélioration **Sabord** (MDG ch.12 l.362-364, `deckCover` en donnée) : « Si un
 * navire ne dispose pas de Sabords, les tirs doivent nécessairement être effectués depuis le pont. Le pont ne
 * fournit aucun couvert, alors qu'un Sabord donne une couverture totale. » → une coque à Sabord couvre TOUS ses
 * emplacements (`sabord:true`). PUR — nouvelle liste (n'altère pas le gabarit de type), consommée par le rendu
 * du Pont (couvert total via `coverModifier`). Sans Sabord : inchangé. `hasSabord` se dérive de
 * `shipHasNavalTrait([...ship.traits, ...Combatant.upgrades], 'Sabord')`. */
export function effectiveDeckPostes(postes: DeckPosteSlot[], hasSabord: boolean): DeckPosteSlot[] {
  if (!hasSabord) return postes;
  return postes.map((p) => (p.sabord ? p : { ...p, sabord: true }));
}
