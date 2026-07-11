/**
 * Contrat PARTAGÉ de tout ART ORIENTÉ (silhouette rendue par vue) — généralise ce que `EnginArtDef`
 * faisait déjà (face / profil / dos). Consommé par : engins de siège (`engin/artkit`), coque de navire
 * (`ship/composeShip`), gabarit terrestre (`land/composeLand`), et — via la variante paramétrée
 * `PropViews` (args `(params, ctx)`) — les props ORIENTABLES du catalogue.
 *
 * Le PROFIL est dessiné tourné vers la DROITE ; le profil gauche s'obtient par MIROIR dans la MACHINERIE
 * de rendu (jamais dans l'art). La sélection vue+miroir vient de l'UNIQUE résolveur `project(dir, camRot)`
 * (`facing.ts`) — jamais un second algorithme. Une vue peut être ABSENTE (art mono-vue : la coque et le
 * chariot ne déclarent que `profile`) : au rendu, la vue demandée REPLIE sur la plus proche déclarée
 * (`foldView`). La COUVERTURE réelle (`declaredViews`) pilote la galerie QC (cases vides / « profil seul »).
 */
import type { View } from './facing';

/** @template A arguments passés à chaque vue — aucun pour engin/navire/terrestre ; `[params, ctx]` pour un prop. */
export interface ViewArt<A extends unknown[] = []> {
  front?(...a: A): string;
  profile?(...a: A): string;
  back?(...a: A): string;
}

const CANON: View[] = ['front', 'profile', 'back'];

/** Vues RÉELLEMENT déclarées, dans l'ordre canon (face, profil, dos) — couverture QC. */
export function declaredViews<A extends unknown[]>(art: ViewArt<A>): View[] {
  return CANON.filter((v) => typeof art[v] === 'function');
}

/** Ordre de proximité par vue demandée : le profil est mitoyen de face et de dos ; face/dos se replient
 *  d'abord sur le profil, puis l'un sur l'autre. */
const NEAREST: Record<View, View[]> = {
  front: ['front', 'profile', 'back'],
  profile: ['profile', 'front', 'back'],
  back: ['back', 'profile', 'front'],
};

/** Vue DÉCLARÉE la plus proche de `want` (repli). Lève si l'art ne déclare AUCUNE vue (erreur de donnée). */
export function foldView<A extends unknown[]>(art: ViewArt<A>, want: View): View {
  const v = NEAREST[want].find((c) => typeof art[c] === 'function');
  if (!v) throw new Error('[viewArt] art orienté sans aucune vue déclarée');
  return v;
}

/** Fonction de rendu de la vue repliée (repli inclus). */
export function pickView<A extends unknown[]>(art: ViewArt<A>, want: View): (...a: A) => string {
  return art[foldView(art, want)]! as (...a: A) => string;
}
