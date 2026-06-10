/**
 * Émet l'`args` du workflow weapons-salvage en inspectant le staging existant.
 *   npx tsx scripts/qc/_weapon-salvage-args.mts
 * Sortie : {"draw":[{label,slug,type,target,slots:[n…]}], "judge":[{label,slug,target}]}
 *   - draw  : armes dont il manque ≥1 PNG candidat (slots = numéros manquants).
 *   - judge : armes sans chosen.json (jugées sur leurs PNG après la phase draw).
 */
import { existsSync } from 'node:fs';
import { WEAPON_FORMS } from '../../src/gameIso/rig/parts/weaponForms';

const ROOT = 'art-ref/directional/weapons-redo';
const N = 3;
const draw: any[] = [];
const judge: any[] = [];

for (const f of WEAPON_FORMS) {
  const dir = `${ROOT}/${f.slug}`;
  const missing: number[] = [];
  for (let n = 1; n <= N; n++) if (!existsSync(`${dir}/cand${n}.png`)) missing.push(n);
  if (missing.length) draw.push({ label: f.label, slug: f.slug, type: f.type, target: f.target, slots: missing });
  if (!existsSync(`${dir}/chosen.json`)) judge.push({ label: f.label, slug: f.slug, target: f.target });
}

console.log(JSON.stringify({ draw, judge }));
