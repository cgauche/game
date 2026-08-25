/**
 * Schéma de `species.json` — dérivé du contenu RÉEL (27 entrées, script d'inventaire) et de
 * `SpeciesData` (`src/data/index.ts`). `skills`/`talents` = `AdvancementRef[]`, `baseChar` =
 * `Partial<Record<CharKey, number>>`. Mêmes petites formes partagées (Ref/AdvancementRef/CharKey)
 * que `careerLevels.ts`, PROMUES dans `common.ts`. `mutationBodyMax` est ABSENT sur une partie des
 * entrées (18/27) : optionnel, conforme à l'interface ; `grantGroups` est porté par les 27.
 */
import { z } from 'zod';
import { sourceRefSchema, charKeySchema, raceKeySchema, refCareerIdSchema } from '../grammaire/valeurs';
import { advancementRefSchema, traitInstanceSchema } from '../grammaire/reference';

export const file = 'species.json';
export const famille = 'entite';

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
    /** Ids de `groups.json` de l'espèce (Traits psy ciblés, LDB 21) — racial, plus la sous-espèce
     *  quand elle a son propre Groupe (« Humains (Tiléens) » → `humain` + `tileen`). DONNÉE requise
     *  (27/27) : `groupsFor` les lit, il ne dérive plus rien du `label`. */
    grantGroups: z.array(z.string()),
    /** Seuil d100 de mutation PHYSIQUE (LDB 19 l.78-81). Absent = défaut Humain (50). */
    mutationBodyMax: z.number().optional(),
    /** Habillage de l'APERÇU (créateur, carte de race #431) — id de carrière ICONIQUE et COMMUNE à
     *  l'espèce (jamais un choix de RÈGLE, pur flavor de vitrine) : la tuile de famille montre un
     *  personnage vêtu plutôt qu'une tunique nue. Absent = pas de tenue (repli existant). */
    preview: z.strictObject({ career: z.string().optional() }).optional(),
    /** Trait RACIAL de l'espèce (#572) — MÊME `TraitInstance` que le bestiaire (Ogre `{id:'ogre'}`,
     *  encombrance/consommation ×2 ; la Taille est portée par le TALENT Massif/Petit, pas ici).
     *  Absent (26/27 observées) = aucun trait racial mécanique. */
    traits: z.array(traitInstanceSchema).optional(),
    /** `VDM 02 l.190` / `LDB 46 l.177` (`careerSlots.arcaneDomainCap`). Absent = plafond 1 (défaut RAW hors elfe).
     *  Portée ici sur les deux entrées « Hauts elfes »/« Elfes sylvains ». */
    arcaneDomainsBonusOf: charKeySchema.optional(),
    /** id d'`OptionalRule` (`reglesOptionnelles.json`) qui OUVRE l'espèce au joueur — absent = ouverte.
     *  Portée sur `gnomes` (`NADJ 14 l.5`, règle `creation-gnome-jouable`). */
    gatedByRule: z.string().optional(),
  }),
);
