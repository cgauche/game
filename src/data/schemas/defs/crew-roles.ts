/**
 * Schéma de `crew-roles.json` — rôles d'équipage naval (MDG ch.14 « Tests d'équipage »). Consommé par
 * `src/data/index.ts:1320` (`CrewRoleData`) et `src/engine/crewMorale.ts`/`src/state/shipCrew.ts` (le
 * rôle mappe une ou plusieurs Compétences par `skillId` + `spec` optionnel, ex. Artilleur = Projectiles
 * (Poudre noire), Chansonnier = Divertissement (Chant)).
 */
import { z } from 'zod';

export const file = 'crew-roles.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    skills: z.array(z.strictObject({ skillId: z.string(), spec: z.string().optional() })),
    desc: z.string(),
  }),
);

export type CrewRolesData = z.infer<typeof schema>;
