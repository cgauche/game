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

/**
 * REPLI VISIBLE (#223) — silhouette d'ERREUR ASSUMÉE d'un objet inerte du système de plans (navire /
 * terrestre / engin de siège) dont l'`id` n'a PAS d'art dédié. Doctrine du patron « mannequin »
 * (`state/spawn.ts`) : jamais un joli générique silencieux — une caisse d'alarme barrée d'un « ? » que
 * l'œil repère immédiatement en jeu, doublée d'un `console.warn` en DEV nommant l'`id` fautif (donnée à
 * corriger). Coords LOCALES : origine = contact sol au centre, l'objet monte en y NÉGATIF (cf.
 * `groundedBody`). Mono-vue (`profile`) → face/dos REPLIENT dessus. Couleurs LITTÉRALES (magenta d'alarme)
 * — indépendantes de la palette du record, pour rester criardes quelle que soit la teinte demandée.
 */
const MISSING_ART_SVG =
  '<g fill="none" stroke="#ff2fb0" stroke-width="2.5">'
  + '<rect x="-22" y="-52" width="44" height="48" fill="#2a0820"/>' // caisse d'erreur
  + '<path d="M-22 -52 L22 -4 M22 -52 L-22 -4" stroke-width="1.4" opacity="0.55"/>' // hachure croisée
  + '<path d="M-7 -40 Q-7 -47 0 -47 Q8 -47 8 -40 Q8 -34 0 -31 L0 -26" stroke-linecap="round"/>' // hampe du «?»
  + '<rect x="-2.4" y="-21" width="4.8" height="4.8" fill="#ff2fb0" stroke="none"/>' // point du «?»
  + '</g>';

/** Art orienté du REPLI VISIBLE (#223), mono-vue `profile`. Exposé pour la galerie QC et les gardes. */
export const MISSING_ART: ViewArt = { profile: () => MISSING_ART_SVG };

/**
 * SOURCE UNIQUE du repli des 3 registres d'objets inertes (navire / terrestre / engin). Résout l'art
 * orienté d'`id` dans `byId` ; à défaut, la silhouette de REPLI VISIBLE (`MISSING_ART`) + un `console.warn`
 * en DEV nommant l'`id` fautif (`kind` = famille affichée). PLUS aucun repli « générique silencieux ».
 */
export function orientedArtOr<T extends ViewArt>(byId: Map<string, T>, id: string, kind: string): ViewArt {
  const found = byId.get(id);
  if (found) return found;
  // `?.` : viewArt est importé par les scripts tsx (galeries), où `import.meta.env` n'existe pas.
  if (import.meta.env?.DEV) console.warn(`[${kind}] id « ${id} » sans art dédié — silhouette de repli visible (#223), donnée à corriger.`);
  return MISSING_ART;
}
