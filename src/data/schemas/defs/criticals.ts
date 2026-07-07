/**
 * Schéma de `criticals.json` — Tables de Blessures critiques LDB (Traumatisme, LDB 18), 4 familles
 * (Tête/Bras/Corps/Jambe, projetées sur les 6 `HitLocation`). Reflet de `CritEntry`/`CritTable`
 * (`src/data/criticals.ts`).
 */
import { z } from 'zod';
import { gameOpSchema, difficultySchema } from '../common';

export const file = 'criticals.json';

/** Escalade GATÉE par les soins (« Main ouverte » : doigt/Round ; « Pied écrasé » : perte du membre sans
 *  Chirurgie sous 1d10 jours) — reflet de `CritEscalation` (`src/data/criticals.ts`). Partagée AA/LDB. */
export const critEscalationSchema = z.strictObject({
  fingerLossPerRound: z.boolean().optional(),
  amputateAfter1d10Days: z.boolean().optional(),
  amputateSequel: z.string().optional(),
  // « Épaule luxée »/« Genou démis » : membre désactivé jusqu'à un Test étendu de Guérison réussi (DR
  // `restoreDR`) APRÈS Aide Médicale, puis pénalité 1d10 jours (`recoveryPenalty`). Cf. `CritEscalation`.
  medicalAidGate: z
    .strictObject({
      label: z.string(),
      disable: z.array(gameOpSchema),
      restoreDR: z.number(),
      recoveryPenalty: z.array(gameOpSchema),
    })
    .optional(),
  // « Réouverture » (LDB 18 l.101/118/143/145/148/175 ; AA 07 l.119/147/149/152/175) : tant que la plaie
  // n'a pas été recousue par Chirurgie, chaque nouveau Dégât à la MÊME Localisation octroie `amount` État
  // Hémorragique. Stampé par `stampCriticalEscalation` en séquelle chirurgicale (`bleedOnReinjury` + `needsSurgery`).
  bleedOnReinjury: z.strictObject({ amount: z.number(), label: z.string() }).optional(),
});

const critEntrySchema = z.strictObject({
  id: z.string(),
  min: z.number(),
  max: z.number(),
  name: z.string(),
  ops: z.array(gameOpSchema).optional(),
  resist: z
    .strictObject({
      difficulty: difficultySchema,
      onFail: z.array(gameOpSchema),
    })
    .optional(),
  lethal: z.boolean().optional(),
  amputation: z
    .strictObject({
      difficulty: difficultySchema,
      sequels: z.array(z.string()),
    })
    .optional(),
  traumas: z.array(z.string()).optional(),
  escalation: critEscalationSchema.optional(),
  desc: z.string(),
});

export const schema = z.strictObject({
  tete: z.array(critEntrySchema),
  bras: z.array(critEntrySchema),
  corps: z.array(critEntrySchema),
  jambe: z.array(critEntrySchema),
});

export type CriticalsData = z.infer<typeof schema>;
