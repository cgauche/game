/**
 * Schéma de `actions.json` — REGISTRE UNIQUE des actions de combat (spec HUD, « Zone 12 »).
 * Une entrée = un acte OFFERT au joueur pendant un combat, avec son identité STABLE (sans préfixe
 * de position), son affichage (`label`/`icon`), sa RÈGLE (`rule`/`ruleCategory` → Codex), son COÛT,
 * sa surface d'accueil par défaut, et les IDS de code qui l'exécutent (`gate`/`candidates`/`run`/
 * `mode`/`armed`, tous résolus par `src/state/actionRegistry.ts` — jamais de code en JSON).
 *
 * COÛTS — guideline RAW (`LDB 13 l.106`, verbatim : « C'est le MJ qui va décider ce qui vous coûtera
 * votre Action, et ce que vous pouvez faire au cours d'un Round. On part en général du principe que
 * si un acte nécessite un Test, c'est que c'est une Action plutôt qu'une Action gratuite. ») : elle
 * sert de DÉFAUT de remplissage. Tout coût qui n'en découle pas et qu'aucun verbatim ne porte est
 * marqué `maison: true` + `costNote` (patron `activities.json`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'actions.json';

/** Surface d'accueil PAR DÉFAUT (spec §1a / §1c-bis / zone 4). Le placement joueur reste libre :
 *  ce champ dit d'où l'action NAÎT quand rien n'a été posé. `geste-d-etat` = la case G6bis de la
 *  travée gauche (spec §1a, G6bis) : ce que l'ÉTAT du porteur ouvre, pas ce que son arme offre. */
const surfaceSchema = z.enum(['deduite-du-set', 'geste-d-etat', 'grille', 'pastille-entite', 'hors-console']);

/** Ce que l'acte consomme dans l'économie du Tour. */
const costSchema = z.enum(['action', 'mouvement', 'gratuit', 'aucun']);

export const schema = z.array(
  z.strictObject({
    /** Id STABLE, SANS préfixe de position (la touche suit la case, la case porte cet id). */
    id: z.string(),
    /** Libellé d'AFFICHAGE (français) — jamais une clé de logique. */
    label: z.string(),
    /** Id d'icône du registre `src/ui/icons` (garde `data-wellformed`, cas 9). */
    icon: z.string(),
    surface: surfaceSchema,
    /** Id de PRÉDICAT enregistré dans `ACTION_GATES` (`src/state/actionRegistry.ts`). */
    gate: z.string(),
    /** Id de SÉLECTEUR impur enregistré dans `ACTION_CANDIDATES` (liste des cibles/objets offerts). */
    candidates: z.string().optional(),
    /** Id de DISPATCHER enregistré dans `ACTION_RUN` (méthode `battle*` du store). Absent = `blocked`. */
    run: z.string().optional(),
    /** Id de `TargetingMode` EXISTANT (`src/state/targetingModes.ts`) armé par cette action. */
    mode: z.string().optional(),
    /** Id de PORTÉE d'INTENTION (`INTENT_REACH`, `src/state/localIntent.ts`) : la case ARME le mode
     *  local qui peint cette portée sur le champ. Le clic qui suit reste le geste par défaut du grid,
     *  et dissout l'intention (spec zone 4). */
    intent: z.string().optional(),
    /** Valeur écrite dans `battle.action` quand l'action est ARMÉE (mode à bouton). */
    armed: z.string().optional(),
    cost: costSchema,
    /** Arbitrage NON-verbatim du coût (patron `activities.json`) — exige `costNote`. */
    maison: z.boolean().optional(),
    costNote: z.string().optional(),
    source: sourceRefSchema.optional(),
    /** FOYER de la règle : id de l'entrée Codex qui la porte (jamais une phrase recomposée). */
    rule: z.string().optional(),
    /** Catégorie Codex du foyer (`'regles'`, `'talents'`, `'etats'`…) — exigée avec `rule`. */
    ruleCategory: z.string().optional(),
    /** Clés de SURFACE historiques (slots `ActionBar`, cases `CombatConsole`) couvertes par cette
     *  action, tant que les espaces d'ids sont forkés. Une clé template (`sort-${id}`) se déclare
     *  par son PRÉFIXE littéral. Liste DÉCROISSANTE : le lot branchements remplace ces clés par
     *  l'id d'action lui-même. Consommée par `src/state/action-atteignabilite.test.ts`. */
    keys: z.array(z.string()).optional(),
    /** Dette BLOQUANTE : l'action est déclarée mais aucun dispatcher ne l'exécute encore. */
    blocked: z.strictObject({ ticket: z.string(), raison: z.string() }).optional(),
  })
  .superRefine((a, ctx) => {
    if (a.maison && !a.costNote) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : coût maison sans costNote` });
    }
    if (a.costNote && !a.maison) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : costNote sans maison (un coût RAW n'a pas de note d'arbitrage)` });
    }
    if (a.rule && !a.ruleCategory) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : rule sans ruleCategory` });
    }
    if (!a.run && !a.intent && !a.blocked) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : ni dispatcher (run), ni intention (intent), ni dette déclarée (blocked)` });
    }
    if ((a.run || a.intent) && a.blocked) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : dette déclarée alors que l’action s’exécute (run) ou s’arme (intent)` });
    }
  }),
);
