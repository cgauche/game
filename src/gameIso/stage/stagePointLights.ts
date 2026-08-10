/**
 * LAMPES PONCTUELLES de l'écran de jeu volumique (#1245, lot L1) — les FLAQUES que les sources de
 * lumière de la scène (`state/visionState.ts` → `sceneLightSources`) posent dans le monde. Module PUR
 * à part de `GameStage3D`, au même titre que `stageLights.ts` (l'ambiante et le soleil) : l'écran
 * MONTE ce que cette passe décide, il ne décide rien lui-même.
 *
 * POOL FIXE, et c'est STRUCTUREL. Le compte de lampes montées entre dans la clé de cache de programme
 * de three (`numPointLights`, `getProgramCacheKeyParameters` — mesuré dans `three.module.js` 0.185.1,
 * et le test épingle la ligne) : le faire varier RECOMPILE tous les matériaux du monde (76 sur l'arène).
 * Donc : `createPointLightPool` monte un budget FIXE une fois pour toutes, et `applyPointLights`
 * ne bouge plus que l'INTENSITÉ, la position et la portée. Une lampe éteinte a une intensité de 0 —
 * jamais `visible = false`, qui la retirerait de la passe de lumière (`WebGLRenderer.projectObject`
 * ignore un objet invisible) et ferait donc exactement varier le compte que l'on fige.
 *
 * `decay = 0` : l'atténuation physique en 1/d² n'a rien à voir avec la mécanique du jeu, qui dégrade
 * linéairement jusqu'à son rayon (`state/vision.ts` `falloff`). Ce que `distance` fait, en revanche,
 * est exactement ce qu'on veut : three coupe la contribution par `pow2(saturate(1 − pow4(d/distance)))`,
 * donc RIEN au-delà de `radiusTiles × mpt` — la flaque ne déborde jamais du rayon RAW de la source.
 *
 * ÉCARTS CONSIGNÉS (visuels seulement — le champ mécanique, lui, reste la vérité de jeu) :
 *  - three ADDITIONNE les contributions là où `computeLightField` les combine par MAX — d'où
 *    l'intensité CALÉE sous la saturation (`FLAME_INTENSITY`) : sans tone mapping, deux flaques qui
 *    se recouvrent écrêteraient en aplat blanc ;
 *  - les flaques ne sont pas coupées par les murs (le champ mécanique, lui, le sait) ;
 *  - la lampe est levée de `FLAME_LIFT_M` au-dessus du sol (une lampe posée AU sol n'éclairerait pas
 *    le sol : sa direction y est rasante, donc `dotNL` nul) — la flaque au sol est donc un peu plus
 *    courte que le rayon RAW, jamais plus longue.
 */
import * as THREE from 'three';
import { LIGHT_LEVEL_BY_ID } from '../../data';
import { heightAt, type Scene } from '../../state/scene';
import type { LightSource } from '../../state/vision';
import { ambianceLuminance } from '../catalog/ambiance';
import { LIGHT_COLOR } from '../backends/webgl/sceneMeshes';

/** Nombre de lampes ponctuelles montées EN PERMANENCE. Budget mesuré sur la population réelle : 3
 *  sources sur le terrain d'entraînement, ≤ 12 sur le hub de l'arène (#1245). Au-delà, ce sont les
 *  sources POSÉES qui passent (cf. `pointLightWrites`). */
export const POINT_LIGHT_BUDGET = 12;

/** Hauteur (m) de la flamme au-dessus du sol de sa case — apparence, aucune règle. */
export const FLAME_LIFT_M = 1;

/** Luminance VISÉE au foyer d'UNE flaque au palier `nuit` (part d'albédo, `ambianceLum` comprise). En
 *  dessous de 1 par CONSTRUCTION : three ADDITIONNE les contributions et ce canevas n'a aucun tone
 *  mapping — deux flaques qui se chevauchent, sinon, écrêtent en aplat blanc. La marge laissée est ce
 *  qu'une seconde flaque peut ajouter au même point sans saturer. */
export const FOYER_NUIT_CIBLE = 0.85;

/** Luminance du palier `nuit` — le plancher que les flaques COMPLÈTENT (`stageLights.ts` :
 *  `ambianceLuminance` du scalaire de `lightLevels.json`), lu en donnée et jamais recopié. */
const AMBIANCE_NUIT = ambianceLuminance(LIGHT_LEVEL_BY_ID.get('nuit')!.scalar);

/** Part d'albédo qu'une flaque rend à son foyer AVANT extinction par l'ambiance (l'intensité écrite
 *  vaut `FLAME_INTENSITY × π × extinction` : le facteur `π` est la conversion du lambertien de three,
 *  `BRDF_Lambert` portant le `RECIPROCAL_PI` — la même qu'à l'ambiante de `stageLights.ts`).
 *
 *  CALÉE, pas choisie : au foyer d'une source (`flaquePart` y culmine à ~1), la luminance du sol vaut
 *  `ambianceLum + FLAME_INTENSITY × (1 − ambianceLum)`, qu'on veut à `FOYER_NUIT_CIBLE` au palier
 *  `nuit`. MESURE (`stage-flaques.test.tsx`, profil épinglé) : 0,7769 → foyer de nuit 0,8497 sur un
 *  plancher d'ambiance de 0,3276 ; foyer le plus haut des cinq paliers 0,9542 (`couvert`) ; point le
 *  plus clair des scènes livrées 0,9592 (arène zone 4, l'aplomb d'un brasero dans la flaque de son
 *  voisin) — aucun recouvrement écrêté. */
export const FLAME_INTENSITY = (FOYER_NUIT_CIBLE - AMBIANCE_NUIT) / (1 - AMBIANCE_NUIT);

/** Part d'albédo qu'une flaque rend à une surface horizontale située `dM` mètres à l'horizontale de
 *  l'aplomb de sa flamme et `liftM` mètres SOUS elle, pour une portée `distanceM` et une extinction
 *  donnée. DÉFINITION UNIQUE — celle des chunks de three, mesurés (`stage-flaques.test.tsx`) :
 *  `dotNL` (la surface regarde en l'air, la flamme est `liftM` plus haut) × la fenêtre de coupure
 *  `pow2(saturate(1 − pow4(L/D)))`, avec `L` la distance RÉELLE à la flamme. C'est par elle que le
 *  profil d'une flaque se mesure, jamais à vue.
 *
 *  `liftM` vaut `FLAME_LIFT_M` par défaut : le sol de la case de la source, le cas du monde. Une
 *  flamme au NIVEAU de la surface (`liftM` nul) ou EN DESSOUS (négatif) ne lui rend rien — `dotNL`
 *  est saturé à 0 dans three comme ici, et c'est pourquoi le sol d'un étage au-dessus d'une torche
 *  reste noir. */
export function flaquePart(dM: number, distanceM: number, extinction: number, liftM: number = FLAME_LIFT_M): number {
  if (distanceM <= 0) return 0;
  const L = Math.hypot(dM, liftM);
  if (L <= 0) return 0;
  const dotNL = Math.max(0, liftM) / L;
  const coupure = Math.min(1, Math.max(0, 1 - Math.pow(L / distanceM, 4)));
  return FLAME_INTENSITY * extinction * dotNL * coupure * coupure;
}

/** Luminance du sol sous une flaque : le palier d'ambiance PLUS ce que la flaque y ajoute — la somme
 *  que three fait réellement (contributions ADDITIVES, aucun tone mapping). */
export function flaqueLuminance(ambianceLum: number, dM: number, distanceM: number): number {
  return ambianceLum + flaquePart(dM, distanceM, extinctionDe(ambianceLum));
}

/** Ce qu'il reste à allumer sous le palier d'ambiance : 1 en ténèbres, 0 en plein jour. */
export function extinctionDe(ambianceLum: number): number {
  return Math.min(1, Math.max(0, 1 - ambianceLum));
}

/** Une lampe TELLE QU'ELLE ÉCLAIRE à l'instant de la frame — la surface exacte que `THREE.PointLight`
 *  offre, et rien de plus : c'est la lampe MONTÉE qu'on interroge (donc déjà glissée avec son porteur,
 *  `stage/boardPose.ts`), jamais la table qui l'a écrite. */
export interface LitLamp {
  position: { x: number; y: number; z: number };
  intensity: number;
  distance: number;
}

/**
 * EXPOSITION d'un BILLBOARD (#1245, L3) — ce qui remplace l'exposition GLOBALE de la frame sur un quad
 * de personnage. Un billboard n'a pas de normale exploitable (`billboardMaterial`, `boardPose.ts`) :
 * aucune lampe ponctuelle ne l'atteint par le chemin lambertien de three, si bien qu'un héros au pied
 * d'un brasero restait exactement aussi clair qu'à vingt mètres — le sol s'allumait, les personnages non.
 *
 * La flaque qu'un personnage reçoit est celle de SA CASE, par la MÊME définition que le sol
 * (`flaquePart`, la loi mesurée sur les chunks de three), et non le dégradé linéaire du champ mécanique
 * (`state/vision.ts` `falloff`) : deux lois donneraient deux flaques à l'écran, et un héros au bord
 * serait plus clair que la case sous ses pieds. Elle S'AJOUTE à l'exposition de la frame exactement
 * comme elle s'ajoute au palier d'ambiance pour le sol (`flaqueLuminance`) — three additionne les
 * contributions. Le plafond à 1 est celui de l'écran : au-delà, le rendu du sol écrête lui aussi.
 *
 * La distance à la lampe est celle des TROIS axes : l'ancre est aux PIEDS du sujet, donc à la hauteur
 * du sol de sa case, et la flamme est `liftM = lampe.y − ancre.y` au-dessus d'elle — exactement
 * `FLAME_LIFT_M` quand les deux partagent l'étage. Un sujet posté AU-DESSUS de la flamme reçoit ce
 * que reçoit le sol sur lequel il se tient : rien (`dotNL` saturé à 0).
 *
 * L'extinction de la frame se RELIT sur la lampe (`intensity / (FLAME_INTENSITY × π)`) : la lampe montée
 * est la seule vérité de ce qui éclaire, et une lampe éteinte (intensité 0) ne contribue à rien.
 *
 * RÉSIDUS CONSIGNÉS (mêmes classes que l'ombre portée du billboard) :
 *  - la lumière reçue est OMNIDIRECTIONNELLE — le quad n'a pas de côté, un personnage éclairé de dos
 *    l'est comme de face ;
 *  - la flaque est prise à l'ANCRE, donc au pied : la tête d'un sujet reçoit ce que reçoivent ses
 *    bottes, un quad ne se dégrade pas sur sa hauteur ;
 *  - les flaques ne sont pas coupées par les murs (l'écart de l'en-tête, ici aussi).
 */
export function billboardExposure(
  anchor: { x: number; y: number; z: number },
  lamps: readonly LitLamp[],
  surfaceLuminance: number,
): number {
  let part = 0;
  for (const l of lamps) {
    if (l.intensity <= 0 || l.distance <= 0) continue;
    const dM = Math.hypot(anchor.x - l.position.x, anchor.z - l.position.z);
    part += flaquePart(dM, l.distance, l.intensity / (FLAME_INTENSITY * Math.PI), l.position.y - anchor.y);
  }
  return Math.min(1, surfaceLuminance + part);
}

/** Ce qu'une frame écrit sur UNE lampe du pool — la décision, avant tout objet three. */
export interface PointLightWrite {
  /** Porteur de la source (`LightSource.srcId`) : la couture par laquelle une lampe suivra son sujet. */
  srcId?: string;
  /** Position MONDE (mètres, repère three : x = colonne, y = hauteur, z = ligne). */
  x: number;
  y: number;
  z: number;
  /** Intensité three (0 = éteinte). */
  intensity: number;
  /** Portée : `radiusTiles × mpt` — la flaque s'annule au rayon RAW de la source. */
  distance: number;
}

/** Le POOL, monté une fois pour toutes. Toutes les lampes naissent éteintes (`intensity` 0) et
 *  VISIBLES : c'est l'intensité qui les allume, jamais leur présence. */
export function createPointLightPool(budget: number = POINT_LIGHT_BUDGET): THREE.PointLight[] {
  const pool: THREE.PointLight[] = [];
  for (let i = 0; i < budget; i++) {
    const lampe = new THREE.PointLight(LIGHT_COLOR, 0, 0, 0);
    // Une ombre par lampe ponctuelle = une carte cubique de plus à cuire par frame, et un second
    // compte dans la clé de programme (`numPointLightShadows`). Le monde a déjà celle du soleil.
    lampe.castShadow = false;
    pool.push(lampe);
  }
  return pool;
}

/** Ce que la frame écrit sur le POOL, INDEX PAR INDEX : `slots[i]` va sur `pool[i]`, `null` = lampe
 *  éteinte. La longueur vaut toujours le budget — c'est la table d'occupation, pas une liste. */
export type PointLightSlots = readonly (PointLightWrite | null)[];

/** Clé de SLOT d'une source : son porteur. Une source sans porteur nommé (`LightSource.srcId` absent)
 *  retombe sur une clé commune — elle garde alors son slot tant qu'elle est seule de son espèce. */
const SANS_PORTEUR = '(sans porteur)';
const cléDe = (s: { srcId?: string }): string => s.srcId ?? SANS_PORTEUR;

/**
 * DÉCISION d'une frame : ce que chaque source de lumière de la scène écrit sur une lampe du pool.
 * `ambianceLum` = la luminance du palier (`stageLights` : le complément du voile de nuit de la voie
 * affine) — l'intensité la COMPLÈTE, si bien qu'à midi (`ambianceLum` 1) les flaques s'éteignent d'
 * elles-mêmes, sans porte par nom : une lampe à pleine intensité sous le soleil ne serait pas
 * invisible, elle ferait une tache BLANCHE (aucun tone mapping sur ce canevas).
 *
 * SLOT STABLE. Une source garde SON index de lampe tant qu'elle vit (`prev` = la table de la frame
 * précédente, relue par porteur) : sans cela, l'ordre des sources décide du slot, et une lampe saute
 * de sujet en sujet dès qu'une source apparaît ou meurt — ce qui, au glissement de la marche
 * (lot L2), fait sauter la flaque elle-même. Une source qui meurt LIBÈRE son slot sans déplacer les
 * autres ; une nouvelle prend le premier slot libre.
 *
 * BUDGET SATURÉ : les sources POSÉES passent d'abord (le décor de la scène : brasero, torche murale),
 * les PORTÉES remplissent le reste. Trier par rayon éteindrait les braséros d'une salle à l'arrivée
 * d'un groupe à lanternes (rayon 10 > rayon 4) — le décor ne clignote pas parce qu'on entre.
 */
export function pointLightWrites(
  sources: readonly LightSource[],
  opts: { scene: Scene; mpt: number; ambianceLum: number; budget?: number; prev?: PointLightSlots },
): PointLightSlots {
  const budget = opts.budget ?? POINT_LIGHT_BUDGET;
  const extinction = extinctionDe(opts.ambianceLum);
  const slotPrécédent = new Map<string, number>();
  opts.prev?.forEach((w, i) => { if (w && i < budget) slotPrécédent.set(cléDe(w), i); });

  const slots: (PointLightWrite | null)[] = new Array(budget).fill(null);
  const àPlacer: PointLightWrite[] = [];
  const posées = sources.filter((s) => !s.carried);
  const portées = sources.filter((s) => s.carried);
  for (const s of [...posées, ...portées].slice(0, budget)) {
    const z = s.z ?? 0;
    const w: PointLightWrite = {
      srcId: s.srcId,
      x: s.pos.x * opts.mpt,
      y: heightAt(opts.scene, s.pos.x, s.pos.y, z) + FLAME_LIFT_M,
      z: s.pos.y * opts.mpt,
      intensity: FLAME_INTENSITY * Math.PI * extinction,
      distance: s.radiusTiles * opts.mpt,
    };
    const tenu = slotPrécédent.get(cléDe(w));
    if (tenu !== undefined && slots[tenu] === null) slots[tenu] = w;
    else àPlacer.push(w);
  }
  let libre = 0;
  for (const w of àPlacer) {
    while (libre < budget && slots[libre] !== null) libre++;
    if (libre >= budget) break;
    slots[libre] = w;
  }
  return slots;
}

/** Applique la table au POOL, index par index : `null` éteint la lampe. Ni ajout, ni retrait, ni
 *  `visible` — le compte monté ne bouge pas d'un cran (cf. l'en-tête). */
export function applyPointLights(pool: readonly THREE.PointLight[], slots: PointLightSlots): void {
  for (let i = 0; i < pool.length; i++) {
    const lampe = pool[i];
    const w = slots[i];
    if (!w) {
      lampe.intensity = 0;
      continue;
    }
    lampe.position.set(w.x, w.y, w.z);
    lampe.distance = w.distance;
    lampe.intensity = w.intensity;
  }
}
