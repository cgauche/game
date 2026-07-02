/**
 * Orchestration STATE du socle « Avantage de groupe » (Aux Armes, Annexe I — cf. `engine/advantagePool`).
 * La réserve par camp (`BattleState.advantagePools`) est la SOURCE DE VÉRITÉ ; chaque `Combatant.advantage`
 * en est la PROJECTION (`mirrorPools`), pour que les LECTEURS d'Avantage du moteur (attackModifiers,
 * baseTestMods…) lisent la réserve du camp de l'acteur sans changer une ligne. En mode Livre de base
 * (défaut), tout ce module délègue au primitif per-combattant `gainAdvantage` (comportement INCHANGÉ).
 */
import type { Combatant } from '../../engine/types';
import type { Get } from '../flowTypes';
import { gainAdvantage } from '../../engine/advantage';
import { isOutOfAction } from '../../engine/conditions';
import {
  groupAdvantage, advantageCampOf, emptyPools, addToPool, mirrorPools, dominationTransfer,
  initialAdvantagePools, type AdvantagePools, type InitialAdvantageCircumstances,
} from '../../engine/advantagePool';
import { advantageTransferWeight } from '../../engine/combatFeatures/dispatch';

/** Réserve courante de la bataille (créée à la volée si absente). */
function poolsOf(battle: { advantagePools?: AdvantagePools }): AdvantagePools {
  return (battle.advantagePools ??= emptyPools());
}

/**
 * SEUL point de GAIN d'Avantage en combat. Mode groupe (AA l.4113-4115) : `n` Avantages sont crédités à
 * la réserve du camp de `c`, puis projetés sur tous les combattants. Mode Livre de base : `gainAdvantage`
 * per-combattant, INCHANGÉ. Sans bataille (tests unitaires du moteur), on retombe sur le primitif.
 */
export function campGain(get: Get, c: Combatant, n = 1): void {
  if (n <= 0) return; // (gainAdvantage ignore déjà n≤0 ; la réserve idem)
  const battle = get().battle;
  if (!groupAdvantage() || !battle) {
    gainAdvantage(c, n);
    return;
  }
  const pools = poolsOf(battle);
  addToPool(pools, advantageCampOf(c), n);
  mirrorPools(pools, battle.combatants);
}

/**
 * Renversement — variante « Avantage de groupe » (AA l.4442) : `thief` prend 1 Avantage dans la réserve
 * ADVERSE (celle de `victim`) et l'ajoute à la sienne. Réserve adverse vide → il gagne simplement +1
 * (meilleur auto-choix : « au lieu de gagner +1, prendre 1 »). Retombe sur `campGain(+1)` hors mode
 * groupe / sans bataille. Renvoie `true` si un Avantage a bien été VOLÉ à l'adversaire.
 */
export function reversalStealOne(get: Get, thief: Combatant, victim: Combatant): boolean {
  const battle = get().battle;
  if (!groupAdvantage() || !battle) {
    campGain(get, thief, 1);
    return false;
  }
  const pools = poolsOf(battle);
  const from = advantageCampOf(victim);
  const to = advantageCampOf(thief);
  const stole = pools[from] > 0 && from !== to;
  if (stole) addToPool(pools, from, -1);
  addToPool(pools, to, 1);
  mirrorPools(pools, battle.combatants);
  return stole;
}

/**
 * Réconcilie la réserve du camp de `c` avec son Avantage individuel après un octroi par OP (`gainAdvantage`
 * op — Redoutable, ZI : complète l'Avantage jusqu'à l'Indice au début du tour). L'op écrit sur le
 * combattant (la projection) sans atteindre la réserve ; on RELÈVE ici la réserve (jamais réduite) puis on
 * re-projette. No-op hors mode groupe.
 */
export function reconcileAdvantageToPool(get: Get, c: Combatant): void {
  const battle = get().battle;
  if (!groupAdvantage() || !battle) return;
  const pools = poolsOf(battle);
  const camp = advantageCampOf(c);
  if (c.advantage > pools[camp]) {
    pools[camp] = c.advantage;
    mirrorPools(pools, battle.combatants);
  }
}

/**
 * Transfert de domination de fin de Round (AA l.4146) — REMPLACE la décroissance per-combattant et le
 * Surnombre du Livre de base en mode groupe. Le camp le plus nombreux (Coude-à-coude compte pour deux,
 * l.4387) prend 1 Avantage à l'autre, ou +1 si l'autre est vide. Mute les réserves + re-projette.
 */
export function roundEndAdvantageTransfer(battle: { advantagePools?: AdvantagePools; combatants: Combatant[] }): void {
  const pools = poolsOf(battle);
  dominationTransfer(pools, battle.combatants, (c) => !isOutOfAction(c), (c) => advantageTransferWeight(c));
  mirrorPools(pools, battle.combatants);
}

/** Réserves de départ (AA l.4149-4167). AUTO-dérivé de ce que le moteur connaît au lancement : Surnombre
 *  (ratio de combattants actifs) et Surprise (embuscade). Menace / Manœuvrabilité / Terrain restent à
 *  l'appréciation du MJ (entrée d'éditeur future) → 0 par défaut. */
export function startAdvantagePools(all: Combatant[], doSurprise: boolean): AdvantagePools {
  const allies = all.filter((c) => c.kind === 'hero' && !isOutOfAction(c)).length;
  const foes = all.filter((c) => c.kind !== 'hero' && !isOutOfAction(c)).length;
  const circ: InitialAdvantageCircumstances = {};
  if (allies > foes && foes > 0) circ.outnumber = { camp: 'allies', ratio: allies / foes };
  else if (foes > allies && allies > 0) circ.outnumber = { camp: 'foes', ratio: foes / allies };
  if (doSurprise) circ.surprise = 'foes'; // l'embuscade de rencontre surprend le groupe (camp adverse)
  return initialAdvantagePools(circ);
}
