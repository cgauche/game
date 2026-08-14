/**
 * Aperçus de DÉPLACEMENT du stage (par-frame, hors builders) : losange du CURSEUR clavier/manette,
 * aperçu au survol en combat (chemin + badge de coût — le clic/A commet) et hors combat (tracé partagé,
 * pas de badge). Tous sur la MÊME source de tracé (movePreviewEls) et la même géométrie (diamondPath +
 * lift métrique) que les autres surbrillances.
 */
import { Dims, diamondPath } from '../../geometry/iso';
import { footprintN, footprintTiles } from '../../state/footprint';
import { mountOf } from '../../state/mount';
import { inBattleId } from '../../state/combatants';
import { movePreviewEls } from './movePreview';
import { GOLD_TINT } from '../highlightTints';
import type { Combatant } from '../../engine/types';
import type { BattleState } from '../../state/store';
import type { Pt } from '../../state/path';

/** Losange du CURSEUR clavier/manette : repère de case TOUJOURS visible tant qu'aucune modale de jet à
 *  cible n'est ouverte ET que hoverAim ne peint pas déjà un réticule (anti-doublon quand le curseur est
 *  aimanté sur une cible). Curseur = TOUTE l'empreinte du mobile actif (4 cases pour un cavalier sur
 *  monture 2×2), ancrée au coin NO de la case visée — c'est là que le bloc atterrira (battleClickTile). */
export function CursorOverlay({ tile, footN, dims, liftAt }: { tile: Pt; footN: number; dims: Dims; liftAt: (x: number, y: number, z?: number) => number }) {
  return (
    <g pointerEvents="none">
      {footprintTiles(tile, footN).map((t) => (
        <path key={`cursor-${t.x}-${t.y}`} className="combat-cursor" d={diamondPath(t.x, t.y, dims, liftAt(t.x, t.y, tile.z ?? 0))} fill="none" />
      ))}
    </g>
  );
}

/** Aperçu de DÉPLACEMENT au survol (desktop) ET sous le curseur clavier/manette (effHover) en combat —
 *  déplacement NORMAL (Marche/Course) ou mode-CASE du catalogue (Pousser/Téléportation/pose de zone,
 *  `tilePreviewAt` #198) : même primitive de tracé (`movePreviewEls`), `move.label` porte le badge
 *  (« Aller (N) »/« Courir »/« Pousser (N) »/« Téléporter »/« Poser la zone »). */
export function HoverMovePreview({ move, at, footN, dims, lift }: { move: { path: Pt[]; label: string }; at: Pt; footN: number; dims: Dims; lift: (p: Pt) => number }) {
  return (
    <g pointerEvents="none">
      {movePreviewEls(move.path, at, move.label, dims, 'hmv', GOLD_TINT, footN, lift)}
    </g>
  );
}

/** Aperçu de DÉPLACEMENT au survol HORS combat : case d'arrivée = fin du chemin (case adjacente pour un
 *  objet/PNJ interactif), pas le survol. Chaque point se rend à SON z et SA hauteur (lift) → le trait
 *  MONTE la rampe et court sur le tablier au lieu de rester écrasé sur la cour (z0). */
export function ExplorePathPreview({ path, dims, lift, walking = false }: { path: Pt[]; dims: Dims; lift: (p: Pt) => number; walking?: boolean }) {
  if (walking) return null;
  const destination = path[path.length - 1] ?? null;
  return <g pointerEvents="none">{movePreviewEls(path, destination, null, dims, 'exp', GOLD_TINT, 1, lift)}</g>;
}

/** APERÇU TAP-1 (tactile) : le geste en deux temps — une première touche montre où l'on ira et ce que
 *  cela coûte (`battle.preview`), la seconde commet. MÊME tracé que le survol desktop
 *  (`movePreviewEls`, source unique) plus l'EMPREINTE de la cible quand l'aperçu vise un combattant.
 *  Il vivait dans la couche de surbrillances affine (`stage/highlightLayer.tapPreviewObjs`) et a suivi
 *  les overlays d'interaction quand la voie affine est morte (#1176 P3-4, commit C5a). */
export function TapPreview({ battle, activeC, dims, liftAt, myTurn }: {
  battle: BattleState;
  activeC: Combatant | undefined;
  dims: Dims;
  liftAt: (x: number, y: number, z?: number) => number;
  myTurn: boolean;
}) {
  const pv = myTurn ? battle.preview : null;
  if (!pv) return null;
  const liftOf = (p: Pt) => (p.z ? liftAt(p.x, p.y, p.z) : 0);
  const cible = 'targetId' in pv ? inBattleId(battle, pv.targetId) : undefined;
  const dest = pv.kind === 'move' || pv.kind === 'run' ? pv.tile : pv.kind === 'attack' ? cible?.pos : pv.dest;
  const label = pv.kind === 'move' ? `Aller (${pv.cost})`
    : pv.kind === 'run' ? 'Courir'
      : pv.kind === 'charge' ? (pv.adv ? 'Charger (+1 Av)' : 'Charger')
        : pv.kind === 'moveAttack' ? 'Rejoindre + attaquer' : 'Attaquer';
  const footN = pv.kind === 'attack' ? 1 : activeC ? footprintN(mountOf(battle, activeC) ?? activeC) : 1;
  return (
    <g pointerEvents="none">
      {movePreviewEls(pv.kind === 'attack' ? [] : pv.path, dest ?? null, label, dims, 'pv', GOLD_TINT, footN, liftOf)}
      {cible?.pos && footprintTiles(cible.pos, footprintN(cible)).map((t) => (
        <path
          key={`pv-tgt-${t.x}-${t.y}`}
          d={diamondPath(t.x, t.y, dims, cible.pos!.z ? liftAt(t.x, t.y, cible.pos!.z) : 0)}
          fill={GOLD_TINT}
          opacity={0.18}
        />
      ))}
    </g>
  );
}
