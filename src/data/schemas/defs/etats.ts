/**
 * Schéma de `etats.json` — dérivé de l'inventaire COMPLET des clés (script node, n=20/20) et de
 * `StatusData`/`EtatData` (`src/data/index.ts`). `effects` (`TriggeredEffect[]`) et
 * son `Flow` récursif : MÊME algèbre que talents.json (`engine/flowCore.ts`), PROMUE dans
 * `grammaire/mecanique.ts` (`flowSchema`/`conditionSchema`/`triggeredEffectSchema`).
 * `icon` et `maison` sont des clés d'ENVELOPPE, posées par la fabrique.
 */
import { z } from 'zod';
import { charKeySchema, difficultySchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'etats.json';
export const famille = 'entite';

/** `StatusData.gating` (`src/data/index.ts`) — restriction Action/Mouvement/défense. */
const gatingSchema = z.strictObject({
  action: z.literal('none').optional(),
  movement: z.enum(['none', 'half', 'crawl']).optional(),
  cannotDefend: z.literal(true).optional(),
});

/** `EtatData.recover` (`src/data/index.ts`). */
const recoverSchema = z.strictObject({
  skill: z.string().optional(),
  characteristic: charKeySchema.optional(),
  opposedBy: z.literal('source').optional(),
  difficulty: difficultySchema.optional(),
});

const doc = document(
  'etats',
  famille,
  {
    passive: z.array(gameOpSchema).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    gating: gatingSchema.optional(),
    severity: z.number().optional(),
    aiThreat: z.number().optional(),
    perStack: z.boolean().optional(),
    /** `stacksReducedBy` = clé de `CombatFeature` (ex. `bleedIgnore`) — laissé en `z.string()` (référence
     *  croisée hors périmètre d'un seul dataset). */
    stacksReducedBy: z.string().optional(),
    restrictsAction: z.boolean().optional(),
    recover: recoverSchema.optional(),
    /** `EtatData.persistsAfterCombat` (`src/data/index.ts`) — LDB 16 l.56/70/84/92/107/117, LDB 62 l.250. */
    persistsAfterCombat: z.boolean().optional(),
  },
  {
    passive: { label: 'Effets passifs', hint: 'Effets mécaniques appliqués en continu tant que l’État est actif' },
    effects: { label: 'Effets déclenchés' },
    gating: { label: 'Restrictions Action/Mouvement/défense', hint: 'Limite Action/Mouvement/défense pendant l’État' },
    severity: { label: 'Sévérité' },
    aiThreat: { label: 'Menace pour l’IA', hint: 'Poids pris en compte par l’IA pour évaluer la dangerosité de l’État' },
    perStack: { label: 'Par cumul', hint: 'L’effet se recalcule à chaque palier de cumul, pas une seule fois' },
    stacksReducedBy: { label: 'Cumuls réduits par', hint: 'Capacité de combat qui réduit le nombre de cumuls' },
    restrictsAction: {
      label: 'Action verrouillée',
      hint: 'État bloquant (Brisé) : l’IA dépense sa Détermination pour le lever',
    },
    recover: { label: 'Guérison', hint: 'Test (Compétence/Caractéristique/Difficulté) qui met fin à l’État' },
    persistsAfterCombat: { label: 'Persiste hors combat' },
  },
  {
    codex: { keys: ['etats'] },
    edit: { dataset: 'etats' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;
