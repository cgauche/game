/**
 * Schémas zod de la CARTE DU MONDE d'un projet (`src/state/worldMap.ts`) — lieux, routes, services.
 *
 * ORDRE DU SEAM : le schéma voit `places[].port` AVANT `resolvePortRef` (`worldMap.ts:512`), donc
 * sous ses DEUX formes documentées (`worldMap.ts:181-183`) — la forme SPARSE par référence
 * (`{ ref, lighthouse }`, le catalogue `naval-ports.json` fournissant les défauts) et la forme
 * CONCRÈTE à plat (`PortProfile` complet). Un port sans `ref` porte donc son profil en entier.
 */
import { z } from 'zod';
import { effectSchema } from './effets';
import { conditionSchema } from '../grammaire/mecanique';

/** `TravelMode` (`engine/travel.ts`) — `'pied'`/`'monture'` ou id de `vehicles.json`. */
export const travelModeSchema = z.string();
/** `WindDirection` (`engine/seaWeather.ts`) — cap dominant d'une route maritime (`MDG 13 l.262-270`). */
export const windDirectionSchema = z.enum(['nord', 'sud', 'est', 'ouest']);

/** `PortProfile` (`engine/seaVoyage.ts:217`) en forme AUTHORÉE : SPARSE quand `ref` désigne une
 *  entrée de `naval-ports.json` (les champs présents sont des SURCHARGES locales), COMPLET sinon.
 *  `lighthouse` (hors catalogue) : un phare veille sur l'approche (`MDG 13 l.333-351`). */
export const portProfileSchema = z
  .strictObject({
    ref: z.string().optional(),
    /** Taille du Lieu (1-4). */
    taille: z.number().optional(),
    richesse: z.number().optional(),
    /** Colonne Production : ids de cargaison, `'commerce'`/`'minimum-vital'` compris. */
    production: z.array(z.string()).optional(),
    /** Colonne Surplus : id de cargaison → indice. */
    surplus: z.record(z.string(), z.number()).optional(),
    demande: z.record(z.string(), z.number()).optional(),
    /** Grand port cosmopolite (`MDG 15 l.343-349`). */
    cosmopolite: z.boolean().optional(),
    lighthouse: z.boolean().optional(),
  })
  .superRefine((port, ctx) => {
    if (port.ref !== undefined) return;
    for (const champ of ['taille', 'richesse', 'production'] as const) {
      if (port[champ] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [champ],
          message: `port sans « ref » : le profil est authoré EN ENTIER, « ${champ} » manque (forme concrète, worldMap.ts:181-183).`,
        });
      }
    }
  });

/** `LandMarketProfile` (`engine/landCargo.ts:62`) — indices de commerce terrestre/fluvial (`MSRC 13`). */
export const landMarketProfileSchema = z.strictObject({
  /** Indice de Taille de la communauté (1 Hameau … 4 Grande ville, `MSRC 13 l.44-50`). */
  taille: z.number(),
  richesse: z.number(),
  /** Colonne Produits : ids d'entrées de `land-cargo.json` (marchandises ET marqueurs). */
  produits: z.array(z.string()),
  demande: z.array(z.string()).optional(),
  /** Le Lieu tire sa Richesse du COMMERCE (`MSRC 13 l.40-42`) — d100 de quantité inversé. */
  commerceRichesse: z.boolean().optional(),
  /** Régions à Vin/Eau-de-vie supérieurs (`MSRC 13 l.95`). */
  wineBonusEchelons: z.number().optional(),
  hostLine: z.string().optional(),
  backdrop: z.string().optional(),
});

/** `PlaceService` — service extensible d'un lieu (`kind` = id de `lieux-services.json`), hors
 *  port/marché qui portent leur schéma riche. `rest` = offre de couchage PROPRE au lieu. */
export const placeServiceSchema = z.strictObject({
  kind: z.string(),
  label: z.string().optional(),
  rest: z
    .strictObject({
      auberge: z.boolean().optional(),
      maison: z.boolean().optional(),
      camp: z.boolean().optional(),
      bord: z.boolean().optional(),
    })
    .optional(),
});

/** `PlacePoi` (#345) — marqueur de PLAN, cible EXCLUSIVE `sceneId` OU `serviceKind`. */
export const placePoiSchema = z
  .strictObject({
    id: z.string(),
    label: z.string(),
    /** Coordonnées PLAN-LOCALES 0-100, indépendantes de `MapPlace.pos`. */
    pos: z.strictObject({ x: z.number(), y: z.number() }),
    icon: z.string().optional(),
    sceneId: z.string().optional(),
    serviceKind: z.string().optional(),
  })
  .superRefine((poi, ctx) => {
    if ((poi.sceneId === undefined) === (poi.serviceKind === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: `POI « ${poi.id} » : cible EXCLUSIVE — « sceneId » (transition) OU « serviceKind » (service résolu du lieu), jamais les deux ni aucun.`,
      });
    }
  });

/**
 * Kinds de `Condition` réellement ÉVALUABLES avec le contexte de la CARTE (`condCtx`,
 * `src/state/bourseFlow.ts` : `flags`, `gameTime`, `party`, `money`). Les autres kinds lisent
 * `target`/`caster`/`sl`/`location`/état de combat — absents ici, et `evalCondition`
 * (`src/engine/flowCore.ts`) les rend alors FAUX : un lieu disparaîtrait de la carte, ou un trajet
 * se fermerait, EN SILENCE et sans qu'aucune donnée ne soit fautive. Le sous-ensemble se vérifie
 * kind par kind dans `evalCondition` ; tout kind non listé est REFUSÉ à l'authoring (fail-fast).
 */
const CONDITION_KINDS_CARTE = new Set([
  'always', 'flag', 'time', 'hasItem', 'money', 'partyDead',
  'skill', 'career', 'species', 'status',
  'all', 'any', 'not',
]);

/** Kinds hors portée rencontrés dans une `Condition` authored (récursif : `all`/`any`/`not`). */
function kindsHorsCarte(cond: unknown, out: Set<string> = new Set()): Set<string> {
  if (!cond || typeof cond !== 'object') return out;
  const c = cond as { kind?: unknown; of?: unknown };
  if (typeof c.kind === 'string' && !CONDITION_KINDS_CARTE.has(c.kind)) out.add(c.kind);
  if (Array.isArray(c.of)) for (const sub of c.of) kindsHorsCarte(sub, out);
  else if (c.of) kindsHorsCarte(c.of, out);
  return out;
}

/** `Condition` d'un `when` de CARTE — l'algèbre complète, restreinte aux kinds évaluables ici. */
const conditionCarteSchema = conditionSchema.superRefine((cond, ctx) => {
  const hors = [...kindsHorsCarte(cond)];
  if (hors.length) {
    ctx.addIssue({
      code: 'custom',
      message:
        `Condition de carte : « ${hors.join(' », « ')} » n'est pas évaluable au contexte de la carte ` +
        `(drapeaux, horloge, groupe, bourse — « condCtx », src/state/bourseFlow.ts) : la Condition serait ` +
        `FAUSSE en silence. Kinds admis : ${[...CONDITION_KINDS_CARTE].join(', ')}.`,
    });
  }
});

/** `MapPlace` — lieu posé sur la carte ; être dans `scene` = être à ce lieu. */
export const mapPlaceSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  /** Position sur la carte en % du canvas (0-100). */
  pos: z.strictObject({ x: z.number(), y: z.number() }),
  /** Scène liée (id du registre de scènes du projet). */
  scene: z.string(),
  entry: z.string().optional(),
  /** Icône du médaillon (id du registre `src/ui/icons`), défaut `nav/entry-point`. */
  icon: z.string().optional(),
  port: portProfileSchema.optional(),
  market: landMarketProfileSchema.optional(),
  services: z.array(placeServiceSchema).optional(),
  poi: z.array(placePoiSchema).optional(),
  /** Bande d'ambiance du hub (id du registre `src/ui/backdrops`). */
  backdrop: z.string().optional(),
  /** EXISTENCE du lieu sur la carte (algèbre `Condition`, cf. `evalCondition`) — axe NŒUD du gating
   *  narratif : la destination n'apparaît qu'une fois révélée. Absente = toujours visible. */
  when: conditionCarteSchema.optional(),
});

/** `RoutePeril` — péripétie d'AUTEUR tirée chaque jour de voyage à `chancePct` %. */
export const routePerilSchema = z.strictObject({
  label: z.string(),
  chancePct: z.number(),
  effects: z.array(effectSchema),
});

/** `MapRoute` — route entre deux lieux, bidirectionnelle sauf `from` (sens unique d'initiation). */
export const mapRouteSchema = z.strictObject({
  id: z.string(),
  a: z.string(),
  b: z.string(),
  from: z.string().optional(),
  /** Distance en kilomètres (`LDB 51 l.178`) — en MILLES sur une route `sea`. */
  km: z.number(),
  modes: z.array(travelModeSchema),
  /** Prix d'auteur (sous/PA par km par passager) par mode payant — défaut : classe RAW. */
  prices: z.record(z.string(), z.number()).optional(),
  /** Déplacement d'auteur par mode (`LDB 51 l.178`). À pied : force la vitesse. */
  speed: z.record(z.string(), z.number()).optional(),
  /** Seuil du d10 quotidien de péripétie (`LDB 51 l.208`) ; 0 = désactivé. */
  perilDie: z.number().optional(),
  perils: z.array(routePerilSchema).optional(),
  /** Cible du « Attaqués ! » ; `at` = ancrage DÉTERMINISTE en mer (fraction 0-1, défaut 0.5, #212). */
  ambush: z
    .strictObject({ scene: z.string(), entry: z.string().optional(), encounter: z.string(), at: z.number().optional() })
    .optional(),
  /** Relais d'auberges en bord de route : la halte de NUIT propose l'auberge. */
  inns: z.boolean().optional(),
  /** Route MARITIME (`MDG 13-15`) : se voyage sur le navire de campagne, `km` en MILLES. */
  sea: z.boolean().optional(),
  seaHeading: windDirectionSchema.optional(),
  /** Route FLUVIALE JOUÉE (`MSRC 7`) : la descente se joue jour par jour en mode `barge`. */
  river: z.boolean().optional(),
  /** Périls de rivière tirés chaque jour (`MSRC 7 l.119-166`, `river-perils.json`). */
  riverPerils: z.array(z.strictObject({ perilId: z.string(), chancePct: z.number() })).optional(),
  /** PRATICABILITÉ du trajet (algèbre `Condition`, cf. `evalCondition`) — axe ARÊTE du gating
   *  narratif, indépendant de `mapPlaceSchema.when`. Absente = toujours praticable. */
  when: conditionCarteSchema.optional(),
  /** Raison JOUEUR de l'indisponibilité, rendue par `GatedAction` en infobulle — EXIGÉE dès que
   *  `when` est posé (superRefine ci-dessous) : un trajet fermé MUET est un cul-de-sac inexplicable. */
  refus: z.string().optional(),
  /** Exposition HYDRIQUE de la descente (`MSRC 16 l.5-13`) — déclenche l'Effet `waterExposure`. */
  riverExposure: z
    .strictObject({
      source: z.string().optional(),
      mode: z.enum(['ingestion', 'immersion']),
      chancePct: z.number(),
    })
    .optional(),
})
  .superRefine((route, ctx) => {
    if (route.when !== undefined && route.refus === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `Route « ${route.id} » : « when » posé sans « refus » — un trajet fermable doit dire au JOUEUR pourquoi il l'est (infobulle « GatedAction »).`,
      });
    }
  });

/** `WorldMapParams` — réglages RAW de voyage au niveau CARTE, tous paramétrables. */
export const worldMapParamsSchema = z.strictObject({
  /** Heures de voyage par jour sans Test (`LDB 51 l.195`, défaut 6). */
  hoursPerDay: z.number().optional(),
  /** Plafond de marche forcée en heures/jour (défaut 10). */
  forcedMaxHours: z.number().optional(),
  /** Seuil d10 de péripétie par défaut des routes (défaut 8, `LDB 51 l.208`). */
  perilDie: z.number().optional(),
});

/** `WorldMap` — graphe de LIEUX et de ROUTES au niveau PROJET. */
export const worldMapSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  params: worldMapParamsSchema.optional(),
  /** Image de fond : présente ⇒ les lieux sont rendus à leurs `pos` EXACTS (aucun déchevauchement). */
  background: z.string().optional(),
  places: z.array(mapPlaceSchema),
  routes: z.array(mapRouteSchema),
});
