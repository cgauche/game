/**
 * Schéma de `maneuvers.json` — manœuvres/attaques naturelles de créature (LDB 85), résolues ENTIÈREMENT
 * depuis cette donnée par `state/combatManeuvers.resolveManeuver` (`ManeuverDef`, `src/data/index.ts`).
 * `kind` = `AttackKind` (`src/engine/creatureAttacks.ts`, anim/pose/icône seulement — jamais la
 * résolution). `effects` = `TriggeredEffect<EffectOp>[]` (`src/engine/flowCore.ts`), PROMU dans
 * `grammaire/mecanique.ts` (`conditionSchema`/`flowSchema`/`triggeredEffectSchema` — partagés avec
 * `qualities.ts`/`talents.ts`/`etats.ts`/`spells.ts`).
 *
 * AUCUN champ de PROSE (#1226) : une manœuvre est la PROJECTION mécanique d'un Trait de créature qui la
 * déclare (`TraitData.grantsManeuvers`) et qui porte SEUL le verbatim + l'ancrage. L'ENVELOPPE de la
 * fabrique offre `desc` à tout document ; ce document la REFUSE nommément par `options.affinerEntree`
 * — sans quoi l'adoption rouvrirait en silence la porte que `strictObject` fermait (0/20 en donnée).
 * Résolution du trait : `traitProjectingManeuver` (`src/data/index.ts`).
 */
import { z } from 'zod';
import { charKeySchema, stakeFormSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'maneuvers.json';
export const famille = 'entite';

/** `ManeuverMeasure` (`src/data/index.ts`) — Portée/Souffle en mètres = `bonus(ref) + plus`. */
const maneuverMeasure = z.strictObject({
  bonusOf: charKeySchema.optional(),
  plus: z.number().optional(),
});

const doc = document(
  'maneuvers',
  famille,
  {
    kind: z.enum(['arme', 'morsure', 'caudale', 'cornes', 'souffle', 'vomi', 'tentacules', 'etreinte', 'regard', 'langue', 'hurlement']),
    activation: z.enum(['action', 'free', 'charge']),
    advantageCost: z.number(),
    advantageMode: z.enum(['fixed', 'variable', 'all']).optional(),
    stat: z.enum(['capacite-de-combat', 'capacite-de-tir']).optional(),
    defense: z.enum(['esquive', 'parade', 'init', 'resist', 'auto']).optional(),
    targeting: z.enum(['melee', 'ranged', 'zone', 'allFoes', 'allAround', 'self']),
    range: maneuverMeasure.optional(),
    blast: maneuverMeasure.optional(),
    magic: z.boolean().optional(),
    effects: z.array(triggeredEffectSchema),
    priority: z.number().optional(),
    /** ENJEU de l'ENTRÉE (#1117) — ce que la manœuvre met en jeu, COLLÉ à ses `effects` (éditable au
     *  Codex). Rendu par `resolveStake` et PRIORITAIRE sur le gabarit du kind `maneuverDefense`. */
    stake: z.string().optional(),
    stakeForm: stakeFormSchema.optional(),
  },
  {
    kind: { label: 'Type d’attaque (rendu)', hint: 'Anime et illustre la manœuvre — n’entre pas dans la résolution' },
    activation: { label: 'Activation', hint: 'Action / gratuite / charge' },
    advantageCost: { label: 'Coût en Avantage' },
    advantageMode: { label: 'Mode de coût', hint: 'Fixe / variable / tout l’Avantage' },
    stat: { label: 'Caractéristique de test' },
    defense: { label: 'Défense opposée' },
    targeting: { label: 'Ciblage' },
    range: { label: 'Portée' },
    blast: { label: 'Zone d’effet' },
    magic: { label: 'Magique' },
    effects: { label: 'Effets déclenchés' },
    priority: {
      label: 'Priorité',
      hint: 'Poids de pertinence : classe la manœuvre au menu d’attaque et dans le choix de l’IA (défaut 1)',
    },
    stake: { label: 'Enjeu', hint: 'Ce que la manœuvre met en jeu, collé à ses effets déclenchés' },
    stakeForm: { label: 'Forme de l’enjeu' },
  },
  {
    codex: { keys: ['maneuvers'] },
    edit: { dataset: 'maneuvers' },
  },
  {
    exiges: ['source'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { id: string; desc?: string };
        if (e.desc !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['desc'],
            message: `${e.id} : une manœuvre ne porte AUCUNE prose (#1226) — le verbatim vit sur le Trait qui la projette`,
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
