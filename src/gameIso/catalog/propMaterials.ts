/** Matériaux de RENDU des recettes volumiques de décor (`src/data/propMaterials.json`), vus par le
 *  catalogue gameIso — MÊME accès que `reliefMaterial`/`roofMaterial` : le registre par id vit dans
 *  `src/data`, le REPLI VISIBLE (#877) vit ici, avec les autres catalogues de rendu. */
import { propMaterials, type PropMaterialData } from '../../data';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE } from './missing';

const MAP: Record<string, PropMaterialData> = Object.fromEntries(propMaterials.map((m) => [m.id, m]));

/** Entrée de REPLI VISIBLE (#877) : une matière de décor au ton d'alarme, jamais l'apparence d'un
 *  autre matériau. Sa réponse à la lumière est NEUTRE (diffus pur, aucun métal) — le repli ne peint
 *  pas un vernis ni un bronze qu'aucune donnée n'a authorés. */
const MISSING: PropMaterialData = {
  id: MISSING_ID,
  type: 'propMaterials',
  label: MISSING_LABEL,
  color: MISSING_TONE,
  roughness: 1,
  metalness: 0,
};

/** Matériau de décor par id ; id absent du registre → repli VISIBLE + avertissement DEV. */
export function propMaterial(id: string): PropMaterialData {
  return catalogEntry(MAP, id, 'matière de décor', MISSING);
}
