import type { PartArt } from '../types';

/** Slots habillables d'une tenue. Valeurs = PartArt (SVG dans le repère LOCAL de l'os porteur). */
export type TenueSet = Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', PartArt>>;

/**
 * Une tenue = un fichier `defs/<Nom>.ts`. `name` = la CLÉ de lookup :
 *   - nom de CLASSE WFRP (Guerriers, Lettrés, Roublards…) pour les archétypes de classe
 *     (fallback quand une carrière n'a pas d'art dédié, cf. careerTenueFor) ;
 *   - 'Nu' pour le corps de chair sans vêtement (monstres : trolls, goules, snotlings ;
 *     torse/jambes peints en @peau, le token suit la palette d'espèce).
 */
export type TenueDef = { name: string; set: TenueSet };
