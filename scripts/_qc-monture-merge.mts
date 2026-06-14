/**
 * QC d'assise — exerce le VRAI code (seatRiderOnMount / composeComposite / mountedRest) en
 * headless, à géométrie identique à l'IsoStage (BodyToken : pieds au centre, scale = mountScale).
 * L'assise est dérivée du dos de la monture (os tronc) → pas de seatY codé en dur.
 *   npx tsx scripts/_qc-monture-merge.mts → public/qc/monture-merge/*.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { DEFS } from '../src/gameIso/sprites';
import { addPose } from '../src/gameIso/rig/poses';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { planById, bodyPlanOf, type BodyPlanId } from '../src/gameIso/rig/bodyPlan';
import { creatureMatch, creatureSpeciesScale, bipedSpeciesScale } from '../src/gameIso/rig/creatures';
import { sizeTokenScale } from '../src/gameIso/sizeScale';
import { seatRiderOnMount, mountedRest } from '../src/gameIso/rig/mountedRig';
import { isShield } from '../src/gameIso/rig/parts/equipment';
import { CLIPS, sampleClip } from '../src/gameIso/rig/anim/clips';
import type { View } from '../src/gameIso/rig/facing';

type SizeToken = Parameters<typeof sizeTokenScale>[0];
const RIDE_SCALE = 0.78; // = MountedToken
const W = 340, H = 320, cxS = 170, cyS = 250;

function mountBox(name: string, view: View) {
  const plan = planById(bodyPlanOf(name) as BodyPlanId);
  const species = creatureMatch(name)?.name ?? plan.speciesNames()[0] ?? '';
  return plan.resolve(species, view, plan.restPose(), {});
}
function riderBox(name: string, view: View, weapon?: string) {
  const p = entityRigProfile(name, 7, weapon ? { weapon } : undefined)!;
  // FIDÉLITÉ JEU = MountedToken : pose MONTÉE dédiée + delta du clip vivant (idle figé ici).
  const mainWeapon = p.equip.weapons?.find((w) => !isShield(w)) ?? p.equip.weapons?.[0];
  const idle = sampleClip(CLIPS.idle, 0).pose;
  return resolveRig(p.appearance, p.equip, addPose(mountedRest(view, mainWeapon), idle), p.tenue, view, []);
}
function frame(body: string, S: number, label = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
    + `<defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#1a1f2b"/>`
    + `<ellipse cx="${cxS}" cy="${cyS}" rx="${16 * S + 5}" ry="${(16 * S + 5) / 2}" fill="#000" opacity="0.33"/>`
    + `<g transform="translate(${cxS},${cyS})"><g transform="translate(${-60 * S},${-150 * S}) scale(${S})">${body}</g></g>`
    + (label ? `<text x="8" y="18" fill="#cdd" font-family="sans-serif" font-size="12">${label}</text>` : '')
    + `</svg>`;
}

interface Couple { mount: string; rider: string; size: SizeToken; view: View; weapon?: string; label?: string }
function couple(o: Couple): string {
  const S = 0.62 * creatureSpeciesScale(o.mount) * sizeTokenScale(o.size);
  const k = RIDE_SCALE * bipedSpeciesScale(o.rider);
  const merged = seatRiderOnMount(mountBox(o.mount, o.view), riderBox(o.rider, o.view, o.weapon),
    { view: o.view, mountScale: 1, riderScale: k });
  return frame(bonesToSvg(merged), S, o.label);
}

mkdirSync('public/qc/monture-merge', { recursive: true });
const L = 'Lance de cavalerie';
const shots: Array<[string, () => string]> = [
  // Chevalier à la lance — 3 vues (assise auto + tenue de lance couchée + jambes symétriques).
  ['lance-profil', () => couple({ mount: 'Cheval', rider: 'Soldat', size: 'grande', view: 'profile', weapon: L, label: 'profil — lance' })],
  ['lance-front', () => couple({ mount: 'Cheval', rider: 'Soldat', size: 'grande', view: 'front', weapon: L, label: 'face — lance' })],
  ['lance-back', () => couple({ mount: 'Cheval', rider: 'Soldat', size: 'grande', view: 'back', weapon: L, label: 'dos — lance' })],
  // Gobelin sur loup (warg, lance courte) — vérifie que l'assise auto s'adapte à une autre monture.
  ['gl-profil', () => couple({ mount: 'Loup', rider: 'Gobelin', size: 'grande', view: 'profile', weapon: 'Lance', label: 'Gobelin/Loup — profil' })],
  ['gl-front', () => couple({ mount: 'Loup', rider: 'Gobelin', size: 'grande', view: 'front', weapon: 'Lance', label: 'Gobelin/Loup — face' })],
];
for (const [id, make] of shots) {
  writeFileSync(`public/qc/monture-merge/${id}.png`, new Resvg(make(), { fitTo: { mode: 'width', value: 680 } }).render().asPng());
}
console.log(`OK: ${shots.length} rendus → public/qc/monture-merge/`);
