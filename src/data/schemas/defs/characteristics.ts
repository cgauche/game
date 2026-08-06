/**
 * Schéma de `characteristics.json` — l'EXEMPLAIRE de la convention des defs de schéma (Lot 1 du
 * contrat de donnée). Dérivé du contenu RÉEL du JSON (10 caracs à jet + Blessure/Destin/Chance/
 * Résilience/Détermination/Extra Points/Mouvement/Corruption/Péché) et de son seul consommateur typé,
 * `src/ui/compendium/registry.ts:460` (`{ label, abr?, type?, desc?, source? }`, `c.type === 'roll'`).
 */
import { z } from 'zod';
import { sourceRefSchema, charKeySchema } from '../common';

export const file = 'characteristics.json';

/** id STABLE — `CharKey` du moteur pour les 10 caracs à jet (« CC »…), slug dédié pour les 9 autres
 *  entrées (Blessure/Destin/Chance/Résilience/Détermination/Extra Points/Mouvement/Corruption/Péché)
 *  qui ne sont pas des `CharKey`. Catalogue FERMÉ (19 entrées) — union énumérée, pas `z.string()`. */
const characteristicIdSchema = z.union([
  charKeySchema,
  z.enum(['blessure', 'destin', 'chance', 'resilience', 'determination', 'extra-points', 'mouvement', 'corruption', 'peche']),
]);

/** `type` observés dans le JSON : 'roll' (10 caracs à jet), 'wounds' (B), 'extra' (Destin/Résilience),
 *  'mv' (Mouvement), 'points' (Extra Points), '' (Chance/Détermination/Corruption — pas de type propre). */
export const schema = z.array(
  z.strictObject({
    /** id STABLE — cible de la jointure (`src/data/index.ts`, `registry.ts`). `abr` reste un champ
     *  d'AFFICHAGE (abréviation FR rendue sur la fiche perso), jamais une clé de logique. */
    id: characteristicIdSchema,
    abr: z.string(),
    label: z.string(),
    type: z.enum(['roll', 'wounds', 'extra', 'mv', 'points', '']),
    desc: z.string(),
    source: sourceRefSchema,
    /** DÉPENSES offertes par une ressource (Résilience : « Je ne faillirai pas ! » / « Je te renie ! » ;
     *  demain le Destin et ses deux sauvetages) — amendement A de #1117 : la règle vit sur l'ENTITÉ qui
     *  la porte, `regles.json` ne garde que les règles de CADRE. `desc` est un VERBATIM (règle 5).
     *  Rendue en SECTION de la fiche par `registry.ts` (patron `symptoms.onTick`). */
    options: z
      .array(
        z.strictObject({
          id: z.string(),
          label: z.string(),
          desc: z.string(),
          source: sourceRefSchema,
        }),
      )
      .optional(),
  }),
);

export type CharacteristicsData = z.infer<typeof schema>;
