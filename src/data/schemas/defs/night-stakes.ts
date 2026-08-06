/**
 * Schéma de `night-stakes.json` — enjeu VERBATIM (règle 5) d'un `kind` d'étape de la cascade de nuit
 * (#331), migré depuis `NIGHT_STAKES` (`src/state/restFlow.ts`) en donnée app-owned (arbitrage
 * doctrine 2026-07-12 : un catalogue en dur est l'exception, il migre en donnée). Lu par `nightStake`.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'night-stakes.json';

export const schema = z.array(
  z.strictObject({
    /** Identité STABLE (#422, exposition Codex) — distincte de `kind` (le vocabulaire consommé par
     *  `nightStake`), ajoutée pour la navigation/l'édition. */
    id: z.string(),
    /** Libellé FR d'affichage (#422). */
    label: z.string(),
    kind: z.string(),
    stake: z.string(),
    /** FORME du `stake`, DÉCLARÉE par la donnée (garde `night-stake-form.test.ts`, #1117 L0b) :
     *  - absente / `'verbatim'` : chaque bloc du `stake` est une sous-chaîne CONTIGUË d'une ligne du
     *    chapitre cité par `source.note` — recollable tel quel (règle stricte 5) ;
     *  - `'descripteur'` : descripteur MÉCANIQUE assemblé depuis ce que l'applier fait réellement
     *    (aucun fragment n'est réputé verbatim). Le verbatim intégral vit dans la fiche `rule`.
     *  La garde distingue les deux STRUCTURELLEMENT : un assemblage non déclaré échoue. */
    form: z.enum(['verbatim', 'descripteur']).optional(),
    source: sourceRefSchema,
    /** FICHE derrière cette étape — la règle est à UN CLIC depuis l'enjeu (#1117). C'est l'id de
     *  l'entité qui PORTE déjà la règle (amendement A, 2026-08-06 : « tant qu'on évite de surcharger
     *  au maximum la table régle ») : une compétence, un État, un symptôme… `regles.json` n'est que
     *  le foyer des règles de CADRE, sans entité porteuse. */
    rule: z.string().optional(),
    /** CATÉGORIE Codex du foyer — `'regles'` par défaut. `'skills'` quand la règle vit sur la
     *  compétence, `'etats'` sur l'État, etc. Le renvoi est un couple {catégorie, id}. */
    ruleCategory: z.string().optional(),
  }),
);

export type NightStakesData = z.infer<typeof schema>;
