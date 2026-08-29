/**
 * Schéma de `river-navigation.json` — Navigation fluviale (MSRC 7 « Navigation fluviale »), pendant
 * fluvial de `sea-navigation.json`. Dérivé de la vue typée `DATA` (`src/engine/riverNavigation.ts`),
 * seul consommateur. `source` = réf structurée book+page+note PAR entrée/sous-objet (#278), non lue
 * par le moteur (`DATA as unknown as { ... }` ignore le champ superflu).
 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { difficultySchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'river-navigation.json';
export const famille = 'config';

const riverWindDirId = z.enum(['arriere', 'cote', 'contraire']);

/** `BandRow` (`src/engine/riverNavigation.ts`) — table de tirage par fourchette d10. */
const bandRow = z.strictObject({ id: z.string(), label: z.string(), min: z.number(), max: z.number() });

/** `RiverWindEffect` (`src/engine/riverNavigation.ts`). */
const riverWindEffect = z.strictObject({
  pct: z.number().optional(),
  drift: z.boolean().optional(),
  tack: z.boolean().optional(),
  capsizeRisk: z.boolean().optional(),
  riggingRisk: z.boolean().optional(),
});

const champs = {
  windForces: z.array(bandRow.extend({ source: sourceRefSchema })),
  windDirections: z.array(bandRow.extend({ source: sourceRefSchema })),
  windTickThreshold: z.number(),
  windTicksPerDay: z.number(),
  windEffect: z.record(z.string(), z.record(riverWindDirId, riverWindEffect)),
  driftPctOfSpeed: z.number(),
  driftNavPenalty: z.number(),
  navBaseDifficulty: difficultySchema,
  tackDifficulty: difficultySchema,
  savoirVoiesFluvialesDR: z.number(),
  rowingAgility: z.strictObject({
    difficulty: difficultySchema,
    failSpeedPct: z.number(),
    spectacularSL: z.number(),
    spectacularSpeedFactor: z.number(),
    source: sourceRefSchema,
  }),
  capsize: z.strictObject({
    removeSailDifficulty: difficultySchema,
    rightDifficulty: difficultySchema,
    rightCumulativePenalty: z.number(),
    source: sourceRefSchema,
  }),
  outOfControl: z.strictObject({ navPenalty: z.number(), source: sourceRefSchema }),
  echouage: z.strictObject({ hullDamage: z.number(), source: sourceRefSchema }),
  temporaryRepair: z.strictObject({
    difficulty: difficultySchema,
    charpentierPenalty: z.number(),
    woundsPerRepair: z.string(),
    source: sourceRefSchema,
  }),
};

const doc = document(
  'river-navigation',
  famille,
  champs,
  {
    windForces: { label: 'Forces de vent', hint: 'Table de tirage d10 des forces de vent fluviales' },
    windDirections: { label: 'Directions de vent', hint: 'Table de tirage d10 des directions de vent relatives au bateau' },
    windTickThreshold: {
      label: 'Résultat de bascule du vent',
      hint: 'Résultat exact du d10 qui fait changer la FORCE du vent d’un cran (la direction n’est tirée qu’au départ)',
    },
    windTicksPerDay: { label: 'Bascules par jour', hint: 'Nombre de tirages de vent par journée de navigation' },
    windEffect: { label: 'Effet du vent', hint: '% de vitesse, dérive, virement, risque de chavirage/gréement par force×direction' },
    driftPctOfSpeed: { label: '% de dérive', hint: 'Part de la vitesse perdue en dérive' },
    driftNavPenalty: { label: 'Malus de dérive', hint: 'Pénalité au Test de Navigation en dérive' },
    navBaseDifficulty: { label: 'Difficulté de base', hint: 'Difficulté de base du Test de Navigation fluviale' },
    tackDifficulty: { label: 'Difficulté du louvoyage', hint: 'Difficulté du Test pour louvoyer contre le vent' },
    savoirVoiesFluvialesDR: { label: 'DR Savoir (Voies fluviales)', hint: 'Bonus de DR apporté par cette spécialisation' },
    rowingAgility: {
      label: "Test d'Agilité de rame (du jour)",
      hint: 'Difficulté, malus de vitesse à l’échec, seuil et facteur d’ÉCHEC spectaculaire (DR ≤ −6 → vitesse ÷2)',
    },
    capsize: { label: 'Chavirage', hint: 'Difficultés d’amener la voile et de redresser, pénalité cumulative' },
    outOfControl: { label: 'Hors de contrôle', hint: 'Malus au Test de Navigation quand le bateau est hors de contrôle' },
    echouage: { label: 'Échouage', hint: 'Dégâts de coque infligés par un échouage' },
    temporaryRepair: { label: 'Réparation temporaire', hint: 'Difficulté, malus de Charpentier, Blessures réparées par Test' },
  },
  { codex: { keys: ['riverNavigation'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type RiverNavigationData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
