/**
 * Schéma de `activities.json` — catalogue UNIQUE des Activités (LDB 23, EDOC 8, MDG 15,
 * ADE II 8 Bataille de masse), miroir strict de `ActivityDef` (`src/engine/activities.ts:189-256`,
 * étend `TestSpec` de `src/engine/skills.ts:173`) + `OutcomeBand`/`BattleOutcome`/`BattleCond`
 * (`.../activities.ts:56-114`). Inventaire réel (40 entrées, script node) : tous les champs déclarés
 * ci-dessous sont observés au moins une fois ; aucun champ de l'interface n'est ABSENT du JSON.
 */
import { z } from 'zod';
import { gameOpSchema, sourceRefSchema, difficultySchema, stageOutcomeSchema } from '../common';

export const file = 'activities.json';

// `difficulty?` = Difficulté PROPRE à cette voie quand le RAW en attache une différente par
// Compétence (Punchausen, AA 12 l.45-49) — absente, la voie retombe sur `difficulty` de l'Activité.
const skillRefSchema = z.strictObject({
  skillId: z.string(),
  spec: z.string().optional(),
  difficulty: difficultySchema.optional(),
});

const activityContextSchema = z.enum(['interlude', 'voyage', 'mer', 'bataille', 'bataille-round', 'auberge']);

const battleSideSchema = z.enum(['ally', 'enemy']);
const battleOutcomeTargetSchema = z.enum(['might', 'startMight', 'allyTestMod', 'firstRoundBonus', 'planningBonus']);
const battleOutcomeScaleSchema = z.enum(['fixed', 'perDR', 'perHit', 'perKill']);

const battleOutcomeSchema = z.strictObject({
  side: battleSideSchema.optional(),
  target: battleOutcomeTargetSchema,
  scale: battleOutcomeScaleSchema,
  amount: z.number(),
});

const battleCondSchema = z.enum(['generalDown', 'intervention', 'noIntervention', 'combatWon', 'combatLost']);

const outcomeBandSchema = z.strictObject({
  on: z.enum(['success', 'failure', 'fumble']).optional(),
  minSL: z.number().optional(),
  maxSL: z.number().optional(),
  ops: z.array(gameOpSchema).optional(),
  resolver: z.string().optional(),
  payoutPct: z.number().optional(),
  note: z.string().optional(),
  battle: z.array(battleOutcomeSchema).optional(),
  when: battleCondSchema.optional(),
  chains: z.array(z.string()).optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    icon: z.string(),
    contexts: z.array(activityContextSchema),
    source: sourceRefSchema,
    // ── TestSpec (src/engine/skills.ts:173) ──
    skills: z.array(skillRefSchema).optional(),
    char: z.string().optional(),
    difficulty: difficultySchema.optional(),
    combined: z.boolean().optional(),
    // ── ActivityDef propre ──
    freeSkill: z.boolean().optional(),
    extended: z.strictObject({ drPerStage: z.number() }).optional(),
    failExtenue: z.boolean().optional(),
    weatherMod: z.record(z.string(), z.number()).optional(),
    resolver: z.string().optional(),
    onSuccess: z.array(gameOpSchema).optional(),
    desc: z.string().optional(),
    outcomes: z.array(outcomeBandSchema).optional(),
    where: z.array(z.string()).optional(),
    minInvest: z.strictObject({ gold: z.number() }).optional(),
    stageOutcome: stageOutcomeSchema.optional(),
    unavailableIfExtenue: z.boolean().optional(),
    // ── Bataille de masse (ADE II 8) ──
    assisted: z.boolean().optional(),
    requires: z.array(z.string()).optional(),
    grantsFlag: z.string().optional(),
    sceneKind: z.enum(['test', 'combat', 'threat', 'hold', 'rally']).optional(),
    encounter: z.string().optional(),
    rounds: z.number().optional(),
    hold: z.strictObject({
      breakpoint: z.number(),
      maxRounds: z.number(),
      enemyBonusPerHold: z.number(),
    }).optional(),
    threat: z.strictObject({ penalty: z.number() }).optional(),
    generalDownOn: z.enum(['success', 'stupefying']).optional(),
    classGate: z.strictObject({
      classes: z.array(z.string()),
      outsidePenalty: z.number(),
      scope: z.enum(['current', 'ever']).optional(),
    }).optional(),
    // `blocked` = dette bloquante d'une Activité curée dont l'issue n'a aucun support moteur
    // (`ActivityDef.blocked`) : retirée des catalogues jouables par `activitiesFor`.
    blocked: z.strictObject({ ticket: z.string(), raison: z.string() }).optional(),
    // `maison` = arbitrage NON-verbatim documentant un champ (ex. `difficulty` par défaut quand le
    // RAW la laisse « variable ») — même convention que `naval-traits.json`/`criticals.json`/`crew-roles.json`.
    maison: z.string().optional(),
  }),
);

export type ActivitiesData = z.infer<typeof schema>;
