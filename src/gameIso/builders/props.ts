/**
 * BUILDER de PROPS — produit les éléments `prop` du pivot (cf. ./types) : le DÉCOR de scène (entités
 * `kind:'prop'` — tonneaux, cadavres, tentes…) et les OVERLAYS de TERRAIN à décor (tuile `bois → 'arbre'`).
 * TOUS rendus en BILLBOARD du SVG catalogue (`propSvg`) par les DEUX backends (iso/éditeur ET POV) —
 * l'overlay de terrain n'est plus qu'un prop dérivé d'une donnée `TerrainDef.overlayProp` (le mur PLEIN,
 * lui, naît de `solidHeightM` via le relief de `buildFloors`, pas d'ici). PUR et projection-agnostique :
 * identité + case + empreinte + vérités de scène, aucune caméra.
 * Consommé par IsoStage (couches props/affordances), l'éditeur et le POV (mêmes billboards).
 */
import { Scene, tileAt, heightAt, type ArchitectureEdgeRef, type ArchitectureRect, type WallSide } from '../../state/scene';
import { roofHidden, massFootBBox } from '../../state/buildings';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { decorFootGeometry } from '../../state/footprint';
import { terrainOverlayProp } from '../../state/terrain';
import { buildingFeatures } from '../catalog/buildings';
import { facadeFeatureViz } from '../catalog/facades';
import { WALL_H_M } from '../iso';
import { fieldHeightAt, nappeKey, resolveNappes } from './roofs';
import type { FloorView } from './floors';
import type { PropEl } from './types';
import { wallEnds } from './walls';

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
      interact: !!ent.interact,
      states: { visible: !visible || visible.has(`${ent.pos.x},${ent.pos.y},${z}`) },
    });
  }
  const physicalEdges = new Set((scene.walls ?? []).map((wall) => architectureEdgeKey(wall)));
  const emittedFeatures = new Set<string>();
  for (const body of scene.architecture ?? []) {
    for (const section of body.facades) {
      const sectionEdges = new Set(section.edges.map((edge) =>
        architectureEdgeKey({ ...edge, z: edge.z ?? section.z })));
      for (const feature of section.features ?? []) {
        const edge = { ...feature.edge, z: feature.edge.z ?? section.z };
        const z = edge.z;
        if (hasLayerView && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
        const edgeId = architectureEdgeKey(edge);
        const featureId = `${body.id}:${section.id}:${feature.id}`;
        if (emittedFeatures.has(featureId) || !sectionEdges.has(edgeId) || !physicalEdges.has(edgeId)) continue;
        const viz = facadeFeatureViz(section.appearance, feature.kind);
        if (!viz) continue;
        emittedFeatures.add(featureId);
        const offset = feature.offset ?? 0.5;
        const [a, b] = wallEnds(edge);
        const anchor = {
          x: a.x + (b.x - a.x) * offset,
          y: a.y + (b.y - a.y) * offset,
        };
        const [nx, ny] = WALL_NEIGHBOUR[edge.side];
        out.push({
          kind: 'prop',
          key: `arch:${featureId}`,
          cell: { x: edge.x, y: edge.y, z },
          source: 'architecture',
          architectureFeatureId: featureId,
          ref: feature.appearance ?? viz.prop,
          foot: {
            offX: anchor.x - edge.x,
            offY: anchor.y - edge.y,
            scale: viz.scale ?? 1,
          },
          ...(viz.liftM != null ? { liftM: viz.liftM } : {}),
          interact: false,
          states: {
            visible: !visible ||
              visible.has(`${edge.x},${edge.y},${z}`) ||
              visible.has(`${edge.x + nx},${edge.y + ny},${z}`),
          },
        });
      }
    }
  }
  // Ornements d'IDENTITÉ par TYPE de bâtiment (clocheton/cheminée/enseigne/étal) — dérivés de
  // `buildingFeatures(body.style)`, un jeu par MASSE (#822), posés en billboard SUR (faîte/façade) ou DEVANT (étal) le
  // bâtiment. 100 % donnée : aucun cas en dur par id de scène.
  const nappes = resolveNappes(scene);
  for (const body of effectiveArchitecture(scene)) {
    const feats = buildingFeatures(body.style);
    if (!feats.length) continue;
    for (const mass of body.masses) {
      const z = mass.z;
      const f = massFootBBox(mass.footprint);
      // Égout et FAÎTE lus sur le CHAMP de la nappe (`resolveNappes`) — la MÊME hauteur que les pans
      // que `buildRoofs` émet, jamais une seconde formule. Un ornement de FAÎTE se pose à ~60 % de la
      // pente sous l'apex.
      // Masse sans nappe : son ornement est OMIS (le reste des props se construit).
      const nappe = nappes.get(nappeKey(body.id, mass.id));
      if (!nappe) continue;
      const { cells, field } = nappe;
      const eaveM = field.shape.eaveHeightM;
      let apexM = eaveM;
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const)
          apexM = Math.max(apexM, fieldHeightAt(field, { x: x + dx, y: y + dy }));
      }
      const cx = f.x + Math.floor(f.w / 2), cy = f.y + Math.floor(f.h / 2);
      const vis = roofFootVisible(f, z, visible);
      // Cutaway : toit LEVÉ pour montrer l'intérieur (un allié sous l'empreinte) → un ornement de FAÎTE
      // flotterait au-dessus du vide ; on le SAUTE (MÊME `roofHidden` que `buildRoofs`). Façade/étal, au
      // sol, restent — le toit levé ne les occulte pas.
      const roofCut = !!view?.allies && roofHidden(f, view.allies);
      let door: DoorAnchor | null = null; // résolu PARESSEUSEMENT (façade/front seulement)
      feats.forEach((feat, i) => {
        const base = {
          kind: 'prop' as const,
          key: `orn:${body.id}:${mass.id}:${i}`,
          source: 'ornament' as const,
          ref: feat.prop,
          interact: false,
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
        door ??= buildingDoor(scene, f, z);
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
  }
  return out;
}

const WALL_NEIGHBOUR: Record<WallSide, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  '\\': [0, 0],
  '/': [0, 0],
};

function architectureEdgeKey(edge: ArchitectureEdgeRef): string {
  return `${edge.x},${edge.y},${edge.side},${edge.z ?? 0}`;
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
function buildingDoor(scene: Scene, f: ArchitectureRect, z: number): DoorAnchor {
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
