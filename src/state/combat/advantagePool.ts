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

/** Avantage DISPONIBLE pour dépense par `c` : en mode groupe, la réserve de SON camp (source de vérité) ;
 *  sinon son Avantage individuel (LDB). SOURCE UNIQUE des gardes d'abordabilité d'une dépense de camp. */
export function spendableAdvantage(get: Get, c: Combatant): number {
  const battle = get().battle;
  if (!groupAdvantage() || !battle) return c.advantage;
  return poolsOf(battle)[advantageCampOf(c)];
}

/**
 * SEUL point de GAIN d'Avantage en combat. Mode groupe (AA l.4113-4115) : `n` Avantages sont crédités à
 * la réserve du camp de `c`, puis projetés sur tous les combattants. Mode Livre de base : `gainAdvantage`
 * per-combattant, INCHANGÉ. Sans bataille (tests unitaires du moteur), on retombe sur le primitif.
 */
export function campGain(get: Get, c: Combatant, n = 1): void {
  if (n <= 0) return; // (gainAdvantage ignore déjà n≤0 ; la réserve idem)
  if ((c.distractedRounds ?? 0) > 0) return; // Distraire (LDB 10 l.364 / AA l.4395) : ce combattant ne génère aucun Avantage (ni pour lui, ni pour sa réserve)
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
 * SEUL point de DÉPENSE d'Avantage en combat — symétrique de `campGain`. Mode groupe (AA l.4132 : « Les
 * Avantages des réserves d'Avantages des deux camps peuvent être dépensés… ») : `n` Avantages sont
 * DÉBITÉS de la réserve du camp de `c` (jamais sous 0), puis re-projetés sur tous les combattants — la
 * réserve reste la source de vérité (sans ça, `mirrorPools` restaurerait la projection au prochain sync).
 * Mode Livre de base (défaut) : dépense per-combattant `c.advantage = max(0, c.advantage − n)`, INCHANGÉE.
 * Sans bataille (tests unitaires du moteur), on retombe aussi sur la mutation per-combattant.
 */
export function campSpend(get: Get, c: Combatant, n: number): void {
  if (n <= 0) return;
  const battle = get().battle;
  if (!groupAdvantage() || !battle) {
    c.advantage = Math.max(0, c.advantage - n);
    return;
  }
  const pools = poolsOf(battle);
  addToPool(pools, advantageCampOf(c), -n);
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
 * Réconcilie la réserve du camp de `c` avec son Avantage individuel après qu'un OP a écrit DIRECTEMENT sur
 * la projection `c.advantage` sans passer par `campGain`/`campSpend` : `gainAdvantage` (Redoutable, ZI :
 * complète jusqu'à l'Indice) RELÈVE la réserve du camp ; `spendAdvantage` (un futur effet dépensant de
 * l'Avantage par op) l'ABAISSE. On reporte l'ÉCART (`c.advantage − réserve du camp`) sur la réserve puis on
 * re-projette — la réserve reste la source de vérité. No-op hors mode groupe (l'op a déjà tout fait). Idempotent
 * (après re-projection `c.advantage == réserve`, un 2ᵉ appel ne bouge rien).
 */
export function reconcileAdvantageToPool(get: Get, c: Combatant): void {
  const battle = get().battle;
  if (!groupAdvantage() || !battle) return;
  const pools = poolsOf(battle);
  const camp = advantageCampOf(c);
  if (c.advantage !== pools[camp]) {
    pools[camp] = Math.max(0, c.advantage);
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
