/**
 * MATÉRIAUX du monde CUIT — un matériau par GROUPE DE SURFACE (`geometry.userData.surfaceGroups`,
 * index = `materialIndex` des `geometry.groups`). La géométrie reste FUSIONNÉE, seul le dessin se
 * scinde : le groupe nu garde la couleur cuite au sommet, les autres reçoivent le masque de période
 * de leur surface (UV en MÈTRES, d'où une répétition inverse de la période métrique du groupe) ou
 * leur CUISSON PAR FACE (colombage), échantillonnée sur l'UV de face (`uv1`).
 *
 * Régime LAMBERTIEN par défaut — celui du jeu : l'ambiante porte la scène quand aucun soleil ne
 * l'éclaire, et rien ne bascule au crépuscule. `lit: false` rend le régime PLAT (`MeshBasicMaterial`,
 * aucune lampe consultée) : le seul axe sur lequel les planches QC divergent du jeu.
 *
 * Le module porte aussi la source unique des matériaux de PLAN TRANSPARENT du monde
 * (`materiauPlanTransparent`, en fin de fichier) : billboards, marques, halos, météo, décalque.
 */
import * as THREE from 'three';
import { getFaceBake, getFaceBakeEnFile } from './faceBake';
import { getPeriodTexture, getPeriodTextureEnFile } from './periodTexture';
import type { WorldGeometry } from './sceneMeshes';

/** Matériau d'un groupe de surface : les trois régimes partagent `map`, `color` et les couleurs de
 *  sommet — tout ce que cette passe écrit. */
export type WorldSurfaceMaterial = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;

/** Ce que rend une RELÈVE de gabarit quand elle s'achève. */
export interface RelèveDeSurface {
  /** La clé d'attente annoncée par `attendues` — celle qu'un voile d'entrée en scène tient. */
  clé: string;
  /** La `map` a-t-elle été posée ? `false` = gabarit vide (masque neutre), cuisson perdue, ou tâche
   *  d'une scène révolue. */
  posé: boolean;
}

/** Les matériaux du monde et, en mode EN FILE, de quoi les orchestrer. */
export interface SurfacesDuMonde {
  /** Un matériau par groupe de surface, dans l'ordre — UTILISABLES tout de suite. */
  materials: WorldSurfaceMaterial[];
  /** Clés des gabarits FROIDS partis en file : ce qu'un appelant a à attendre avant de se dire servi.
   *  Vide quand tout était au cache, et toujours vide en mode SYNCHRONE. */
  attendues: string[];
  /** Une relève par clé attendue. Ne rejette JAMAIS : une cuisson perdue rend `posé: false`, sans quoi
   *  un voile adossé à ces promesses resterait accroché à un gabarit cassé. */
  relèves: Promise<RelèveDeSurface>[];
}

/** Clé d'attente d'un groupe de surface : son RANG dans la géométrie plus son identité de cuisson —
 *  deux groupes ne partagent donc jamais une clé, même à cuisson partagée. */
const cléDeSurface = (rang: number, key: string): string => `face:${rang}|${key}`;

/** Pose la `map` cuite d'un gabarit sur son matériau, et le gain sur sa couleur. Vaut au montage comme
 *  À LA RELÈVE (le matériau est alors déjà monté) — d'où le `needsUpdate`, que la compilation du
 *  programme réclame quand une `map` apparaît sur un matériau déjà servi. */
function poserGabarit(
  mat: WorldSurfaceMaterial,
  texture: THREE.Texture,
  gain: number,
  periodM?: { u: number; v: number },
): void {
  if (periodM) texture.repeat.set(1 / periodM.u, 1 / periodM.v);
  mat.map = texture;
  mat.color.setScalar(gain);
  mat.needsUpdate = true;
}

/**
 * Les matériaux du monde cuit, dans l'ordre des groupes de surface. `anisotropy` vient du renderer qui
 * les dessinera (`capabilities.getMaxAnisotropy`). L'appelant en est PROPRIÉTAIRE : il les libère avec
 * le maillage qui les porte.
 *
 * `enFile` (#1399) choisit QUAND les gabarits (colombage `faceBake`, période `periodTexture`) sont
 * rasterisés :
 *  - `false` (défaut) — SYNCHRONE, tout est cuit avant le retour. C'est ce qu'exige une cuisson HORS
 *    ÉCRAN à usage unique (`stage/planSnapshot`) : son monde naît et meurt dans l'appel, une texture
 *    qui arriverait après ne serait sur aucune image, et son instantané sortirait en aplats ;
 *  - `true` — les gabarits FROIDS partent par la file cadencée du cuiseur (une cuisson par tranche
 *    d'inactivité), et le matériau sort avec sa seule couleur de sommet — l'aplat de base de la
 *    surface, celui-là même que le masque MULTIPLIE. L'appelant tient l'écran par `attendues` et
 *    repeint sur `relèves`. Les gabarits déjà au cache, eux, sont posés tout de suite dans les deux
 *    modes.
 */
export function worldSurfaceMaterials(
  geometry: WorldGeometry,
  anisotropy: number,
  opts: { lit?: boolean; enFile?: boolean } = {},
): SurfacesDuMonde {
  const lit = opts.lit ?? true;
  const enFile = opts.enFile ?? false;
  const attendues: string[] = [];
  const relèves: Promise<RelèveDeSurface>[] = [];
  const materials = geometry.userData.surfaceGroups.map((g, rang) => {
    // Un groupe qui authore sa réponse à la lumière (décor volumique, `materials.json` domaine `prop`) se monte en
    // matériau à rugosité/métal : le lambertien commun n'a ni l'une ni l'autre à offrir.
    const mat: WorldSurfaceMaterial = !lit
      ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
      : g.pbr
        ? new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, roughness: g.pbr.roughness, metalness: g.pbr.metalness })
        : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true });
    /** Enregistre une relève et rend le matériau nu en attendant. */
    const relever = <T>(prêt: Promise<T | null>, poser: (cuit: T) => void): WorldSurfaceMaterial => {
      const clé = cléDeSurface(rang, g.key);
      attendues.push(clé);
      relèves.push(prêt.then((cuit) => {
        if (cuit) poser(cuit);
        return { clé, posé: cuit != null };
      }, () => ({ clé, posé: false })));
      return mat;
    };
    if (g.bake && g.recipe) {
      const surface = { color: g.color ?? '', recipe: g.recipe, part: g.part };
      const poser = (c: { texture: THREE.Texture; gain: number }): void => poserGabarit(mat, c.texture, c.gain);
      if (!enFile) {
        const cuisson = getFaceBake(g.key, surface, g.bake.wM, g.bake.hM, g.variant ?? 0, anisotropy);
        if (cuisson) poser(cuisson);
        return mat;
      }
      const { cuisson, prêt } = getFaceBakeEnFile(g.key, surface, g.bake.wM, g.bake.hM, g.variant ?? 0, anisotropy);
      if (cuisson) {
        poser(cuisson);
        return mat;
      }
      return relever(prêt, poser);
    }
    const periodM = g.periodM;
    if (!g.kind || !g.recipe || !periodM) return mat;
    const pOpts = { kind: g.kind, baseColor: g.color ?? '', anisotropy };
    const poser = (p: { texture: THREE.Texture; gain: number }): void => poserGabarit(mat, p.texture, p.gain, periodM);
    if (!enFile) {
      const période = getPeriodTexture(g.key, g.recipe, g.variant ?? 0, pOpts);
      if (période) poser(période);
      return mat;
    }
    const { période, prêt } = getPeriodTextureEnFile(g.key, g.recipe, g.variant ?? 0, pOpts);
    if (période) {
      poser(période);
      return mat;
    }
    return relever(prêt, poser);
  });
  return { materials, attendues, relèves };
}

/**
 * MATÉRIAU d'un PLAN TRANSPARENT à DEUX FACES, dessiné en UNE SEULE PASSE — la source unique de tout
 * matériau `transparent + DoubleSide` du monde volumique (billboard et son jumeau, marques de sol,
 * halos, nappes de brume, semis d'averse, décalque d'authoring).
 *
 * Un plan aligné écran ou plaqué au sol n'a pas de face arrière à trier : ses deux faces montrent le
 * même texel au même endroit. Sans `forceSinglePass`, `WebGLRenderer.renderObject` scinde tout
 * matériau `transparent + DoubleSide` en DEUX rendus (`side = BackSide` puis `FrontSide`, chacun
 * précédé d'un `needsUpdate = true`) : deux résolutions de programme par matériau ET PAR RENDU,
 * qu'il y ait un pixel à peindre ou zéro instance dessinée.
 *
 * Les paramètres du site (`map`, `alphaTest`, `color`, `opacity`, `depthWrite`, `depthFunc`, `fog`,
 * `blending`, `toneMapped`…) sont fusionnés tels quels ; le triplet transparent/DoubleSide/
 * forceSinglePass, lui, n'est pas surchargeable — un site qui aurait besoin du tri par face (un
 * VOLUME, jamais un plan) construit son matériau lui-même.
 */
export function materiauPlanTransparent(params: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ ...params, transparent: true, side: THREE.DoubleSide, forceSinglePass: true });
}
