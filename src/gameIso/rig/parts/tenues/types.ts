import type { PartArt } from '../types';
import type { StoredPalette } from '../../palette';

/** Slots habillables d'une tenue. Valeurs = PartArt (SVG dans le repère LOCAL de l'os porteur). */
export type TenueSet = Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', PartArt>>;

/**
 * Une tenue = un fichier `defs/<Nom>.ts`. `name` = la CLÉ de lookup :
 *   - nom de CLASSE WFRP (Guerriers, Lettrés, Roublards…) pour les archétypes de classe
 *     (fallback quand une carrière n'a pas d'art dédié, cf. careerTenueFor) ;
 *   - 'Nu' pour le corps de chair sans vêtement (monstres : trolls, goules, snotlings ;
 *     torse/jambes peints en @peau, le token suit la palette d'espèce) ;
 *   - avec `career: true` : une TENUE DE CARRIÈRE complète (PNJ nommé, armure de faction…) —
 *     injectée dans `GENERATED_CAREER_TENUES` (PRIORITAIRE sur l'auto et le MANUAL legacy).
 *     Les slots peuvent porter les 3 vues `{front, back, profile}`. Ajouter un humanoïde à
 *     tenue dédiée = DÉPOSER ce fichier + un def de race/PNJ qui pointe `career: '<name>'` —
 *     ZÉRO édition de fichier existant.
 *
 * `palette` : couleurs par défaut des `@tokens` de l'art (StoredPalette = hex exact) → rendu
 * sans perte + recoloriage cohérent, comme `CAREER_PALETTES` pour les tenues de carrière.
 * Résolue par `tenuePaletteFor` (carrière dédiée > def `career` > archétype de classe).
 * Absente pour 'Nu' (la peau suit la palette d'espèce).
 */
export type TenueDef = { name: string; set: TenueSet; palette?: StoredPalette; career?: boolean };
