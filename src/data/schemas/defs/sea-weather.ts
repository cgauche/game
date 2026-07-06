/**
 * Schéma de `sea-weather.json` — MÉTÉO DE LA MER DES GRIFFES (MDG ch.13 l.162-306). Consommé par
 * `src/engine/seaWeather.ts` (`DATA as unknown as { ... }`, cast inline reflété ICI 1:1) : tirage
 * quotidien (table 4 aspects), modificateur saisonnier, catalogues d'aspect (Précipitations /
 * Température / Visibilité / Vents), rose des vents, effet du vent (standard + Clinfoc), Affaler les
 * voiles, Encalminé.
 *
 * ANOMALIE DE DONNÉE constatée : `precipitations[].skillMods[].spec` (ex. `{ "projectiles":
 * "poudre-noire" }`) existe dans le JSON mais N'EST PAS lu par le consommateur (`PrecipitationDef` /
 * `precipitationSkillMod` dans `src/engine/seaWeather.ts` n'ont pas de champ `spec` — seul `skillId`
 * générique "projectiles" est testé). Le malus s'applique donc à TOUT Test de Projectiles, pas
 * seulement Poudre noire comme le `desc` verbatim l'indique. Champ modélisé ici (fidèle au JSON réel)
 * mais le décalage donnée/moteur reste à trancher par un agent de mécanique (hors périmètre schéma).
 */
import { z } from 'zod';
import { difficultySchema } from '../common';

export const file = 'sea-weather.json';

const windForce = z.enum([
  'calme-plat',
  'legere-brise',
  'brise-fraiche',
  'vent-modere',
  'vent-violent',
  'violente-tempete',
]);
const windAspect = z.enum(['arriere', 'lateral', 'face']);
const windEffectCell = z.strictObject({
  pctSail: z.number().optional(),
  pctOther: z.number().optional(),
  encalmine: z.boolean().optional(),
  affaler: z.boolean().optional(),
  virement: z.boolean().optional(),
});
const windEffectTable = z.record(windForce, z.record(windAspect, windEffectCell));

export const schema = z.strictObject({
  table: z.array(
    z.strictObject({
      min: z.number(),
      max: z.number(),
      precipitations: z.enum(['aucune', 'legeres', 'abondantes', 'tres-abondantes']),
      temperature: z.enum(['caniculaire', 'chaude', 'mediane', 'froide', 'glaciale']),
      visibilite: z.enum(['degage', 'brume', 'brouillard', 'puree-de-pois']),
      vent: windForce,
    }),
  ),
  seasonMod: z.strictObject({ ete: z.number(), automne: z.number(), printemps: z.number(), hiver: z.number() }),
  warmSeaMod: z.number(),
  precipitations: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      desc: z.string().optional(),
      skillMods: z
        .array(
          z.strictObject({
            skills: z.array(z.string()),
            /** Présent en donnée mais IGNORÉ par le consommateur — cf. anomalie en tête de fichier. */
            spec: z.record(z.string(), z.string()).optional(),
            mod: z.number(),
          }),
        )
        .optional(),
      otherMod: z.number().optional(),
    }),
  ),
  temperatures: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      testEveryHours: z.number().optional(),
      difficulty: difficultySchema.optional(),
      exposure: z.enum(['chaleur', 'froid']).optional(),
      litresParJour: z.number().optional(),
    }),
  ),
  visibilites: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      drPenalty: z.number().optional(),
      beyondM: z.number().optional(),
    }),
  ),
  vents: z.array(z.strictObject({ id: z.string(), label: z.string() })),
  roseDesVents: z.array(
    z.strictObject({
      min: z.number(),
      max: z.number(),
      direction: z.enum(['dominant', 'nord', 'sud', 'ouest', 'est']),
    }),
  ),
  effetDuVent: windEffectTable,
  effetDuVentClinfoc: windEffectTable,
  affaler: z.strictObject({
    difficulty: difficultySchema,
    failCritLocation: z.string(),
    driftPctOfSpeed: z.number(),
  }),
  encalmine: z.strictObject({ currentM: z.number(), towM: z.number(), towManDR: z.number() }),
});

export type SeaWeatherData = z.infer<typeof schema>;
