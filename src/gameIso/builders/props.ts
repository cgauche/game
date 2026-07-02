/**
 * BUILDER de PROPS — produit les éléments `prop` du pivot (cf. ./types) : le DÉCOR de scène (entités
 * `kind:'prop'` — tonneaux, cadavres, tentes… rendus en billboard du SVG catalogue) et les OVERLAYS de
 * TERRAIN en relief (tuile 'mur' pleine, 'bois' — rendus en code par le registre, couche de base).
 * PUR et projection-agnostique : identité + case + empreinte + vérités de scène, aucune caméra.
 * Consommé par IsoStage (couches décor/props/affordances) et l'éditeur (overlays terrain).
 */
import { Scene, tileAt } from '../../state/scene';
import { decorFootGeometry } from '../../state/footprint';
import { terrainHasOverlay } from '../sprites';
import type { FloorView } from './floors';
import type { PropEl } from './types';

/** Éléments `prop` de la scène. `view` ABSENT ⇒ toutes les couches (POV/éditeur/QC) ; sinon `viewZ`
 *  isole un étage (debug), sinon z ≤ activeZ (un prop AU-DESSUS de la zone active n'est pas rendu —
 *  l'historique du stage, pas de fantôme pour le décor). `visible` absent ⇒ tout visible ; un prop de
 *  scène en vue est tagué `visible` (dessiné AU-DESSUS du voile), mémorisé → dessous (grisé). Les
 *  overlays de terrain restent TOUJOURS sous le voile (décor « mémorisé », convention des sols). */
export function buildProps(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): PropEl[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const out: PropEl[] = [];
  // Overlays de TERRAIN en relief — couche de base uniquement (historique IsoStage/éditeur).
  const { w, h } = scene.dimensions;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = tileAt(scene, x, y);
      if (!terrainHasOverlay(t)) continue;
      out.push({
        kind: 'prop',
        key: `ov:${x},${y}`,
        cell: { x, y, z: 0 },
        sortClass: 'prop',
        source: 'terrain',
        ref: t,
        foot: { offX: 0, offY: 0, scale: 1 },
        interact: false,
        states: { visible: false },
      });
    }
  // Props de scène (décor) — visibles dans les deux modes (exploration ET combat).
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop') continue;
    const z = ent.z ?? 0;
    if (view && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
    out.push({
      kind: 'prop',
      key: `prop:${ent.id}`,
      cell: { x: ent.pos.x, y: ent.pos.y, z },
      ...(ent.foot ? { span: { w: ent.foot.w, h: ent.foot.h } } : {}),
      sortClass: 'prop',
      source: 'entity',
      entId: ent.id,
      ref: ent.ref ?? 'tonneau',
      ...(ent.facing ? { facing: ent.facing } : {}),
      foot: decorFootGeometry(ent.foot),
      ...(ent.anim ? { fx: ent.anim } : {}),
      interact: !!ent.interact,
      states: { visible: !visible || visible.has(`${ent.pos.x},${ent.pos.y},${z}`) },
    });
  }
  return out;
}
