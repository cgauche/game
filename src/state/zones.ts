/**
 * Zones persistantes de bataille (Jalon 2.6 L11) — généralisation de l'ancien `battle.smoke[]` :
 * une zone = des cases + un TTL en Rounds + des effets optionnels :
 *  - `blocksLoS`   : bloque la Ligne de Vue (fumée du Souffle (Fumée), RAW LDB 85) ;
 *  - `onCross`     : appliqué à quiconque TRAVERSE une case de la zone en se déplaçant
 *                    (Mur de feu, LDB 47 : « Quiconque traverse le mur de feu ») ;
 *  - `perRound`    : appliqué à quiconque est DANS la zone au franchissement de Round
 *                    (Grands feux d'U'Zhul, LDB 47 : « au début d'un Round »).
 * Le TTL est décrémenté à chaque frontière de Round (dissipation à 0) — même cadence que
 * l'ancienne fumée. La TÉLÉPORTATION ne « traverse » pas (apparition — exempte d'onCross).
 */
import type { Pt } from './path';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import { Formula, GameOp, resolveFormula, applyOps } from '../engine/ops';
import type { FlowTest } from '../engine/flowCore';
import type { ZoneArea, SceneEffectZone } from './scene';
import { isOutOfAction } from '../engine/conditions';
import { isProfane } from '../engine/corruption';
import { groupMatch } from '../engine/groups';

export interface BattleZone {
  /** id STABLE de la zone authoree (`SceneEffectZone.id`), propage par `sceneZonesToBattle` — identite
   *  de la zone la ou `label` est de l'AFFICHAGE (#598). Absent = zone creee au RUNTIME (op `zone`
   *  d'un sort) : les consommateurs retombent sur la position dans `battle.zones`, jamais sur le libelle. */
  id?: string;
  label: string;
  tiles: Pt[];
  /** Rounds restants (décrément à la frontière de Round, dissipation à 0). */
  rounds: number;
  /** Zone PERMANENTE (piège/hasard authoré dans la scène) : ignore le TTL — ne se dissipe jamais. */
  permanent?: boolean;
  blocksLoS?: boolean;
  /** Effets appliqués par `applyOps` (vocabulaire unique) : `onCross` à la traversée, `perRound` au
   *  franchissement de Round pour les occupants. Mitigation/État/soin = des `GameOp` (cf. `op:'zone'`). */
  onCross?: GameOp[];
  perRound?: GameOp[];
  /** GATE de Test à la TRAVERSÉE (Forêt d'épines, LDB 48 l.749 : « quiconque tente de traverser… sans
   *  posséder le Talent Magie des Arcanes (Vie) doit réussir un Test d'Agilité Difficile »). Résolu
   *  CADENCE-AWARE (`applyZoneCrossings`/`routeTriggeredTest`) AVANT `onCross` : succès → `onCross`
   *  sauté ; `gate` de `FlowTest` porte l'exemption (Condition `not/has talent`) ; absent → `onCross`
   *  inconditionnel (Mur de feu). */
  crossTest?: FlowTest;
  /** BARRIÈRE : les cases sont infranchissables pour les créatures gatées (cf. `SceneEffectZone.barrier`) —
   *  injectées dans `occupied()`, donc respectées par TOUT déplacement (joueur, IA, poussée, téléport). */
  barrier?: { blockGroups?: string[] };
  /** GATE de la zone (barrière + `perRound`) restreint aux créatures PROFANES (Protection de Phâ, LDB 48
   *  p.249 : « les créatures profanes ne peuvent pas entrer… celles déjà à l'intérieur gagnent Brisé »). */
  gate?: 'profane';
  /** Aucun gain de Corruption pour les occupants tant que la zone est active (Protection de Phâ). */
  noCorruption?: boolean;
  /** Référent des formules de l'effet (« votre BFM » = le lanceur) — résolu à l'application. */
  casterId?: string;
}

/** Le combattant `mover` est-il GATÉ par la zone `z` (ciblé par sa barrière / son `perRound`) ? `gate:
 *  'profane'` → seulement les profanes (LDB 48). Sans gate → tout le monde. */
const zoneTargets = (z: BattleZone, mover: Combatant): boolean => z.gate !== 'profane' || isProfane(mover);

export const zoneCovers = (z: BattleZone, p: Pt): boolean => z.tiles.some((t) => t.x === p.x && t.y === p.y);

/** Cases bloquant la Ligne de Vue (toutes zones opaques confondues). */
export const losBlockingTiles = (zones: BattleZone[] | undefined): Pt[] =>
  (zones ?? []).filter((z) => z.blocksLoS).flatMap((z) => z.tiles);

/** Disque de Chebyshev (ZdE « rayon N mètres » — 1 case = 2 m, cohérent applyAreaAttack). */
export function discTiles(center: Pt, radiusTiles: number): Pt[] {
  const out: Pt[] = [];
  for (let dy = -radiusTiles; dy <= radiusTiles; dy++)
    for (let dx = -radiusTiles; dx <= radiusTiles; dx++) out.push({ x: center.x + dx, y: center.y + dy });
  return out;
}

/** Cases couvertes par une aire authorée (rectangle plein ou disque de Chebyshev). */
export function zoneAreaTiles(area: ZoneArea): Pt[] {
  if (area.kind === 'disc') return discTiles({ x: area.cx, y: area.cy }, Math.max(0, area.radius));
  const out: Pt[] = [];
  for (let y = area.y; y < area.y + area.h; y++)
    for (let x = area.x; x < area.x + area.w; x++) out.push({ x, y });
  return out;
}

/** Convertit les zones d'effet AUTHORÉES d'une scène en `BattleZone` PERMANENTES (semées dans
 *  `battle.zones` au début du combat) — réutilise le runtime des zones de Sort (crossZones/
 *  zonesRoundTick/losBlockingTiles). `rounds` est ignoré (permanent) mais posé à 1 pour le typage. */
export function sceneZonesToBattle(zones: SceneEffectZone[] | undefined): BattleZone[] {
  return (zones ?? []).map((z) => ({
    id: z.id,
    label: z.label,
    tiles: zoneAreaTiles(z.area),
    rounds: 1,
    permanent: true,
    blocksLoS: z.blocksLoS,
    onCross: z.onCross,
    perRound: z.perRound,
    barrier: z.barrier,
    crossTest: z.crossTest,
  }));
}

/** Cases d'un combattant `mover` BLOQUÉES par les barrières actives (`battle.zones[].barrier`) :
 *  une barrière sans `blockGroups` bloque tout le monde ; sinon seulement les Groupes correspondants
 *  (groupMatch). `moverGroups` = Groupes du mover (vide si inconnu → on bloque par prudence quand un
 *  filtre existe). Injecté dans `occupied()` → respecté par TOUT déplacement. */
export function barrierTilesFor(zones: BattleZone[] | undefined, mover: Combatant | undefined): Pt[] {
  const out: Pt[] = [];
  for (const z of zones ?? []) {
    if (!z.barrier) continue;
    if (z.gate && (!mover || !zoneTargets(z, mover))) continue; // barrière sacrée : ne bloque que les profanes
    const filter = z.barrier.blockGroups;
    const blocks = !filter?.length || (mover?.groups ? filter.some((g) => groupMatch(g, mover.groups!)) : true);
    if (blocks) out.push(...z.tiles);
  }
  return out;
}

/** Cases d'un MUR (Mur de feu, LDB 47 : « épais de 1 mètre ») : segment PERPENDICULAIRE à l'axe
 *  lanceur→centre, centré sur `center`, de `lengthTiles` cases (épaisseur 1 case). Lanceur sur
 *  le centre (axe nul) : mur horizontal par défaut. */
export function wallTiles(from: Pt, center: Pt, lengthTiles: number): Pt[] {
  const ax = Math.sign(center.x - from.x);
  const ay = Math.sign(center.y - from.y);
  const perp = ax === 0 && ay === 0 ? { x: 1, y: 0 } : { x: -ay, y: ax };
  const out: Pt[] = [];
  const back = Math.floor((lengthTiles - 1) / 2);
  const fwd = Math.ceil((lengthTiles - 1) / 2);
  for (let k = -back; k <= fwd; k++) out.push({ x: center.x + k * perp.x, y: center.y + k * perp.y });
  return out;
}

/** TTL : décrémente les zones temporaires d'un Round, dissipe celles à 0. Les zones PERMANENTES
 *  (pièges authorés) sont conservées telles quelles — pas de décompte, pas de dissipation. */
export function decayZones(zones: BattleZone[] | undefined): { zones: BattleZone[]; log: string[] } {
  const next = (zones ?? []).map((z) => (z.permanent ? z : { ...z, rounds: z.rounds - 1 }));
  const log = next.filter((z) => !z.permanent && z.rounds <= 0).map((z) => `${z.label} se dissipe.`);
  return { zones: next.filter((z) => z.permanent || z.rounds > 0), log };
}

/** Traversée : applique l'`onCross` de chaque zone dont une case du CHEMIN fait partie —
 *  UNE application par zone et par déplacement (« quiconque traverse le mur »). Zones GATÉES par
 *  un `crossTest` (Forêt d'épines) sont SAUTÉES ici (fonction PURE, sans accès get/set) — résolues
 *  cadence-aware par `applyZoneCrossings` (combatGeometry.ts), seule couture qui les traite. */
export function crossZones(
  zones: BattleZone[] | undefined,
  mover: Combatant,
  path: Pt[],
  resolveCaster: (id?: string) => Combatant | undefined,
  rng: RNG,
): string[] {
  const lines: string[] = [];
  if (mover.dead || isOutOfAction(mover)) return lines;
  for (const z of zones ?? []) {
    if (!z.onCross?.length || z.crossTest) continue;
    if (!path.some((p) => zoneCovers(z, p))) continue;
    lines.push(`${mover.name} traverse ${z.label} !`);
    lines.push(...applyOps(mover, z.onCross, { caster: resolveCaster(z.casterId), rng, label: z.label }));
  }
  return lines;
}

/** Franchissement de Round : applique le `perRound` de chaque zone à chaque combattant DANS la
 *  zone (« Quiconque se trouve dans la Zone d'Effet au début d'un Round »). Chaque ligne porte
 *  son COMBATTANT — l'entretien de Round partitionne héros (modale) / ennemis (journal seul). */
export function zonesRoundTick(
  zones: BattleZone[] | undefined,
  combatants: Combatant[],
  rng: RNG,
): { line: string; combatant: Combatant }[] {
  const out: { line: string; combatant: Combatant }[] = [];
  for (const z of zones ?? []) {
    if (!z.perRound?.length) continue;
    const caster = z.casterId ? combatants.find((c) => c.id === z.casterId) : undefined;
    for (const c of combatants) {
      if (!c.pos || c.dead || isOutOfAction(c)) continue;
      if (!zoneCovers(z, c.pos) || !zoneTargets(z, c)) continue; // `gate:'profane'` → seuls les profanes subissent
      for (const line of applyOps(c, z.perRound, { caster, rng, label: z.label })) out.push({ line, combatant: c });
    }
  }
  return out;
}

/** Résout une formule de longueur/rayon en MÈTRES vers des cases (1 case = 2 m, min 1). */
export function metersToTiles(meters: number): number {
  return Math.max(1, Math.ceil(meters / 2));
}

/** Longueur d'un mur en mètres : base + extension « +X m par +N DR » (Mur de feu, LDB 47). */
export function resolveZoneMeters(
  base: Formula,
  perSL: { every: number; metersFormula: Formula } | undefined,
  ref: Combatant,
  sl: number,
  rng: RNG,
): number {
  let m = Math.max(0, resolveFormula(base, ref, rng));
  if (perSL) m += Math.floor(Math.max(0, sl) / Math.max(1, perSL.every)) * Math.max(0, resolveFormula(perSL.metersFormula, ref, rng));
  return m;
}
