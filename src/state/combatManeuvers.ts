/**
 * MANŒUVRES de créature (attaques naturelles activées — LDB 85) : ENTITÉS de 1ʳᵉ classe ÉDITABLES
 * (`maneuvers.json`, effets en GameOp). Ce module FEUILLE porte le RÉSOLVEUR GÉNÉRIQUE unique
 * (`resolveManeuver`) — il REMPLACE les 5 appliers par type. La GÉOMÉTRIE/portée/opposition est moteur
 * (règle 3, dérivée de `ManeuverDef.targeting` + `range`/`blast`) ; les Dégâts (`wounds`) et États sont
 * la DONNÉE (`ManeuverDef.effects`, GameOp) appliquée par `applyTriggeredEffects` aux cibles GAGNÉES.
 *
 * Convention « baril » : n'importe RIEN de `combatFlow` (qui le ré-exporte via `export * from
 * './combatManeuvers'`). Tout passe par les feuilles moteur/état (engine/*, ./path, ./footprint,
 * ./battleRng, ./combatLog, ./lineOfSight, ./triggeredEffects).
 *
 * Le jet d'ATTAQUANT (`rollManeuverAttacker`, CC/CT) est le SEUL influençable (Chance/Résilience de la
 * modale joueur) ; partagé par le flux joueur ET l'IA. Le DÉFENSEUR roule SON jet DANS le résolveur (jet
 * SUBI, montré au feed `evLines`) — pas de modale différée. `resolveManeuver` NE PPELLE PAS
 * `checkBattleOver` (l'appelant — store ou wrapper IA — le fait).
 */
import type { Get, Set as SetFn } from './flowTypes';
import type { BattleState } from './store';
import { Combatant, type Difficulty } from '../engine/types';
import { battleRng } from './battleRng';
import { evLines } from './combatLog';
import type { RNG } from '../engine/dice';
import { combatValue, defenseValue } from '../engine/combat';
import { rollTest, resolveOpposed, type TestResult } from '../engine/tests';
import { effectiveChar, bonus } from '../engine/characteristics';
import { isOutOfAction, applyZeroWounds } from '../engine/conditions';
import { hasTraitKey, isBestial } from '../engine/traits/dispatch';
import { creatureAttacks, ATTACK_LABEL, type AttackKind } from '../engine/creatureAttacks';
import type { ManeuverDef } from '../data';
import { sizeGap } from '../engine/size';
import { combatDistance } from './footprint';
import { chebyshev, type Pt } from './path';
import { smokeZone } from './lineOfSight';
import { applyTriggeredEffects } from './triggeredEffects';
import { canTakeAction } from '../engine/conditions';
import { bus, EVT } from './bus';

// ---------------------------------------------------------------------------
// Émission d'animation + énumération (déplacées de combatFlow)
// ---------------------------------------------------------------------------

/** Émet l'animation d'attaque d'une attaque SPÉCIALE de créature → AnimatedPlanToken joue la pose
 *  dédiée (creatureAttackPoses) ; les biped/spectraux jouent leur clip d'attaque générique. */
export function emitCreatureAttackAnim(attacker: Combatant, kind: string): void {
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: attacker.id, kind: 'creature', defense: 'none', result: { hit: true }, creatureAttack: kind });
}

/** Chiffre flottant de Dégâts sur le pion touché — MÊME canal FX que les attaques/sorts (`useCombatFx`
 *  écoute `ANIM_FLOAT`). Sans ça, les Dégâts d'une manœuvre n'apparaissaient QUE dans le journal. */
function floatDamage(tgt: Combatant, wl: number): void {
  if (wl > 0) bus.emit(EVT.ANIM_FLOAT, { to: tgt.id, text: `-${wl}`, kind: 'damage' });
}
/** Étiquette flottante d'ÉTAT/issue (Pétrifié, Esquivé…) sur le pion — feedback visuel de la manœuvre. */
function floatTag(tgt: Combatant, text: string): void {
  bus.emit(EVT.ANIM_FLOAT, { to: tgt.id, text, kind: 'condition' });
}

/** Cible de Piétinement valide pour `c` (LDB 85 l.320-321) : adversaire ADJACENT, encore actif et
 *  PLUS PETIT (`sizeGap >= 1`). `targetId` borne la recherche à une cible précise (clic du joueur). */
export function trampleTarget(battle: BattleState, c: Combatant, targetId?: string): Combatant | undefined {
  return battle.combatants.find(
    (t) =>
      (targetId ? t.id === targetId : true) &&
      t.kind !== c.kind &&
      !isOutOfAction(t) &&
      !!t.pos &&
      !!c.pos &&
      combatDistance(c, t) <= 1 &&
      sizeGap(c.size, t.size) >= 1,
  );
}

/** Icône FR par type de manœuvre (cosmétique hotbar). */
export const MANEUVER_ICON: Record<AttackKind, string> = {
  arme: '⚔️', morsure: '🦷', caudale: '🦎', cornes: '🐏', souffle: '🐉', vomi: '🤮',
  tentacules: '🐙', etreinte: '❄️', regard: '👁', langue: '👅', hurlement: '📢',
};

/** Manœuvre activable par le héros actif (descripteur uniforme rendu par la hotbar). `mode` dicte
 *  le ciblage : 'target' → on arme `battle.action` puis le clic-entité résout ; 'immediate' →
 *  résolution directe (zone/soi). `dispatch` route vers le store : 'trample'/'tentacle' (flux
 *  dédiés conservés), 'maneuver' (mêlée gratuite de trait, ciblée), 'area' (zone/action immédiate). */
export interface Maneuver {
  id: string;
  /** Type d'attaque de créature (absent pour Piétinement, qui dérive de la Taille). */
  kind?: AttackKind;
  label: string;
  icon: string;
  /** Coût en Avantage (affiché « · N Av »). */
  cost: number;
  mode: 'target' | 'immediate';
  dispatch: 'trample' | 'tentacle' | 'maneuver' | 'area';
}

/** Manœuvres de mêlée résolues comme un COUP D'ARME (via `pendingAttack` + `freeKind` →
 *  `applyAttackResult` : localisation/critique/FX/défense). Les autres manœuvres ciblées passent par
 *  `pendingManeuver` (résolution propre). Exporté : le store (`battleManeuver`) route là-dessus. */
export const MELEE_MANEUVER_KINDS: AttackKind[] = ['morsure', 'caudale', 'tentacules'];

/** Manœuvres que le héros ACTIF peut activer maintenant — agrège (dédupliquées) : (1) ses manœuvres
 *  de trait abordables & légales ; (2) Piétinement (Taille) ; (3) la mutation Tentacule. Aucune
 *  logique par créature en dur : tout vient de `creatureAttacks` (profils) + des prédicats existants. */
export function availableManeuvers(active: Combatant, battle: BattleState): Maneuver[] {
  if (active.kind !== 'hero') return [];
  const out: Maneuver[] = [];
  // (1) Manœuvres de trait. 'arme' = l'attaque-Action normale (pas une manœuvre) ; 'charge' (Cornes) =
  // gratuite uniquement à la Charge (auto) → exclues. Les manœuvres-Action (Étreinte) exigent l'Action.
  for (const a of creatureAttacks(active.traits ?? [])) {
    if (a.kind === 'arme' || a.trigger === 'charge') continue;
    // Avantage requis = coût RAW, ou 1 si l'Avantage est VARIABLE (Regard, +1 DR/Av — LDB 85 l.238).
    // Vaut pour les manœuvres-Action AUSSI (sinon Regard/Étreinte s'activeraient à 0 Avantage).
    const minAdv = a.advantageMode === 'variable' ? 1 : a.avantage;
    if (active.advantage < minAdv) continue;
    if (a.trigger === 'action' && (battle.acted || !canTakeAction(active))) continue;
    // Toute manœuvre se CIBLE au clic (victime, ou point d'impact de la zone pour Souffle/Vomi : LDB 85
    // « choisit une cible visible ») SAUF Hurlement (tous les ennemis à I mètres, l.135). 'maneuver' →
    // battleManeuver (pendingAttack pour la mêlée de trait, pendingManeuver pour les manœuvres spéciales).
    const immediate = a.kind === 'hurlement';
    out.push({
      id: a.kind, kind: a.kind, label: ATTACK_LABEL[a.kind], icon: MANEUVER_ICON[a.kind],
      cost: a.avantage, mode: immediate ? 'immediate' : 'target', dispatch: immediate ? 'area' : 'maneuver',
    });
  }
  // (2) Piétinement (Taille, LDB 85 l.320-321) : adversaire adjacent plus petit, ≥1 Avantage. Flux dédié.
  if (active.advantage >= 1 && trampleTarget(battle, active))
    out.push({ id: 'pietinement', label: 'Piétiner', icon: '🐾', cost: 1, mode: 'target', dispatch: 'trample' });
  // (3) Mutation Tentacule (arme `nat-tentacule`, LDB 85 l.354) : 1/tour, 0 Avantage, cible adjacente.
  if (
    !active.tentacleUsedThisTurn && active.weapons.some((w) => w.uid === 'nat-tentacule') && !!active.pos &&
    battle.combatants.some((c) => c.kind !== 'hero' && !isOutOfAction(c) && c.pos && combatDistance(active, c) <= 1)
  )
    out.push({ id: 'tentacule', label: 'Tentacule', icon: '🐙', cost: 0, mode: 'target', dispatch: 'tentacle' });
  // Déduplique par id (la mutation Tentacule et le trait Tentacules ne coexistent pas, mais garde-fou).
  return out.filter((m, i) => out.findIndex((n) => n.id === m.id) === i);
}

// ---------------------------------------------------------------------------
// JET de l'attaquant (le SEUL influençable) — partagé flux joueur + IA
// ---------------------------------------------------------------------------

/** Jet d'attaquant d'une manœuvre (LDB 85) : CC (mêlée) ou CT (distance/zone). `difficulty` porte le
 *  bonus d'attaquant propre à la manœuvre (Vomissement : Facile +40 à courte distance, LDB 85 l.376) ;
 *  Intermédiaire par défaut. Hurlement n'a PAS de jet d'attaquant (chaque cible teste sa Résistance)
 *  → `stat` absent : `rollManeuverAttacker` n'est jamais appelé pour lui. */
export function rollManeuverAttacker(attacker: Combatant, stat: 'CC' | 'CT', rng: RNG, difficulty: Difficulty = 'intermediaire'): TestResult {
  return rollTest(combatValue(attacker, stat === 'CC' ? 'melee' : 'ranged'), difficulty, rng);
}

/** Difficulté du jet d'ATTAQUANT propre à une manœuvre (seul le Vomissement dévie du +0 : Facile +40
 *  à courte distance, LDB 85 l.376). Le store/IA passe ce résultat à `rollManeuverAttacker`. */
export function maneuverAttackerDifficulty(kind: AttackKind): Difficulty {
  return kind === 'vomi' ? 'facile' : 'intermediaire';
}

// ---------------------------------------------------------------------------
// RÉSOLVEUR GÉNÉRIQUE — UNE fonction joue TOUTE manœuvre depuis sa `ManeuverDef`
// ---------------------------------------------------------------------------

/** Portée d'une manœuvre en MÈTRES depuis sa formule-chaîne (« Bonus d'Endurance + 20 mètres »,
 *  « Bonus de Force mètres », « 2 mètres »). PUR/moteur (règle 3) — géométrie de la manœuvre, les
 *  Dégâts/États restent data. Non chiffrable → null. */
function maneuverMeters(formula: string | undefined, ref: Combatant): number | null {
  if (!formula) return null;
  let m = 0;
  if (/bonus d[e'’]\s*endurance/i.test(formula)) m += bonus(effectiveChar(ref, 'E'));
  if (/bonus d[e'’]\s*force/i.test(formula)) m += bonus(effectiveChar(ref, 'F'));
  const plus = formula.match(/\+\s*(\d+)/);
  if (plus) m += parseInt(plus[1], 10);
  // « N mètres » nu (sans « Bonus de … ») : littéral.
  if (!/bonus/i.test(formula)) { const lit = formula.match(/(\d+)\s*m/i); if (lit) m = parseInt(lit[1], 10); }
  return m > 0 ? m : null;
}
/** Mètres → CASES (grille 2 m/case), min 1 ; null conservé. */
const tilesOf = (meters: number | null): number | null => (meters == null ? null : Math.max(1, Math.ceil(meters / 2)));

/** Jet du DÉFENSEUR opposé à la manœuvre, selon `def.defense`. `null` = pas d'opposition (Résistance/
 *  auto sans jet — le `test` op de l'effet roule lui-même, Hurlement). 'init' = Initiative (Regard) ;
 *  'auto' = meilleure réaction ; 'esquive'/'parade' = explicite. */
function defenderRoll(tgt: Combatant, defense: ManeuverDef['defense']): TestResult | null {
  if (!defense || defense === 'resist') return null;
  if (defense === 'init') return rollTest(effectiveChar(tgt, 'I'), 'intermediaire', battleRng()); // Regard, opposé à l'Initiative (LDB 85)
  const mode = defense === 'auto' ? bestDefenseMode(tgt) : defense;
  return rollTest(defenseValue(tgt, mode), 'intermediaire', battleRng());
}

/** Émet le flash de ZONE (empreinte centre ± rayon, clippée à la scène) — montre pourquoi plusieurs
 *  cibles sont affectées (R7). Émis pour TOUTE manœuvre de zone (ennemi/joueur). */
function emitAoe(get: Get, center: Pt, radius: number, kind: AttackKind, type?: string): void {
  const sc = get().scene;
  const tiles: Pt[] = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      const x = center.x + dx, y = center.y + dy;
      if (sc && x >= 0 && y >= 0 && x < sc.dimensions.w && y < sc.dimensions.h) tiles.push({ x, y });
    }
  bus.emit(EVT.ANIM_AOE, { tiles, kind, type });
}

/**
 * RÉSOLVEUR UNIQUE de manœuvre — joue ENTIÈREMENT une `ManeuverDef` (remplace applyMan{Area,Tongue,
 * Wail,Gaze,ChillGrasp}). `atk` = jet d'attaquant FIGÉ (influencé par la modale joueur ; null = pas de
 * jet, Hurlement), `spent` = Avantage dépensé, `chosenTarget` = clic joueur (victime mêlée/distance, ou
 * centre de zone). La GÉOMÉTRIE dérive de `def.targeting`+`range`/`blast` ; les effets AUTHORÉS
 * (`def.effects`, GameOp : Dégâts `wounds` + États) sont appliqués aux cibles GAGNÉES avec l'Indice
 * (`{indiceOf}`) et la marge (`ctx.sl` : slThreshold/valuePerSL). NE PPELLE PAS `checkBattleOver`.
 */
export function resolveManeuver(
  get: Get, set: SetFn, attacker: Combatant, def: ManeuverDef, indice: number, atk: TestResult | null, spent: number, chosenTarget?: Combatant,
): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - spent);
  const rng = battleRng();
  // Libellé de feed = celui de la manœuvre (« Souffle (Feu) ») s'il enrichit le geste, sinon le libellé
  // canonique du geste (`ATTACK_LABEL[def.kind]`). Aucune LOGIQUE sur le label — pur affichage.
  const lines: string[] = [`${attacker.name} déclenche ${def.label || ATTACK_LABEL[def.kind]} !`];
  emitCreatureAttackAnim(attacker, def.kind);
  const alive = (c: Combatant) => c.kind !== attacker.kind && !isOutOfAction(c) && !!c.pos;
  const nearest = (cands: Combatant[]) => cands.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c));

  /** Applique la manœuvre à UNE cible : jet du défenseur (selon `def.defense`), opposition, et — si
   *  l'attaquant gagne (ou pas d'opposition) — les effets AUTHORÉS (`def.effects`) avec `indice`/`margin`. */
  const hitOne = (tgt: Combatant): void => {
    const drow = defenderRoll(tgt, def.defense);
    let margin: number | undefined;
    if (drow) {
      const opp = resolveOpposed(atk ?? drow, drow);
      if (!opp.attackerWins) { lines.push(`${tgt.name} résiste.`); floatTag(tgt, def.defense === 'init' ? 'Résiste' : 'Esquive'); return; }
      // Marge = DR net du vainqueur (+Avantage dépensé pour les manœuvres à Avantage VARIABLE, Regard l.238).
      margin = opp.netSL + (def.advantageMode === 'variable' ? spent : 0);
    }
    const before = tgt.wounds.current;
    lines.push(...applyTriggeredEffects(get, attacker, def.effects ?? [], 'onHit', { victim: tgt, margin, indice, rng }));
    const wl = before - tgt.wounds.current;
    if (wl > 0) floatDamage(tgt, wl);
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  };

  if (def.targeting === 'zone') {
    const rangeTiles = tilesOf(maneuverMeters(def.range, attacker)) ?? Math.max(1, Math.ceil(bonus(effectiveChar(attacker, 'E')) / 2));
    const foes = battle.combatants.filter((c) => alive(c) && chebyshev(attacker.pos!, c.pos!) <= rangeTiles);
    const center = chosenTarget && alive(chosenTarget) && chebyshev(attacker.pos!, chosenTarget.pos!) <= rangeTiles
      ? chosenTarget : foes.length ? nearest(foes) : null;
    if (!center) { set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } }); return; }
    // Rayon de Souffle : `blast` « Bonus de Force mètres » → BF de la CIBLE (RAW l.251) ; Vomi « 2 mètres » → 1 case.
    const blast = /force/i.test(def.blast ?? '') ? Math.max(1, Math.ceil(bonus(effectiveChar(center, 'F')) / 2)) : (tilesOf(maneuverMeters(def.blast, attacker)) ?? 1);
    emitAoe(get, center.pos!, blast, def.kind, def.label);
    const affected = battle.combatants.filter((c) => alive(c) && chebyshev(center.pos!, c.pos!) <= blast);
    for (const tgt of affected) hitOne(tgt);
    // Fumée (souffle-fumee) : la zone bloque les Lignes de vue pendant BE Rounds — GÉOMÉTRIE moteur (pas un GameOp).
    if (def.id === 'souffle-fumee') {
      const dur = Math.max(1, bonus(effectiveChar(attacker, 'E')));
      const tiles = smokeZone(attacker.pos!, center.pos!, blast);
      const zones = [...(get().battle!.zones ?? []), { label: 'Fumée', tiles, rounds: dur, blocksLoS: true }];
      lines.push(`La zone se remplit de fumée — Lignes de vue bloquées ${dur} Round(s).`);
      set({ battle: { ...get().battle!, zones } });
    }
  } else if (def.targeting === 'allFoes') {
    // Hurlement (l.135) : tous les ennemis VIVANTS (≠ Mort-vivant) à Initiative mètres — filtre de Groupe moteur.
    const radius = Math.max(1, Math.ceil(effectiveChar(attacker, 'I') / 2));
    const living = battle.combatants.filter((c) => alive(c) && chebyshev(attacker.pos!, c.pos!) <= radius && !hasTraitKey(c.traits, 'mort-vivant'));
    emitAoe(get, attacker.pos, radius, def.kind, def.label);
    for (const tgt of living) hitOne(tgt);
  } else {
    // melee / ranged : cible unique (clic joueur, ou la plus proche pour l'IA/auto).
    const foes = battle.combatants.filter(alive);
    const tgt = chosenTarget && alive(chosenTarget) ? chosenTarget : foes.length ? nearest(foes) : null;
    if (tgt) hitOne(tgt);
  }
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Le défenseur choisit sa meilleure réaction : Parade (Corps à corps) ou Esquive (Agilité + avances,
 *  pénalité d'Encombrement incluse) — la plus haute valeur. Vit ICI (feuille) et est ré-exporté par
 *  `combatFlow` (baril) : SOURCE UNIQUE, importée par combatFlow/rollFlows sans cycle.
 *  Bestial (LDB 85 l.338) : « En défense, elle peut seulement utiliser la Compétence Esquive. » */
export function bestDefenseMode(defender: Combatant): 'parade' | 'esquive' {
  if (isBestial(defender.traits)) return 'esquive';
  return defenseValue(defender, 'esquive') > defenseValue(defender, 'parade') ? 'esquive' : 'parade';
}
