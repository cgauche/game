/**
 * TEXTURES STATIQUES d'un billboard (décor, corps sans couture de frame) et leur RANG dans la file
 * cadencée du cuiseur (#1373).
 *
 * Une texture statique se mémoïse sur sa clé (`getBillboardTexture`) et s'obtient à un REGARD donné :
 * l'identité de cache d'un décor porte son cran, celle d'un personnage l'ignore (`identiteAuCran`).
 * Ce module tient la carte des POIGNÉES : le rang d'une clé qui ATTEND encore son tour, pour que la
 * caméra puisse le relever ou le rendre au réchauffage sans jamais reconstruire la file.
 */
import type * as THREE from 'three';
import type { Rot } from '../../geometry/iso';
import { billboardTextureKey } from '../backends/webgl/billboardMath';
import type { View } from '../rig/facing';
import { clearBillboardTextures, getBillboardTexture, svgToTexture } from '../backends/webgl/svgTexture';
import { PRIORITE_RECHAUFFAGE, PRIORITE_VUE_COURANTE, queueBakeTask, type BakePriority } from '../backends/webgl/atlasBake';
import type { BillboardSubject } from '../backends/webgl/sceneMeshes';
import { identiteAuCran } from './regard';

/**
 * POIGNÉES DE PRIORITÉ des textures statiques EN FILE, par clé (`BakePriority`, l'objet mutable que le
 * cuiseur relit à chaque tranche).
 *
 * Sans elle, une clé posée en réchauffage puis redemandée par la caméra restait servie en dernier : la
 * mémoïsation (`getBillboardTexture`) rend la promesse DÉJÀ en file sans jamais toucher à son rang, et
 * la relève du cran franchi passait derrière toute la pré-chauffe (mesuré : rang 31/31 contre 1/31 à
 * froid ; 56 rasterisations pour 20 décors utiles). Le cuiseur a la même carte pour ses planches
 * (`enqueueBake`) — c'est le même geste, pour l'autre population.
 *
 * Elle ne tient QUE ce qui attend : la poignée se pose à l'entrée en file et se retire au départ de la
 * tâche. Une clé déjà servie par le cache n'y entre pas — une poignée fantôme se ferait relire par
 * chaque passage de `rendreAuRechauffage`, sans plus rien commander.
 */
const POIGNEES_STATIQUES = new Map<string, BakePriority>();

/** TEXTURE STATIQUE d'un sujet à une vue et un cran, mémoïsée sur sa clé (`getBillboardTexture`).
 *
 *  `priorité` la range dans la file CADENCÉE du cuiseur (`queueBakeTask`) : c'est par là que passe
 *  toute rasterisation qu'un changement de regard réclame, une par tranche d'inactivité et jamais en
 *  rafale. Sans priorité, la rasterisation part tout de suite — le MONTAGE d'une scène, dont chaque
 *  quad n'entre en scène qu'à sa texture.
 *
 *  Dans les DEUX cas, une clé DÉJÀ EN FILE que la caméra réclame voit son rang RELEVÉ, jamais abaissé :
 *  la mémoïsation rend la promesse en attente telle quelle, et le montage comme la repose hériteraient
 *  sinon du rang du temps mort qui l'a posée. */
export function textureAuCran(
  sub: BillboardSubject,
  view: View,
  mirror: boolean,
  rot: Rot,
  pxHeight: number,
  priorité?: number,
): Promise<THREE.Texture> {
  const clé = billboardTextureKey(identiteAuCran(sub, rot), view, mirror, pxHeight);
  const rasteriser = () => svgToTexture(sub.svg(view, mirror, rot), sub.box, pxHeight);
  const rang = POIGNEES_STATIQUES.get(clé);
  const voulu = priorité ?? PRIORITE_VUE_COURANTE;
  if (rang) rang.value = Math.max(rang.value, voulu);
  if (priorité === undefined) return getBillboardTexture(clé, rasteriser);
  // La poignée se pose DANS la fabrique : elle seule court sur un vrai manque de cache. Posée avant,
  // une clé déjà servie en laissait une que rien ne retirerait jamais.
  return getBillboardTexture(clé, () => {
    const poignée = rang ?? { value: priorité };
    POIGNEES_STATIQUES.set(clé, poignée);
    return queueBakeTask(poignée, () => {
      // La carte ne tient que ce qui ATTEND : une tâche partie n'a plus de rang à défendre.
      POIGNEES_STATIQUES.delete(clé);
      return rasteriser();
    });
  });
}

/** Rend au RÉCHAUFFAGE les textures statiques que la caméra n'attend plus (le regard qu'on vient de
 *  quitter) : laissées en tête de file, elles font patienter celles du regard courant. */
export function rendreAuRechauffage(): void {
  for (const poignée of POIGNEES_STATIQUES.values()) {
    if (poignée.value > PRIORITE_RECHAUFFAGE) poignée.value = PRIORITE_RECHAUFFAGE;
  }
}

/** Oublie le cache de textures statiques ET les rangs de ce qui l'attendait (changement de scène). */
export function viderTexturesStatiques(): void {
  clearBillboardTextures();
  POIGNEES_STATIQUES.clear();
}

/** RANG de chaque clé statique encore EN ATTENTE — la carte que le cuiseur relit, en lecture seule.
 *  C'est par elle que se mesurent l'ordre de service d'un changement de regard et l'absence de
 *  poignée fantôme. */
export function poigneesEnAttente(): ReadonlyMap<string, number> {
  return new Map([...POIGNEES_STATIQUES].map(([clé, p]) => [clé, p.value]));
}
