/**
 * Schéma de `species.json` — dérivé du contenu RÉEL (27 entrées, script d'inventaire) et de
 * `SpeciesData` (`src/data/index.ts:128`). `skills`/`talents` = `AdvancementRef[]`, `baseChar` =
 * `Partial<Record<CharKey, number>>`. Mêmes petites formes partagées (Ref/AdvancementRef/CharKey)
 * que `careerLevels.ts`, PROMUES dans `common.ts`. `group` (racial de Groupe éditable, LDB 21) et
 * `mutationBodyMax` sont ABSENTS sur une partie des entrées (0/27 et 18/27) : optionnels, conformes
 * à l'interface.
 */
import { z } from 'zod';
import { sourceRefSchema, charKeySchema, advancementRefSchema, raceKeySchema, refCareerIdSchema, traitInstanceSchema } from '../common';

export const file = 'species.json';

export const schema = z.array(
  z.strictObject({
    /** id STABLE (slug du libellé) — cible de `Combatant.species`, pregens, draft. */
    id: z.string(),
    label: z.string(),
    /** Race (famille d'espèces) pour le groupage d'affichage — DONNÉE requise. */
    family: z.string(),
    /** Variante régionale/sous-espèce — absente pour l'espèce nominale. */
    variant: z.string().optional(),
    /** id STABLE — colonne d'espèce des tables Âge/Taille/Yeux/Cheveux (`raceKeySchema`, #313). */
    refChar: raceKeySchema,
    /** id STABLE — colonne du Tableau des Classes et Carrières aléatoires (`refCareerIdSchema`, #313). */
    refCareer: refCareerIdSchema,
    rand: z.number(),
    desc: z.string(),
    movement: z.number(),
    fate: z.strictObject({ fate: z.number(), resilience: z.number(), extra: z.number() }),
    baseChar: z.record(charKeySchema, z.number()),
    /** Compétences d'espèce (positionnel +5/+3 — lu via `advancementLabel`). */
    skills: z.array(advancementRefSchema),
    /** Talents d'espèce ({ref}, {choice} « A ou B », {wildcard} « Au choix »). */
    talents: z.array(advancementRefSchema),
    source: sourceRefSchema,
    /** Racial de Groupe ÉDITABLE (Traits psy ciblés, LDB 21) — surcharge la dérivation par label.
     *  Absent (0/27 observées) = racial auto-dérivé du `label`. */
    group: z.string().optional(),
    /** Seuil d100 de mutation PHYSIQUE (LDB 19 l.87-91). Absent = défaut Humain (50). */
    mutationBodyMax: z.number().optional(),
    /** Habillage de l'APERÇU (créateur, carte de race #431) — id de carrière ICONIQUE et COMMUNE à
     *  l'espèce (jamais un choix de RÈGLE, pur flavor de vitrine) : la tuile de famille montre un
     *  personnage vêtu plutôt qu'une tunique nue. Absent = pas de tenue (repli existant). */
    preview: z.strictObject({ career: z.string().optional() }).optional(),
    /** Trait RACIAL de l'espèce (#572) — MÊME `TraitInstance` que le bestiaire (Ogre `{id:'ogre'}`,
     *  encombrance/consommation ×2 ; la Taille est portée par le TALENT Massif/Petit, pas ici).
     *  Absent (26/27 observées) = aucun trait racial mécanique. */
    traits: z.array(traitInstanceSchema).optional(),
  }),
);

export type SpeciesData = z.infer<typeof schema>;
