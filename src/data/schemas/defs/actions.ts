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

/** RENDEUR d'accueil PAR DÉFAUT (spec §1a / §1c-bis / zone 4). Le placement joueur reste libre :
 *  ce champ dit d'où l'action NAÎT quand rien n'a été posé — et il nomme un rendeur RÉEL, mesuré au
 *  DOM par le contrat « surface ⇄ rendeur » (`src/ui/CombatConsole.test.tsx`). Correspondances :
 *   • `deduite-du-set` / `geste-d-etat` → la travée GAUCHE (`.cc-bay-left` : cases déduites du set,
 *     rubrique ACCÈS RAPIDE) ; `geste-d-etat` = la case G6bis (spec §1a) : ce que l'ÉTAT du porteur
 *     ouvre, pas ce que son arme offre ;
 *   • `grille` → la travée DROITE (`.cc-bay-right`), grille de capacités ;
 *   • `gouttiere-arche` → la GOUTTIÈRE de ressource de l'arche (`.cc-gutter`) : le geste adossé à la
 *     jauge qu'il défait (spec §1c) ;
 *   • `selecteur-de-sets` → la COLONNE de vignettes de sets (`.cc-sets`) : chaque vignette commute
 *     SON set ;
 *   • `coin-de-tour` → le coin de fin de tour (`.cc-corner`), isolé des deux travées ;
 *   • `bandeau-de-phase` → le bandeau `.cc-phase` HORS ciblage : la pause d'initiative de Round ;
 *   • `interlude` → le MÊME bandeau, pendant un ciblage par la carte : l'action s'affiche tant que
 *     le mode courant (`currentTargetingMode`) est celui de son `mode`, et SON dispatcher est la
 *     SORTIE de ce ciblage. Elle exige donc `mode`, `run` et `exitSafe` ;
 *   • `pastille-etat` → la PASTILLE de l'État concerné dans la niche d'États (`StateChips`, slot
 *     `action`) : la réaction que cet État ouvre vit sur LUI (arbitrage HUD 2026-08-16) ;
 *   • `pastille-entite` → la pastille de l'ENTITÉ sur le champ (zone 4), hors console ;
 *   • `frise` → la frise d'initiative (`InitiativeStrip`), hors console. */
const surfaceSchema = z.enum([
  'deduite-du-set', 'geste-d-etat', 'grille', 'gouttiere-arche', 'selecteur-de-sets', 'coin-de-tour',
  'bandeau-de-phase', 'interlude', 'pastille-etat', 'pastille-entite', 'frise',
]);

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
    /** Id de PRÉDICAT enregistré dans `ACTION_GATES` (`src/state/actionRegistry.ts`), ou LISTE d'ids :
     *  ils se composent alors par l'ET séquentiel d'`actionGate` (toutes passent, sinon la première
     *  raison refusée est rendue). Une condition de plus sur une action = un id de plus ici. */
    gate: z.union([z.string(), z.array(z.string()).min(2)]),
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
    /** POSTURE de tir pré-armée basculée par cette action (`BattleState.stances`, champ du
     *  `PendingAttack` qu'elle pré-remplit) — exigée par le dispatcher `battleToggleStance`. */
    stance: z.enum(['heldGround', 'intoCrowd']).optional(),
    cost: costSchema,
    /** Arbitrage NON-verbatim du coût (patron `activities.json`) — exige `costNote`. */
    maison: z.boolean().optional(),
    costNote: z.string().optional(),
    source: sourceRefSchema.optional(),
    /** FOYER de la règle : id de l'entrée Codex qui la porte (jamais une phrase recomposée). */
    rule: z.string().optional(),
    /** Catégorie Codex du foyer (`'regles'`, `'talents'`, `'etats'`…) — exigée avec `rule`. */
    ruleCategory: z.string().optional(),
    /** Clés de SURFACE historiques (cases `CombatConsole`) couvertes par cette
     *  action, tant que les espaces d'ids sont forkés. Une clé template (`sort-${id}`) se déclare
     *  par son PRÉFIXE littéral. Liste DÉCROISSANTE : le lot branchements remplace ces clés par
     *  l'id d'action lui-même. Consommée par `src/state/action-atteignabilite.test.ts`. */
    keys: z.array(z.string()).optional(),
    /** Dette BLOQUANTE : l'action est déclarée mais aucun dispatcher ne l'exécute encore. */
    blocked: z.strictObject({ ticket: z.string(), raison: z.string() }).optional(),
    /** SORTIE D'INTERLUDE ATTEIGNABLE À ÉCHAP (`surface: 'interlude'` uniquement) : `false` = son
     *  dispatcher COMMET quelque chose (un renoncement, un placement) — la touche d'annulation ne
     *  doit jamais le déclencher, seul le clic explicite le fait. `true` = la sortie ne perd rien
     *  (retour à la modale, désarmement d'un mode). */
    exitSafe: z.boolean().optional(),
    /** RÔLE SÉMANTIQUE de la sortie d'interlude (`surface: 'interlude'` uniquement, requis) : ce que
     *  le joueur FAIT en la prenant. `valide` = elle mène le geste à son terme (« Terminer »,
     *  « Valider », « Rester sur place ») ; `renonce` = elle abandonne ou revient en arrière
     *  (« Renoncer », « Retour », « Annuler »). C'est un rôle, PAS un style : la proéminence du
     *  bouton s'en DÉDUIT au rendu (même doctrine que `RollShell`), elle ne se déclare pas ici. */
    role: z.enum(['valide', 'renonce']).optional(),
    /** L'action FAIT NAÎTRE un panneau-paramètre (`PanneauParametre`) de SON alvéole : la surface qui
     *  la rend y pose l'ANCRE du panneau. Déclaré ICI pour qu'aucune console ne teste un id. */
    panneau: z.boolean().optional(),
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
    if ((a.run === 'battleToggleStance') !== !!a.stance) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : la bascule de posture et le champ stance vont ensemble (run battleToggleStance ⇔ stance)` });
    }
    if ((a.run || a.intent) && a.blocked) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : dette déclarée alors que l’action s’exécute (run) ou s’arme (intent)` });
    }
    if (a.surface === 'interlude' && (!a.mode || !a.run || a.exitSafe === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : action d’interlude sans mode de ciblage, sans dispatcher de sortie ou sans exitSafe` });
    }
    if (a.exitSafe !== undefined && a.surface !== 'interlude') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : exitSafe hors d’une action d’interlude (aucune touche d’annulation ne la vise)` });
    }
    if (a.surface === 'interlude' && !a.role) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : sortie d’interlude sans role (valide/renonce) — sa proéminence ne peut pas se déduire` });
    }
    if (a.role && a.surface !== 'interlude') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.id} : role hors d’une action d’interlude (aucun bandeau de phase ne la rend)` });
    }
  }),
);
