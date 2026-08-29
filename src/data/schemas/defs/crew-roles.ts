/**
 * Schéma de `crew-roles.json` — rôles d'équipage naval (MDG 14 « Tests d'équipage »). Consommé par
 * `src/data/index.ts` (`CrewRoleData`) et `src/engine/crewMorale.ts`/`src/state/shipCrew.ts` (le
 * rôle mappe une ou plusieurs Compétences par `skillId` + `spec` optionnel, ex. Artilleur = Projectiles
 * (Poudre noire), Chansonnier = Divertissement (Chant)).
 *
 * PROVENANCE : `source`/`maison` (clés d'ENVELOPPE) sont le reflet TOP-LEVEL de `wage.source`/
 * `wage.maison` — seule source réelle de l'entrée, jamais une 2ᵉ recherche indépendante (contrat du
 * garde `citation-coverage-guard.test.ts`, #309 phase 3).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'crew-roles.json';
export const famille = 'entite';

const money = z.strictObject({ gold: z.number(), silver: z.number(), bronze: z.number() });

const doc = document(
  'crew-roles',
  famille,
  {
    skills: z.array(z.strictObject({ skillId: z.string(), spec: z.string().optional() })),
    // Barème de solde (MDG 14 l.293-302 « Exemples de mercenaires ») : coûts quotidien ET hebdomadaire
    // verbatim (colonnes non-multiples l'une de l'autre). `source` = correspondance RAW explicite ;
    // `maison` = correspondance rôle→type de mercenaire arbitrée. #216
    wage: z
      .strictObject({
        daily: money,
        weekly: money,
        source: sourceRefSchema.optional(),
        maison: z.string().optional(),
      })
      .optional(),
  },
  {
    skills: { label: 'Compétences du rôle', hint: 'Compétence (+ spécialisation optionnelle) qui couvre ce rôle d’équipage' },
    wage: { label: 'Solde', hint: 'Coût quotidien et hebdomadaire d’un mercenaire tenant ce rôle' },
  },
  {
    codex: { keys: ['crewRoles'] },
    edit: { dataset: 'crewRoles' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
