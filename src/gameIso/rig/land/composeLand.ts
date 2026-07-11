/**
 * Gabarit VÉHICULE TERRESTRE (EDOC 07 « Chargement ») — attelage/chariot INERTE : caisse bâchée + roues
 * + timon, rendu par le système de plans (comme la coque de navire et l'engin de siège), une silhouette
 * procédurale SOBRE recoloriée par la palette à jetons, ANCRÉE BASE-AU-SOL via `groundedBody`.
 *
 * Routé par `hull.propulsion === 'terrestre'` dans `bodyPlan` (JAMAIS par la coque de navire : une
 * diligence/charrette ne peut plus retomber par accident sur le gabarit `navire`). RÉUTILISE le contrat
 * d'art orienté PARTAGÉ (`viewArt`) et les roues de la boîte à outils d'engin (`engin/artkit`) — aucune
 * machinerie ni token nouveaux. Silhouette de BROADSIDE → seule `profile` est déclarée (couverture
 * honnête, visible en galerie QC) ; face/dos REPLIENT dessus jusqu'aux vagues d'art A1-A4.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { groundedBody } from '../staticBody';
import { pickView, type ViewArt } from '../viewArt';
import { wheelFace, ENGIN_DEFAULT } from '../engin/artkit';

// Palette : mêmes bases que l'engin (bois/fer) + toile de bâche. Les variantes O/H sont dérivées par
// `buildTokenMap` (comme l'engin/la coque).
const LAND_DEFAULT: StoredPalette = { ...ENGIN_DEFAULT, bache: '#8c7a54' };

/** Silhouette de PROFIL (regarde à droite) : deux roues, caisse bâchée, timon en flèche vers l'avant.
 *  Coords LOCALES (origine = contact sol au centre, y NÉGATIF vers le haut) — cf. `groundedBody`. */
function landProfile(): string {
  return '<g>'
    // Timon (brancard) : flèche partant du bas de caisse vers l'avant-droit, au sol.
    + '<path d="M22 -18 L52 -3 L52 -7 L22 -22 Z" fill="@bois" stroke="@boisO" stroke-width="1.4"/>'
    // Châssis : longeron horizontal reliant les deux essieux.
    + '<path d="M-30 -16 L30 -16 L30 -22 L-30 -22 Z" fill="@boisO" stroke="@fer" stroke-width="1.2"/>'
    // Caisse : ridelle latérale (planches) posée sur le châssis.
    + '<path d="M-28 -22 L28 -22 L26 -44 L-26 -44 Z" fill="@bois" stroke="@boisO" stroke-width="1.6"/>'
    + '<line x1="-26" y1="-30" x2="26" y2="-30" stroke="@boisO" stroke-width="1.4" opacity="0.6"/>' // bandeau
    + '<line x1="-10" y1="-23" x2="-10" y2="-43" stroke="@boisO" stroke-width="1" opacity="0.5"/>'
    + '<line x1="10" y1="-23" x2="10" y2="-43" stroke="@boisO" stroke-width="1" opacity="0.5"/>'
    // Bâche : couverture bombée sur des arceaux.
    + '<path d="M-26 -44 Q0 -64 26 -44 L24 -48 Q0 -60 -24 -48 Z" fill="@bache" stroke="@boisO" stroke-width="1.2"/>'
    + '<path d="M-24 -47 Q0 -60 24 -47" stroke="@bache" stroke-width="6" fill="none" opacity="0.85"/>'
    // Roues (côté proche, au sol) : grande à l'arrière, plus petite à l'avant.
    + `<g transform="translate(-18,-15)">${wheelFace(15)}</g>`
    + `<g transform="translate(20,-13)">${wheelFace(13)}</g>`
    + '</g>';
}

/** Art orienté d'un chariot (mono-vue broadside). Exposé pour la galerie QC. */
export function landArt(): ViewArt {
  return { profile: landProfile };
}

/** (espèce ignorée — silhouette unique, vue, pose, couleurs) → un os statique ancré au sol.
 *  `pose.cahot` = tangage de roulage / renversement (mort). */
function resolveLand(_species: string, view: View, pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  const svg = pickView(landArt(), view)();
  return groundedBody(svg, LAND_DEFAULT, colors, { id: 'chariot', tilt: pose.cahot ?? 0 });
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
