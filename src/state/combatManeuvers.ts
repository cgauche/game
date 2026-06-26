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
import { isVehicle } from '../engine/vehicle';
import { rollTest, resolveOpposed, type TestResult } from '../engine/tests';
import { effectiveChar, bonus } from '../engine/characteristics';
import { isOutOfAction, applyZeroWounds } from '../engine/conditions';
import { hasTraitKey, isBestial } from '../engine/traits/dispatch';
import { isFrenzied } from '../engine/psychology';
import { creatureAttacks, ATTACK_LABEL, type AttackKind } from '../engine/creatureAttacks';
import { findTalentById, findPsychologyById, type ManeuverDef, type ManeuverMeasure } from '../data';
import { sizeGap } from '../engine/size';
import { combatDistance } from './footprint';
import { chebyshev, type Pt } from './path';
import { combatantsWithinRadius } from './combatGeometry';
import { smokeZone } from './lineOfSight';
import { applyTriggeredEffects } from './triggeredEffects';
import { canTakeAction } from '../engine/conditions';
import { bus, EVT } from './bus';
import { t } from '../i18n';

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

/** Manœuvres de mêlée résolues comme un COUP D'ARME (via `pendingAttack` + `freeKind` →
 *  `applyAttackResult` : localisation/critique/FX/défense). Les autres (zone) passent par `pendingManeuver`
 *  (résolution propre). Classifieur partagé : `availableAttacks` (targeting melee/zone) + le survol. */
export const MELEE_MANEUVER_KINDS: AttackKind[] = ['morsure', 'caudale', 'tentacules'];

/** ATTAQUE activable par le héros actif — descripteur UNIFIÉ (arme tenue + attaques gratuites/zone),
 *  SOURCE UNIQUE de la liste d'attaques (hotbar) ET de la résolution (`battleClickEntity`). `targeting`
 *  pilote la résolution : 'melee' → approche-puis-frappe (attackPlan + pendingAttack) ; 'zone' →
 *  resolveManeuver (pendingManeuver) ; 'trample' → battleTrample. `cost.action` = coûte l'Action (Arme),
 *  sinon gratuite. `reach`/`forceMelee` = Allonge de l'attaque (gratuites de mêlée = 1 ; Arme absente →
 *  attackPlan lit l'arme tenue). `freeKind`/`weaponUid` = charge utile de frappe (mêlée). */
export interface AttackOption {
  id: string;
  kind?: AttackKind;
  label: string;
  icon: string;
  targeting: 'melee' | 'zone' | 'trample';
  reach?: number;
  forceMelee?: boolean;
  cost: { action: boolean; advantage: number };
  weaponUid?: string;
  freeKind?: AttackKind;
  def?: ManeuverDef;
  advantageMode?: 'fixed' | 'variable' | 'all';
  /** Pertinence de BASE (poids éditable, depuis `ManeuverDef.priority`) — lue par le scoreur d'attaque
   *  (clic droit joueur + décision IA). Défaut 1 ; combinée aux bonus situationnels AUTO. */
  priority?: number;
}

/** Une attaque d'Arme GRATUITE est-elle disponible ce Round ? Lue de la DONNÉE : un talent (Frénésie, LDB 21
 *  l.34) porte `passive: grantFreeAttack{when:'available', activeIf:'frenzied'}` → l'attaque d'Arme reste
 *  gratuite (Action préservée). Plafond /Round = niveau du talent (`times`), compté via
 *  `freeAttacksThisTurn['arme']` (reset de tour). GÉNÉRIQUE : tout talent du même genre s'ajoute en donnée,
 *  sans code. Lue par `availableAttacks` + ActionBar/IsoStage/turnEconomy (l'affordance « attaque libre »). */
export const hasFreeWeaponAttack = (c: Combatant): boolean => {
  const used = c.freeAttacksThisTurn?.['arme'] ?? 0;
  // Sources DONNÉES d'une attaque d'Arme gratuite « disponible » : Talents ET États PSY. L'état Frénésie
  // porte LUI-MÊME `grantFreeAttack` (LDB 21 l.34) → HÉROS comme ENNEMI, MÊME donnée (pas de jaloux).
  for (const t of c.talents ?? [])
    for (const op of findTalentById(t.talentId)?.passive ?? [])
      if (op.op === 'grantFreeAttack' && op.when === 'available' && (op.activeIf !== 'frenzied' || isFrenzied(c)) && used < (t.times ?? 1))
        return true;
  for (const p of c.psychState ?? [])
    for (const op of findPsychologyById(p.type)?.passive ?? [])
      if (op.op === 'grantFreeAttack' && op.when === 'available' && used < 1)
        return true;
  return false;
};

/** Attaques que le héros ACTIF peut lancer MAINTENANT — UNE liste à coût (Arme d'abord, puis gratuites/
 *  zone abordables, Piétinement, mutation Tentacule). Subsume l'attaque d'arme implicite ET la garde de
 *  Frénésie. Source : `active.weapons` (Arme) + `creatureAttacks` (gratuites) + les prédicats existants. */
export function availableAttacks(active: Combatant, battle: BattleState): AttackOption[] {
  // Un NAVIRE allié (`kind:'hero'`, MDG ch.13) n'a PAS d'attaque-arme PERSONNELLE (`active.weapons` vide → l'option
  // 'arme' ferait planter `attackPlan` sur `weapon.type`). Ses « attaques » sont la Manœuvre (HUD navire) et la Bordée
  // via les postes servis par l'équipage (combattants distincts) — jamais une attaque de mêlée de la coque.
  if (active.kind !== 'hero' || isVehicle(active)) return [];
  const out: AttackOption[] = [];
  // (0) ARME du Set actif — attaque-Action de base ET attaque CC GRATUITE de Frénésie (l.34), tant que
  //     l'Action OU la libre de Frénésie est dispo. `reach` absent → attackPlan lit l'arme tenue (Allonge,
  //     branche distance pour une arme à distance).
  const freeWeapon = hasFreeWeaponAttack(active);
  if ((!battle.acted && canTakeAction(active)) || freeWeapon)
    out.push({ id: 'arme', kind: 'arme', label: ATTACK_LABEL.arme, icon: MANEUVER_ICON.arme, targeting: 'melee', cost: { action: !freeWeapon, advantage: 0 } });
  // (1) Attaques de trait : gratuites de MÊLÉE (Morsure/Caudale/Tentacules) ou SPÉCIALES de zone (Souffle/
  //     Vomi/Langue/Regard/Étreinte/Hurlement). 'arme' (ci-dessus) et 'charge' (Cornes, auto) exclues.
  //     Mêmes prédicats d'abordabilité (Avantage RAW ou 1 si variable ; Action si trigger='action').
  for (const a of creatureAttacks(active.traits ?? [])) {
    if (a.kind === 'arme' || a.trigger === 'charge') continue;
    const minAdv = a.advantageMode === 'variable' ? 1 : a.avantage;
    if (active.advantage < minAdv) continue;
    if (a.trigger === 'action' && (battle.acted || !canTakeAction(active))) continue;
    // RAW LDB 85 l.171 : « pendant son tour, la créature peut effectuer UNE Attaque gratuite » → 1/tour ;
    // exception « une Attaque gratuite par tentacule » (l.355) → `count`/tour. Plafond DÉRIVÉ de la donnée
    // (`perTentacle`/`count`), compteur partagé `freeAttacksThisTurn` — pas de limite par type en dur.
    if (a.trigger === 'free' && (active.freeAttacksThisTurn?.[a.kind] ?? 0) >= (a.perTentacle ? (a.count ?? 1) : 1)) continue;
    const melee = MELEE_MANEUVER_KINDS.includes(a.kind);
    out.push({
      id: a.kind, kind: a.kind, label: ATTACK_LABEL[a.kind], icon: MANEUVER_ICON[a.kind],
      targeting: melee ? 'melee' : 'zone',
      ...(melee ? { reach: 1, forceMelee: true, freeKind: a.kind } : { def: a.def, advantageMode: a.advantageMode }),
      cost: { action: a.trigger === 'action', advantage: a.avantage },
      priority: a.def?.priority, // poids éditable (maneuvers.json) lu par le scoreur
    });
  }
  // (2) Piétinement (Taille, LDB 85 l.320-321) : adversaire adjacent plus petit, ≥1 Avantage. Flux dédié.
  if (active.advantage >= 1 && trampleTarget(battle, active))
    out.push({ id: 'pietinement', label: 'Piétiner', icon: '🐾', targeting: 'trample', cost: { action: false, advantage: 1 } });
  // (3) Mutation Tentacule (arme `nat-tentacule`, LDB 85 l.354) : 1/tour (compteur partagé), 0 Avantage. Comme
  //     toute attaque de mêlée, elle s'APPROCHE (charge/rejoindre) → dispo dès qu'un ennemi existe (adjacence non requise).
  if (
    (active.freeAttacksThisTurn?.['tentacules'] ?? 0) < 1 && active.weapons.some((w) => w.uid === 'nat-tentacule') && !!active.pos &&
    battle.combatants.some((c) => c.kind !== 'hero' && !isOutOfAction(c) && c.pos)
  )
    out.push({ id: 'tentacule', kind: 'tentacules', label: 'Tentacule', icon: '🐙', targeting: 'melee', reach: 1, forceMelee: true, weaponUid: 'nat-tentacule', freeKind: 'tentacules', cost: { action: false, advantage: 0 } });
  // (4) Poste d'artillerie SERVI (`mannedPoste`, MDG ch.12-13) : « servir la pièce » = attaque DÉDIÉE portant
  //     l'arme du poste (`weaponUid` → canon ÉPINGLÉ, même si le servant porte une arme perso de mêlée pour
  //     l'abordage). Arc + portée INTRINSÈQUES (firedAttackBlock garde déjà l'arc de `w.mountSide`). Coûte
  //     l'Action ; `targeting:'melee'` = chemin approche-puis-frappe commun (une arme à distance y tire en
  //     place, comme l'option 'arme'). KIND-AGNOSTIQUE côté donnée (l'IA ennemie a son propre chemin).
  if (active.mannedPoste && !battle.acted && canTakeAction(active)) {
    const w = active.weapons.find((x) => x.uid === active.mannedPoste!.item.uid);
    if (w) out.push({ id: 'poste', label: `Servir ${w.name}`, icon: '💥', targeting: 'melee', weaponUid: w.uid, cost: { action: true, advantage: 0 } });
  }
  // Déduplique par id (la mutation Tentacule et le trait Tentacules ne coexistent pas, mais garde-fou).
  return out.filter((m, i) => out.findIndex((n) => n.id === m.id) === i);
}

/** Résout l'`AttackOption` à exécuter/prévisualiser : clic droit = `forceId` (première abordable) ; sinon
 *  l'attaque ARMÉE (`selectedAttack`, défaut 'arme', repli sur 'arme' si périmée). `undefined` = mode
 *  non-attaque (cast/heal/focus/…) ou aucune attaque abordable. SOURCE UNIQUE partagée par le clic (store)
 *  et le survol (targeting). */
export function selectedAttackOption(active: Combatant, battle: BattleState, forceId?: string): AttackOption | undefined {
  if (battle.action !== null) return undefined; // l'attaque ne vit qu'en mode neutre (cast/heal/… = leurs propres modes)
  const opts = availableAttacks(active, battle);
  if (forceId) return opts.find((o) => o.id === forceId) ?? opts[0]; // clic droit = première abordable (repli)
  const want = battle.selectedAttack ?? 'arme';
  return opts.find((o) => o.id === want) ?? opts.find((o) => o.id === 'arme'); // armée, repli sur l'Arme si périmée
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

/** Géométrie d'une manœuvre en MÈTRES depuis sa mesure STRUCTURÉE (`{bonusOf?, plus?}`). `ref` = référent
 *  du Bonus (Attaquant pour la Portée, Cible au centre pour le Souffle — RAW l.251). PUR/moteur (règle 3) ;
 *  Dégâts/États restent data (`GameOp`). Vide ou ≤ 0 → null. Zéro regex (donnée déjà structurée). */
function measureMeters(spec: ManeuverMeasure | undefined, ref: Combatant): number | null {
  if (!spec) return null;
  const m = (spec.bonusOf ? bonus(effectiveChar(ref, spec.bonusOf)) : 0) + (spec.plus ?? 0);
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
  const lines: string[] = [t('manv.trigger', { name: attacker.name, label: def.label || ATTACK_LABEL[def.kind] })];
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
      if (!opp.attackerWins) { lines.push(t('manv.resists', { name: tgt.name })); floatTag(tgt, def.defense === 'init' ? t('fx.resists') : t('fx.dodge')); return; }
      // Marge = DR net du vainqueur (+Avantage dépensé pour les manœuvres à Avantage VARIABLE, Regard l.238).
      margin = opp.netSL + (def.advantageMode === 'variable' ? spent : 0);
    }
    const before = tgt.wounds.current;
    lines.push(...applyTriggeredEffects(get, attacker, def.effects ?? [], 'onHit', { victim: tgt, margin, indice, rng, set }));
    const wl = before - tgt.wounds.current;
    if (wl > 0) floatDamage(tgt, wl);
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  };

  if (def.targeting === 'zone') {
    const rangeTiles = tilesOf(measureMeters(def.range, attacker)) ?? Math.max(1, Math.ceil(bonus(effectiveChar(attacker, 'E')) / 2));
    const foes = combatantsWithinRadius(attacker.pos!, rangeTiles, battle.combatants, alive);
    const center = chosenTarget && alive(chosenTarget) && chebyshev(attacker.pos!, chosenTarget.pos!) <= rangeTiles
      ? chosenTarget : foes[0] ?? null; // `foes` est trié par distance (combatantsWithinRadius) → le plus proche d'abord
    if (!center) { set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } }); return; }
    // Rayon de Souffle : `blast` résolu contre la CIBLE au centre (« Bonus de Force » → BF de la cible, RAW l.251 ;
    // Vomi « 2 mètres » → littéral, 1 case). Plus de regex `/force/i` — la mesure structurée porte le référent.
    const blast = tilesOf(measureMeters(def.blast, center)) ?? 1;
    emitAoe(get, center.pos!, blast, def.kind, def.label);
    const affected = combatantsWithinRadius(center.pos!, blast, battle.combatants, alive);
    for (const tgt of affected) hitOne(tgt);
    // Fumée (souffle-fumee) : la zone bloque les Lignes de vue pendant BE Rounds — GÉOMÉTRIE moteur (pas un GameOp).
    if (def.id === 'souffle-fumee') {
      const dur = Math.max(1, bonus(effectiveChar(attacker, 'E')));
      const tiles = smokeZone(attacker.pos!, center.pos!, blast);
      const zones = [...(get().battle!.zones ?? []), { label: t('manv.smokeZone'), tiles, rounds: dur, blocksLoS: true }];
      lines.push(t('manv.smoke', { dur }));
      set({ battle: { ...get().battle!, zones } });
    }
  } else if (def.targeting === 'allFoes') {
    // Hurlement (l.135) : tous les ennemis VIVANTS (≠ Mort-vivant) à Initiative mètres — filtre de Groupe moteur.
    const radius = Math.max(1, Math.ceil(effectiveChar(attacker, 'I') / 2));
    const living = combatantsWithinRadius(attacker.pos!, radius, battle.combatants, (c) => alive(c) && !hasTraitKey(c.traits, 'mort-vivant'));
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
