/**
 * BUILDER de PROPS — produit les éléments `prop` du pivot (cf. ./types) : le DÉCOR de scène (entités
 * `kind:'prop'` — tonneaux, cadavres, tentes…) et les OVERLAYS de TERRAIN à décor (tuile `bois → 'arbre'`).
 * TOUS rendus en BILLBOARD du SVG catalogue (`propSvg`) par les DEUX backends (iso/éditeur ET POV) —
 * l'overlay de terrain n'est plus qu'un prop dérivé d'une donnée `TerrainDef.overlayProp` (le mur PLEIN,
 * lui, naît de `solidHeightM` via le relief de `buildFloors`, pas d'ici). PUR et projection-agnostique :
 * identité + case + empreinte + vérités de scène, aucune caméra.
 * Consommé par IsoStage (couches props/affordances), l'éditeur et le POV (mêmes billboards).
 */
import { Scene, tileAt, heightAt, type Roof } from '../../state/scene';
import { roofHidden } from '../../state/buildings';
import { decorFootGeometry } from '../../state/footprint';
import { terrainOverlayProp } from '../../state/terrain';
import { buildingFeatures } from '../catalog/buildings';
import { WALL_H_M } from '../iso';
import { ROOF_SLOPE_M } from './roofs';
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
  // Le tri par COUCHE n'est actif que si l'appelant l'a demandé (`activeZ`/`viewZ`) — passer SEULEMENT
  // `allies` (cutaway, cf. POV) ne doit PAS culler les props d'étage.
  const hasLayerView = view != null && (view.activeZ !== undefined || view.viewZ !== undefined);
  const out: PropEl[] = [];
  // Overlays de TERRAIN à DÉCOR (bois → arbre) — un billboard par tuile (couche de base), MÊME chemin de
  // rendu que les props de scène. `visible` suit le brouillard comme un prop : en vue → au-dessus du voile
  // (donc VISIBLE en POV) ; mémorisé → sous le voile. Éditeur/QC (`visible` absent) → tout visible.
  const { w, h } = scene.dimensions;
  for (const lvl of scene.layers) {
    if (hasLayerView && (viewZ != null ? lvl.z !== viewZ : lvl.z > activeZ)) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ref = terrainOverlayProp(tileAt(scene, x, y, lvl.z));
        if (!ref) continue;
        out.push({
          kind: 'prop',
          key: `ov:${x},${y},${lvl.z}`,
          cell: { x, y, z: lvl.z },
          source: 'terrain',
          ref,
          foot: { offX: 0, offY: 0, scale: 1 },
          interact: false,
          states: { visible: !visible || visible.has(`${x},${y},${lvl.z}`) },
        });
      }
  }
  // Props de scène (décor) — visibles dans les deux modes (exploration ET combat).
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop') continue;
    const z = ent.z ?? 0;
    if (hasLayerView && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
    out.push({
      kind: 'prop',
      key: `prop:${ent.id}`,
      cell: { x: ent.pos.x, y: ent.pos.y, z },
      ...(ent.foot ? { span: { w: ent.foot.w, h: ent.foot.h } } : {}),
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
  // Ornements d'IDENTITÉ par TYPE de bâtiment (clocheton/cheminée/enseigne/étal) — dérivés de
  // `buildingFeatures(roof.style)`, posés en billboard SUR (faîte/façade) ou DEVANT (étal) le bâtiment.
  // 100 % donnée : aucun cas en dur par id de scène.
  for (const roof of scene.roofs ?? []) {
    const feats = buildingFeatures(roof.style);
    if (!feats.length) continue;
    const z = roof.z ?? 0;
    const f = roof.foot;
    // Égout (base des murs, comme `buildRoofs`) + faîte (montée centrale) — approx robuste, indépendante
    // de la forme exacte de la nappe. Un ornement de FAÎTE se pose à ~60 % de la pente sous l'apex.
    let maxH = -Infinity;
    for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) maxH = Math.max(maxH, heightAt(scene, f.x + dx, f.y + dy, z));
    const eaveM = WALL_H_M + maxH;
    const apexM = eaveM + Math.floor(Math.min(f.w, f.h) / 2) * ROOF_SLOPE_M;
    const cx = f.x + Math.floor(f.w / 2), cy = f.y + Math.floor(f.h / 2);
    const vis = roofFootVisible(f, z, visible);
    // Cutaway : toit LEVÉ pour montrer l'intérieur (un allié sous l'empreinte) → un ornement de FAÎTE
    // flotterait au-dessus du vide ; on le SAUTE (MÊME `roofHidden` que `buildRoofs`). Façade/étal, au
    // sol, restent — le toit levé ne les occulte pas.
    const roofCut = !!view?.allies && roofHidden(roof, view.allies);
    let door: DoorAnchor | null = null; // résolu PARESSEUSEMENT (façade/front seulement)
    feats.forEach((feat, i) => {
      const base = {
        kind: 'prop' as const,
        key: `orn:${roof.id}:${i}`,
        source: 'ornament' as const,
        ref: feat.prop,
        interact: false,
        ...(feat.fx ? { fx: feat.fx } : {}),
        states: { visible: vis },
      };
      if (feat.anchor === 'ridge') {
        if (roofCut) return; // toit en cutaway → pas de faîteau flottant
        // Faîte : PARTAGE la profondeur du toit (empreinte + coin caméra-proche identiques) pour se
        // dessiner PAR-DESSUS lui, mais billboard CENTRÉ et surélevé sur la pente (posé, pas flottant).
        out.push({
          ...base,
          cell: { x: f.x, y: f.y, z },
          span: { w: f.w, h: f.h },
          foot: { offX: (f.w - 1) / 2, offY: (f.h - 1) / 2, scale: 1 },
          liftM: eaveM - heightAt(scene, cx, cy, z) + 0.6 * (apexM - eaveM),
        });
        return;
      }
      door ??= buildingDoor(scene, roof);
      // 'facade' comme 'front' : ancré à la case JUSTE À L'EXTÉRIEUR de la porte (le mur PLEIN, +0.45 de
      // profondeur, masquerait un billboard posé à l'intérieur). L'ENSEIGNE saille encore un peu plus au
      // large (elle DÉGAGE la face du mur qui, peinte APRÈS, la mordrait) et pend en haut de la façade ;
      // l'ÉTAL reste plaqué au sol devant la porte. Les deux tournés vers l'EXTÉRIEUR (face à qui approche).
      const [ox, oy] = OUTWARD[door.facing];
      const facade = feat.anchor === 'facade';
      out.push({
        ...base,
        cell: { x: door.frontCell.x, y: door.frontCell.y, z },
        facing: door.facing, // Dir8 vers l'EXTÉRIEUR
        foot: { offX: facade ? ox * 0.5 : 0, offY: facade ? oy * 0.5 : 0, scale: 1 },
        liftM: facade ? WALL_H_M * 0.55 : 0, // enseigne : haut de la façade ; étal : au sol
      });
    });
  }
  return out;
}

/** Normale SORTANTE cardinale → delta (dx,dy) : pousse un ornement de façade vers l'extérieur. */
type Cardinal = 'N' | 'E' | 'S' | 'O';
const OUTWARD: Record<Cardinal, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], O: [-1, 0] };

/** Ancrage EXTÉRIEUR de la PORTE d'un bâtiment (résolu depuis `scene.walls`) : case juste À L'EXTÉRIEUR de
 *  la porte + normale cardinale SORTANTE. Robuste à la canonisation N/E des arêtes (une porte 'S'/'O' est
 *  stockée sur la case voisine). Repli : façade SUD, sous le centre bas de l'empreinte. */
interface DoorAnchor {
  frontCell: { x: number; y: number };
  facing: Cardinal;
}
function buildingDoor(scene: Scene, roof: Roof): DoorAnchor {
  const f = roof.foot, z = roof.z ?? 0;
  const x0 = f.x, y0 = f.y, x1 = f.x + f.w - 1, y1 = f.y + f.h - 1;
  for (const w of scene.walls ?? []) {
    if (!w.door || (w.z ?? 0) !== z) continue;
    if (w.side === 'N') {
      if (w.x >= x0 && w.x <= x1 && w.y === y0) return { frontCell: { x: w.x, y: y0 - 1 }, facing: 'N' };
      if (w.x >= x0 && w.x <= x1 && w.y === y1 + 1) return { frontCell: { x: w.x, y: y1 + 1 }, facing: 'S' };
    } else if (w.side === 'E') {
      if (w.y >= y0 && w.y <= y1 && w.x === x1) return { frontCell: { x: x1 + 1, y: w.y }, facing: 'E' };
      if (w.y >= y0 && w.y <= y1 && w.x === x0 - 1) return { frontCell: { x: x0 - 1, y: w.y }, facing: 'O' };
    }
  }
  return { frontCell: { x: f.x + Math.floor(f.w / 2), y: y1 + 1 }, facing: 'S' };
}

/** Un ornement de toit est VISIBLE dès qu'une case de l'empreinte ÉLARGIE d'1 est en vue (règle IDENTIQUE
 *  à `buildRoofs` — on voit le bâtiment dès qu'on est à son pied). `visible` absent (éditeur/QC) ⇒ tout visible. */
function roofFootVisible(f: { x: number; y: number; w: number; h: number }, z: number, visible?: ReadonlySet<string>): boolean {
  if (!visible) return true;
  for (let dy = -1; dy <= f.h; dy++) for (let dx = -1; dx <= f.w; dx++) if (visible.has(`${f.x + dx},${f.y + dy},${z}`)) return true;
  return false;
}
