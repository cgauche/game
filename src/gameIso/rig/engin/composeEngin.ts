/**
 * Gabarit ENGIN DE SIÈGE (ADE II ch.08 « Le théâtre de la guerre ») — pièce d'artillerie INERTE servie
 * par un équipage, rendue par le système de plans (comme la coque de navire) : une silhouette statique
 * recoloriée par la palette à jetons, ANCRÉE BASE-AU-SOL via `groundedBody` (pas de lévitation).
 *
 * RÉUTILISE entièrement `staticBody` (ancrage + palette) — aucune machinerie nouvelle. L'art de chaque
 * engin est 1 fichier `engin/defs/<id>.ts` (registre auto-chargé `ENGIN_ARTS`, MÊME pattern que les
 * armes/créatures) ; le TYPE d'engin (`species`, id de la def) sélectionne l'art PAR ID via `ART_BY_ID`
 * — JAMAIS de name-matcher/regex (règle de rendu : « espèce explicite → record »). Les 3 vues (face /
 * profil / dos) sont des arts dédiés en coords LOCALES (origine = contact sol au centre, y NÉGATIF vers le haut).
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette } from '../palette';
import { groundedBody } from '../staticBody';
import { pickView } from '../viewArt';
import { ENGIN_DEFAULT } from './artkit';
import { ENGIN_ARTS } from './_registry.generated';

/** Index des arts par id d'espèce (registre `engin/defs/`, 13 defs). Un `siegeRig` de `trappings.json`
 *  sans art propre retomberait sur l'affût à roues générique (`canon-petit`) — plus aucune entrée
 *  n'est dans ce cas depuis l'intégration de la vague d'art (catapulte/trébuchet/mangonneau/onagre/
 *  mortier/pierrier/canon-lourd/canon-à-répétition/batterie-tonnerre-de-feu/canon-à-flammes). */
const ART_BY_ID = new Map(ENGIN_ARTS.map((a) => [a.id, a]));
const FALLBACK = ART_BY_ID.get('canon-petit') ?? ENGIN_ARTS[0];

/** Art orienté d'un type d'engin (repli sur l'affût à roues générique). Exposé pour la galerie QC. */
export function enginArtOf(species: string): (typeof ENGIN_ARTS)[number] {
  return ART_BY_ID.get(species) ?? FALLBACK;
}

function art(species: string, view: View): string {
  // Sélection vue + repli PARTAGÉS (`pickView`) — plus de ternaire ad hoc par vue.
  return pickView(enginArtOf(species), view)();
}

/** (espèce, vue, pose, couleurs) → un os statique ancré au sol. `pose.recul` = recul (tir) / bascule (mort). */
function resolveEngin(species: string, view: View, pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return groundedBody(art(species, view), ENGIN_DEFAULT, colors, { id: 'engin', tilt: pose.recul ?? 0 });
}

export const enginPlan: BodyPlan = {
  id: 'engin',
  resolve: (sp, view, pose, opts) => resolveEngin(sp, view, pose, opts?.colors),
  speciesNames: () => [], // les espèces d'engin sont listées par le registre de créatures (creatureSpeciesOptions)
  // L'engin est ANCRÉ AU SOL (bas de la boîte) → le portrait cadre ce bas (x centré, y 80→150), sinon le
  // cadre haut-avant générique ne montrerait que du vide (disque noir).
  portraitBox: '25 80 70 70',
  restPose: () => ({}),
  walkPose: () => ({}), // un engin ne marche pas (servi sur place)
  attackPose: (phase) => ({ recul: -Math.sin(Math.min(1, phase) * Math.PI) * 5 }), // léger recul au tir
  deathPose: () => ({ recul: 16 }), // affût démonté/basculé
  hasView: () => true,
};
