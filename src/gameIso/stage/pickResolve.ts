/**
 * RÉSOLUTION DU PICKING — « quel pixel désigne quoi ? », en UN lieu et en entier.
 *
 * Deux porteurs posent la question : le GESTE (`useStagePointer.pickTile`, ce qu'un clic fait) et la
 * SONDE DE RECETTE (`pickProbe.pickTileAt`, ce qu'une recette lit sans cliquer). Tenue en double, la
 * chaîne dérive — et une sonde qui a dérivé RAPPORTE un verdict que le clic ne rend pas, donc innocente
 * le pixel que le clic manque. `resoudrePixel` porte la chaîne COMPLÈTE (rayon → meuble dessiné → pas
 * inter-étages → case marchable → sol cross-couche) : aucun étage n'appartient plus à un porteur.
 * L'INVERSION DU PIXEL y est comprise (`pointStageSousPixel`) : c'est le dernier étage qui restait
 * tenu en double, et il divergeait par sa CAMÉRA — le geste inversait avec celle du rendu, la sonde
 * avec `store.camPan`, qui vaut (0,0) sur un écran centré sur le groupe.
 *
 * VERROU D'EXHAUSTIVITÉ (#1680 ligne 13) : ce module est le SEUL consommateur de la NATURE d'un
 * `PickResult`. Le `never` du défaut fait refuser par le compilateur une nature qu'aucune branche ne
 * nomme, là où une égalité sur `kind` la laisserait tomber en silence dans le repli de sol.
 */
import { heightAt, isWalkable, type Scene } from '../../state/scene';
import { metricToLift } from '../../state/relief';
import { memoByRef } from '../../state/sceneMemo';
import { resolveCursorZ } from '../../state/combatCursor';
import { walkNeighbors, type Pt } from '../../state/path';
import { inBattleId } from '../../state/combatants';
import { sceneAUnPropVolumique } from '../builders/props';
import { hasSpritePicker } from './spritePicker';
import { screenToTileAtLift, type StagePose } from './projection';
import { stagePointAt, viewBoxPointAt } from './stageCam';
import type { Dims } from '../../geometry/iso';
import type { EtatEtage } from '../../state/viewLevel';
import type { PickResult } from '../backends/webgl/spriteRaycast';

/** Ce que la résolution lit de l'état — la tranche EXACTE, jamais le store entier. Elle ÉTEND celle de
 *  l'étage affiché (`state/viewLevel.ts`) : le picking résout sur l'étage que l'écran montre. */
export interface EtatDePick extends EtatEtage {
  scene: Scene | null;
}

/** Par quelle voie la case a été désignée. L'ordre de ce type EST celui de la chaîne. */
export type PickVia = 'sprite' | 'decor' | 'meuble' | 'pas-etage' | 'sol' | 'aucune';

/** Verdict du picking sous un pixel : la case du monde (`null` = rien de dessiné), le combattant dont
 *  le CORPS s'y trouve, et l'étage de la chaîne qui a tranché. */
export interface Verdict {
  tile: { x: number; y: number; z: number } | null;
  cid: string | null;
  via: PickVia;
}

/** LIFTS D'AFFICHAGE distincts d'une scène, du plus HAUT au plus bas — l'ensemble des hauteurs
 *  auxquelles une case peut être DESSINÉE (`metricToLift` de chaque hauteur de relief authorée, plus le
 *  sol). Un pixel doit être inversé à CHACUN d'eux pour retrouver la case qu'on voit : le relief n'est
 *  pas une couche, c'est une hauteur continue. Mémoïsé par identité de scène (`memoByRef`). */
export const sceneLifts = memoByRef((scene: Scene): readonly number[] =>
  [...new Set([0, ...scene.layers.flatMap((layer) => [...(layer.height ?? [])]).map(metricToLift)])]
    .sort((a, b) => b - a));

/** La voie de rendu est-elle interrogée sous ce pixel ? Le hit-test tourne à CHAQUE `pointermove` et
 *  c'est lui qui coûte (la masse triangulée de la carte) : on ne le paie que là où sa réponse peut
 *  changer le verdict — en COMBAT (le jeton sous le pixel), et hors combat seulement si une voie
 *  volumique est inscrite ET que la scène porte un décor volumique, seule chose qu'un rayon MONDE
 *  puisse nommer. `hasSpritePicker` est une lecture de REGISTRE (le montage de `GameStage3D`) : c'est
 *  précisément ce que les deux porteurs doivent lire pareil. */
export function tireLeRayon(st: EtatDePick): boolean {
  if (st.mode === 'battle' && st.battle) return true;
  return !!st.scene && hasSpritePicker() && sceneAUnPropVolumique(st.scene);
}

/**
 * Ce que le rayon désigne → la case du monde. `null` quand rien n'est nommé, ou quand le nom ne
 * retrouve personne : la chaîne poursuit alors sur les surfaces dessinées.
 *
 * DÉCOR VOLUMIQUE : c'est le MEUBLE qui est dessiné sous le pixel, pas la tuile derrière lui — on
 * rend sa case d'ANCRAGE, d'où l'interaction d'exploration le reprend comme n'importe quel décor. Le
 * rayon touche la face réellement dessinée, à sa hauteur réelle : il est juste même sur le DESSUS
 * d'un meuble haut, là où une inversion écran→case au lift du SOL décale la case (mesuré sur
 * `la-diligence` : un pixel sur le dessus de `comptoir-2` (11,24) rend (10,23), la table voisine).
 */
export function caseVisee(vise: PickResult, st: EtatDePick): Verdict | null {
  if (!vise) return null;
  switch (vise.kind) {
    case 'combatant': {
      if (st.mode !== 'battle') return null;
      const c = inBattleId(st.battle, vise.id);
      if (!c?.pos) return null;
      return { tile: { x: c.pos.x, y: c.pos.y, z: c.pos.z ?? 0 }, cid: c.id, via: 'sprite' };
    }
    case 'entity': {
      const e = st.scene?.entities.find((x) => x.id === vise.id);
      if (!e) return null;
      return { tile: { x: e.pos.x, y: e.pos.y, z: e.z ?? 0 }, cid: null, via: 'decor' };
    }
    default: {
      const jamais: never = vise;
      throw new Error(`nature de cible non traitée par la résolution de picking : ${JSON.stringify(jamais)}`);
    }
  }
}

/** Point de PROJECTION du stage : le repère où `tileCenter`/`worldToScreen` dessinent. */
export interface PointStage {
  x: number;
  y: number;
}

/** Point de VIEWBOX : le repère `0 0 VW VH` du stage SVG, AVANT la caméra du groupe. */
export interface PointViewBox {
  x: number;
  y: number;
}

/** Pixel CLIENT → point de VIEWBOX : premier étage de l'inversion (recouvrement `slice` centré), le
 *  seul que le panoramique défait — la caméra du groupe y reste en place, c'est elle qu'on déplace.
 *  `null` quand l'élément n'a aucune surface mesurée : il n'y a alors pas de pixel à inverser. */
export function pointViewBoxSousPixel(svg: SVGSVGElement | null, clientX: number, clientY: number): PointViewBox | null {
  const r = svg?.getBoundingClientRect();
  if (!r || !r.width || !r.height) return null;
  return viewBoxPointAt({ sx: clientX - r.left, sy: clientY - r.top }, { w: r.width, h: r.height });
}

/** Pixel CLIENT → point de PROJECTION, les DEUX étages de `stageCam` à l'envers, en UN lieu pour les
 *  deux porteurs. La `cam` et le `zoom` sont ceux du RENDU COURANT : le geste les tient de son hôte
 *  (`camRef.current`, prop `zoom`), la sonde les lit du cadre publié
 *  (`spritePicker.ts:CadreRendu.camRendue`). */
export function pointStageSousPixel(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
  cam: { x: number; y: number },
  zoom: number,
): PointStage | null {
  const vb = pointViewBoxSousPixel(svg, clientX, clientY);
  return vb ? stagePointAt(vb, cam, zoom) : null;
}

/** Contexte de PROJECTION que les étages de surface inversent — la même géométrie que le peintre. */
export interface CadreDePick {
  pose: StagePose;
  dims: Dims;
  activeZ: number;
}

/** Case du MEUBLE réellement dessinée sous le pixel, à la couche `z` : la MÊME inversion par LIFT que
 *  `caseMarchable`, mais pour une case qu'un décor `prop` OCCUPE — donc justement celle que la
 *  marchabilité écarte (l'empreinte d'un meuble solide n'est pas marchable). Sans elle, le pixel d'un
 *  plateau FIN que le rayon ne touche pas retombe sur la boucle CROSS-COUCHE, qui rend une case d'un
 *  AUTRE ÉTAGE : mesuré sur `la-diligence`, la table murale (13,10) résolvait (16,13,z1) et envoyait le
 *  groupe à l'autre bout de la salle. */
export function meubleDessine(scene: Scene, cadre: CadreDePick, g: PointStage, z: number): Pt | null {
  for (const lift of sceneLifts(scene)) {
    const { x, y } = screenToTileAtLift(cadre.pose, g, lift);
    if (x < 0 || y < 0 || x >= cadre.dims.w || y >= cadre.dims.h) continue;
    if (metricToLift(heightAt(scene, x, y, z)) !== lift) continue; // cette case n'est pas dessinée à ce lift
    // PREMIÈRE case dessinée sous le pixel (lift le plus haut) : c'est celle qu'on VOIT, et elle
    // décide seule — porte-t-elle un meuble ou non. Continuer à sonder les lifts plus bas
    // rendrait un meuble d'AILLEURS, la maladie même qu'on soigne.
    return scene.entities.some((e) => e.kind === 'prop' && e.pos.x === x && e.pos.y === y && (e.z ?? 0) === z)
      ? { x, y, z }
      : null;
  }
  return null;
}

/** Case d'un AUTRE étage visée par le pointeur, BORNÉE au voisinage marchable du groupe
 *  (`walkNeighbors` — exactement la connectivité qu'emprunte le pas clavier `exploreStepDest`) : le
 *  franchissement vertical (marches, rampe, tablier) se CLIQUE donc comme il se pousse au clavier.
 *  Hors de ce voisinage l'étage ACTIF garde la priorité : une case d'un étage qu'AUCUN pas ne rejoint
 *  reste une silhouette translucide posée au-dessus du sol qu'on foule, et ne lui vole jamais le clic.
 *  Le LIFT de chaque candidat est sa HAUTEUR MÉTRIQUE rendue (`metricToLift(heightAt)`), PAS son index
 *  de couche — même correction qu'au curseur clavier (`screenStepDot`, `combatCursor.ts`). */
export function pasInterEtages(scene: Scene, cadre: CadreDePick, partyPos: Pt, g: PointStage): Pt | null {
  for (const n of walkNeighbors(scene, partyPos)) {
    const nz = n.z ?? 0;
    if (nz === cadre.activeZ) continue; // même étage : la résolution de l'étage actif suffit
    const { x, y } = screenToTileAtLift(cadre.pose, g, metricToLift(heightAt(scene, n.x, n.y, nz)));
    if (x === n.x && y === n.y) return { x: n.x, y: n.y, z: nz };
  }
  return null;
}

/** Case MARCHABLE de la couche `z` réellement DESSINÉE sous le pixel. Chaque case est projetée à son
 *  LIFT MÉTRIQUE (`metricToLift(heightAt)`), JAMAIS au seul index de couche : une marche d'escalier est
 *  dessinée soulevée, et l'inverser à plat rendait la case voisine 1 à 3 pas plus loin — les 8 marches
 *  de `la-diligence` étaient toutes injouables à la souris, donc l'étage inatteignable. Le lift le plus
 *  HAUT gagne : c'est lui qu'on voit, et une case cachée DERRIÈRE une marche n'a pas à être cliquable.
 *  Scène sans relief ⇒ un seul lift (0) ⇒ strictement l'inversion plan-sol. */
export function caseMarchable(scene: Scene, cadre: CadreDePick, g: PointStage, z: number): Pt | null {
  for (const lift of sceneLifts(scene)) {
    const { x, y } = screenToTileAtLift(cadre.pose, g, lift);
    if (x < 0 || y < 0 || x >= cadre.dims.w || y >= cadre.dims.h) continue;
    if (metricToLift(heightAt(scene, x, y, z)) !== lift) continue; // cette case n'est pas dessinée à ce lift
    if (!isWalkable(scene, x, y, z)) continue;
    return { x, y, z };
  }
  return null;
}

/** Repli CROSS-COUCHE aligné sur le curseur clavier : chaque couche est inversée à son lift, puis
 *  `resolveCursorZ` tranche la surface réelle la plus haute de la case candidate. */
export function caseAuSol(scene: Scene, cadre: CadreDePick, g: PointStage): Pt | null {
  for (const z of scene.layers.map((l) => l.z).sort((a, b) => b - a)) {
    const { x, y } = screenToTileAtLift(cadre.pose, g, z);
    if (x < 0 || y < 0 || x >= cadre.dims.w || y >= cadre.dims.h) continue;
    if (resolveCursorZ(scene, x, y) !== z) continue; // la surface réelle la plus haute ici n'est pas cette couche
    return { x, y, z };
  }
  return null;
}

const verdict = (t: Pt, via: PickVia): Verdict => ({ tile: { x: t.x, y: t.y, z: t.z ?? 0 }, cid: null, via });

/**
 * LA CHAÎNE — l'ordre dans lequel les étages se départagent, et le seul endroit où il est écrit.
 * `vise` = ce que la voie de rendu a nommé (`null` si le rayon n'a pas été tiré).
 *
 * `pointStage` est un THUNK, et c'est une contrainte de COÛT, pas un style : inverser le pixel coûte un
 * `getBoundingClientRect()` (mesure forcée du layout) et la chaîne tourne à CHAQUE `pointermove`. Quand
 * le rayon nomme déjà sa cible — le cas ordinaire du survol en combat — aucun étage de surface n'est
 * atteint et le pixel n'a pas à être inversé. Il rend `null` quand rien n'est inversable (élément sans
 * surface mesurée) : seul le rayon peut alors répondre.
 */
export function resoudrePixel(st: EtatDePick, vise: PickResult, pointStage: () => PointStage | null, cadre: CadreDePick): Verdict {
  const nommé = caseVisee(vise, st);
  if (nommé) return nommé;
  const scene = st.scene;
  if (!scene) return { tile: null, cid: null, via: 'aucune' };
  const g = pointStage();
  if (!g) return { tile: null, cid: null, via: 'aucune' };
  if (st.mode !== 'battle') {
    const meuble = meubleDessine(scene, cadre, g, cadre.activeZ);
    if (meuble) return verdict(meuble, 'meuble');
  }
  if (st.mode === 'exploration') {
    const pas = pasInterEtages(scene, cadre, st.partyPos, g);
    if (pas) return verdict(pas, 'pas-etage');
    const ici = caseMarchable(scene, cadre, g, cadre.activeZ);
    if (ici) return verdict(ici, 'sol');
  }
  const sol = caseAuSol(scene, cadre, g);
  return sol ? verdict(sol, 'sol') : { tile: null, cid: null, via: 'aucune' };
}
