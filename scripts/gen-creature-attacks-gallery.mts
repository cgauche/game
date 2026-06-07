/**
 * Galerie BESTIAIRE — ATTAQUES (SVG + CSS, en boucle). Pour chaque créature non-bipède, une
 * tuile animée PAR ATTAQUE listée dans ses TRAITS canon (Morsure, Attaque caudale, Cornes,
 * Souffle, Arme/griffes…) — cf. engine/creatureAttacks. Gabarit quad/ailé → poses dédiées
 * (creatureAttackPoses) ; autres plans → leur attackPose. Aucune invention : tout vient des
 * traits. Lancer : npx tsx scripts/gen-creature-attacks-gallery.mts → public/creature-attacks.html
 */
import { writeFileSync } from 'node:fs';
import { DEFS } from '../src/gameIso/sprites';
import { planById, bodyPlanOf, type BodyPlanId } from '../src/gameIso/rig/bodyPlan';
import { creatureMatch, creatureSpeciesScale } from '../src/gameIso/rig/creatures';
import { mul, translate, type Matrix } from '../src/gameIso/rig/kinematics';
import type { ResolvedBone } from '../src/gameIso/rig/composeRig';
import { creatureAttacks, ATTACK_LABEL, type AttackKind } from '../src/engine/creatureAttacks';
import { quadAttackPose } from '../src/gameIso/rig/anim/creatureAttackPoses';
import { animatedRig } from './_lib-anim-rig';
import { creatures } from '../src/data/index';

const ATTACK_MS = 760;
const N = 14;
const styles: string[] = [];
let uidN = 0;

function scaleBones(bones: ResolvedBone[], z: number, cx = 60, cy = 78): ResolvedBone[] {
  if (z === 1) return bones;
  const S = mul(translate(cx, cy), mul([z, 0, 0, z, 0, 0] as Matrix, translate(-cx, -cy)));
  return bones.map((b) => ({ ...b, matrix: mul(S, b.matrix) }));
}

/** Échantillons d'os d'une attaque (profil, face à la cible) ou null si bipède/monolithique. */
function attackFrames(name: string, kind: AttackKind): { samples: ResolvedBone[][] } | null {
  const planId = bodyPlanOf(name);
  if (planId === 'monolithic' || planId === 'biped') return null;
  const plan = planById(planId as BodyPlanId);
  const species = creatureMatch(name)?.name ?? plan.speciesNames()[0] ?? '';
  const sc = creatureSpeciesScale(name);
  const z = sc > 1 ? +(1 / sc).toFixed(3) : 1;
  const quadFamily = planId === 'quadruped' || planId === 'winged';
  const poseAt = quadFamily ? (p: number) => quadAttackPose(kind, p) : (p: number) => plan.attackPose(p);
  const samples = Array.from({ length: N }, (_, i) => scaleBones(plan.resolve(species, 'profile', poseAt(i / (N - 1)), {}), z));
  return { samples };
}

function cell(name: string, kind: AttackKind, label: string): string {
  const f = attackFrames(name, kind);
  if (!f) return '';
  const uid = `a${uidN++}`;
  const { css, svg } = animatedRig(f.samples, ATTACK_MS, uid);
  styles.push(css);
  return `<figure style="margin:0;text-align:center">
    <svg viewBox="0 0 120 150" width="116" height="145"><defs>${DEFS}</defs><rect width="120" height="150" fill="#221a1a"/>${svg}</svg>
    <figcaption style="color:#e9b;font:10px sans-serif">${ATTACK_LABEL[kind]}<br><span style="color:#9a8">${label.replace(ATTACK_LABEL[kind], '').trim() || ''}</span></figcaption></figure>`;
}

const rows: string[] = [];
let nCreatures = 0, nAttacks = 0;
for (const c of creatures) {
  const planId = bodyPlanOf(c.label);
  if (planId === 'monolithic' || planId === 'biped') continue; // bipèdes → armes (anim-gallery)
  const attacks = creatureAttacks((c as { traits?: string[] }).traits ?? []);
  if (!attacks.length) continue;
  nCreatures++;
  nAttacks += attacks.length;
  const cells = attacks.map((a) => cell(c.label, a.kind, a.label)).join('');
  rows.push(`<div style="display:flex;align-items:center;gap:10px;margin:8px 0;border-bottom:1px solid #222;padding-bottom:6px">
    <div style="width:150px;color:#eee;font:12px sans-serif">${c.label}<br><span style="color:#888;font-size:10px">${attacks.length} attaque(s)</span></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">${cells}</div></div>`);
}

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bestiaire — attaques</title>
<style>${styles.join('')}</style></head>
<body style="background:#11141c;padding:18px;margin:0">
<a href="galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif;margin:10px 0 2px">Bestiaire — attaques par créature (depuis les TRAITS), animées</h1>
<p style="color:#9ab;font:12px sans-serif;margin:0 0 8px">Une tuile par attaque listée dans les traits canon (Morsure, Attaque caudale, Cornes, Souffle, Arme/griffes…), jouée en boucle. ${nCreatures} créatures · ${nAttacks} attaques. Aucune invention : tout vient des traits.</p>
${rows.join('')}
</body></html>`;
writeFileSync('public/creature-attacks.html', html);
console.log(`OK: public/creature-attacks.html (${nCreatures} créatures, ${nAttacks} attaques animées)`);
