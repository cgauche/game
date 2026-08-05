/**
 * Schéma de `voyage-stakes.json` — ENJEU d'un `kind` d'étape de cascade de VOYAGE (fluvial/maritime,
 * #1117). Jumeau de `night-stakes.json`, PAS le même contrat de contenu (c'est pourquoi les deux
 * datasets ne fusionnent pas) :
 *  - `night-stakes.stake` est un VERBATIM figé de la Source (règle 5), recollable tel quel ;
 *  - `voyage-stakes.template` est un GABARIT de descripteur MÉCANIQUE : ses trous `{nom}` reçoivent
 *    les valeurs CALCULÉES par le flux au moment de l'étape (km de dérive, % de vent, Rounds, Dégâts).
 * Mélanger les deux sous une même clé ferait cohabiter « ne jamais interpoler » et « toujours
 * interpoler » — un même libellé pour deux natures.
 * Le texte reste éditable au Codex (catégorie « Enjeux — cascade de voyage »).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'voyage-stakes.json';

export const schema = z.array(
  z.strictObject({
    /** Identité STABLE (exposition/édition Codex) — distincte de `kind`. */
    id: z.string(),
    /** Libellé FR d'affichage. */
    label: z.string(),
    /** `kind` de l'étape de cascade servie (clé de consommation, `voyageStake`). */
    kind: z.string(),
    /** Gabarit du descripteur mécanique — trous `{nom}` remplis par le flux (valeurs calculées). */
    template: z.string(),
    /** Fiche de RÈGLE du Codex (`regles.json`) derrière cette étape — la règle est à UN CLIC depuis
     *  l'enjeu (#1117). Absente = aucune fiche ne couvre encore ce `kind`. */
    rule: z.string().optional(),
    source: sourceRefSchema,
  }),
);

export type VoyageStakesData = z.infer<typeof schema>;
