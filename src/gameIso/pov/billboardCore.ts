/**
 * POV — noyau PUR des BILLBOARDS (mécanisme UNIQUE des deux familles, personnages ET props) :
 * ancrage aux PIEDS (projection du centre de case à la hauteur de surface, cull derrière/portée),
 * échelle ∝ profondeur (hauteur écran = fy·hauteur_métrique/profondeur, boîte locale 120×150) et
 * BUDGET par famille (tri loin→près, les plus proches priment — plus aucun cap en dur).
 *
 * Les PROPS (décor : tonneaux, arbres, tentes…) se rendent ici en CHAÎNES SVG du MÊME dessin iso
 * (`propSvg`, source unique du décor) — consommées par `PovBillboards` (jeu) ET la QC headless
 * (`env-panels`). Les personnages/créatures (rig/gabarit) restent dans la couche React (billboards.tsx),
 * sur CE noyau.
 */
import { project, fogAt, fogCurveOf, farTilesOf, fy, VW, VH, type CamPose } from './camera';
import { propSvg } from '../catalog/decor';
import { AMBIANCE } from '../catalog/ambiance';
import { decorFootGeometry } from '../../state/footprint';
import { heightAt, isIndoor, type Scene } from '../../state/scene';

/** Boîte LOCALE d'un billboard (repère paper-doll ET prop : 120×150, pieds/base en (60,150)). */
export const BB_W = 120;
export const BB_H = 150;
export const BB_FOOT_X = 60;
export const BB_FOOT_Y = 150;
/** Hauteur métrique d'une PERSONNE debout (m) — la boîte 150 du rig. */
export const ENT_H_M = 1.8;
/** Hauteur métrique de la boîte d'un PROP (m) — même proportion prop/personnage que l'iso
 *  (échelles de boîte 0.55 prop vs 0.58 rig). */
export const PROP_H_M = 1.7;
/** Budgets de billboards PAR FAMILLE (les plus proches priment) — anti-surcharge d'une scène peuplée.
 *  En DONNÉE (`ambiance.json`), dimensionnés avec la portée de profondeur. */
export const MAX_PERSON_BILLBOARDS = AMBIANCE.pov.depth.billboards.maxPersons;
export const MAX_PROP_BILLBOARDS = AMBIANCE.pov.depth.billboards.maxProps;

/** Marge d'EMPRISE écran d'un billboard (fraction de sa boîte) — un rig déborde un peu de 120×150
 *  (arme tendue, miroir) : le cull hors-cadre reste conservateur. */
const BB_OVERFLOW = 0.35;

/** Ancre PIEDS d'un billboard : centre de case (grille continue — empreinte multi-cases décalée par
 *  l'appelant), hauteur de surface de la case d'ANCRAGE, projetée en pixels, ÉCHELLE ∝ profondeur
 *  (hauteur écran = fy·hM/profondeur × `scaleK` d'espèce/empreinte) et FONDU atmosphérique `o`
 *  (opacité = 1 − brume : une silhouette à 20 cases est petite ET délavée, pas absente). null =
 *  derrière le plan proche, au-delà de la portée (brume pleine), ou EMPRISE entièrement hors-cadre
 *  (cull FOV des billboards — un sprite à `opacity` totalement hors-canvas fait paniquer resvg). PUR. */
export function footAnchor(
  scene: Scene,
  cam: CamPose,
  gx: number,
  gy: number,
  z: number,
  hM: number,
  scaleK = 1,
): { sx: number; sy: number; depth: number; s: number; o: number } | null {
  const indoor = isIndoor(scene);
  const P = { x: gx * cam.mpt, y: gy * cam.mpt, z: heightAt(scene, Math.round(gx), Math.round(gy), z) };
  const pr = project(cam, P);
  if (pr.behind || pr.depth > farTilesOf(indoor) * cam.mpt) return null;
  const o = 1 - fogAt(pr.depth / cam.mpt, fogCurveOf(indoor));
  if (o <= 0.02) return null; // dissous dans la brume
  const s = ((fy * hM) / pr.depth / BB_H) * scaleK;
  // Emprise écran (boîte locale ancrée pieds + marge de débord) : entièrement hors-cadre → cull.
  const halfW = (0.5 + BB_OVERFLOW) * BB_W * s;
  const top = pr.sy - (1 + BB_OVERFLOW) * BB_FOOT_Y * s;
  const bottom = pr.sy + BB_OVERFLOW * BB_H * s;
  if (pr.sx + halfW < 0 || pr.sx - halfW > VW || bottom < 0 || top > VH) return null;
  return { sx: pr.sx, sy: pr.sy, depth: pr.depth, s, o };
}

/** Tri PEINTRE (loin→près) + budget : garde les `cap` plus proches, dans l'ordre de peinture. PUR. */
export function keepClosest<T extends { depth: number }>(list: T[], cap: number): T[] {
  const sorted = [...list].sort((a, b) => b.depth - a.depth);
  return sorted.length > cap ? sorted.slice(sorted.length - cap) : sorted;
}

/** Transform d'ancrage aux pieds : le point (BB_FOOT_X, BB_FOOT_Y) de la boîte locale atterrit sur
 *  l'ancre écran, le contenu réduit à `s`. Partagé personnages (JSX) ⇄ props (chaînes). */
export function bbTransform(a: { sx: number; sy: number }, s: number): { outer: string; inner: string } {
  return {
    outer: `translate(${a.sx.toFixed(2)},${a.sy.toFixed(2)})`,
    inner: `translate(${(-BB_FOOT_X * s).toFixed(2)},${(-BB_FOOT_Y * s).toFixed(2)}) scale(${s.toFixed(4)})`,
  };
}

/** Un billboard de PROP prêt à trier/rendre : profondeur caméra (m) + son SVG déjà positionné. */
export interface PropBillboard {
  key: string;
  depth: number;
  svg: string;
}

/**
 * Billboards des PROPS visibles de la scène : MÊME SVG que l'iso (`propSvg(ref, facing, 0)` — un prop
 * directionnel garde son orientation d'auteur), ancré aux pieds du CENTRE de son empreinte
 * (`decorFootGeometry` : offset fractionnaire + échelle au côté max, comme l'iso), échelle ∝ profondeur
 * (même règle que les personnages, hauteur `PROP_H_M`), cull LdV/brouillard + distance, budget
 * `MAX_PROP_BILLBOARDS`. PUR (chaînes) — consommé par le jeu ET la QC headless.
 */
export function buildPropBillboards(scene: Scene, cam: CamPose, visible: ReadonlySet<string>): PropBillboard[] {
  const out: PropBillboard[] = [];
  for (const e of scene.entities) {
    if (e.kind !== 'prop') continue;
    const z = e.z ?? 0;
    if (!visible.has(`${e.pos.x},${e.pos.y},${z}`)) continue;
    const fg = decorFootGeometry(e.foot);
    const a = footAnchor(scene, cam, e.pos.x + fg.offX, e.pos.y + fg.offY, z, PROP_H_M, fg.scale);
    if (!a) continue;
    const t = bbTransform(a, a.s);
    const op = a.o < 1 ? ` opacity="${a.o.toFixed(3)}"` : '';
    out.push({
      key: `prop:${e.id}`,
      depth: a.depth,
      svg: `<g transform="${t.outer}"${op}><g transform="${t.inner}">${propSvg(e.ref ?? 'tonneau', e.facing, 0)}</g></g>`,
    });
  }
  return keepClosest(out, MAX_PROP_BILLBOARDS);
}
