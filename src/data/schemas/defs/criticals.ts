/**
 * Schéma de `criticals.json` — Tables de Blessures critiques LDB (Traumatisme, LDB 18), 4 familles
 * (Tête/Bras/Corps/Jambe, projetées sur les 6 `HitLocation`). Reflet de `CritEntry`/`CritTable`
 * (`src/data/criticals.ts`).
 */
import { z } from 'zod';
import { difficultySchema, hitLocationSchema, sourceRefSchema, formulaSchema } from '../grammaire/valeurs';
import { gameOpSchema } from '../grammaire/mecanique';

export const file = 'criticals.json';

/** Escalade GATÉE par les soins (« Main ouverte » : doigt/Round ; « Pied écrasé » : perte du membre sans
 *  Chirurgie sous 1d10 jours) — reflet de `CritEscalation` (`src/data/criticals.ts`). Partagée AA/LDB. */
export const critEscalationSchema = z.strictObject({
  // Escalade PÉRIODIQUE sans Aide Médicale (« Main ouverte ») et escalade À ÉCHÉANCE sans Chirurgie
  // (« Pied écrasé ») — deux AXES paramétrés (séquelle visée + cadence/délai), cf. `CritEscalation`.
  perRound: z.strictObject({ versTraumaId: z.string(), unites: z.number().optional() }).optional(),
  apresDelai: z.strictObject({ jours: formulaSchema, versTraumaId: z.string() }).optional(),
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
  // « Si vous tombez une seconde fois sur cette blessure… » (Blessure majeure à l'oreille, LDB 18 l.71 / AA
  // 07 l.96) : effet ALTERNATIF à la 2e occurrence de l'entrée (`onRepeat.traumas` remplace les séquelles de
  // base, `onRepeat.ops` s'ajoute à l'effet immédiat). Évalué par `rollCritical`/`resolveAACritical`.
  onRepeat: z
    .strictObject({
      traumas: z.array(z.string()).optional(),
      ops: z.array(gameOpSchema).optional(),
    })
    .optional(),
  // « Si vous recevez une autre Blessure critique à la tête alors que vous êtes Exténué… » (Commotion
  // cérébrale, LDB 18 l.74) : séquelle porteuse d'un `critTrigger` — tant que `whileCondition` tient, tout
  // critique subséquent à `location` impose le Test `resist`. Stampé par `stampCriticalEscalation`.
  onNextCritWhileCondition: z
    .strictObject({
      label: z.string(),
      location: hitLocationSchema.optional(),
      whileCondition: z.string(),
      resist: z.strictObject({ difficulty: difficultySchema, onFail: z.array(gameOpSchema) }),
    })
    .optional(),
  // « Une fois que la blessure est guérie… » (Blessure spectaculaire l.61 / Nez cassé l.72) : marqueur de
  // guérison (`Trauma.onHealGrant`) → cicatrice `scar` (fiche traumas.json) une fois tous les États `whenClear`
  // retirés (LDB 18 l.304). Octroyée par `settleHealedCriticals` au retrait d'État.
  onHealGrant: z.strictObject({ scar: z.string(), whenClear: z.array(z.string()) }).optional(),
});

/** Amputation (LDB 18 l.237) — reflet de `Amputation` (`src/data/criticals.ts`), SOURCE UNIQUE de forme
 *  partagée LDB (`criticals.json`) et Aux Armes (`aa-criticals.json`, mêmes textes « Une fois la rencontre
 *  terminée… »/« un orteil par DR »). Résolue par `resolveAmputation`. */
export const amputationSchema = z.strictObject({
  difficulty: difficultySchema,
  sequels: z.array(z.string()),
  // Nombre d'UNITÉS que CETTE ligne fait perdre à ses séquelles cumulatives (« Perdez 1d10 dents »,
  // criticals.json:bouche-explosee/machoire-mutilee) — `Formula`, défaut 1. Cf. `Amputation.unites`.
  unites: formulaSchema.optional(),
  // Test différé à la fin de la rencontre (« Coupure à l'orteil », LDB l.171 / AA 07 l.171) — marqueur `pendingAmputation`.
  timing: z.literal('postEncounter').optional(),
  // Séquelle CONDITIONNELLE : `difficulty` = Test gate SÉPARÉ (réussite → pas d'amputation) ; absent = le
  // Test de Résistance `difficulty` détermine lui-même la perte. `perDR` = orteils 1 + DR en dessous de 0.
  loss: z.strictObject({ difficulty: difficultySchema.optional(), perDR: z.boolean().optional() }).optional(),
});

const critEntrySchema = z.strictObject({
  id: z.string(),
  min: z.number(),
  max: z.number(),
  label: z.string(),
  ops: z.array(gameOpSchema).optional(),
  resist: z
    .strictObject({
      difficulty: difficultySchema,
      onFail: z.array(gameOpSchema),
    })
    .optional(),
  lethal: z.boolean().optional(),
  amputation: amputationSchema.optional(),
  traumas: z.array(z.string()).optional(),
  escalation: critEscalationSchema.optional(),
  // Note MAISON (#195) : trace éditable d'une valeur mécanique absente littéralement du texte RAW (règle stricte 7).
  maison: z.string().optional(),
  desc: z.string(),
  source: sourceRefSchema.optional(),
});

export const schema = z.strictObject({
  tete: z.array(critEntrySchema),
  bras: z.array(critEntrySchema),
  corps: z.array(critEntrySchema),
  jambe: z.array(critEntrySchema),
});
