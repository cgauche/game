/**
 * Avantage de GROUPE (Aux Armes, Annexe I — l.4105-4181) : SOCLE PUR de la variante où l'Avantage
 * n'est plus accumulé par combattant mais dans DEUX réserves de camp (alliés / adversaires). Ce module
 * ne dépend que de `types` + `policy` (aucun store/UI) — la couche state (`state/combat/advantagePool`)
 * l'orchestre sur la `BattleState` (réserve = source de vérité, `Combatant.advantage` = projection).
 *
 * RAW l.4113-4115 : « Les Avantages […] sont acquis et stockés dans la réserve d'Avantages des alliés
 * ou dans celle des adversaires. Chaque fois qu'un Personnage génère un Avantage, placez-le dans la
 * réserve des alliés. Chaque fois qu'un PNJ hostile ou neutre génère un Avantage, placez-le dans la
 * réserve des adversaires. Les PNJ alliés génèrent des Avantages dans la réserve des alliés. »
 */
import type { Combatant } from './types';
import { rule } from './policy';

export type AdvantageCamp = 'allies' | 'foes';

/** Les deux réserves d'Avantage de la bataille (AA l.4113). */
export interface AdvantagePools {
  allies: number;
  foes: number;
}

/** Le modèle « Avantage de groupe » (AA l.4107) est-il actif ? Registre `combat-aa-avantage-groupe`.
 *  Faux par défaut → modèle par combattant du Livre de base (INCHANGÉ). */
export function groupAdvantage(): boolean {
  return rule('combat-aa-avantage-groupe') === true;
}

/** Réserve d'un combattant : héros et PNJ alliés (`kind:'hero'`) → réserve des alliés ; PNJ hostile ou
 *  neutre (`enemy`/`npc`) → réserve des adversaires (AA l.4113-4115). */
export function advantageCampOf(c: Pick<Combatant, 'kind'>): AdvantageCamp {
  return c.kind === 'hero' ? 'allies' : 'foes';
}

export function emptyPools(): AdvantagePools {
  return { allies: 0, foes: 0 };
}

/** Ajoute (ou retire) `n` Avantages à la réserve `camp`, jamais sous 0. */
export function addToPool(pools: AdvantagePools, camp: AdvantageCamp, n: number): void {
  pools[camp] = Math.max(0, pools[camp] + n);
}

/** Projette chaque réserve sur le `.advantage` de tous les combattants : les LECTEURS d'Avantage
 *  (`attackModifiers`/`baseTestMods`/`defenseModifiers`, magie) lisent alors la réserve du camp de
 *  l'acteur sans changer une ligne (l'Avantage individuel EST la réserve du camp). */
export function mirrorPools(pools: AdvantagePools, combatants: Combatant[]): void {
  for (const c of combatants) c.advantage = pools[advantageCampOf(c)];
}

// ── Table d'Avantage initial (AA l.4155-4167) ────────────────────────────────────────────────────
// « Seul le modificateur le plus élevé applicable à une circonstance donnée doit être accordé pour
//   cette circonstance. Les Avantages sont générés dans la réserve du camp qui en bénéficie. »

/** Niveau de Menace d'un camp (AA l.4159-4161) : dangereuse=1, très dangereuse=3, extrême=5. */
export type ThreatTier = 'dangereuse' | 'tresDangereuse' | 'extreme';
const THREAT_ADVANTAGE: Record<ThreatTier, number> = { dangereuse: 1, tresDangereuse: 3, extreme: 5 };

export interface InitialAdvantageCircumstances {
  /** Manœuvrabilité (monté, araignées dans les arbres…) : +2 au camp (l.4158). */
  maneuverability?: AdvantageCamp;
  /** Menace (ogre / manticore / dragon…) : +1/3/5 selon le palier (l.4159-4161). */
  threat?: { camp: AdvantageCamp; tier: ThreatTier };
  /** Surnombre (l.4162-4164) : +1 (>×1), +2 (≥×2), +3 (≥×3) au camp le plus nombreux. */
  outnumber?: { camp: AdvantageCamp; ratio: number };
  /** Surprise : un camp a déclenché un assaut inattendu → +2 (l.4165). */
  surprise?: AdvantageCamp;
  /** Terrain : couvert léger / position tenue = +1 ; couvert lourd / pont = +2 (l.4166-4167). */
  terrain?: { camp: AdvantageCamp; heavy: boolean };
}

/** Avantage de Surnombre (AA l.4162-4164) selon le ratio de combattants. */
export function outnumberAdvantage(ratio: number): number {
  if (ratio >= 3) return 3;
  if (ratio >= 2) return 2;
  if (ratio > 1) return 1;
  return 0;
}

/** Réserves de départ selon le positionnement tactique initial (AA l.4149-4167). Chaque circonstance
 *  crédite la réserve du camp qui en bénéficie. */
export function initialAdvantagePools(circ: InitialAdvantageCircumstances): AdvantagePools {
  const pools = emptyPools();
  if (circ.maneuverability) addToPool(pools, circ.maneuverability, 2);
  if (circ.threat) addToPool(pools, circ.threat.camp, THREAT_ADVANTAGE[circ.threat.tier]);
  if (circ.outnumber) addToPool(pools, circ.outnumber.camp, outnumberAdvantage(circ.outnumber.ratio));
  if (circ.surprise) addToPool(pools, circ.surprise, 2);
  if (circ.terrain) addToPool(pools, circ.terrain.camp, circ.terrain.heavy ? 2 : 1);
  return pools;
}

// ── Transfert de fin de Round (AA l.4146) ────────────────────────────────────────────────────────

/**
 * « PERDRE UN AVANTAGE » (AA l.4146) : à la fin du Round, le camp DOMINANT (le plus de combattants ;
 * à égalité, celui qui tient l'avantage tactique — non modélisable, on ne transfère pas) prend 1
 * Avantage à la réserve du camp défavorisé ; si celle-ci est vide, le dominant en gagne 1.
 *
 * `weightOf` pondère chaque combattant au décompte (Coude-à-coude variante AA « compte comme deux
 * combattants », l.4387) ; injecté par la couche state qui connaît les Talents. Mute `pools`.
 */
export function dominationTransfer(
  pools: AdvantagePools,
  combatants: Combatant[],
  active: (c: Combatant) => boolean,
  weightOf: (c: Combatant) => number,
): { dominant: AdvantageCamp | null } {
  let allies = 0;
  let foes = 0;
  for (const c of combatants) {
    if (!active(c)) continue;
    if (advantageCampOf(c) === 'allies') allies += weightOf(c);
    else foes += weightOf(c);
  }
  if (allies === foes) return { dominant: null }; // égalité → arbitrage tactique du MJ, non modélisé
  const dominant: AdvantageCamp = allies > foes ? 'allies' : 'foes';
  const weak: AdvantageCamp = dominant === 'allies' ? 'foes' : 'allies';
  if (pools[weak] > 0) {
    pools[weak] -= 1;
    pools[dominant] += 1;
  } else {
    pools[dominant] += 1;
  }
  return { dominant };
}
