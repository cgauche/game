/**
 * Schéma de `combat-stakes.json` — ENJEU d'un `kind` d'étape de cascade de COMBAT (#1117 L2). Quatrième
 * dataset de la famille (après `night-stakes`, `voyage-stakes`, `flow-stakes`), même contrat de forme
 * DÉCLARÉE (`form`) : `verbatim` = contigu au Source bloc par bloc ; `descripteur` = assemblage
 * mécanique de ce que l'APPLIER du `kind` fait réellement, dont le verbatim intégral vit dans la fiche.
 *
 * FOYER (`rule` + `ruleCategory`) ou ENTRÉE (`entryCategory`) : le renvoi cible l'entité qui PORTE déjà
 * la règle (l'État posé par l'échec, la maladie contractée, la manœuvre subie, le sort prolongé),
 * `regles.json` n'étant que le foyer des règles de cadre. Au moins l'un des deux est exigé.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'combat-stakes.json';

export const schema = z.array(
  z
    .strictObject({
      /** Identité STABLE (exposition/édition Codex) — distincte de `kind`. */
      id: z.string(),
      /** Libellé FR d'affichage. */
      label: z.string(),
      /** `kind` de l'étape de cascade servie (clé de `cascadeAppliers`). */
      kind: z.string(),
      /** Gabarit du descripteur — trous `{nom}` remplis par le flux (valeurs calculées). */
      template: z.string(),
      /** FORME DÉCLARÉE (garde `night-stake-form.test.ts`, étendue à ce dataset). */
      form: z.enum(['verbatim', 'descripteur']),
      /** Id du FOYER de la règle (entité porteuse, ou fiche de `regles.json` à défaut). */
      rule: z.string().optional(),
      /** Catégorie Codex du foyer (`'regles'`, `'etats'`, `'maladies'`…). */
      ruleCategory: z.string().optional(),
      /** Catégorie Codex de l'ENTRÉE JOUÉE quand le foyer descend jusqu'à elle (`'maladies'`,
       *  `'maneuvers'`, `'spells'`) — le producteur fournit alors l'`entryId` depuis son `meta`. */
      entryCategory: z.string().optional(),
      source: sourceRefSchema,
    })
    .superRefine((e, ctx) => {
      if (!e.entryCategory && !(e.rule && e.ruleCategory)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${e.id} : ni foyer (rule+ruleCategory) ni entryCategory` });
      }
      if (e.rule && !e.ruleCategory) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${e.id} : rule sans ruleCategory` });
      }
    }),
);

export type CombatStakesData = z.infer<typeof schema>;
