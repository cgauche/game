/**
 * Schéma de `pregens.json` — dérivé du contenu RÉEL (8 entrées, script d'inventaire) et de
 * `PregenDef` (`src/data/pregens.ts`). Personnages pré-tirés APP-OWNED (flavor : motivation,
 * ambitions LDB 05 l.730-736) ; la fabrique (`src/data/pregens.ts`, #421) route par le MÊME
 * pipeline que le créateur joueur (`CreatorDraft` → `buildHero`) — `species`/`career` (ids stables),
 * `careerTalent` et `pettySpells` sont les seuls choix AUTHORÉS, le reste suit la recette RAW seedée.
 */
import { z } from 'zod';

export const file = 'pregens.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    /** `id` STABLE de l'espèce (`SpeciesData.id`). */
    species: z.string(),
    /** `id` STABLE de la carrière (`CareerData.id`). */
    career: z.string(),
    seed: z.number(),
    motivation: z.string(),
    /** Ambitions à court/long terme (LDB 05 l.730-736) — flavor du pré-tiré. */
    ambitionShort: z.string().optional(),
    ambitionLong: z.string().optional(),
    /** Âge (LDB 05 étape 6) — absent sur toutes les entrées observées (pas de tirage moteur côté pré-tiré). */
    age: z.number().optional(),
    /** Talent de carrière CHOISI (libellé concret) — sans lui, `createHero` prend la 1ʳᵉ entrée du Niveau. */
    careerTalent: z.string().optional(),
    /** Sorts de Magie mineure choisis (libellés de `spells.json`, famille `mineure`) — n'a de sens que
     *  si `careerTalent` porte le Talent Magie mineure ; complétés au quota BFM exact par `pregens.ts`
     *  (LDB 10 l.714), jamais un remplacement des sorts authorés. */
    pettySpells: z.array(z.string()).optional(),
    /** Id de trapping (catalogue) résolvant l'emplacement `{wildcard:'arme'}` de la carrière
     *  (construct de choix d'équipement) — aucune des 8 entrées actuelles n'a un tel slot au Niveau 1. */
    weaponChoice: z.string().optional(),
    /** Sexe visuel (cosmétique). Défaut 'M'. */
    sex: z.enum(['M', 'F']).optional(),
    /** Morphologie 0..1 (cosmétique). Défaut 0.5. */
    build: z.number().optional(),
  }),
);
