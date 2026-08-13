/**
 * LUMIÈRE DE L'ÉCRAN DE JEU volumique (#1176, lot P2-5) — module PUR à part de `GameStage3D`, au même
 * titre que `boardPose.ts` (pose) et `stage3dCamera.ts` (cadrage) : l'écran MONTE ce que cette passe
 * décide, il ne décide rien lui-même. Aucun DOM, aucun renderer — des scalaires et deux objets `three`.
 *
 * UN SEUL PROPRIÉTAIRE DE LUMINOSITÉ PAR RÉGIME. En volumique, le canevas porte TOUTE la luminosité de
 * la scène : le voile d'ambiance du SVG (`stage/Ambiance.tsx`) reste à la voie affine, que `IsoStage`
 * gate. Les deux voies sont réglées sur la MÊME donnée (`catalog/ambiance.ts`, `ambianceLuminance` →
 * `nightVeilMax`) : la voie affine peint son voile par-dessus la scène, celle-ci dose ses lampes avec
 * le complément — d'où une parité de luminance PAR CONSTRUCTION, et un plancher non nul à luminosité 0
 * (le palier `tenebres` rend `1 − nightVeilMax`, jamais un écran noir). Les deux grandeurs se lisent sur
 * une surface HORIZONTALE, la surface de référence de `surfaceLuminance` : depuis le modelé de forme
 * (#1300), une face VERTICALE rend ce plancher multiplié par le facteur de sa famille d'orientation
 * (`AMBIANCE.faceShade`), et le voile de l'affine, lui, ne connaît pas d'orientation.
 *
 * DEUX lampes au plus, et la seconde a une PORTE :
 *  - l'AMBIANTE existe toujours. Son intensité suit le palier de lumière de la scène (`ambientScalar` →
 *    `lightLevels.json`, le `scalar` de jour/couvert/crépuscule/nuit/ténèbres, ou la mise en scène
 *    `state.lightLevel`) passé par `ambianceLuminance`. Sans soleil, elle porte la scène ENTIÈRE ; sous
 *    le soleil PLEIN, elle redescend à la part `AMBIENT_INTENSITY` du réglage à deux lampes
 *    (`sunContrast`), et le passage de l'une à l'autre suit le FONDU du soleil — donc sans marche ;
 *  - la DIRECTIONNELLE (le soleil, avec ses ombres) n'est montée QUE si la scène en a un : `sceneSun`
 *    — aucun soleil en intérieur (porte `isIndoor`, celle du reste du rendu), aucun hors de l'arche
 *    diurne, et aucun sous l'élévation d'ACNÉ (`sunFade` ci-dessous). Sa direction vient de l'heure
 *    d'horloge et du nord de la scène.
 *
 * Les matériaux du monde sont TOUJOURS lambertiens (`GameStage3D`) : c'est ce qui rend la continuité
 * structurelle — il n'y a plus de régime à basculer au crépuscule, seulement des intensités qui
 * tendent vers zéro.
 *
 * Le soleil de PLANCHE (fixe) reste au spike (`backends/webgl/sceneMeshes.ts`) : les gardes QC
 * l'épinglent, et c'est pourquoi il ne se règle pas ici.
 *
 * FRUSTUM D'OMBRE : `sunRigFrom` serre son frustum sur la SPHÈRE englobante des casteurs, donc un cube
 * — à soleil bas, l'essentiel de la carte d'ombre 2048² tombe hors géométrie. Le serrer à la hauteur
 * réelle demande de projeter la boîte dans le repère de la lampe DANS `sunRigFrom`, que le soleil de
 * PLANCHE partage : la planche QC change avec.
 */
import * as THREE from 'three';
import type { Scene } from '../../state/scene';
import { ambientScalar } from '../../state/vision';
import { ambianceLuminance, weatherLightScalars, type WeatherLight } from '../catalog/ambiance';
import {
  AMBIENT_INTENSITY,
  LIGHT_COLOR,
  SHADOW_NORMAL_BIAS_TEXELS,
  SUN_INTENSITY,
  sunRigFrom,
} from '../backends/webgl/sceneMeshes';
import { sceneSun, type SunJeu } from '../backends/webgl/sunJeu';

/** Élévation (degrés) SOUS laquelle un receveur rasant acnéise : le décalage de profondeur qu'un texel
 *  d'ombre couvre sur une pente vue à `élévation` vaut `texel / tan(élévation)`, et il dépasse le
 *  décalage de normale (`SHADOW_NORMAL_BIAS_TEXELS` texels) dès `tan(élévation) < 1 / texels`. Le
 *  rapport est SANS DIMENSION : ni la taille de la carte ni celle de la carte d'ombre n'y entrent. */
export const SUN_ACNE_ELEVATION_DEG = (Math.atan(1 / SHADOW_NORMAL_BIAS_TEXELS) * 180) / Math.PI;

/** Élévation (degrés) à partir de laquelle le soleil brille à PLEINE intensité. Entre elle et
 *  `SUN_ACNE_ELEVATION_DEG`, le soleil s'allume en fondu : le lever et le coucher gagnent leur
 *  transition, et l'acné rasante s'éteint avant d'exister. */
export const SUN_FADE_FULL_DEG = SUN_ACNE_ELEVATION_DEG + 8;

/** Part du soleil réellement allumée à cette élévation : 0 au ras (acné), 1 en hauteur, `smoothstep`
 *  entre les deux (dérivée nulle aux deux bouts — aucune cassure à l'allumage ni à l'extinction). */
export function sunFade(elevationDeg: number): number {
  const t = (elevationDeg - SUN_ACNE_ELEVATION_DEG) / (SUN_FADE_FULL_DEG - SUN_ACNE_ELEVATION_DEG);
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** DÉCISION de lumière, en scalaires purs — ce dont l'écran a besoin avant même de monter une lampe. */
export interface StageLightScalars {
  /** La course du soleil de la scène à cette heure (`null` = intérieur ou nuit) — diagnostic. */
  course: SunJeu | null;
  /** Part du soleil allumée (`sunFade` de son élévation) : 0 tant qu'il rase, 1 au-dessus. */
  fade: number;
  /** Un soleil éclaire-t-il RÉELLEMENT la scène (donc : ombres portées, disque de contact inutile). */
  lit: boolean;
  /** Ce que la MÉTÉO authorée fait à la lumière (#1247) — dérivé de `tint`/`alpha`, la donnée même du
   *  voile d'écran de la voie affine. `dim` est déjà appliqué aux trois grandeurs ci-dessous ; `tint`
   *  et `k` servent à la COULEUR des lampes et du fond. */
  meteo: WeatherLight;
  /** Intensité de l'ambiante, en unités three (facteur `π` compris). */
  ambientIntensity: number;
  /** Intensité de la directionnelle, en unités three (facteur `π` compris) — 0 quand elle n'est pas montée. */
  sunIntensity: number;
  /** LUMINANCE du seul PALIER d'ambiance (`ambianceLuminance`), soleil exclu — le complément exact du
   *  voile de nuit de la voie affine. C'est le scalaire que COMPLÈTENT les flaques de lampe
   *  (`stagePointLights.ts`) : à 1 (plein jour) il ne reste rien à allumer. Un NOMBRE, sans rapport
   *  avec `Scene.ambiance`, qui est l'id du LIEU (`exterieur`/`interieur`). */
  ambianceLum: number;
  /** LUMINANCE d'une surface horizontale de la scène, en part de son albédo — l'exposition globale de
   *  la frame. C'est le scalaire que multiplient les surfaces NON lambertiennes (billboards), qui n'ont
   *  pas de normale exploitable, et la mesure de parité avec la voie affine (sans soleil : elle vaut
   *  exactement `ambianceLuminance(palier)`, soit le complément du voile SVG). */
  surfaceLuminance: number;
}

/**
 * Intensités en unités PHYSIQUES (three ≥ r155) : sous le lambertien de three, une ambiante d'intensité
 * `I` rend `albédo · I / π` (`BRDF_Lambert` porte le `RECIPROCAL_PI`) — le facteur `Math.PI` ramène donc
 * l'intensité à sa part d'albédo à l'écran. Même conversion qu'au spike.
 */
export function stageLightScalars(args: {
  scene: Pick<Scene, 'ambiance' | 'northDeg' | 'ambientLight' | 'weather'>;
  gameTime: number;
  lightLevel: number | null | undefined;
}): StageLightScalars {
  const course = sceneSun(args.scene as Scene, args.gameTime);
  const palier = ambientScalar(args.scene as Scene, args.gameTime, args.lightLevel ?? null);
  // MÉTÉO (#1247) : la MÊME donnée que le voile d'écran de la voie affine (`tint`/`alpha`), dérivée en
  // scalaires (`weatherLightScalars`). `dim` est le facteur d'exposition APPARIÉ EN LUMINANCE au voile
  // de l'affine sur l'albédo de référence — il vaut plus de 1 sous une météo plus CLAIRE que la scène
  // (neige, brouillard). L'orage se joue par les LAMPES, jamais par un rect posé par-dessus.
  const meteo = weatherLightScalars(args.scene);
  const expo = ambianceLuminance(palier) * meteo.dim;
  const fade = course ? sunFade(course.elevationDeg) : 0;
  // L'ambiante cède au soleil À MESURE qu'il s'allume : pleine sans lui, `AMBIENT_INTENSITY` sous lui.
  const partAmbiante = 1 - (1 - AMBIENT_INTENSITY) * fade;
  const partSolaire = course ? SUN_INTENSITY * fade * Math.sin((course.elevationDeg * Math.PI) / 180) : 0;
  return {
    course,
    fade,
    lit: fade > 0,
    meteo,
    // `ambianceLum` reste le PALIER seul : c'est le complément exact du voile de nuit, et le socle que
    // COMPLÈTENT les flaques de lampe (`stagePointLights`). Une flamme ne faiblit pas sous l'averse.
    ambianceLum: ambianceLuminance(palier),
    ambientIntensity: expo * partAmbiante * Math.PI,
    sunIntensity: expo * SUN_INTENSITY * fade * Math.PI,
    surfaceLuminance: expo * (partAmbiante + partSolaire),
  };
}

export interface StageLights extends StageLightScalars {
  /** Ambiante — toujours présente. */
  ambient: THREE.AmbientLight;
  /** Soleil DIRECT (ombres portées) — `null` en intérieur, de nuit, et tant qu'il rase l'horizon. */
  sun: THREE.DirectionalLight | null;
}

/** Lampes de la scène à l'instant `gameTime`. `shadowBox` = la boîte des CASTEURS (géométrie +
 *  billboards, `worldShadowBox`), qui serre le frustum d'ombre. `lightLevel` = la mise en scène runtime
 *  (`state.lightLevel`), prioritaire sur le palier authoré — exactement comme pour les voiles.
 *
 *  COULEUR sous la météo (#1247) : les deux lampes du CIEL se déplacent vers la teinte authorée, du
 *  dosage de son alpha — c'est ce qui rend l'orage bleu-gris et la brume laiteuse. Les lampes
 *  PONCTUELLES (`stagePointLights.ts`, pool à part) n'en reçoivent RIEN : une flamme reste une flamme
 *  sous l'orage, et c'est le CONTRASTE entre un ciel éteint et un braséro intact qui rend l'orage
 *  lisible — la dimmer ferait un écran uniformément gris. */
export function meteoLightColor(meteo: WeatherLight): THREE.Color {
  const base = new THREE.Color(LIGHT_COLOR);
  return meteo.tint ? base.lerp(new THREE.Color(meteo.tint), meteo.k) : base;
}

export function stageLights(args: {
  scene: Scene;
  gameTime: number;
  lightLevel: number | null | undefined;
  shadowBox: THREE.Box3;
}): StageLights {
  const scalars = stageLightScalars(args);
  const teinte = meteoLightColor(scalars.meteo);
  const ambient = new THREE.AmbientLight(teinte, scalars.ambientIntensity);
  if (!scalars.lit || !scalars.course) return { ...scalars, ambient, sun: null };
  const rig = sunRigFrom(args.shadowBox, scalars.course.dir);
  const sun = new THREE.DirectionalLight(teinte, scalars.sunIntensity);
  sun.position.copy(rig.position);
  sun.target.position.copy(rig.target);
  sun.castShadow = true;
  const cam = sun.shadow.camera;
  cam.left = -rig.span; cam.right = rig.span; cam.top = rig.span; cam.bottom = -rig.span;
  cam.near = rig.near;
  cam.far = rig.far;
  cam.updateProjectionMatrix();
  sun.shadow.mapSize.set(rig.mapSize, rig.mapSize);
  // Décalage le long de la NORMALE (jamais un biais de profondeur seul) : c'est lui qui sépare un plan
  // de son propre rendu dans la carte d'ombre. Il ne suffit plus sous `SUN_ACNE_ELEVATION_DEG` — d'où
  // le fondu, qui éteint le soleil avant d'y arriver.
  sun.shadow.normalBias = rig.normalBias;
  return { ...scalars, ambient, sun };
}
