import type { QuadProps } from '../quadSkeleton';
import type { QuadArt } from '../partArt';

/**
 * Une CRINIÈRE de quadrupède = un fichier `manes/defs/<clé>.ts` (même patron que les têtes et les
 * queues). Elle vit sur TROIS sites du gabarit, un par endroit du corps où le poil se dresse :
 *   - `neck`      : le long de l'encolure, en PROFIL — obligatoire (l'absence de crinière est
 *                   elle-même un art : la ligne de dos discrète de `sans`).
 *   - `chestRuff` : fraise de fourrure au poitrail, vue de FACE (poitrail canidé/félin).
 *   - `backTuft`  : touffe dorsale au sommet de la croupe, vue de DOS (croupe canidée/féline).
 * `params` : axes de `QuadProps` consommés par les arts (contrat d'axes déclarés, design v2 §1).
 */
export interface QuadManeDef {
  key: string;
  label: string;
  art: { neck: QuadArt; chestRuff?: QuadArt; backTuft?: QuadArt };
  params?: readonly (keyof QuadProps)[];
}
