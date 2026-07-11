/**
 * Gabarit VÉHICULE TERRESTRE (EDOC 07 « Chargement ») — attelage/chariot INERTE : caisse bâchée + roues
 * + timon, rendu par le système de plans (comme la coque de navire et l'engin de siège), une silhouette
 * recoloriée par la palette à jetons, ANCRÉE BASE-AU-SOL via `groundedBody`.
 *
 * Routé par `hull.propulsion === 'terrestre'` dans `bodyPlan` (JAMAIS par la coque de navire : une
 * diligence/charrette ne peut plus retomber par accident sur le gabarit `navire`). L'art de chaque
 * véhicule est 1 fichier `land/defs/<id>.ts` (registre auto-chargé `LAND_ARTS`, MÊME pattern que les
 * engins de siège) ; le TYPE de véhicule (`species`, id de `vehicles.json`) sélectionne l'art PAR ID via
 * `ART_BY_ID` — JAMAIS de name-matcher/regex. Un id sans art dédié retombe sur `attelage-generique`
 * (silhouette de repli, MÊME rôle que `canon-petit` côté engins). Silhouette de BROADSIDE → seule
 * `profile` est déclarée (couverture honnête, visible en galerie QC) ; face/dos REPLIENT dessus via
 * `pickView`/`foldView`.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette } from '../palette';
import { groundedBody } from '../staticBody';
import { pickView } from '../viewArt';
import { LAND_DEFAULT } from './artkit';
import { LAND_ARTS } from './_registry.generated';

/** Index des arts par id de véhicule (registre `land/defs/`, auto-chargé). Un véhicule terrestre sans
 *  art propre retombe sur l'attelage générique — MÊME mécanique que `ENGIN_ARTS`/`canon-petit`. */
const ART_BY_ID = new Map(LAND_ARTS.map((a) => [a.id, a]));
const FALLBACK = ART_BY_ID.get('attelage-generique') ?? LAND_ARTS[0];

/** Art orienté d'un type de véhicule terrestre (repli sur l'attelage générique). Exposé pour la galerie QC. */
export function landArtOf(species: string): (typeof LAND_ARTS)[number] {
  return ART_BY_ID.get(species) ?? FALLBACK;
}

function art(species: string, view: View): string {
  // Sélection vue + repli PARTAGÉS (`pickView`) — plus de ternaire ad hoc par vue.
  return pickView(landArtOf(species), view)();
}

/** (espèce, vue, pose, couleurs) → un os statique ancré au sol. `pose.cahot` = tangage de roulage /
 *  renversement (mort). */
function resolveLand(species: string, view: View, pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return groundedBody(art(species, view), LAND_DEFAULT, colors, { id: 'chariot', tilt: pose.cahot ?? 0 });
}

export const landPlan: BodyPlan = {
  id: 'terrestre',
  resolve: (sp, view, pose, opts) => resolveLand(sp, view, pose, opts?.colors),
  speciesNames: () => [],
  // Ancré au sol (bas de la boîte) → le portrait cadre ce bas, comme l'engin (sinon disque vide).
  portraitBox: '25 80 70 70',
  restPose: () => ({}),
  walkPose: (phase) => ({ cahot: Math.sin(phase * Math.PI * 2) * 1.6 }), // léger cahot en roulant
  idlePose: (phase) => ({ cahot: Math.sin(phase * Math.PI * 2) * 0.5 }),
  attackPose: () => ({}), // un chariot n'attaque pas
  deathPose: () => ({ cahot: 20 }), // versé/roue cassée
  hasView: () => true,
};
