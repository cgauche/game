/**
 * Schéma de `skills.json` — dérivé de l'inventaire COMPLET des clés (script node, n=46/46), de
 * l'interface `SkillData` (`src/data/index.ts`) et de ses consommateurs (`ItemCapabilities`,
 * `SpecsSource`, `engine/skillCombatApps`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'skills.json';

/** 10 Caractéristiques (LDB) — cf. `engine/types.ts::CharKey`. Dupliqué ici (`common.ts` gelé) ;
 *  candidat à mutualisation (`charKeySchema`) avec talents/spells/etats qui le redéfinissent aussi. */
const charKeySchema = z.enum([
  'capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite',
  'intelligence', 'force-mentale', 'sociabilite',
]);

/** `SpecsSource` (`src/data/index.ts`) — registre partagé `SPEC_SOURCES` d'où dérive le pool de
 *  spécialisations quand `specs[]` est absent. Constaté sur skills.json : `weaponGroupsMelee`/
 *  `weaponGroupsRanged`/`winds` seulement, mais le type complet est repris (colonne vertébrale TS). */
const specsSourceSchema = z.enum([
  'weaponGroupsMelee',
  'weaponGroupsRanged',
  'winds',
  'arcaneDomains',
  'cultBlessings',
  'cultMiracles',
  'cultChaos',
  'seaShanties',
  'groups',
  'diseases',
  'sizes',
  'mutations',
  'breathTypes',
  'damageTypes',
  'weaponsMelee',
  'weaponsRanged',
]);

/** `SpecEntry` (`src/data/index.ts`) — entrée de spécialisation inline. */
const specEntrySchema = z.strictObject({ id: z.string(), label: z.string() });

/** Entrée de `skills.json`. */
const skillEntrySchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  characteristic: charKeySchema,
  /** Libellé d'affichage de catégorie ('base' | 'avancée' constatés) — AFFICHAGE, pas un id de logique. */
  type: z.string(),
  specs: z.array(specEntrySchema).optional(),
  specsSource: specsSourceSchema.optional(),
  specsOpen: z.boolean().optional(),
  desc: z.string(),
  source: sourceRefSchema,
  movement: z.boolean().optional(),
  hearing: z.boolean().optional(),
  /** Caractéristique ALTERNATIVE sous règle optionnelle (`SkillData.altChar`, lu par `altCharKey`) :
   *  `gatedByRule` = id d'`OptionalRule` (FK validée par `variants-integrity.test.ts`), `from` = carac de
   *  base à laquelle la substitution s'applique (absente = toute carac), `chars` = la carac à utiliser
   *  PAR VALEUR de la règle (clé = valeur rendue par `rule()`, en chaîne — `"true"` pour un interrupteur ;
   *  une LISTE = la meilleure des caracs citées chez le porteur). */
  altChar: z.strictObject({
    gatedByRule: z.string(),
    from: charKeySchema.optional(),
    chars: z.record(z.string(), z.union([charKeySchema, z.array(charKeySchema)])),
  }).optional(),
  combatAdvantage: z.strictObject({ cap: charKeySchema }).optional(),
  combatSubstitute: z.strictObject({
    role: z.enum(['defense', 'attack', 'both']),
    gate: z.literal('fear'),
  }).optional(),
  /** `capability` = clé de `ItemCapabilities` (`src/data/index.ts`) — sac de flags fermé côté TS ;
   *  laissé en `z.string()` ici (référence croisée hors périmètre d'un seul dataset, cf. `tool.json`
   *  n'existe pas comme catalogue séparé — c'est un type TS, pas une donnée). */
  tool: z.strictObject({ capability: z.string(), withoutMod: z.number() }).optional(),
});

export const schema = z.array(skillEntrySchema);
