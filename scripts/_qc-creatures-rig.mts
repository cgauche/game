/**
 * QC RECONNAISSABILITÉ — rendu RIG des créatures en PNG (front, pose de repos), pour audit aveugle.
 * Remplace l'ancien _qc-render.mts (qui rendait le MONOLITHIQUE, supprimé). Même logique de pose
 * que gen-bestiary-gallery.mts / l'IsoStage : gabarit non-bipède (plan.restPose) ou rig humanoïde
 * (clip idle t=0), grandes espèces remises à l'échelle pour tenir dans la boîte 120×150.
 *   npx tsx scripts/_qc-creatures-rig.mts → public/qc/creatures-rig/c*.png + manifest.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { resolveRig, type ResolvedBone } from '../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { DEFS } from '../src/gameIso/sprites';
import { addPose } from '../src/gameIso/rig/poses';
import { CLIPS, sampleClip } from '../src/gameIso/rig/anim/clips';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { planById, bodyPlanOf, type BodyPlanId } from '../src/gameIso/rig/bodyPlan';
import { creatureMatch, creatureSpeciesScale } from '../src/gameIso/rig/creatures';
import { mul, translate, type Matrix } from '../src/gameIso/rig/kinematics';
import { creatures } from '../src/data/index';

/** Pré-scale (autour du centre) pour faire tenir les grandes espèces — identique à la galerie. */
function scaleBones(bones: ResolvedBone[], z: number, cx = 60, cy = 78): ResolvedBone[] {
  if (z === 1) return bones;
  const S = mul(translate(cx, cy), mul([z, 0, 0, z, 0, 0] as Matrix, translate(-cx, -cy)));
  return bones.map((b) => ({ ...b, matrix: mul(S, b.matrix) }));
}

/** Os résolus d'une créature en pose de repos, vue de face — exactement comme l'IsoStage. */
function creatureBones(name: string): ResolvedBone[] {
  const z = (() => { const s = creatureSpeciesScale(name); return s > 1 ? +(1 / s).toFixed(3) : 1; })();
  const planId = bodyPlanOf(name);
  if (planId !== 'monolithic' && planId !== 'biped') {
    const plan = planById(planId as BodyPlanId);
    const species = creatureMatch(name)?.name ?? plan.speciesNames()[0] ?? '';
    const pose = plan.idlePose ? plan.idlePose(0) : plan.restPose();
    return scaleBones(plan.resolve(species, 'front', pose, {}), z);
  }
  const prof = entityRigProfile(name, 7);
  if (!prof) return [];
  return scaleBones(resolveRig(prof.appearance, prof.equip, addPose({}, sampleClip(CLIPS.idle, 0).pose), prof.career, 'front', prof.overlays), z);
}

mkdirSync('public/qc/creatures-rig', { recursive: true });
const manifest: Record<string, { kind: string; intended: string; plan: string }> = {};
let i = 0;
for (const c of creatures) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150"><defs>${DEFS}</defs><rect width="120" height="150" fill="#171b26"/>${bonesToSvg(creatureBones(c.label))}</svg>`;
  const png = new Resvg(svg, { background: '#171b26', fitTo: { mode: 'width', value: 360 } }).render().asPng();
  const id = `c${String(i++).padStart(2, '0')}`;
  writeFileSync(`public/qc/creatures-rig/${id}.png`, png);
  manifest[id] = { kind: 'creature', intended: c.label, plan: bodyPlanOf(c.label) };
}
writeFileSync('public/qc/creatures-rig/manifest.json', JSON.stringify(manifest, null, 2));
console.log(`OK: ${i} créatures rendues (rig) → public/qc/creatures-rig/ (manifest.json)`);
