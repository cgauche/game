/**
 * Carte du monde (#T2 Voyage) — graphe de LIEUX et de ROUTES au niveau PROJET, même philosophie
 * que le schéma de Scène : tout est de la DONNÉE, créée/éditée dans l'éditeur (onglet « Monde »),
 * rien n'est codé en dur. Le voyage RAW (vitesses, 6 h/jour, coûts, péripéties) est résolu par
 * `engine/travel.ts` + `state/travelFlow.ts` ; ce module ne porte que le schéma et ses helpers purs.
 *
 * Tous les réglages RAW sont PARAMÉTRABLES par l'auteur : km, modes autorisés, prix par mode
 * (sous/km — défauts RAW l.207-219), Déplacement du véhicule (modèles rapides/lents, M ±1, l.208),
 * seuil du d10 de péripétie (défaut 8, l.237 ; 0 = désactivé), péripéties d'auteur (probabilité
 * par jour + Effects), cible d'embuscade du « Attaqués ! », heures de voyage/jour et plafond de
 * marche forcée au niveau carte.
 */
import type { Effect } from './scene';
import type { TravelMode } from '../engine/travel';

/** Lieu posé sur la carte. Être dans `scene` = être à ce lieu ; y arriver → transition vers elle. */
export interface MapPlace {
  id: string;
  label: string;
  /** Position sur la carte en % du canvas (0-100). */
  pos: { x: number; y: number };
  /** Scène liée (id du registre de scènes du projet). */
  scene: string;
  /** Point d'arrivée nommé dans la scène (sinon heroStart). */
  entry?: string;
  /** Pictogramme affiché (emoji), défaut 📍. */
  icon?: string;
}

/** Péripétie d'AUTEUR sur une route : tirée chaque jour de voyage à `chancePct` %. */
export interface RoutePeril {
  label: string;
  chancePct: number;
  effects: Effect[];
}

/** Route entre deux lieux (`a` ↔ `b`, bidirectionnelle). */
export interface MapRoute {
  id: string;
  a: string;
  b: string;
  /** Distance en kilomètres (l.207 : les coûts sont « par kilomètre parcouru »). */
  km: number;
  /** Modes de voyage offerts sur cette route. */
  modes: TravelMode[];
  /** Prix d'auteur (sous/PA par km par passager) pour un transport payant (`id` de `transports.json`)
   *  — défaut : classe RAW. */
  prices?: Partial<Record<Exclude<TravelMode, 'pied'>, number>>;
  /** Déplacement d'auteur par mode (modèle rapide/lent : M ±1, l.208). À pied : force la vitesse. */
  speed?: Partial<Record<TravelMode, number>>;
  /** Seuil du d10 quotidien de péripétie RAW (l.237 « sur un résultat de 8 ») ; 0 = désactivé.
   *  Absent = défaut de la carte (sinon TRAVEL_DEFAULTS.perilDie). */
  perilDie?: number;
  /** Péripéties d'auteur (en PLUS de la table d10 RAW). */
  perils?: RoutePeril[];
  /** Cible du « Attaqués ! » (péripétie 10) : scène d'embuscade + rencontre. Absent = narratif. */
  ambush?: { scene: string; entry?: string; encounter: string };
  /** Relais d'auberges en bord de route (section Voyage : « Les auberges en bord de route sont
   *  souvent placées à la convenance des relais de diligences ») : la halte de NUIT propose
   *  l'auberge (chambres/repas payants, modale de Repos) en plus du campement. Absent = belle
   *  étoile seulement. */
  inns?: boolean;
}

export interface WorldMapParams {
  /** Heures de voyage par jour sans Test (RAW l.224, défaut 6). */
  hoursPerDay?: number;
  /** Plafond de marche forcée (heures/jour, canon muet — défaut 10). */
  forcedMaxHours?: number;
  /** Seuil d10 de péripétie par défaut des routes (défaut 8, l.237 ; 0 = désactivé). */
  perilDie?: number;
}

export interface WorldMap {
  id: string;
  nom: string;
  params?: WorldMapParams;
  places: MapPlace[];
  routes: MapRoute[];
}

export function emptyWorldMap(): WorldMap {
  return { id: `carte-${Date.now()}`, nom: 'Carte du monde', places: [], routes: [] };
}

/** Lieu correspondant à une scène (être dans la scène = être à ce lieu). */
export function placeOfScene(map: WorldMap | null | undefined, sceneId: string | undefined): MapPlace | undefined {
  if (!map || !sceneId) return undefined;
  return map.places.find((p) => p.scene === sceneId);
}

export function placeById(map: WorldMap, id: string): MapPlace | undefined {
  return map.places.find((p) => p.id === id);
}

/** Routes partant d'un lieu (les routes sont bidirectionnelles). */
export function routesFrom(map: WorldMap, placeId: string): MapRoute[] {
  return map.routes.filter((r) => r.a === placeId || r.b === placeId);
}

/** L'autre extrémité d'une route. */
export function otherEnd(route: MapRoute, placeId: string): string {
  return route.a === placeId ? route.b : route.a;
}

// ── Format de PROJET (export/import éditeur) ────────────────────────────────────────────────
// Format unique : `{ schema: 2, scenes, worldMap? }`.
import type { Scene } from './scene';

export interface ProjectDoc {
  schema: 2;
  scenes: Scene[];
  worldMap?: WorldMap;
}

/** Parse un document de projet (format `{ schema: 2, scenes, worldMap? }`). Lève si le format est
 *  invalide — les anciens formats (tableau de scènes, scène unique) ne sont plus supportés. */
export function parseProject(data: unknown): { scenes: Scene[]; worldMap?: WorldMap } {
  const obj = data as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.scenes)) {
    throw new Error('Projet invalide : format attendu { schema: 2, scenes: [...] }.');
  }
  return { scenes: obj.scenes as Scene[], worldMap: (obj.worldMap as WorldMap) ?? undefined };
}
