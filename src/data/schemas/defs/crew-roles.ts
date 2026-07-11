/**
 * Schéma de `crew-roles.json` — rôles d'équipage naval (MDG ch.14 « Tests d'équipage »). Consommé par
 * `src/data/index.ts:1320` (`CrewRoleData`) et `src/engine/crewMorale.ts`/`src/state/shipCrew.ts` (le
 * rôle mappe une ou plusieurs Compétences par `skillId` + `spec` optionnel, ex. Artilleur = Projectiles
 * (Poudre noire), Chansonnier = Divertissement (Chant)).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'crew-roles.json';

const money = z.strictObject({ gold: z.number(), silver: z.number(), bronze: z.number() });

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    skills: z.array(z.strictObject({ skillId: z.string(), spec: z.string().optional() })),
    desc: z.string(),
    // Barème de solde (MDG 14 l.293-302 « Exemples de mercenaires ») : coûts quotidien ET hebdomadaire
    // verbatim (colonnes non-multiples l'une de l'autre). `source` = correspondance RAW explicite ;
    // `maison` = correspondance rôle→type de mercenaire arbitrée. #216
    wage: z.strictObject({
      daily: money,
      weekly: money,
      source: sourceRefSchema.optional(),
      maison: z.string().optional(),
    }).optional(),
    // Citation TOP-LEVEL de l'entrée (contrat du garde `citation-coverage-guard.test.ts`, #309 phase
    // 3) — reflet de `wage.source`/`wage.maison` (seule source réelle de l'entrée), jamais une
    // 2e recherche indépendante.
    source: sourceRefSchema.optional(),
    maison: z.string().optional(),
  }),
);

export type CrewRolesData = z.infer<typeof schema>;
