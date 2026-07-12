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
import type { Effect, Scene } from './scene';
import { normalizeScene } from './scene';
import type { TravelMode } from '../engine/travel';
import type { PortProfile } from '../engine/seaVoyage';
import type { LandMarketProfile } from '../engine/landCargo';
import type { RestPlaces } from './restFlow';
import { findNavalPortById, findLieuServiceById } from '../data';

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
   *  (Test de Perception d'équipage à l'atterrage, MDG ch.13 l.333-351). `ref` (#217) : id de
   *  `naval-ports.json` — les champs `PortProfile` ci-dessous sont alors des SURCHARGES locales
   *  par-dessus le catalogue (sparse en authoring JSON, résolues/complétées au chargement du projet
   *  par `resolvePortRef`, `parseProject`) ; le type reste NON-partiel car tout consommateur aval lit
   *  `place.port` APRÈS résolution (jamais la forme sparse brute). */
  port?: { ref?: string } & import('../engine/seaVoyage').PortProfile & { lighthouse?: boolean };
  /** Indices de COMMERCE TERRESTRE/FLUVIAL (Index géographique, T2C ch.11 l.183-278) — présent = ce Lieu
   *  offre des opportunités de commerce de cargaison (achat/vente/rumeurs). Taille + Richesse + colonne
   *  Produits, éditables par l'auteur (aucun index codé en dur). */
  market?: import('../engine/landCargo').LandMarketProfile;
  /** SERVICES EXTENSIBLES du lieu au-delà du port et du marché (#343) — auberge/temple/forgeron/guilde…,
   *  `kind` = id du catalogue `lieux-services.json`. Port et marché NE sont PAS dupliqués ici : ils
   *  gardent leur propre champ riche (`port`/`market`) et `placeServices` les compose avec ceux-ci en
   *  une liste unique. Une auberge peut porter son offre de couchage PROPRE (`rest`) ou, à défaut,
   *  dériver de l'offre de repos de la scène liée. */
  services?: PlaceService[];
  /** POI (#345 phase 5, option A) : marqueurs cliquables du PLAN de ce lieu (onglet Plan du hub,
   *  `MapCanvas` en second consommateur — AUCUNE forme nouvelle, juste des marqueurs). Position en
   *  coordonnées PLAN-LOCALES 0-100 (indépendantes de `pos`, qui reste la position du lieu sur la
   *  carte du MONDE). Absent/vide ⇒ le lieu n'offre pas d'onglet Plan. */
  poi?: PlacePoi[];
  /** Bande d'ambiance du hub de ce lieu (id du registre `src/ui/backdrops`) — surcharge le défaut
   *  éventuel porté par le service (`lieux-services.json`, ex. auberge). Éditable dans `WorldMapEditor`. */
  backdrop?: string;
}

/** Un POI de PLAN (#345 phase 5) : cible EXCLUSIVE `sceneId` (transition vers une scène du projet,
 *  `transitionTo`) OU `serviceKind` (`id` d'un service RÉSOLU du lieu — `placeServices`, dont le
 *  port/marché AUTOMATIQUES `'port'`/`'marche'` — le MÊME panneau de service que l'onglet Services),
 *  jamais les deux. `id` STABLE (référencé par l'éditeur et les tests, `validateScene`) ; `label` est
 *  le SEUL champ d'affichage (doctrine ids internes, CLAUDE.md). */
export interface PlacePoi {
  id: string;
  label: string;
  pos: { x: number; y: number };
  /** Icône du médaillon (id du registre `src/ui/icons`), défaut `nav/entry-point`. */
  icon?: string;
  sceneId?: string;
  serviceKind?: string;
}

/** Un service EXTENSIBLE attaché à un lieu (catalogue `lieux-services.json`) — hors port/marché, qui
 *  portent leur propre schéma riche. `kind` = id du catalogue ; `label` = surcharge d'affichage
 *  facultative d'auteur ; `rest` = offre de couchage/repas PROPRE à ce lieu-hébergement (auberge
 *  autonome), à défaut de quoi l'auberge dérive de l'offre de repos de la scène (`placeServices`). */
export interface PlaceService {
  kind: string;
  label?: string;
  rest?: RestPlaces;
}

/** Péripétie d'AUTEUR sur une route : tirée chaque jour de voyage à `chancePct` %. */
export interface RoutePeril {
  label: string;
  chancePct: number;
  effects: Effect[];
}

/** Route entre deux lieux (`a` ↔ `b`, bidirectionnelle par défaut). */
export interface MapRoute {
  id: string;
  a: string;
  b: string;
  /** Route À SENS UNIQUE d'INITIATION : présent = elle ne s'emprunte QUE depuis ce lieu (`a` ou `b`) — le
   *  trajet retour se fait par une AUTRE route. Absent = bidirectionnelle (historique). Sert à rendre
   *  DISCERNABLES deux routes reliant les mêmes ports (aller/retour, chacune avec son embuscade) : depuis
   *  un port, seule la route de ce sens est offerte au clic (`routesFrom`), l'embuscade est donc déterministe. */
  from?: string;
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
  /** Cible du « Attaqués ! » (péripétie 10) : scène d'embuscade + rencontre. Absent = narratif.
   *  `at` (fraction 0-1, défaut 0.5) : en MER, ancrage DÉTERMINISTE de l'embuscade authorée — elle se
   *  déclenche quand `kmDone` franchit `at × km`, une fois par traversée, indépendamment du RNG (#212). */
  ambush?: { scene: string; entry?: string; encounter: string; at?: number };
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
  /** Plafond de marche forcée (heures/jour) — LDB 51 l.195 : silence, valeur maison (défaut 10). */
  forcedMaxHours?: number;
  /** Seuil d10 de péripétie par défaut des routes (défaut 8, l.237 ; 0 = désactivé). */
  perilDie?: number;
}

export interface WorldMap {
  id: string;
  nom: string;
  params?: WorldMapParams;
  /** Image de fond (URL, chemin d'asset public, ou data URI) : une VRAIE carte derrière les lieux.
   *  Présente ⇒ les lieux sont rendus à leurs `pos` EXACTS (pas de déchevauchement — la carte a sa
   *  propre échelle et des points dispersés). Absente ⇒ fond au parchemin + déchevauchement (schématique).
   *  `km` reste authoré par route (la position sur la carte est purement visuelle). */
  background?: string;
  places: MapPlace[];
  routes: MapRoute[];
}

export function emptyWorldMap(): WorldMap {
  return { id: `carte-${Date.now()}`, nom: 'Carte du monde', places: [], routes: [] };
}

/**
 * Résout un `MapPlace.port` par RÉFÉRENCE (#217) : `ref` absent → inchangé. `ref` présent → les champs
 * du catalogue `naval-ports.json` servent de DÉFAUTS, tout champ déjà présent sur `port` (surcharge
 * locale d'auteur, authoring SPARSE toléré en entrée — `Partial<PortProfile>`) l'emporte. `ref` inconnu
 * → erreur EXPLICITE (fail-fast, jamais un port silencieusement vide). Appelée par `parseProject`
 * (chargement de projet, entrée déjà résolue/concrète ou sparse à plat) et par l'éditeur au moment où
 * l'auteur choisit une réf au picker (`WorldMapEditor` — entrée sparse `{ ref, lighthouse }` : choisir
 * une réf REMPLACE le profil par celui du catalogue, seul `lighthouse` — hors catalogue — est préservé).
 */
export function resolvePortRef(
  port: ({ ref?: string } & Partial<PortProfile> & { lighthouse?: boolean }) | undefined,
): MapPlace['port'] {
  if (!port?.ref) return port as MapPlace['port'];
  const def = findNavalPortById(port.ref);
  if (!def) {
    throw new Error(`Lieu-port : réf de port inconnue "${port.ref}" (absente de naval-ports.json).`);
  }
  return {
    ref: port.ref,
    taille: port.taille ?? def.taille,
    richesse: port.richesse ?? def.richesse,
    production: port.production ?? def.production ?? [],
    surplus: port.surplus ?? def.surplus,
    demande: port.demande ?? def.demande,
    cosmopolite: port.cosmopolite ?? def.cosmopolite,
    lighthouse: port.lighthouse,
  };
}

/** Lieu correspondant à une scène (être dans la scène = être à ce lieu). */
export function placeOfScene(map: WorldMap | null | undefined, sceneId: string | undefined): MapPlace | undefined {
  if (!map || !sceneId) return undefined;
  return map.places.find((p) => p.scene === sceneId);
}

export function placeById(map: WorldMap, id: string): MapPlace | undefined {
  return map.places.find((p) => p.id === id);
}

/** Le groupe est-il À UN LIEU de la carte (hub de ville ouvrable, #343) : en exploration, hors voyage
 *  en cours, sur une scène qui EST un lieu. Retourne ce lieu (sinon `undefined` — route, camp sauvage,
 *  combat…). SOURCE UNIQUE de la porte du hub, partagée par `CampaignView` et son test. */
export function atLocationPlace(args: {
  mode: string;
  travelPlan: unknown;
  worldMap: WorldMap | null | undefined;
  sceneId: string | undefined;
}): MapPlace | undefined {
  if (args.mode !== 'exploration' || args.travelPlan || !args.worldMap) return undefined;
  return placeOfScene(args.worldMap, args.sceneId);
}

/** Catégorie d'un service résolu — routage du hub de lieu (#343). `port`/`marche`/`auberge` ont un
 *  panneau dédié ; `autre` = service de catalogue générique (temple/forgeron/guilde…). */
export type PlaceServiceCategory = 'port' | 'marche' | 'auberge' | 'autre';

/** Un service RÉSOLU d'un lieu (sortie de `placeServices`) — vocabulaire UNIQUE consommé par le hub de
 *  lieu (#343) et l'auberge. Les payloads métier sont RÉFÉRENCÉS, jamais copiés : `port`/`market`
 *  pointent la donnée existante du nœud, `rest` pointe l'offre propre au service ou celle de la scène. */
export interface ResolvedPlaceService {
  /** id de routage : `'port'` | `'marche'` | `kind` du catalogue (dont `'auberge'`). */
  id: string;
  category: PlaceServiceCategory;
  label: string;
  icon?: string;
  desc?: string;
  port?: NonNullable<MapPlace['port']>;
  market?: LandMarketProfile;
  /** Offre de couchage/repas effective d'une auberge (propre au service, sinon dérivée de la scène). */
  rest?: RestPlaces;
  /** Réplique de boniment (catalogue `lieux-services.json`) du bandeau d'interlocuteur statique. */
  hostLine?: string;
  /** Bande d'ambiance par défaut (catalogue `lieux-services.json`, id du registre `src/ui/backdrops`). */
  backdrop?: string;
  /** Archétype marchand (catalogue `lieux-services.json`, ex. `armurier` pour le forgeron) — porte vers
   *  le système marchand EXISTANT (`openPlaceMerchant`, #369), aucun système neuf. */
  merchantArchetype?: string;
}

/** id STABLE du marchand VIRTUEL d'un service de lieu (#369) : le service de catalogue (forgeron…) n'a
 *  aucune `SceneEntity` de scène — l'écran marchand s'ouvre quand même, keyé sur cet id pour son propre
 *  stock persistant (`merchantStocks`). PUR/testable, source unique du format. */
export function placeServiceMerchantId(placeId: string, serviceId: string): string {
  return `lieu:${placeId}:${serviceId}`;
}

/** Offre de couchage en AUBERGE portée par une scène (`rest.auberge`, ou une `restZone` qui l'offre) —
 *  la scène reste la SOURCE de vérité, référencée jamais copiée sur le nœud. */
function sceneAubergeOffer(scene?: Scene): RestPlaces | undefined {
  if (!scene) return undefined;
  if (scene.rest?.auberge) return { auberge: true, maison: scene.rest.maison, camp: scene.rest.camp };
  const zone = (scene.restZones ?? []).find((z) => z.places.auberge);
  return zone ? { auberge: true, maison: zone.places.maison, camp: zone.places.camp } : undefined;
}

/**
 * API UNIQUE des SERVICES d'un lieu (#343) : compose en UNE liste le port (`place.port`), le marché
 * (`place.market`) et les services extensibles du catalogue (`place.services`, `lieux-services.json`),
 * plus l'auberge — déclarée en service propre OU dérivée de l'offre de repos de la scène liée. Zéro
 * duplication de vérité : chaque payload RÉFÉRENCE sa donnée d'origine (port/marché/offre de repos),
 * il n'en est jamais recopié une seconde source. Consommée par le hub de lieu et l'auberge (phase 2) ;
 * les consommateurs actuels (PortView/LandMarketView/restPlacesHere) restent inchangés en phase 1.
 */
export function placeServices(place: MapPlace, scene?: Scene): ResolvedPlaceService[] {
  const out: ResolvedPlaceService[] = [];
  if (place.port) out.push({ id: 'port', category: 'port', label: 'Port', icon: 'travel/anchor', port: place.port });
  if (place.market) out.push({ id: 'marche', category: 'marche', label: 'Marché', icon: 'merchant/cart', market: place.market });
  const declared = new Set<string>();
  for (const s of place.services ?? []) {
    const def = findLieuServiceById(s.kind);
    const auberge = s.kind === 'auberge';
    out.push({
      id: s.kind,
      category: auberge ? 'auberge' : 'autre',
      label: s.label ?? def?.label ?? s.kind,
      icon: def?.icon,
      desc: def?.desc,
      rest: auberge ? (s.rest ?? sceneAubergeOffer(scene)) : undefined,
      hostLine: def?.hostLine,
      backdrop: def?.backdrop,
      merchantArchetype: def?.merchantArchetype,
    });
    declared.add(s.kind);
  }
  // Auberge DÉRIVÉE de la scène si le lieu ne la déclare pas en service propre mais que la scène offre
  // le couchage en auberge — source unique = la scène.
  if (!declared.has('auberge')) {
    const rest = sceneAubergeOffer(scene);
    if (rest) {
      const def = findLieuServiceById('auberge');
      out.push({ id: 'auberge', category: 'auberge', label: def?.label ?? 'Auberge', icon: def?.icon, desc: def?.desc, rest, hostLine: def?.hostLine, backdrop: def?.backdrop });
    }
  }
  return out;
}

/** Routes EMPRUNTABLES depuis un lieu : reliées à `placeId`, et — si à sens unique (`from`) — initiables
 *  depuis lui. Une route `from` reliant les deux mêmes ports que sa jumelle n'est offerte QUE dans son sens. */
export function routesFrom(map: WorldMap, placeId: string): MapRoute[] {
  return map.routes.filter((r) => (r.a === placeId || r.b === placeId) && (r.from == null || r.from === placeId));
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
// Format courant : `{ schema: 2, scenes, worldMap? }`. Chaîné par la primitive générique
// `migrateDoc` (même mécanique que les saves, `saves.ts`) — `schema` joue le rôle de `version`.
import { migrateDoc, type MigrationMap } from './migrateDoc';

export interface ProjectDoc {
  schema: 2;
  scenes: Scene[];
  worldMap?: WorldMap;
}

const CURRENT_PROJECT_SCHEMA = 2;

/** Migrations SÉQUENTIELLES de ProjectDoc : la clé N met à niveau un schema N → N+1. VIDE pour
 *  l'instant — schema 2 est l'unique format qui ait jamais existé. La mécanique est branchée pour
 *  tout futur bump : ajouter ici la migration N→N+1 le jour où schema 3 apparaît (cf. `MIGRATIONS`
 *  de `saves.ts`), plutôt que de refuser en silence des projets antérieurs valides. */
export const PROJECT_MIGRATIONS: MigrationMap = {};

/** Parse un document de projet, migrant au besoin via `migrateDoc`. Refus EXPLICITE (jamais un
 *  throw sec sans espoir de migration) si : document mal formé, `schema` absent/non numérique,
 *  `schema` FUTUR (plus récent que l'app — on ne devine pas une structure inconnue), trou dans la
 *  chaîne de migration (pas de migrateur défini pour ce schema), ou forme finale invalide
 *  (`scenes` absent/non-tableau). Les anciens formats (tableau de scènes nu, scène unique) restent
 *  refusés : ils n'ont jamais porté de `schema`. Chaque scène ressort passée par `normalizeScene`
 *  (`scene.ts`) : les collections requises qu'un vieux document (même schema 2) ne portait pas encore
 *  sont complétées ici, au SEUL point d'entrée, jamais par un `?? []` dispersé côté consommateur. */
export function parseProject(data: unknown): { scenes: Scene[]; worldMap?: WorldMap } {
  const obj = data as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') {
    throw new Error('Projet invalide : document absent ou mal formé.');
  }
  const migrated = migrateDoc({ ...obj, version: obj.schema }, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS);
  if (!migrated || !Array.isArray(migrated.scenes)) {
    throw new Error(
      `Projet invalide ou version non supportée (schema=${JSON.stringify(obj.schema)}) — attendu ` +
      `{ schema: ${CURRENT_PROJECT_SCHEMA}, scenes: [...] }, et aucune migration n'est disponible vers ce format.`,
    );
  }
  const worldMap = (migrated.worldMap as WorldMap) ?? undefined;
  if (worldMap) {
    worldMap.places = worldMap.places.map((p) => (p.port ? { ...p, port: resolvePortRef(p.port) } : p));
  }
  return { scenes: (migrated.scenes as Scene[]).map(normalizeScene), worldMap };
}
