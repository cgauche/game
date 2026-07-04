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
  /** Icône du médaillon (id du registre src/ui/icons), défaut `nav/entry-point`. */
  icon?: string;
  /** Profil COMMERCIAL de port (Index des ports, MDG ch.15 l.439-506) — présent = ce lieu est un port
   *  maritime (commerce, événements d'escale, chantier). `lighthouse` : un phare veille sur l'approche
   *  (Test de Perception d'équipage à l'atterrage, MDG ch.13 l.333-351). */
  port?: import('../engine/seaVoyage').PortProfile & { lighthouse?: boolean };
  /** Indices de COMMERCE TERRESTRE/FLUVIAL (Index géographique, T2C ch.11 l.183-278) — présent = ce Lieu
   *  offre des opportunités de commerce de cargaison (achat/vente/rumeurs). Taille + Richesse + colonne
   *  Produits, éditables par l'auteur (aucun index codé en dur). */
  market?: import('../engine/landCargo').LandMarketProfile;
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
  /** Prix d'auteur (sous/PA par km par passager) pour un transport payant (`id` de `vehicles.json`)
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
  /** Route MARITIME (MDG ch.13-15) : se voyage sur le NAVIRE DE CAMPAGNE (`state.vessel`) ; `km` est
   *  alors en MILLES (les tables RAW — 18 milles/jour par M, distances ch.15 l.40-47 — sont en milles). */
  sea?: boolean;
  /** Cap DOMINANT du trajet (aspect du vent, MDG ch.13 l.262-270) — défaut 'ouest'. */
  seaHeading?: import('../engine/seaWeather').WindDirection;
  /** Route FLUVIALE JOUÉE (T2C ch.5 « Navigation fluviale ») : en mode `barge`, la descente se joue jour par
   *  jour (Test de Navigation, table des vents, périls, chavirage) au lieu d'un transport payant. Repli
   *  payant si aucun batelier/embarcation. Absent = barge en transport payant (comportement historique). */
  river?: boolean;
  /** Périls de rivière tirés chaque jour sur une route fluviale JOUÉE (T2C ch.5 l.119-166, `river-perils.json`) :
   *  `perilId` (débris/rochers/eaux-peu-profondes/barrage) tiré à `chancePct` %. Data-driven, éditable. */
  riverPerils?: { perilId: string; chancePct: number }[];
  /** Exposition HYDRIQUE de la descente (T2C ch.14 « Maladies transmises par l'eau », l.5-13) : à chaque
   *  étape à flot, un tirage à `chancePct` % déclenche l'Effet EXISTANT `waterExposure` (Test de Résistance
   *  modifié → maladie contractée). `source` = id du tableau 1 « Source d'eau » (choix d'auteur de la
   *  portion de fleuve : `grande-ville-marais`, `aval-grande-ville-8km`…), `mode` = `ingestion` (boire l'eau
   *  du fleuve non bouillie, l.5) / `immersion` (chute\nage, blessures ouvertes, l.7-9). Data-driven, éditable. */
  riverExposure?: { source?: string; mode: import('../data').WaterExposureMode; chancePct: number };
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

// ── Anti-chevauchement des médaillons (rendu seulement — n'affecte JAMAIS `pos`) ─────────────
/** Point de rendu d'un lieu : id + position en unités du viewBox de la carte (x 0..100, y 0..64). */
export interface RenderPoint { id: string; x: number; y: number }

/** Hash déterministe d'un id → angle de séparation stable (aucun Math.random : la carte ne « bouge »
 *  pas d'un rendu à l'autre, même contrainte que `routeCurve` côté vue). */
function hashAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 360) * (Math.PI / 180);
}

/**
 * Écarte les médaillons trop proches, de façon PURE et DÉTERMINISTE, pour rendre lisibles les
 * grandes cartes où 27+ lieux se chevauchent au centre (ex. le Reik). Répulsion itérative des
 * PAIRES dont la distance est < `minDist` : chaque paire est repoussée le long de son axe de la
 * moitié du déficit de chaque côté (les deux bougent symétriquement) ; deux points EXACTEMENT
 * confondus sont séparés selon un angle dérivé de la somme de leurs id (déterministe, pas de RNG).
 * Le résultat est borné dans le cadre `[0..w] × [0..h]`. N'affecte QUE les positions de rendu —
 * les `pos` d'authoring restent intacts (la donnée n'est pas mutée).
 *
 * @param points   positions de rendu `{id, x, y}` (l'ordre d'entrée fixe l'ordre de résolution des paires)
 * @param minDist  distance minimale visée entre deux médaillons (unités viewBox)
 * @param iterations passes de relaxation (chaque passe rapproche du minimum sans jamais « exploser »)
 * @param frame    cadre de bornage (défaut : le viewBox de la carte, 100 × 64)
 * @returns une `Map<id, {x, y}>` des positions écartées, dans le MÊME repère que l'entrée.
 */
export function declutterPositions(
  points: RenderPoint[],
  minDist: number,
  iterations = 60,
  frame: { w: number; h: number } = { w: 100, h: 64 },
): Map<string, { x: number; y: number }> {
  // Copie de travail (on ne mute pas l'entrée) ; l'ordre est celui de `points` → déterministe.
  const pts = points.map((p) => ({ id: p.id, x: p.x, y: p.y }));
  const clamp = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);

  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 1e-6) {
          // Points confondus : séparer selon un angle dérivé des id (stable, sans RNG).
          const ang = hashAngle(a.id + '|' + b.id);
          dx = Math.cos(ang); dy = Math.sin(ang); dist = 1;
        }
        // Décalage : chaque point s'éloigne de la moitié du déficit le long de l'axe de la paire.
        const push = (minDist - dist) / 2;
        const ux = dx / dist, uy = dy / dist;
        a.x = clamp(a.x - ux * push, frame.w); a.y = clamp(a.y - uy * push, frame.h);
        b.x = clamp(b.x + ux * push, frame.w); b.y = clamp(b.y + uy * push, frame.h);
        moved = true;
      }
    }
    if (!moved) break; // convergé : toutes les paires respectent déjà `minDist`.
  }

  const out = new Map<string, { x: number; y: number }>();
  for (const p of pts) out.set(p.id, { x: p.x, y: p.y });
  return out;
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
  if (!obj || typeof obj !== 'object' || obj.schema !== 2 || !Array.isArray(obj.scenes)) {
    throw new Error('Projet invalide : format attendu { schema: 2, scenes: [...] }.');
  }
  return { scenes: obj.scenes as Scene[], worldMap: (obj.worldMap as WorldMap) ?? undefined };
}
