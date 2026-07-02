/**
 * Couche de SURBRILLANCES statiques du combat (grilles W×H LOURDES, memoïsées par IsoStage — figées
 * hors changement d'état de combat) : assemble les vérités du STORE (portées, cibles éligibles,
 * candidats du mode de ciblage) en `HighlightsView`, appelle le builder pur (`buildHighlights`),
 * projette par le backend affine, et INTERCALE l'aperçu tap-1 (battle.preview) entre les grilles de
 * portée et le reste — l'ordre d'empilement historique des ex æquo de profondeur.
 * Les éléments qui SUIVENT le token qui glisse (tether, halo de l'actif) restent à la frame
 * (cf. stage/tokens.dynamicHighlightObjs).
 */
import type { GameState, BattleState, PendingAttack, PendingCleave, PendingDualStrike, PendingCast } from '../../state/store';
import { Scene } from '../../state/scene';
import { Combatant } from '../../engine/types';
import { crowdEligible, eligibleAttackTargetIds, displayedReach, computeRunReach, hasFreeWeaponAttack } from '../../state/combatFlow';
import { currentTargetingMode } from '../../state/targetingModes';
import { footprintN, footprintTiles } from '../../state/footprint';
import { mountOf } from '../../state/mount';
import { Dims, depth, diamondPath } from '../iso';
import { buildHighlights, type HighlightsView } from '../builders/highlights';
import { highlightDepth, highlightJsx } from '../backends/affineHighlights';
import { movePreviewEls } from './movePreview';
import type { Pt } from '../../state/path';
import type { StageObj } from './objs';

export interface HighlightOpts {
  myTurn: boolean;
  pendingAttack: PendingAttack | null;
  pendingCleave: PendingCleave | null;
  pendingDualStrike: PendingDualStrike | null;
  pendingCast: PendingCast | null;
}

export function combatHighlightObjs(
  get: () => GameState,
  scene: Scene,
  battle: BattleState,
  dims: Dims,
  liftAt: (x: number, y: number, z?: number) => number,
  opts: HighlightOpts,
): StageObj[] {
  const { myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast } = opts;
  const activeC = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
  // COOP : le tour du héros d'un AUTRE joueur s'affiche comme un tour ennemi — aucune affordance
  // (ni grille de déplacement, ni anneaux de cible, ni aperçu) ; teintes d'équipe/zones restent.
  // (Plus AUCUN indicateur de distance au sol — la portée se lit au survol : réticule = cible valide.)
  const view: HighlightsView = {
    myTurn,
    walkReach: myTurn ? displayedReach(get) : new Map<string, number>(),
    runReach: myTurn ? computeRunReach(get) : new Map<string, number>(),
    activeId: activeC?.id ?? null,
    // Anneaux d'attaque (R4) : en mode neutre (attaque implicite), tant que l'Action est disponible
    // (ou attaque libre de Frénésie).
    eligibleIds:
      myTurn && battle.action === null && activeC?.kind === 'hero' && !pendingAttack && (!battle.acted || hasFreeWeaponAttack(activeC))
        ? eligibleAttackTargetIds(get)
        : null,
    crowdIds: (() => {
      if (!pendingAttack?.intoCrowd) return null;
      const atk = battle.combatants.find((c) => c.id === pendingAttack.attackerId);
      const tgt = battle.combatants.find((c) => c.id === pendingAttack.targetId);
      return atk && tgt ? new Set(crowdEligible(battle, atk, tgt).map((v) => v.id)) : null;
    })(),
    // Cibles cliquables du MODE de ciblage courant (targetingModes → MÊME source que réticule/clic) :
    // Soin (alliés → anneau AMI) ; flux différés (ennemis → anneau hostile, déjà cochés en vert).
    candidates: (() => {
      if (!myTurn || pendingAttack || !(pendingCleave || pendingDualStrike || pendingCast?.pickingTargets || battle.action === 'heal')) return null;
      const active = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
      const tmode = currentTargetingMode(get);
      const cands = active ? tmode.candidates?.(get, active) ?? [] : [];
      return {
        ids: cands.map((c: Combatant) => c.id),
        friendly: tmode.id === 'heal', // soin = anneau ami (vert)
        checkedIds: pendingCast?.pickingTargets ? new Set(pendingCast.extraTargetIds ?? []) : null, // surincantation : déjà coché
      };
    })(),
  };
  const els = buildHighlights(scene, battle, view);
  const objs: StageObj[] = els.map((el) => ({ d: highlightDepth(el, dims), el: highlightJsx(el, dims) }));
  // Aperçu tap-1 (tactile) INTERCALÉ entre les grilles (walk/run) et le reste (teintes/zones/anneaux)
  // — l'ordre d'émission historique, qui départage les ex æquo de profondeur au tri stable.
  const pv = tapPreviewObjs(battle, activeC, dims, liftAt, myTurn);
  if (!pv.length) return objs;
  const cut = els.findIndex((e) => e.kind !== 'walk' && e.kind !== 'run');
  const at = cut < 0 ? objs.length : cut;
  return [...objs.slice(0, at), ...pv, ...objs.slice(at)];
}

/** Aperçu tap-1 (tactile) : chemin + case d'arrivée + badge — MÊME rendu que le survol desktop
 *  (movePreviewEls, source unique du tracé de déplacement) + empreinte de la cible. Une seule
 *  profondeur pragmatique à la case d'ARRIVÉE (l'exactitude par-segment du tracé est secondaire). */
function tapPreviewObjs(battle: BattleState, activeC: Combatant | undefined, dims: Dims, liftAt: (x: number, y: number, z?: number) => number, myTurn: boolean): StageObj[] {
  const pv = myTurn ? battle.preview : null;
  if (!pv) return [];
  const liftOf = (p: Pt) => (p.z ? liftAt(p.x, p.y, p.z) : 0);
  const out: StageObj[] = [];
  const pvTgt = 'targetId' in pv ? battle.combatants.find((c) => c.id === pv.targetId) : undefined;
  const pvDest = pv.kind === 'move' || pv.kind === 'run' ? pv.tile : pv.kind === 'attack' ? pvTgt?.pos : pv.dest;
  const pvLbl = pv.kind === 'move' ? `Aller (${pv.cost})` : pv.kind === 'run' ? 'Courir' : pv.kind === 'charge' ? (pv.adv ? 'Charger (+1 Av)' : 'Charger') : pv.kind === 'moveAttack' ? 'Rejoindre + attaquer' : 'Attaquer';
  const pvZ = pvDest?.z ?? 0;
  const pvD = pvDest ? depth(pvDest.x, pvDest.y, dims, pvZ) + 0.25 : 0;
  for (const el of movePreviewEls(pv.kind === 'attack' ? [] : pv.path, pvDest ?? null, pvLbl, dims, 'pv', 'var(--combat-gold)', pv.kind === 'attack' ? 1 : activeC ? footprintN(mountOf(battle, activeC) ?? activeC) : 1, liftOf))
    out.push({ d: pvD, el });
  if (pvTgt?.pos) {
    const tz = pvTgt.pos.z ?? 0;
    for (const t of footprintTiles(pvTgt.pos, footprintN(pvTgt)))
      out.push({ d: depth(t.x, t.y, dims, tz) + 0.25, el: <path key={`pv-tgt-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims, tz ? liftAt(t.x, t.y, tz) : 0)} fill="var(--combat-gold)" opacity={0.18} pointerEvents="none" /> }); // tout le bloc N×N d'un grand
  }
  return out;
}
