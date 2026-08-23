/**
 * Aperçus de DÉPLACEMENT du stage (par-frame, hors builders) : losange du CURSEUR clavier/manette,
 * aperçu au survol en combat (chemin + badge de coût — le clic/A commet) et hors combat (tracé partagé,
 * pas de badge). Tous sur la MÊME source de tracé (movePreviewEls) et la même géométrie (diamondPath +
 * lift métrique) que les autres surbrillances.
 */
import { Dims, diamondPath, tileCenter } from '../../geometry/iso';
import { footprintN, footprintTiles } from '../../state/footprint';
import { mountOf, movementRemaining } from '../../state/mount';
import { inBattleId } from '../../state/combatants';
import { previewResourceDelta } from '../../state/combatFlow';
import { movePreviewEls } from './movePreview';
import { GOLD_TINT } from '../highlightTints';
import type { Combatant } from '../../engine/types';
import type { DifficultyShown } from '../../engine/combat';
import { difficultyShownText } from '../../ui/difficultyText';
import type { BattleState } from '../../state/store';
import type { Pt } from '../../state/path';

/** Ce que le geste APERÇU fait du Mouvement du Tour, « avant → après » — le coût vient de la SOURCE
 *  UNIQUE (`previewResourceDelta`, celle des jauges de l'arche) et le solde de `movementRemaining` :
 *  aucune 2ᵉ formule. `null` quand le geste ne coûte aucun Mouvement, ou que le solde de l'actif n'est
 *  pas un nombre fini. */
export function mouvementLigne(battle: BattleState, active: Combatant | undefined, preview: BattleState['preview']): string | null {
  if (!active) return null;
  const { move } = previewResourceDelta({ ...battle, preview });
  const avant = movementRemaining(battle, active);
  if (!Number.isFinite(move) || !Number.isFinite(avant) || move <= 0) return null;
  return `Mouvement ${avant} → ${Math.max(0, avant - move)}`;
}

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
 *  `tilePreviewAt` #198) : même primitive de tracé (`movePreviewEls`), `move.label` porte la 1ᵉʳᵉ ligne du
 *  badge (« Aller (N) »/« Courir »/« Pousser (N) »/« Téléporter »/« Poser la zone »), la 2ᵉ disant ce que
 *  le geste fait du Mouvement du Tour (#1411 P2-D). `kind: 'refus'` : le badge ne dit QUE le refus. */
export function HoverMovePreview({ move, at, footN, dims, lift, battle, activeC }: {
  move: { kind: 'move' | 'run' | 'tile' | 'refus'; path: Pt[]; cost?: number; label: string };
  at: Pt;
  footN: number;
  dims: Dims;
  lift: (p: Pt) => number;
  battle?: BattleState;
  activeC?: Combatant;
}) {
  // REFUS (Course non armée) : le badge dit la raison AU POINT DU GESTE et rien d'autre — ni chemin ni
  // losange d'arrivée, qui promettraient un déplacement que le clic refusera (`state/refusVisible`).
  if (move.kind === 'refus') {
    const c0 = tileCenter(at.x, at.y, dims, lift(at));
    return <text x={c0.cx} y={c0.cy - 28} textAnchor="middle" className="pv-badge" pointerEvents="none">{move.label}</text>;
  }
  // Le geste survolé est un aperçu de la MÊME forme que le tap-1 : il passe par la même source de coût.
  const pv = battle && move.kind !== 'tile' ? { kind: move.kind, tile: at, path: move.path, cost: move.cost ?? 0 } : null;
  const mouvement = battle && pv ? mouvementLigne(battle, activeC, pv as BattleState['preview']) : null;
  return (
    <g pointerEvents="none">
      {movePreviewEls(move.path, at, [move.label, ...(mouvement ? [mouvement] : [])], dims, 'hmv', GOLD_TINT, footN, lift)}
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
 *  Le badge dit AUSSI ce que le geste fait du Mouvement du Tour et la Difficulté qu'il produira. */
export function TapPreview({ battle, activeC, dims, liftAt, myTurn, difficulty }: {
  battle: BattleState;
  activeC: Combatant | undefined;
  dims: Dims;
  liftAt: (x: number, y: number, z?: number) => number;
  myTurn: boolean;
  /** Difficulté que dira le jet de ce geste (`previewDifficultyOf`, résolue par l'appelant qui tient
   *  le store — MÊME chemin que le réticule au survol), mise en mots par `ui/difficultyText`. */
  difficulty?: DifficultyShown;
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
  const lignes = [label, ...[mouvementLigne(battle, activeC, pv), difficultyShownText(difficulty)].filter((l): l is string => !!l)];
  return (
    <g pointerEvents="none">
      {movePreviewEls(pv.kind === 'attack' ? [] : pv.path, dest ?? null, lignes, dims, 'pv', GOLD_TINT, footN, liftOf)}
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
