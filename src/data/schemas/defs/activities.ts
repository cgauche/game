/**
 * Schéma de `activities.json` — catalogue UNIQUE des Activités (LDB 23, EDOC 8, MDG 15,
 * ADE II 8 Bataille de masse), miroir strict de `ActivityDef` (`src/engine/activities.ts`,
 * étend `TestSpec` de `src/engine/skills.ts`) + `OutcomeBand`/`BattleOutcome`/`BattleCond`
 * (`.../activities.ts`). Inventaire réel (40 entrées, script node) : tous les champs déclarés
 * ci-dessous sont observés au moins une fois ; aucun champ de l'interface n'est ABSENT du JSON.
 */
import { z } from 'zod';
import { gameOpSchema, sourceRefSchema, difficultySchema, stageOutcomeSchema, stakeFormSchema } from '../common';

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

/** `ActivityResolver` (`src/engine/activities.ts`) — VOCABULAIRE FERMÉ des résolveurs bespoke
 *  d'Activité (dispatch `runActivityResolver`/`seaActivities`/`travelPostes`/`battleActivities`).
 *  Dupliqué à l'identique côté schéma (même patron que `stageOutcomeSchema`, `common.ts`) : un
 *  résolveur de plus = une ligne ici ET sa branche moteur. */
const activityResolverSchema = z.enum([
  // Interlude — socle (LDB 23, ACE Annexe I)
  'income', 'craftExtended', 'learnTalent', 'identify', 'entrainement', 'mecenat',
  // Interlude — bespoke
  'ritualFocus', 'masterWeapon', 'identifyByResearch', 'memorizeDiscount', 'combatTraining',
  'punchausen', 'knowledgeResearch', 'reputation', 'wrathOfTheGods', 'dissensionScout',
  'dissensionEmeute', 'contremaitre',
  // Voyage (EDOC 8) · Mer (MDG) · Bataille de masse (ADE II 8)
  'forage', 'seaChart', 'opportunityTrade', 'crewTraining', 'battleRally',
]);

const outcomeBandSchema = z.strictObject({
  on: z.enum(['success', 'failure', 'fumble']).optional(),
  minSL: z.number().optional(),
  maxSL: z.number().optional(),
  ops: z.array(gameOpSchema).optional(),
  resolver: activityResolverSchema.optional(),
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
    // ── TestSpec (src/engine/skills.ts) ──
    skills: z.array(skillRefSchema).optional(),
    char: z.string().optional(),
    difficulty: difficultySchema.optional(),
    combined: z.boolean().optional(),
    // ── ActivityDef propre ──
    freeSkill: z.boolean().optional(),
    extended: z.strictObject({ drPerStage: z.number() }).optional(),
    failExtenue: z.boolean().optional(),
    weatherMod: z.record(z.string(), z.number()).optional(),
    resolver: activityResolverSchema.optional(),
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
    /** Réservoir de modificateur d'armée CONSOMMÉ par le Test de cette Activité (miroir de
     *  `ActivityDef.testModFrom`) — Planification dépense `planningBonus` (ADE II 8 l.75/100). */
    testModFrom: z.enum(['allyTestMod', 'firstRoundBonus', 'planningBonus']).optional(),
    /** Difficulté DÉRIVÉE d'un écart de mesure d'armée (miroir de `ActivityDef.difficultyFrom`) —
     *  Discours inspirant : écart de Puissance arrondi à la dizaine (ADE II 8 l.71). */
    difficultyFrom: z.strictObject({
      gap: z.enum(['armyMight']),
      roundTo: z.number().optional(),
    }).optional(),
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
    // ── ENJEU du jet (#1117 L3) — `activities` est le 5ᵉ dataset d'enjeux, porté par l'ENTITÉ
    //    elle-même (pas de fichier tiers) : une Activité qui LANCE dit ce que son jet met en jeu.
    /** Texte d'enjeu — descripteur mécanique de ce que le résolveur applique, et/ou verbatim court. */
    stake: z.string().optional(),
    /** FORME DÉCLARÉE du `stake` (même contrat que `night-stakes`/`flow-stakes`). */
    stakeForm: stakeFormSchema.optional(),
    /** FOYER de la règle derrière le jet — id de l'entité qui la PORTE. Absent : le foyer est
     *  l'Activité elle-même (sa `desc` verbatim, catégorie Codex `activities`). */
    rule: z.string().optional(),
    /** Catégorie Codex du foyer (`'regles'`, `'skills'`, `'etats'`…) — exigée avec `rule`. */
    ruleCategory: z.string().optional(),
  })
  .superRefine((a, ctx) => {
    if (a.stake && !a.stakeForm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : enjeu sans forme déclarée (stakeForm)` });
    }
    if (a.stakeForm && !a.stake) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : forme d’enjeu déclarée sans enjeu` });
    }
    if (a.rule && !a.ruleCategory) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : rule sans ruleCategory` });
    }
  }),
);
