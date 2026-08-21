/**
 * DÉCOUPE LOCALE PAR OCCLUSION (#1176) — LE VERDICT. Qui est caché, où tombe son trou à l'écran, et à
 * quelle cadence la question se repose. Le CANAL (attribut, chunks, uniformes) vit ailleurs
 * (`backends/webgl/percageLocal.ts`) ; ici, rien ne connaît le shader au-delà des quatre `Vector4`
 * qu'il lit.
 *
 * LE VERDICT NE SE RÉINVENTE PAS. « Cette masse cache-t-elle ce héros à l'écran ? » a déjà SA loi dans
 * ce dépôt : `occludesActor` (`geometry/iso.ts`), posée sur la géométrie projetée des nappes (`Lid`,
 * `stage/architectureVisibility.ts`) et les capsules d'acteurs (`stage/actorCapsule.ts`). La découpe
 * locale est la SEULE riposte à cette occlusion-là : elle ôte un disque autour du héros, l'architecture
 * n'est pas retirée (#1176, M3, 2026-08-16). Ce qui se retire se retire pour ABRI RÉEL, et par la loi
 * de dégagement seule.
 *
 * CADENCE ÉVÉNEMENTIELLE, jamais un Hz : le verdict ne se rejoue qu'à la CLÉ (`clePercage`) — pas
 * franchi, cran/lacet de caméra, étage. Ce qui vit à la frame, c'est le seul rayon (`avancer`) : un
 * flottant par héros.
 */
import * as THREE from 'three';
import { occludesActor, type ActorCapsule } from '../../geometry/iso';
import type { Lid } from './architectureVisibility';
import { demanderFrames, relacherFrames } from './stageFrames';
import {
  PERCAGE_FONDU_MS,
  PERCAGE_MAX_HEROS,
  PERCAGE_RAYON_PX,
  cadrePercage,
  trousPercage,
} from '../backends/webgl/percageLocal';

/** Un héros candidat au trou : sa capsule écran (`stage/actorCapsule.ts`), son niveau, et sa position
 *  MONDE dans la scène 3D — le centre du trou en descend par projection. */
export interface ActeurPerce {
  capsule: ActorCapsule;
  z: number;
  monde: THREE.Vector3;
}

/** Qui est CACHÉ, un booléen par acteur. GARDE DE NIVEAU : une nappe SOUS les pieds du héros ne le
 *  cache pas, elle le porte. */
export function verdictPercage(lids: readonly Lid[], acteurs: readonly ActeurPerce[]): boolean[] {
  return acteurs.map((a) => lids.some((lid) => lid.z >= a.z && occludesActor(lid.occluder, a.capsule)));
}

/** CLÉ DISCRÈTE du verdict — la même discipline que l'hôte du monde (`stage/MondeDeCampagne`, `tilesKey`) : les tuiles des
 *  alliés (identité + case), le cran et le lacet de la caméra, l'étage actif. Tant qu'elle ne bouge
 *  pas, aucun pas n'a été franchi et rien n'a tourné : le verdict d'avant tient. */
export function clePercage(vue: {
  tuiles: readonly { id: string; x: number; y: number; z: number }[];
  rot: number;
  view: string;
  activeZ: number;
}): string {
  return `${vue.tuiles.map((t) => `${t.id}:${t.x},${t.y},${t.z}`).join('|')}#${vue.rot}/${vue.view}/${vue.activeZ}`;
}

/** CENTRE ÉCRAN d'un trou : la position monde du héros projetée par la caméra de jeu — `x`/`y` en
 *  pixels de viewport, `z` en profondeur écran `[0,1]`, la grandeur que le fragment compare. */
export function centrePercage(
  camera: THREE.Camera,
  monde: THREE.Vector3,
  largeurPx: number,
  hauteurPx: number,
): THREE.Vector3 {
  const ndc = monde.clone().project(camera);
  return new THREE.Vector3((ndc.x * 0.5 + 0.5) * largeurPx, (ndc.y * 0.5 + 0.5) * hauteurPx, ndc.z * 0.5 + 0.5);
}

/** Pas de temps MAXIMAL (ms) d'une avance de fondu. Même borne que le semis de chute et que la boucle
 *  de lacet : un onglet revenu au premier plan reprend le fondu, il ne le téléporte pas d'un bout à
 *  l'autre. */
const PERCAGE_PAS_MAX_MS = 100;

/** Le rayon d'un trou vers sa cible, à vitesse CONSTANTE : le trou s'ouvre en grand en exactement
 *  `PERCAGE_FONDU_MS`, et se referme dans le même temps. Aucun ressort, aucune exponentielle — une
 *  ouverture qui traîne indéfiniment se lit comme un bug de rémanence. */
export function avancerRayon(actuel: number, cible: number, dtMs: number): number {
  const pas = (PERCAGE_RAYON_PX / PERCAGE_FONDU_MS) * Math.max(0, dtMs);
  if (cible > actuel) return Math.min(cible, actuel + pas);
  return Math.max(cible, actuel - pas);
}

/** LE PILOTE de la découpe : il tient la clé du dernier verdict, les cibles de rayon et les sujets, et
 *  écrit les quatre trous partagés. Un pilote par écran ; l'appelant le crée avec sa scène. */
export interface Percage {
  /** Repose le verdict SI la clé a bougé. Rend `true` quand il a réellement été rejoué. */
  majVerdict(entree: {
    cle: string;
    lids: readonly Lid[];
    acteurs: readonly ActeurPerce[];
  }): boolean;
  /** Fait vivre le fondu à l'horodatage de l'image (`now`), REPROJETTE les centres avec la caméra de
   *  CETTE frame, et pousse l'état aux uniformes. À appeler à la frame.
   *
   *  LE PAS DE TEMPS EST À LA SOURCE : le pilote tient la date de sa dernière avance et en dérive son
   *  pas, borné par `PERCAGE_PAS_MAX_MS` (même patron que le lacet continu, `state/stageYaw.avancerLacet`).
   *  Aucun appelant ne tient plus la date du dernier dessin.
   *
   *  Le centre d'un trou est une grandeur de FRAME, pas de verdict : sous lacet libre et sous la
   *  boucle de marche, le cadrage et le sujet vivent hors des rendus React, sans qu'aucune clé bouge.
   *  Le pilote reprojette donc SES sujets ; l'hôte ne tient aucun centre. */
  avancer(now: number, camera: THREE.Camera, largeurPx: number, hauteurPx: number): void;
  /** Rayons courants (px) — ce que le shader lit, en lecture pour les bancs. */
  rayons(): number[];
  /** Nombre de verdicts RÉELLEMENT rejoués depuis la création : la mesure de la cadence. */
  verdictsJoues(): number;
  /** Le fondu tient-il une source du battement en ce moment ? En lecture pour les bancs. */
  pompeEnVol(): boolean;
  /** Relâche les images : l'écran se démonte. */
  arreter(): void;
}

/**
 * LE FONDU DEMANDE SES IMAGES AU BATTEMENT UNIQUE du stage (`stage/stageFrames`). Il suppose une
 * horloge, et l'hôte volumique n'en a pas : son rendu est ÉVÉNEMENTIEL (il ne dessine qu'aux
 * invalidations — rendu React, battement de marche, averse, flamme). Scène immobile, personne ne
 * marche : le verdict s'ouvre, puis plus une seule frame ne vient, et le rayon reste où le dernier
 * dessin l'a laissé (mesuré : 0,672 px, figé).
 *
 * Le pilote est le SEUL à savoir qu'il n'est pas convergé : il tient donc une SOURCE du battement
 * (`demanderFrames`, clé d'INSTANCE — deux écrans montés ne se relâchent pas les images l'un de
 * l'autre) tant qu'un rayon court après sa cible, et la relâche à l'instant où tous l'ont rejointe.
 * RÉGIME CONTINU, jamais une image ponctuelle : `avancer` court dans la passe de dessin de l'image,
 * et c'est de ce dessin-là que la convergence se lit.
 */
export function creerPercage(): Percage {
  let cle: string | null = null;
  let verdicts = 0;
  let enVol = false;
  let derniereAvanceMs: number | null = null;
  /** La clé d'INSTANCE sous laquelle ce pilote tient ses images au battement. */
  const source = Symbol('percage');
  const cibles = new Array<number>(PERCAGE_MAX_HEROS).fill(0);
  const rayons = new Array<number>(PERCAGE_MAX_HEROS).fill(0);
  const centres = Array.from({ length: PERCAGE_MAX_HEROS }, () => new THREE.Vector3());
  const mondes = new Array<THREE.Vector3 | null>(PERCAGE_MAX_HEROS).fill(null);
  const converge = (): boolean => rayons.every((r, i) => r === cibles[i]);
  const tenirImages = (): void => {
    if (enVol) return;
    enVol = true;
    demanderFrames(source);
  };
  const relacherImages = (): void => {
    if (!enVol) return;
    enVol = false;
    relacherFrames(source);
  };
  return {
    majVerdict({ cle: nouvelle, lids, acteurs }) {
      if (nouvelle === cle) return false;
      cle = nouvelle;
      verdicts++;
      const occlus = verdictPercage(lids, acteurs);
      for (let i = 0; i < PERCAGE_MAX_HEROS; i++) {
        const acteur = i < acteurs.length ? acteurs[i] : null;
        cibles[i] = acteur && occlus[i] ? PERCAGE_RAYON_PX : 0;
        // La position MONDE est prise par RÉFÉRENCE : l'hôte la fait glisser à la frame (marche,
        // rotation), et c'est `avancer` qui la reprojette. Un héros qui n'est plus dit garde la
        // sienne — son trou se referme là où il était, il ne saute pas à l'origine.
        if (acteur) mondes[i] = acteur.monde;
      }
      if (!converge()) tenirImages();
      return true;
    },
    avancer(now, camera, largeurPx, hauteurPx) {
      const dtMs = derniereAvanceMs === null ? 0 : Math.min(PERCAGE_PAS_MAX_MS, Math.max(0, now - derniereAvanceMs));
      derniereAvanceMs = now;
      // Le CADRE d'écran est une grandeur de FRAME, comme les centres : la passe d'OMBRE partage le
      // discard et n'a aucun autre moyen de savoir où le trou tombe à l'écran du joueur (son propre
      // raster est celui du soleil, cf. `percageLocal`).
      cadrePercage(camera, largeurPx, hauteurPx);
      const trous = trousPercage();
      for (let i = 0; i < PERCAGE_MAX_HEROS; i++) {
        rayons[i] = avancerRayon(rayons[i], cibles[i], dtMs);
        const monde = mondes[i];
        if (monde) centres[i].copy(centrePercage(camera, monde, largeurPx, hauteurPx));
        trous[i].set(centres[i].x, centres[i].y, centres[i].z, rayons[i]);
      }
      if (converge()) relacherImages();
      else tenirImages();
    },
    rayons: () => [...rayons],
    verdictsJoues: () => verdicts,
    pompeEnVol: () => enVol,
    arreter() { relacherImages(); },
  };
}
