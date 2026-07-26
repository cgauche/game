/**
 * BUILDER des ÉTIQUETTES de ZONE DESCRIPTIVE (#782) : le nom d'une pièce (`SceneEffectZone` purement
 * descriptive — voir `isDescriptiveZone`), à afficher CUIT au centre de son aire. RÉVÉLATION en
 * cutaway : une zone couverte par une MASSE de toit (`ArchitectureBody.masses`) NON levée (`roofHidden`
 * faux, aucun allié dans l'empreinte) reste masquée — même vérité de jeu que le toit lui-même
 * (`buildRoofs`). PUR et Node-safe : aucun import UI, projection-agnostique (le backend `affineZoneLabels`
 * projette).
 */
import { heightAt, isDescriptiveZone, type Scene, type ZoneArea } from '../../state/scene';
import { massFootBBox, roofHidden } from '../../state/buildings';

/** Rectangle ENGLOBANT (cases) d'une aire — un disque de Chebyshev vaut son carré circonscrit. */
function rectOf(area: ZoneArea): { x: number; y: number; w: number; h: number } {
  if (area.kind === 'disc') return { x: area.cx - area.radius, y: area.cy - area.radius, w: 2 * area.radius + 1, h: 2 * area.radius + 1 };
  return area;
}

/** Centre GRILLE (case) d'une aire — cohérent avec la convention `tileCenter` (case entière = son
 *  centre, cf. `planCellsSvg`/`buildRoofs` : `x + (w-1)/2`). */
function centerOf(area: ZoneArea): { cx: number; cy: number } {
  if (area.kind === 'disc') return { cx: area.cx, cy: area.cy };
  return { cx: area.x + (area.w - 1) / 2, cy: area.y + (area.h - 1) / 2 };
}

const rectsOverlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Élément d'étiquette de zone : centre GRILLE (`cx`,`cy`) + étage (`z`, l'index de couche du plancher
 *  qui la porte) + hauteur MÉTRIQUE du plancher (`hM`, projection) + empreinte ancrée NO (`x`,`y` +
 *  `spanW`/`spanH`) — le texte peut déborder de SA case (police mise à l'échelle sur toute la pièce,
 *  patron `planBoxSvg`) : le backend en tire une profondeur de tri au coin caméra-proche de TOUTE
 *  l'empreinte (`footprintDepth`, même patron que `roofDepth`), jamais celle d'une seule case — sinon
 *  une case plus proche de la même pièce, peinte APRÈS, tronquerait le texte qui déborde dessus. */
export interface ZoneLabelEl {
  key: string;
  label: string;
  cx: number;
  cy: number;
  x: number;
  y: number;
  z: number;
  hM: number;
  spanW: number;
  spanH: number;
}

export interface ZoneLabelView {
  allies?: { x: number; y: number }[];
  activeZ?: number;
  viewZ?: number | null;
}

/** Étiquettes des zones descriptives VISIBLES : sans toit couvrant (extérieur / plan à ciel ouvert) ⇒
 *  toujours visible ; sous un toit ⇒ visible SEULEMENT si ce toit est levé (`roofHidden`, allié dans
 *  son empreinte) — sans allié fourni, aucun toit n'est jamais levé (cohérent avec l'éditeur : `visible`
 *  absent ⇒ tout visible, cf. `buildRoofs`). Un toit ne masque une zone que sur SA COUCHE (`mass.z` =
 *  « étage du plancher sommet couvert », même convention que `Roof.z` avant #822). ÉTAGE (#804) :
 *  `activeZ`/`viewZ` ABSENTS ⇒ toutes les couches (POV/éditeur/QC) ; fournis ⇒ `viewZ` isole cet étage
 *  (debug), sinon SEULE la couche `activeZ` s'affiche — une étiquette de pièce ne concerne que l'étage
 *  courant, empiler plusieurs étages superposerait les libellés au même point écran, illisible. */
export function buildZoneLabels(scene: Scene, opts?: ZoneLabelView): ZoneLabelEl[] {
  const allies = opts?.allies ?? [];
  const activeZ = opts?.activeZ ?? 0;
  const viewZ = opts?.viewZ ?? null;
  const hasLayerView = opts != null && (opts.activeZ !== undefined || opts.viewZ !== undefined);
  const out: ZoneLabelEl[] = [];
  for (const ez of scene.effectZones ?? []) {
    if (!isDescriptiveZone(ez)) continue;
    const z = ez.z ?? 0;
    if (hasLayerView && (viewZ != null ? z !== viewZ : z !== activeZ)) continue;
    const rect = rectOf(ez.area);
    const coveredByMass = (scene.architecture ?? []).some((body) =>
      body.masses.some((mass) => {
        if (mass.z !== z) return false;
        const foot = massFootBBox(mass.footprint);
        return rectsOverlap(rect, foot) && !roofHidden(foot, allies);
      }));
    if (coveredByMass) continue;
    const { cx, cy } = centerOf(ez.area);
    out.push({
      key: `zoneLabel:${ez.id}`,
      label: ez.label,
      cx,
      cy,
      x: rect.x,
      y: rect.y,
      z,
      hM: heightAt(scene, Math.round(cx), Math.round(cy), z),
      spanW: rect.w,
      spanH: rect.h,
    });
  }
  return out;
}
