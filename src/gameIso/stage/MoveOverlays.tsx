/**
 * Aperçus de DÉPLACEMENT du stage (par-frame, hors builders) : losange du CURSEUR clavier/manette,
 * aperçu au survol en combat (chemin + badge de coût — le clic/A commet) et hors combat (tracé partagé,
 * pas de badge). Tous sur la MÊME source de tracé (movePreviewEls) et la même géométrie (diamondPath +
 * lift métrique) que les autres surbrillances.
 */
import { Dims, diamondPath } from '../../geometry/iso';
import { footprintTiles } from '../../state/footprint';
import { movePreviewEls } from './movePreview';
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
      {movePreviewEls(move.path, at, move.label, dims, 'hmv', 'var(--combat-gold)', footN, lift)}
    </g>
  );
}

/** Aperçu de DÉPLACEMENT au survol HORS combat : case d'arrivée = fin du chemin (case adjacente pour un
 *  objet/PNJ interactif), pas le survol. Chaque point se rend à SON z et SA hauteur (lift) → le trait
 *  MONTE la rampe et court sur le tablier au lieu de rester écrasé sur la cour (z0). */
export function ExplorePathPreview({ path, dims, lift, walking = false }: { path: Pt[]; dims: Dims; lift: (p: Pt) => number; walking?: boolean }) {
  if (walking) return null;
  const destination = path[path.length - 1] ?? null;
  return <g pointerEvents="none">{movePreviewEls(path, destination, null, dims, 'exp', 'var(--combat-gold)', 1, lift)}</g>;
}
