/**
 * Schéma de `characteristics.json` — l'EXEMPLAIRE de la convention des defs de schéma (Lot 1 du
 * contrat de donnée). Dérivé du contenu RÉEL du JSON (10 caracs à jet + Blessure/Destin/Chance/
 * Résilience/Détermination/Extra Points/Mouvement/Corruption) et de son seul consommateur typé,
 * `src/ui/compendium/registry.ts:460` (`{ label, abr?, type?, desc?, source? }`, `c.type === 'roll'`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'characteristics.json';

/** `type` observés dans le JSON : 'roll' (10 caracs à jet), 'wounds' (B), 'extra' (Destin/Résilience),
 *  'mv' (Mouvement), 'points' (Extra Points), '' (Chance/Détermination/Corruption — pas de type propre). */
export const schema = z.array(
  z.strictObject({
    abr: z.string(),
    label: z.string(),
    type: z.enum(['roll', 'wounds', 'extra', 'mv', 'points', '']),
    desc: z.string(),
    /** Valeur/formule de base par espèce (clé = `SpeciesData.label`, ex. "Humain", "Ogre"…) — un
     *  nombre (la plupart des attributs) ou une formule texte (ex. Blessure : "BF+(2 × BE)+BFM"). */
    base: z.record(z.string(), z.union([z.number(), z.string()])),
    source: sourceRefSchema,
  }),
);

export type CharacteristicsData = z.infer<typeof schema>;
