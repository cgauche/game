/**
 * EFFETS mécanisés des **Traits & Améliorations** de navire (MDG ch.12) — couche PURE. Distinction RAW
 * (ch.12 l.81,169) : les **Traits** sont intégrés à la construction (fixes, `ship.traits` du type), les
 * **Améliorations** s'ajoutent/retirent plus tard (par INSTANCE). Les deux sont énoncés VERBATIM en donnée
 * (libellés de `vehicles.json` / liste d'améliorations d'instance) ; ce module ne fait que LIRE ces libellés
 * et exposer l'effet là où une brique EXISTANTE le consomme (collision, pont…), sans système parallèle.
 *
 * La liste lue est la COMBINAISON Traits du TYPE (`ship.traits` de `vehicles.json`) + Améliorations
 * d'INSTANCE (`Combatant.upgrades`, ex. « Blindage (fer) ») — l'appelant (state) concatène, ce module reste
 * pur et ne lit que des `string[]`.
 *
 * ⚠ Anti-double-compte (cf. profils de créature) : les colonnes E/B/Contenance des navires NOMMÉS de
 * `vehicles.json` sont DÉJÀ finales (elles intègrent Renforcé/Solide de leur construction) — on ne RÉ-applique
 * donc PAS ces Traits-là au runtime. On ne mécanise ici que les effets ABSENTS des colonnes (colonnes Man et
 * « Peu maniable » étant DISTINCTES, elles se cumulent) : **Bélier** (collision, `collision.ts`), **Sabord**
 * (couvert au pont), **Peu maniable** (−DR de manœuvre, `shipManeuver.ts`), **Blindage** (PA de coque, ci-dessous),
 * **Lissage** (M +1, `shipManeuver.ts`). Renforcé/Solide restent réservés à la construction sur mesure (hors périmètre).
 */
import type { DeckPosteSlot } from './types';

/** Indice (niveau) d'un Trait naval dans les libellés VERBATIM (insensible à la casse) : « Renforcé 2 » → 2,
 *  libellé NU (« Bélier », « Peu maniable ») → 1, absent → 0. PUR. Source UNIQUE de lecture des libellés. */
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

/** Une coque possède-t-elle ce Trait/Amélioration naval ? (présence, tout Indice ≥ 1). PUR. */
export function shipHasNavalTrait(traits: string[] | undefined, name: string): boolean {
  return navalTraitLevel(traits, name) > 0;
}

/**
 * PA de coque conférés par l'Amélioration **Blindage** (MDG ch.12 l.234/236) : « Bronze : la Coque bénéficie
 * d'1 PA. » / « Fer : la Coque bénéficie de 2 PA… » → fer ⇒ 2, bronze (ou libellé nu) ⇒ 1, absent ⇒ 0. PUR
 * (lit le 1ᵉʳ libellé « Blindage … » ; une coque n'en porte qu'un). Le « si Sali → plaques de fer rouillent,
 * PA retirés » (fer, l.236) reste ⏳ (pas d'état *Sali* modélisé). Appliqué au spawn sur `armour.corps`. */
export function hullArmourBonus(traits: string[] | undefined): number {
  for (const t of traits ?? []) {
    const lt = t.toLowerCase();
    if (lt.startsWith('blindage')) return lt.includes('fer') ? 2 : 1;
  }
  return 0;
}

/**
 * Couvert des postes selon l'Amélioration **Sabord** (MDG ch.12 l.362-364) : « Si un navire ne dispose pas de
 * Sabords, les tirs doivent nécessairement être effectués depuis le pont. Le pont ne fournit aucun couvert,
 * alors qu'un Sabord donne une couverture totale. » → une coque dotée de l'Amélioration Sabord couvre TOUS ses
 * emplacements de tir (`sabord:true`). PUR — renvoie une nouvelle liste (n'altère pas le gabarit de type), à
 * consommer par le rendu du Pont (couvert total au servant via `coverModifier`). Sans Sabord : inchangé.
 * `hasSabord` se dérive de `shipHasNavalTrait([...ship.traits, ...Combatant.upgrades], 'Sabord')`. */
export function effectiveDeckPostes(postes: DeckPosteSlot[], hasSabord: boolean): DeckPosteSlot[] {
  if (!hasSabord) return postes;
  return postes.map((p) => (p.sabord ? p : { ...p, sabord: true }));
}
