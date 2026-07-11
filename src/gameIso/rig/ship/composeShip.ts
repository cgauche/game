/**
 * Gabarit NAVIRE / VÉHICULE À COQUE (MDG ch.12) — rendu GÉNÉRIQUE piloté par la DONNÉE `hull.rig`
 * (avirons / voile / mixte), pas par le nom. RÉUTILISE entièrement le système de plans corporels
 * (registry `plans/defs/`, fondation `staticBody`/`groundedBody`, palette à jetons, facing, portrait,
 * FX) — comme le plan `swarm`, sans squelette anatomique : une coque ANCRÉE AU SOL (la quille repose
 * sur l'eau/la case, cf. `groundedBody`) qui roule au repos et gîte à la mort.
 *
 * Le gréement (passé via `species`) choisit la superstructure : voiles (mât + voile), avirons (rames),
 * ou les deux. La teinte vient de la palette du record (`appearance.colors`) → un même gabarit sert
 * tous les vaisseaux ; `ship.lengthM` donnera l'échelle au point d'appel.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { groundedBody } from '../staticBody';
import { pickView, type ViewArt } from '../viewArt';
import { SHIP_ARTS } from './_registry.generated';
import type { ShipArtDef } from './artkit';
import { findVehicleById } from '../../../data';

export type ShipRig = 'avirons' | 'voile' | 'mixte';

// Registre des arts de coque PAR ID de véhicule (vague A1 — `ship/defs/`, auto-chargé). Un id sans
// def retombe sur la silhouette procédurale par gréement ci-dessous (couverture DÉCLARÉE, visible
// dans la galerie oriented-objects) — MÊME mécanique que ENGIN_ARTS pour les engins de siège.
const HULL_ART_BY_ID: Record<string, ShipArtDef> = Object.fromEntries(SHIP_ARTS.map((a) => [a.id, a]));

// Coordonnée locale de la QUILLE (point de contact bas de la coque) : l'art a son origine à la
// flottaison (y=0), la carène descend jusqu'à ~+11 → `groundedBody` pose CE point sur la ligne de sol
// ⇒ la coque REPOSE sur l'eau/la case (pas de lévitation), et le roulis tourne autour de la quille.
const KEEL_Y = 11;

// Jetons NAVIRE propres au plan (réutilisés, pas inventés) : `coque` = bois de carène, `voile` = toile,
// `mat` = mât/avirons, `pavillon` = flamme. Les nuances O/H se dérivent via la palette. Coords LOCALES
// (origine = centre à la flottaison) : `groundedBody` place et ancre l'os, le roulis tourne à la quille.
const hull = (): string =>
  '<path d="M-38 -2 Q0 24 38 -2 L30 -10 L-30 -10 Z" fill="@coque" stroke="@coqueO" stroke-width="1.6"/>'
  + '<path d="M-30 -10 L30 -10 L28 -6 L-28 -6 Z" fill="@coqueH" opacity="0.8"/>' // liston
  + '<path d="M-26 1 Q0 16 26 1" stroke="@coqueO" stroke-width="0.8" fill="none" opacity="0.5"/>';

const sailRig = (): string =>
  '<line x1="0" y1="-10" x2="0" y2="-68" stroke="@mat" stroke-width="2.2"/>'
  + '<path d="M2 -64 Q24 -42 2 -16 Z" fill="@voile" stroke="@voileO" stroke-width="1"/>' // voile gonflée
  + '<path d="M0 -68 l8 2 l-8 2 Z" fill="@pavillon"/>'; // flamme de mât

const oarsRig = (): string =>
  '<g stroke="@mat" stroke-width="1.6" stroke-linecap="round">'
  + '<line x1="-24" y1="-5" x2="-34" y2="6"/><line x1="-13" y1="-4" x2="-22" y2="7"/>'
  + '<line x1="13" y1="-4" x2="22" y2="7"/><line x1="24" y1="-5" x2="34" y2="6"/>'
  + '</g>';

/** Silhouette complète selon le gréement (donnée). */
function buildShip(rig: ShipRig): string {
  const sails = rig === 'voile' || rig === 'mixte' ? sailRig() : '';
  const oars = rig === 'avirons' || rig === 'mixte' ? oarsRig() : '';
  return `<g>${oars}${hull()}${sails}</g>`; // rames derrière la coque, voile devant
}

/** Art ORIENTÉ du REPLI PROCÉDURAL : la silhouette par gréement est une VUE DE BROADSIDE → seule
 *  `profile` est déclarée (couverture honnête, visible en galerie QC). Face/dos REPLIENT sur le
 *  profil (`pickView`). Exposé pour la galerie QC. */
export function shipArt(rig: ShipRig): ViewArt {
  return { profile: () => buildShip(rig) };
}

/** Art ORIENTÉ d'une coque, routé par ID de véhicule : def `SHIP_ARTS` si dessinée (vague A1),
 *  sinon repli procédural par gréement (un jeton de gréement passé tel quel reste accepté —
 *  galerie/tests). Exposé pour la galerie QC (couverture déclarée). */
export function shipArtOf(idOrRig: string): ViewArt {
  return HULL_ART_BY_ID[idOrRig] ?? shipArt(asRig(idOrRig));
}

// Palette par défaut : jetons NAVIRE propres au plan (bois de coque / toile / mât-rames / pavillon vif).
const SHIP_DEFAULT: StoredPalette = { coque: '#6b4a2b', voile: '#e8e0cc', mat: '#4a3320', pavillon: '#b03a2e' };

// Poses (delta additif sur l'angle de la coque) : roulis au repos, tangage à l'« attaque » (éperon),
// forte gîte à la mort (le navire sombre/chavire).
const SHIP_REST: Record<string, number> = {};
const shipRoll = (phase: number): Record<string, number> => ({ coque: Math.sin(phase * Math.PI * 2) * 2.5 });
const shipRam = (phase: number): Record<string, number> => ({ coque: Math.sin(Math.min(1, phase) * Math.PI) * 6 });
const SHIP_DEATH: Record<string, number> = { coque: 22 };

// `species` = ID de véhicule (résolution normale) ou jeton de gréement (galerie/outils). Pour un id
// sans art dédié, le gréement vient de la DONNÉE (`vehicles.json`, `hull.rig`).
const asRig = (species: string): ShipRig =>
  species === 'voile' || species === 'avirons' || species === 'mixte'
    ? species
    : ((findVehicleById(species)?.hull?.rig as ShipRig | undefined) ?? 'mixte');

function resolveShip(species: string, view: View, pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  // La vue demandée est CONSOMMÉE via le contrat d'art orienté PARTAGÉ (`pickView`) — les defs A1
  // déclarent `profile` (broadside), proue/poupe se brancheront ici sans changer d'aiguillage.
  // `pose.coque` = angle de roulis/gîte (deg) ⇒ `tilt` autour de la quille (au sol), via la fondation
  // PARTAGÉE des corps statiques `groundedBody` — la même qui ancre les engins de siège.
  // Les defs sont dessinées quille à y=0 (origine = contact) ; l'art procédural garde son origine
  // à la flottaison → décalage KEEL_Y.
  const def = HULL_ART_BY_ID[species];
  const svg = pickView(def ?? shipArt(asRig(species)), view)();
  return groundedBody(svg, SHIP_DEFAULT, colors, { id: 'coque', baseY: def ? 0 : KEEL_Y, tilt: pose.coque ?? 0 });
}

export const shipPlan: BodyPlan = {
  id: 'navire',
  resolve: (sp, view, pose, opts) => resolveShip(sp, view, pose, opts?.colors),
  speciesNames: () => [],
  restPose: () => SHIP_REST,
  idlePose: shipRoll,
  walkPose: shipRoll,
  attackPose: shipRam,
  deathPose: () => SHIP_DEATH,
  hasView: () => true,
};
