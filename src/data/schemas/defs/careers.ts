/**
 * Schéma de `careers.json` — dérivé du contenu RÉEL (96 entrées, script d'inventaire) et de
 * `CareerData` (`src/data/index.ts`). `rand` = Tableau des Classes et Carrières aléatoires
 * (LDB 05 l.197+) : borne haute d100 par colonne d'espèce, `null` = carrière indisponible pour
 * cette espèce (l.360). Deux jeux de clés distincts observés (96 entrées → 2 key-sets, cohérent
 * avec les colonnes d'espèce qui varient selon que la carrière est ouverte aux races additionnelles).
 */
import { z } from 'zod';
import { sourceRefSchema, refCareerIdSchema } from '../common';

export const file = 'careers.json';

/** Entrée de `careers.json`. */
const careerEntrySchema = z.strictObject({
  /** id STABLE (slug du libellé) — cible de `Combatant.career`, `CareerLevelData.career`, pregens. */
  id: z.string(),
  label: z.string(),
  /** Forme féminine d'AFFICHAGE — le LDB n'imprime QUE le masculin (fiches ch. 07-08), donc
   *  féminisation standard FR MAISON ; omis = forme épicène (identique au masculin). */
  labelF: z.string().optional(),
  /** `id` de la Classe (`ClassData.id`). */
  class: z.string(),
  /** Ids de `groups.json` accordés au titulaire de cette carrière (`groupsFor`), en plus de ceux de
   *  sa Classe. Absent = la carrière n'ouvre aucun Groupe d'appartenance. */
  grantGroups: z.array(z.string()).optional(),
  /** id d'une tenue spécifique (`TENUE_BY_ID`) réutilisée par cette carrière quand son rendu
   *  reprend la tenue d'une autre carrière (variants MDG « (Côtier) », MDG 09 l.255/343/458). */
  tenue: z.string().optional(),
  /** Clé = `refCareerIdSchema` (id stable, #313) → borne haute d100 ; clé ABSENTE = carrière
   *  indisponible pour cette espèce (partiel : toutes les carrières ne portent pas les 11 colonnes). */
  rand: z.partialRecord(refCareerIdSchema, z.number().nullable()),
  desc: z.string(),
  source: sourceRefSchema,
});

export const schema = z.array(careerEntrySchema);
