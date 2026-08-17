/**
 * Schéma de `miscast.json` — DIALECTE compilé (PAS des `GameOp` standard), cf. en-tête de
 * `src/data/data-wellformed.test.ts:19-22` et `src/engine/miscast.ts::expandOp`. Modélise
 * `JsonRow`/`JsonNestedTest`/`JsonOp`/`JsonFormula`/`JsonDice` TELS QU'ILS SONT LUS par
 * `miscast.ts` (miroir du `GameOp` runtime, mais `Formula` → `JsonFormula`, + `sinPlus1Value`/
 * `durationRounds` propres au dialecte). Table exposée en 3 tirages d100 : `minor`/`major` (Tableaux
 * des Incantations Imparfaites Mineures/Majeures, LDB 46 folio 234) et `wrath` (Tableau de la Colère
 * des dieux, LDB 40 folio 218) — #309 phase 3.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'miscast.json';

const difficultySchemaLocal = z.enum([
  'tresFacile', 'facile', 'accessible', 'intermediaire', 'complexe',
  'difficile', 'tresDifficile', 'presqueImpossible', 'impossible',
]);

/** `JsonDice` (`engine/miscast.ts:72`) = `DiceSpec` (`engine/dice.ts:43`) + `sinPlus` (le `plus`
 *  du dé = Points de Péché à la résolution) — dé DÉCLARÉ en donnée, jamais une closure de code. */
const jsonDiceSchema = z.strictObject({
  n: z.number(),
  sides: z.number(),
  plus: z.number().optional(),
  sinPlus: z.boolean().optional(),
});

/** `JsonFormula` (`engine/miscast.ts:81`) : nombre littéral, dé, ou `{sinPlus1}` (= 1 + Points de Péché). */
const jsonFormulaSchema = z.union([
  z.number(),
  z.strictObject({ dice: jsonDiceSchema }),
  z.strictObject({ sinPlus1: z.literal(true) }),
]);

/** `Formula` GÉNÉRAL du moteur (`engine/ops.ts:65`) — UNIQUEMENT pour `escapeStrength` : la donnée
 *  réelle y écrit `{times:{of,factor}}` (miscast.json:93, « Tenue indisciplinée »), une forme HORS
 *  du dialecte `JsonFormula` (qui n'a que number/dice/sinPlus1) — ce champ n'est jamais sin-paramétré,
 *  `expandOp` le recopie tel quel (`engine/miscast.ts`). */
const engineFormulaSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.number(),
    z.strictObject({ bonusOf: z.string() }),
    z.strictObject({ charOf: z.string() }),
    z.strictObject({ dice: z.strictObject({ n: z.number(), sides: z.number(), plus: z.number().optional() }) }),
    z.strictObject({ rolled: z.literal(true) }),
    z.strictObject({ indiceOf: z.literal(true) }),
    z.strictObject({ stacks: z.literal('self') }),
    z.strictObject({ engagedAdvantageGap: z.literal(true) }),
    z.strictObject({ woundsDealt: z.literal(true) }),
    z.strictObject({ sum: z.array(engineFormulaSchema) }),
    z.strictObject({ times: z.strictObject({ of: engineFormulaSchema, factor: z.number() }) }),
  ]),
);

/**
 * `JsonOp` (`engine/miscast.ts:93`) — mirroir aplati du `GameOp` runtime (`op:'condition'|'wounds'|
 * 'corruption'|'reduceToZero'|'castPenalty'`, seuls op observés dans la donnée), en `JsonFormula`.
 * `escapeStrength` (GameOp `condition` réel, `engine/ops.ts:329` — porté par miscast.json:93
 * « Tenue indisciplinée ») est recopié tel quel par `expandOp` (`Formula` plein, jamais sin-paramétré
 * — cf. `engineFormulaSchema` ci-dessus).
 */
const jsonOpSchema = z.strictObject({
  op: z.string(),
  id: z.string().optional(),
  value: jsonFormulaSchema.optional(),
  durationRounds: jsonFormulaSchema.optional(),
  sinPlus1Value: z.boolean().optional(),
  amount: jsonFormulaSchema.optional(),
  /** Mitigation DÉCLARÉE du `wounds` (garde `wounds-mitigation-declaree`) — recopiée telle quelle
   *  par `expandOp` : « qui ignorent les PA » seuls (Poupée de chiffon, LDB 46) ≠ « qui ignorent le
   *  Bonus d'Endurance et les PA » (Choc aethyrique, LDB 46). */
  ignoreTB: z.boolean().optional(),
  ignoreAP: z.boolean().optional(),
  skill: z.string().optional(),
  mod: z.number().optional(),
  blocked: z.boolean().optional(),
  maxZeroDR: z.boolean().optional(),
  rounds: jsonFormulaSchema.optional(),
  hours: jsonFormulaSchema.optional(),
  minutes: jsonFormulaSchema.optional(),
  days: z.number().optional(),
  /** Cf. ANOMALIE ci-dessus — accepté (dialecte réel, `Formula` plein), signalé comme mort côté `expandOp`. */
  escapeStrength: engineFormulaSchema.optional(),
});

/** `JsonNestedTest` (`engine/miscast.ts:115`). */
const jsonNestedTestSchema = z.strictObject({
  skill: z.string().optional(),
  characteristic: z.string().optional(),
  difficulty: difficultySchemaLocal,
  onFail: z.array(jsonOpSchema),
  onFailHard: z.strictObject({ dr: z.number(), ops: z.array(jsonOpSchema) }).optional(),
});

/** `JsonRow` (`engine/miscast.ts:124`) — entrée de table d100 (`min`/`max` inclusifs). */
const jsonRowSchema = z.strictObject({
  /** Identité STABLE (#422, exposition Codex) — slug préfixé par table (`mineure-`/`majeure-`/`colere-`)
   *  pour éviter toute collision inter-tables ; consommée par le Codex, jamais par `engine/miscast.ts`. */
  id: z.string(),
  min: z.number(),
  max: z.number(),
  label: z.string(),
  ops: z.array(jsonOpSchema).optional(),
  test: jsonNestedTestSchema.optional(),
  reroll: z.enum(['majeure', 'mineure-x2']).optional(),
  /** CLÉ d'une table déclarée par le Domaine du lanceur (`domains.json` → `tables`) : la rangée tire
   *  sur la table de SON Vent (`arcaneMark` = Marques Arcaniques, `VDM 02 l.238`). Résolue en op
   *  `rollTable`/`tableId` par `engine/miscast.ts` ; Domaine sans cette clé = relance sur le Majeur. */
  domainTable: z.string().optional(),
  source: sourceRefSchema.optional(),
});

export const schema = z.strictObject({
  minor: z.array(jsonRowSchema),
  major: z.array(jsonRowSchema),
  /** Jeux de tables ALTERNATIFS des Vents de Magie (`VDM 02 l.218-263`, folios 24-25), sélectionnés
   *  par la règle optionnelle `magic-vdm-incantation` — cf. `engine/miscast.ts::miscastTables`. */
  minorVdm: z.array(jsonRowSchema),
  majorVdm: z.array(jsonRowSchema),
  wrath: z.array(jsonRowSchema),
});
