/**
 * Schéma de `vehicles.json` — véhicules/embarcations à coque (chariots, barges, navires), 3 facettes
 * indépendantes (achat/voyage/coque+navire+pont). Dérivé de l'interface `VehicleData` EXISTANTE
 * (`src/engine/types.ts:108`, + `NavalTraitRef`/`ShipDeck`/`DeckPosteSlot`/`Propulsion`/
 * `VehicleTravelClass` co-localisées) et du contenu RÉEL (25 entrées, script d'inventaire : `hull`
 * 22/25, `ship` 20/25, `travel` 3/25, `deck` 1/25).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'vehicles.json';

const moneySchema = z.strictObject({ gold: z.number(), silver: z.number(), bronze: z.number() });

/** `Availability` (`src/engine/types.ts:79`) : « Commune »/« Limitée »/« Rare »/« Exotique ». */
const availabilitySchema = z.enum(['Commune', 'Limitée', 'Rare', 'Exotique']);

const navalTraitRefSchema = z.strictObject({ id: z.string(), value: z.number().optional() });

const deckPosteSlotSchema = z.strictObject({
  pos: z.strictObject({ x: z.number(), y: z.number() }),
  side: z.enum(['proue', 'tribord', 'poupe', 'babord']),
  cover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
});

const shipDeckSchema = z.strictObject({
  ascii: z.array(z.string()),
  postes: z.array(deckPosteSlotSchema).optional(),
});

const vehicleTravelClassSchema = z.strictObject({
  key: z.string(),
  label: z.string(),
  brassPerKm: z.number(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    /** `IconId` du registre `src/ui/icons/` (famille `travel/*`) — typé `string` côté engine (règle 3). */
    icon: z.string().optional(),
    source: sourceRefSchema.optional(),
    /** Encombrement de l'objet véhicule (LDB 61) — `null` = ne se porte pas (généralement, diligence…). */
    enc: z.union([z.number(), z.null()]).optional(),
    /** Chargement (EDOC 07 l.231-243) — Points d'Enc que la section bagages contient, véhicules terrestres
     *  uniquement. Champ parallèle à `ship.capacity` (même concept, facette `ship` inadaptée : ses autres
     *  champs — crew/manoeuvre/lengthM naval — n'ont pas d'équivalent EDOC pour un attelage terrestre). */
    chargement: z.number().optional(),
    desc: z.string().optional(),
    /** Facette ACHAT — `availability` absent pour les navires (MDG ne donne pas de Disponibilité). */
    purchase: z.strictObject({
      price: moneySchema,
      availability: availabilitySchema.optional(),
    }).optional(),
    /** Facette VOYAGE (passage payant, LDB l.207-219). `medium` : milieu du TRAJET PAYÉ (un véhicule
     *  peut être bi-milieu — ex. la Barge navigue le fleuve LDB 70 p.306 tout en figurant à la table
     *  navale MDG 12 avec `hull.propulsion:'maritime'` — les deux facettes sont INDÉPENDANTES,
     *  jamais l'une dérivée de l'autre) ; absent = terrestre implicite (défaut historique). */
    travel: z.strictObject({
      movement: z.number(),
      medium: z.enum(['terrestre', 'fluvial', 'maritime']).optional(),
      draft: z.strictObject({ montureId: z.string(), count: z.number() }).optional(),
      classes: z.array(vehicleTravelClassSchema),
    }).optional(),
    /** Facette COQUE (entité à PV, `bodyShape` toujours `'vehicule'` dans les 22 entrées observées). */
    hull: z.strictObject({
      char: z.strictObject({ endurance: z.number(), B: z.number() }),
      bodyShape: z.literal('vehicule'),
      propulsion: z.enum(['terrestre', 'fluvial', 'maritime']),
      rig: z.enum(['avirons', 'voile', 'mixte']).optional(),
      traits: z.array(z.strictObject({ id: z.string(), value: z.number().optional(), arg: z.string().optional() })).optional(),
      locationTable: z.union([z.string(), z.null()]).optional(),
      criticalTable: z.union([z.string(), z.null()]).optional(),
    }).optional(),
    /** Facette NAVIRE (profil naval MDG 12). */
    ship: z.strictObject({
      crew: z.number(),
      manoeuvre: z.number(),
      lengthM: z.number(),
      footprint: z.number().optional(),
      capacity: z.number(),
      sail: z.strictObject({ m: z.number(), crew: z.number() }).optional(),
      oars: z.strictObject({ m: z.number(), crew: z.number() }).optional(),
      traits: z.array(navalTraitRefSchema),
    }).optional(),
    /** Facette PONT (plan person-scale, authoré par TYPE). */
    deck: shipDeckSchema.optional(),
  }),
);

export type VehiclesData = z.infer<typeof schema>;
