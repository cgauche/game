/**
 * EFFETS des **Traits & Améliorations** de navire (MDG ch.12) — couche PURE. Distinction RAW (ch.12 l.81,169) :
 * les **Traits** sont intégrés à la construction (fixes, `ship.traits` du type), les **Améliorations**
 * s'ajoutent/retirent plus tard (par INSTANCE, `Combatant.upgrades`). L'appelant (state) concatène les deux ;
 * ce module ne lit que des `string[]`.
 *
 * ✅ EFFET = `GameOp[]`, langue UNIQUE (pas de champ ad hoc) : l'effet mécanisé vit dans le `passive` des
 * entrées de `src/data/naval-traits.json` (éditable au Codex via le `GameOpEditor` EXISTANT) — `ap` pour
 * Blindage, `moveMod` pour Lissage, `skillDRBonus` pour Peu maniable : le MÊME vocabulaire que les passifs de
 * trait/mutation. Seul le PORTEUR diffère (libellé de coque vs `TraitInstance` du Combattant) → un collecteur
 * naval `navalPassiveOps` (calqué sur `passiveMods` : UN aplatissement + filtres minces), aucun système
 * parallèle. Restent en CHAMP DE DOMAINE les sous-systèmes navire hors vocabulaire combattant : `ram` (Bélier,
 * géométrie de collision) et `deckCover` (Sabord, géométrie de Pont). Ce module ne fait qu'EXPOSER ces effets
 * là où une brique EXISTANTE les consomme (spawn → PA de coque ; manœuvre → M/DR ; collision → Bélier ; pont → Sabord).
 *
 * ⚠ Anti-double-compte : les colonnes E/B des navires NOMMÉS de `vehicles.json` sont DÉJÀ finales (elles
 * intègrent Renforcé/Solide) → ces Traits-là n'ont PAS de `passive` (desc seule). Man et « Peu maniable » sont
 * en revanche des colonnes DISTINCTES → Peu maniable porte bien son `skillDRBonus` (Voile/Ramer).
 */
import { findNavalTrait } from '../data';
import type { GameOp } from './ops';
import type { DeckPosteSlot } from './types';

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

/** COLLECTEUR UNIQUE des `GameOp` PASSIFS d'une liste de libellés navals (Traits du type + Améliorations
 *  d'instance), chaque op répété ×Indice pour un Trait `ranked` (« Peu maniable 3 » → 3× la pénalité). PUR.
 *  Même FORME que `passiveMods` (un aplatissement → filtres minces) ; vocabulaire `GameOp` PARTAGÉ avec les
 *  passifs de trait/mutation — seul le porteur (étiquette de coque vs `TraitInstance`) diffère. Les helpers
 *  ci-dessous projettent l'op qui les concerne ; aucun ne ré-itère le catalogue. */
export function navalPassiveOps(traits: string[] | undefined): GameOp[] {
  const out: GameOp[] = [];
  for (const label of traits ?? []) {
    const e = findNavalTrait(label);
    if (!e?.passive?.length) continue;
    const level = e.ranked ? navalTraitLevel([label], e.label) : 1;
    for (let i = 0; i < level; i++) out.push(...e.passive);
  }
  return out;
}

/** PA de coque conférés par l'Amélioration **Blindage** — op `ap` sur la Coque (MÊME op que l'armure naturelle
 *  d'une mutation ; MDG ch.12 l.234/236 : bronze 1 / fer 2). Sommé puis baké sur `armour.corps` au spawn,
 *  mitigé par les dégâts navals. PUR. */
export function hullArmourBonus(traits: string[] | undefined): number {
  return navalPassiveOps(traits).reduce(
    (n, op) => (op.op === 'ap' && (op.loc === 'corps' || op.loc == null) && typeof op.amount === 'number' ? n + op.amount : n),
    0,
  );
}

/** Bonus de Mouvement conféré par l'Amélioration **Lissage** — op `moveMod` (MÊME op qu'une mutation ;
 *  MDG ch.12 l.293 : M +1). Ajouté au M de base dans la manœuvre. PUR. */
export function navalMoveMod(traits: string[] | undefined): number {
  return navalPassiveOps(traits).reduce((n, op) => (op.op === 'moveMod' ? n + op.mod : n), 0);
}

/** Bonus de DR (négatif = malus) à un Test de Compétence `skillId` conféré par le Trait **Peu maniable** & co —
 *  op `skillDRBonus` (MÊME op qu'un Trait de personnage ; MDG ch.12 l.173 : −1 DR/niveau aux Tests de
 *  Voile/Ramer). Lu par la manœuvre comme `extraDR` du Test de Navigation. PUR. */
export function navalSkillTestDR(traits: string[] | undefined, skillId: string): number {
  return navalPassiveOps(traits).reduce(
    (n, op) => (op.op === 'skillDRBonus' && op.skill === skillId && typeof op.bonus === 'number' ? n + op.bonus : n),
    0,
  );
}

/** Bonus de collision du **Bélier** (MDG ch.12 l.221 ; valeurs en donnée) : `ic` ajouté à l'Indice de Collision
 *  quand le porteur éperonne de sa proue, `ap` = PA frontaux. Champ de DOMAINE `ram` (sous-système collision,
 *  hors vocabulaire combattant) injecté dans `resolveCollision` par l'appelant. PUR — premier porteur trouvé
 *  (un navire ne porte qu'un Bélier). */
export function belierRam(traits: string[] | undefined): { ic: number; ap: number } {
  for (const label of traits ?? []) {
    const ram = findNavalTrait(label)?.ram;
    if (ram) return { ic: ram.ic, ap: ram.ap };
  }
  return { ic: 0, ap: 0 };
}

/** La coque offre-t-elle un COUVERT à ses postes ? — vrai si l'un de ses Traits/Améliorations porte le champ de
 *  domaine `deckCover` du catalogue (ex. **Sabord**, MDG ch.12 l.364). DATA-DRIVEN (pas de nom littéral codé).
 *  PUR. Booléen à passer à `effectiveDeckPostes`. */
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
