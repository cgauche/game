/**
 * Gabarit NAVIRE / VÉHICULE À COQUE (MDG ch.12) — rendu GÉNÉRIQUE piloté par la DONNÉE `hull.rig`
 * (avirons / voile / mixte), pas par le nom. RÉUTILISE entièrement le système de plans corporels
 * (registry `plans/defs/`, `worldTransformsG`, palette à jetons, overlays, facing, portrait, FX) —
 * comme le plan `swarm`, sans squelette anatomique : une coque qui roule au repos et gîte à la mort.
 *
 * Le gréement (passé via `species`) choisit la superstructure : voiles (mât + voile), avirons (rames),
 * ou les deux. La teinte vient de la palette du record (`appearance.colors`) → un même gabarit sert
 * tous les vaisseaux ; `ship.lengthM` donnera l'échelle au point d'appel.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';

type ShipBoneId = 'coque';
type SBone = FKBone & { z: number };
export type ShipRig = 'avirons' | 'voile' | 'mixte';

// Un seul os « coque », pivot à la flottaison (x=60) → le roulis/la gîte tournent autour de l'eau.
const buildSkeleton = (): Record<ShipBoneId, SBone> => ({
  coque: { parent: null, pivot: { x: 60, y: 98 }, angle: 0, z: 1 },
});

// Jetons = SLOTS de palette EXISTANTS (réutilisés, pas inventés) : `corps` = coque (bois), `vet1` =
// voile (toile), `cuir` = mât/avirons, `accent` = flamme. Les nuances O/H se dérivent via la palette.
// Coords PIVOT-LOCAL (origine = centre à la flottaison, comme `swarm`) : la matrice de l'os place la
// coque dans la boîte, et le roulis/la gîte tournent proprement autour de l'eau.
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

// Palette par défaut : jetons NAVIRE propres au plan (bois de coque / toile / mât-rames / pavillon vif).
const SHIP_DEFAULT: StoredPalette = { coque: '#6b4a2b', voile: '#e8e0cc', mat: '#4a3320', pavillon: '#b03a2e' };

// Poses (delta additif sur l'angle de la coque) : roulis au repos, tangage à l'« attaque » (éperon),
// forte gîte à la mort (le navire sombre/chavire).
const SHIP_REST: Record<string, number> = {};
const shipRoll = (phase: number): Record<string, number> => ({ coque: Math.sin(phase * Math.PI * 2) * 2.5 });
const shipRam = (phase: number): Record<string, number> => ({ coque: Math.sin(Math.min(1, phase) * Math.PI) * 6 });
const SHIP_DEATH: Record<string, number> = { coque: 22 };

const asRig = (species: string): ShipRig =>
  species === 'voile' || species === 'avirons' || species === 'mixte' ? species : 'mixte';

function resolveShip(species: string, view: View, pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  void view; // une coque se lit pareil sous tous les angles (profil)
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<ShipBoneId, Matrix>;
  const tmap = buildTokenMap(SHIP_DEFAULT, colors ?? {});
  return [{ id: 'coque', matrix: world.coque, scale: [1, 1], z: sk.coque.z, parts: [{ svg: applyTokenMap(buildShip(asRig(species)), tmap), layer: 0 }] }];
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
