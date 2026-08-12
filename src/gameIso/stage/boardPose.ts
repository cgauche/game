/**
 * POSE PAR FRAME des billboards du monde volumique (#1176, P2-4) — la passe que la MARCHE rejoue
 * soixante fois par seconde, hors de tout rendu React. Elle ne construit RIEN : ni géométrie, ni
 * matériau, ni texture ; elle ne fait que ré-orienter des quads déjà montés et les décaler du
 * glissement de l'instant.
 *
 * Module à part de `GameStage3D` — et c'est STRUCTUREL : cette passe est PURE (aucun DOM, aucun
 * contexte WebGL), donc mesurable telle quelle, là où la frame complète de l'écran demande un
 * renderer que jsdom ne sait pas fournir.
 *
 * Ce qui appartient à UN sujet voyage AVEC lui : son quad, son ombre de contact plaquée à l'aplomb de
 * la même ancre, et les LAMPES qu'il porte (#1245, L2). Une ombre laissée à l'ancre cuite attendrait le
 * marcheur sur sa case d'arrivée ; une lanterne laissée là éclairerait la case qu'il vient de quitter.
 */
import * as THREE from 'three';
import { billboardDepthOffsetUnits, billboardPose, poseContactShadow, type BillboardSubject } from '../backends/webgl/sceneMeshes';
import { billboardExposure, type PointLightSlots } from './stagePointLights';

/** Un billboard monté : ce qu'il faut pour le RE-POSER quand la caméra bouge, sans le reconstruire. */
export interface Board {
  sub: BillboardSubject;
  quad: { widthM: number; heightM: number; centerLiftM: number };
  mesh: THREE.Mesh;
  /** Matériau du quad — jamais lambertien (P2-5) : la normale d'un quad aligné écran est l'axe caméra.
   *  Le type reste ouvert pour l'écran de SPIKE, qui monte les siens. */
  material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
  /** Disque d'ombre de contact du sujet, quand il en porte un (`wantsContactShadow`). */
  shadow?: THREE.Object3D;
}

/** Caméra de la frame — l'offset de profondeur des quads se dérive de son plan (`near`/`far`). */
export type FrameCamera = THREE.Camera & { near: number; far: number };

/** SEUIL de découpe des texels d'un sprite : sous lui, le fragment est REJETÉ (le sprite garde sa
 *  silhouette au lieu d'un rectangle voilé). Exporté : l'allure d'un jeton se pose sous ce seuil et
 *  doit pouvoir se mesurer contre lui. */
export const ALPHA_TEST = 0.5;

/**
 * MATÉRIAU d'un billboard du stage (#1176, P2-5) — TOUJOURS `MeshBasicMaterial`, et c'est structurel :
 * un quad aligné écran a pour normale l'axe caméra, donc un matériau lambertien y mesure l'angle
 * caméra↔soleil et la luminosité d'un personnage change quand la vue tourne (mesuré : ×2,36 entre deux
 * crans). Sa lumière est donc un SCALAIRE : `luminance` = l'exposition du sujet À CET ENDROIT
 * (`billboardExposure` : l'exposition globale de la frame, plus les flaques de lampe qui l'atteignent),
 * multipliée par la teinte de visibilité du sujet.
 */
export function billboardMaterial(map: THREE.Texture, luminance: number): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: ALPHA_TEST, side: THREE.DoubleSide });
  mat.color.setScalar(luminance);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  // DÉSATURATION du quad (P3-0f) : la teinte de matériau MULTIPLIE la texture, elle ne peut donc pas
  // en retirer la couleur — un jeton hors Ligne de Vue se lit au gris, pas au sombre. Un uniforme, une
  // ligne de fragment, et la MÊME source pour tous les billboards (un seul programme compilé).
  const desat = { value: 0 };
  // OPACITÉ D'ALLURE (P3-0f) : elle ne peut PAS passer par `material.opacity`. La chaîne de fragment de
  // `MeshBasicMaterial` part de `vec4( diffuse, opacity )`, multiplie par le texel dans `map_fragment`,
  // puis REJETTE le fragment sous le seuil (`alphatest_fragment` : `if ( diffuseColor.a < alphaTest )
  // discard`, three `ShaderLib/meshbasic.glsl.js`) : une opacité inférieure au seuil efface le sujet
  // ENTIER, texels opaques compris. Elle se multiplie donc APRÈS l'alphatest, qui garde son unique
  // office — découper les texels transparents du sprite.
  const allureAlpha = { value: 1 };
  mat.userData.desat = desat;
  mat.userData.allureAlpha = allureAlpha;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDesat = desat;
    shader.uniforms.uAllureAlpha = allureAlpha;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uDesat;\nuniform float uAllureAlpha;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, vec3( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ), uDesat );',
      )
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n\tdiffuseColor.a *= uAllureAlpha;');
  };
  return mat;
}

/** Ce que le CHROME d'un jeton change à l'ALLURE de son billboard (#1176, P3-0f) — la même donnée que
 *  la voie affine porte en style CSS sur son corps (`BodyToken`). */
export interface BoardChrome {
  ghost: boolean;
  dim: boolean;
  highlight: string | null;
}

/** Opacité d'un corps HORS D'ACTION, et d'un corps hors Ligne de Vue (`BodyToken`, style du jeton). */
export const DIM_OPACITY = 0.82;
export const GHOST_OPACITY = 0.45;
/** Part de couleur retirée à un corps hors Ligne de Vue (`grayscale(0.85)`, même site). */
export const GHOST_DESAT = 0.85;

/** LUMINANCE perçue d'une couleur (Rec. 709) — la même pondération que la désaturation du fragment. */
export function luminance709(c: THREE.Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** TEINTE du quad : son exposition, portée sur la couleur de relation quand ce jeton est la cible
 *  survolée. Trois canaux en tout (teinte, opacité, désaturation), tous portés par le matériau DÉJÀ
 *  monté — aucun n'en ajoute un quatrième, et la passe de pose reste leur unique écrivain. */
export function boardChromeTint(chrome: BoardChrome | null, luminance: number, out: THREE.Color): THREE.Color {
  if (!chrome?.highlight) return out.setScalar(luminance);
  // MISE EN ÉVIDENCE de la cible survolée : la silhouette prend la couleur de relation À EXPOSITION
  // CONSTANTE. La normalisation se mesure donc en LUMINANCE (Rec. 709), jamais sur le canal le plus
  // fort : le rouge d'adversaire n'a que 0,143 de luminance pour 0,527 de canal rouge, et le ramener
  // par son canal max lui retirait 73 % de sa lumière (mesuré) — le survol ASSOMBRISSAIT sa cible.
  out.set(chrome.highlight);
  const L = luminance709(out);
  out.multiplyScalar(L > 0 ? luminance / L : luminance);
  // ÉCART RÉSIDUEL : une teinte saturée SOMBRE ne peut pas tenir l'exposition d'une frame claire — le
  // rouge d'adversaire y demanderait 1,84 sur son canal rouge. Les canaux se bornent alors à 1, et la
  // luminance rendue reste sous la cible (mesuré : 0,321 pour 0,5 demandé, soit −36 % — contre 0,136
  // sous la normalisation par canal max). En deçà du dépassement, l'exposition est tenue à l'exact.
  const max = Math.max(out.r, out.g, out.b);
  return max > 1 ? out.setRGB(Math.min(1, out.r), Math.min(1, out.g), Math.min(1, out.b)) : out;
}

/** Opacité du quad sous ce chrome. */
export function boardChromeOpacity(chrome: BoardChrome | null): number {
  return chrome?.dim ? DIM_OPACITY : chrome?.ghost ? GHOST_OPACITY : 1;
}

/** Part de couleur retirée au quad sous ce chrome. */
export function boardChromeDesat(chrome: BoardChrome | null): number {
  return chrome?.ghost && !chrome.dim ? GHOST_DESAT : 0;
}

/** Teinte de travail de la passe — une seule, comme l'ancre de glissement. */
const TEINTE = new THREE.Color();

/** Applique les trois canaux au matériau monté — l'unique écrivain de l'ALLURE d'un board.
 *
 *  ÉCART RÉSIDUEL (P3-0f) : la mise en évidence du survol est une TEINTE, là où la voie affine ajoute
 *  en plus une lueur externe (`BodyToken`, `drop-shadow` doublé autour de la silhouette). Un halo
 *  extérieur au quad demanderait une seconde passe — un second quad par sujet, ou un rendu de
 *  silhouette hors écran — que ce lot ne monte pas. */
export function applyBoardChrome(material: Board['material'], chrome: BoardChrome | null, luminance: number): void {
  material.color.copy(boardChromeTint(chrome, luminance, TEINTE));
  // `material.opacity` reste à 1 : l'opacité d'allure vit dans `uAllureAlpha`, APRÈS l'alphatest
  // (cf. `billboardMaterial`). L'y remettre effacerait tout jeton dont l'allure passe sous le seuil.
  const allure = material.userData.allureAlpha as { value: number } | undefined;
  if (allure) allure.value = boardChromeOpacity(chrome);
  const desat = material.userData.desat as { value: number } | undefined;
  if (desat) desat.value = boardChromeDesat(chrome);
}

/** Un disque d'ombre de contact, tel que la passe le retouche : son matériau porte une opacité. */
type ShadowLike = THREE.Object3D & { material?: { opacity: number } };

/** ATTÉNUE l'ombre de contact d'un corps sous son allure (P3-0f) : la voie affine estompe le GROUPE
 *  entier du jeton, ombre comprise — une ombre restée pleine sous un fantôme le rattache au sol qu'il
 *  ne foule plus. L'opacité de MONTAGE (celle que le disque porte avant toute allure) est relevée à la
 *  première pose : cette passe est le seul écrivain suivant.
 *
 *  ÉCART RÉSIDUEL : sous le SOLEIL, le corps ne porte pas de disque mais projette sa vraie ombre
 *  (`wantsContactShadow`) — celle-là est rendue par la passe d'ombres de three, sur un matériau de
 *  profondeur que l'allure n'atteint pas : l'ombre d'un fantôme y reste pleine. */
export function applyShadowAllure(shadow: THREE.Object3D, opacité: number): void {
  const mat = (shadow as ShadowLike).material;
  if (!mat) return;
  const base = (shadow.userData.opacitéMontage ??= mat.opacity) as number;
  mat.opacity = base * opacité;
}

/** Ancre de travail du glissement — une seule, réutilisée : `billboardPose` ne mute pas ce qu'on lui
 *  donne, et une allocation par billboard et par frame n'a rien à faire dans la boucle. */
const ANCRE = new THREE.Vector3();

/** Décalage MONDE du sujet `cid` à l'instant de la frame, `null` s'il ne marche pas. */
export type GlideAt = (cid: string) => { dx: number; dy: number; dz: number } | null;

/** ALLURE du sujet `cid` à l'instant de la frame, `null` s'il n'a rien de particulier à montrer. */
export type ChromeAt = (cid: string) => BoardChrome | null;

/** Aucune allure particulière — la valeur d'une voie qui n'en fournit pas (planches QC, spike). */
export const AUCUN_CHROME: ChromeAt = () => null;

/** Les FLAQUES de la frame (#1245, L2/L3) : le POOL de lampes ponctuelles monté et la table qui vient
 *  d'y être écrite (`stage/stagePointLights.ts`), index par index, plus l'exposition globale du moment. */
export interface FrameLights {
  /** Le pool monté — ce que la passe DÉPLACE (les lampes d'un porteur qui glisse). */
  pool: readonly THREE.PointLight[];
  /** La table écrite : la position LOGIQUE de chaque lampe, celle d'où le glissement se compte. */
  slots: PointLightSlots;
  /** Exposition globale de la frame (`stageLights.surfaceLuminance`), que les flaques COMPLÈTENT. */
  surfaceLuminance: number;
}

/** Remet chaque lampe du pool sur sa position LOGIQUE — le point d'où le glissement de la frame se
 *  compte, et celui où une lampe revient dès que son porteur a fini son pas. */
function reposerLampes(lights: FrameLights): void {
  for (let i = 0; i < lights.pool.length; i++) {
    const w = lights.slots[i];
    if (w) lights.pool[i].position.set(w.x, w.y, w.z);
  }
}

/** Emmène les lampes PORTÉES par `cid` sur le glissement de leur porteur (`LightSource.srcId`). */
function glisserLampesDe(lights: FrameLights, cid: string, g: { dx: number; dy: number; dz: number }): void {
  for (let i = 0; i < lights.pool.length; i++) {
    const w = lights.slots[i];
    if (w?.srcId !== cid) continue;
    lights.pool[i].position.set(w.x + g.dx, w.y + g.dy, w.z + g.dz);
  }
}

/** Glissements de la frame, un par board, dans l'ordre du tableau. Tampon de module réutilisé : la
 *  passe demande son glissement UNE fois par sujet (`glide` lit l'horloge — deux appels dans la même
 *  frame rendraient deux instants), et une allocation par frame n'a rien à faire dans la boucle. */
const GLISSEMENTS: ({ dx: number; dy: number; dz: number } | null)[] = [];

/** Re-pose tous les quads face à la caméra de la frame, glissement de marche compris. Rend `true` si au
 *  moins un sujet a GLISSÉ — c'est le seul cas où la frame déplace un casteur, donc le seul où la carte
 *  d'ombre de la frame précédente cesse d'être valide (une rotation de caméra ne bouge aucune ombre).
 *
 *  Ce qui appartient à un sujet voyage avec lui, et une LAMPE PORTÉE en fait partie (#1245, L2) : la
 *  lanterne d'un marcheur suit la MÊME courbe de glissement que son quad — celle-ci, pas une seconde.
 *
 *  L'EXPOSITION des quads se recalcule ici (#1245, L3) parce qu'elle DÉPEND de la pose : un personnage
 *  qui marche entre dans la flaque case par case, à la cadence de la frame et non des rendus React.
 *
 *  DEUX PASSES, et c'est structurel : toutes les lampes glissent d'abord, les quads s'exposent ensuite.
 *  En une seule passe, l'exposition d'un sujet dépendrait de sa PLACE dans le tableau — le décor, posé
 *  avant les acteurs, échantillonnerait des lanternes encore à leur case de départ.
 *
 *  L'ALLURE du corps (#1176, P3-0f) se pose au même endroit et sur le même matériau : fantôme hors
 *  Ligne de Vue, corps hors d'action, cible survolée. `chromeAt` est demandé à la frame, comme le
 *  glissement — un survol ne remonte donc AUCUN quad, il en réécrit trois nombres. */
export function poseBoards(boards: readonly Board[], camera: FrameCamera, glide: GlideAt, lights: FrameLights, chromeAt: ChromeAt = AUCUN_CHROME): boolean {
  const units = billboardDepthOffsetUnits(camera.near, camera.far);
  let aGlissé = false;
  reposerLampes(lights);
  GLISSEMENTS.length = boards.length;
  for (let i = 0; i < boards.length; i++) {
    const b = boards[i];
    const g = b.sub.cid ? glide(b.sub.cid) : null;
    GLISSEMENTS[i] = g;
    if (!g) continue;
    aGlissé = true;
    if (b.sub.cid) glisserLampesDe(lights, b.sub.cid, g);
  }
  for (let i = 0; i < boards.length; i++) {
    const b = boards[i];
    const g = GLISSEMENTS[i];
    const ancre = g ? ANCRE.set(b.sub.anchor.x + g.dx, b.sub.anchor.y + g.dy, b.sub.anchor.z + g.dz) : b.sub.anchor;
    b.mesh.quaternion.copy(camera.quaternion);
    b.mesh.position.copy(billboardPose(ancre, b.quad.centerLiftM, camera.quaternion));
    b.material.polygonOffsetUnits = units;
    const chrome = b.sub.cid ? chromeAt(b.sub.cid) : null;
    if (b.shadow) {
      poseContactShadow(b.shadow, ancre);
      applyShadowAllure(b.shadow, boardChromeOpacity(chrome));
    }
    applyBoardChrome(
      b.material,
      chrome,
      b.sub.tint * billboardExposure(ancre, lights.pool, lights.surfaceLuminance),
    );
  }
  return aGlissé;
}
