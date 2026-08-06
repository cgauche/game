/** QC planche : rend des créatures par ID via le chemin de PROD (resolveById → entityRigProfile/
 * plan.resolve → bonesToSvg), front + profil. Sort public/qc/zoo.png. Args = ids séparés par virgules. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { resolveById, planById, planOptsForRecord } from '../src/gameIso/rig/bodyPlan';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { creatures } from '../src/data';
import { DEFS } from '../src/gameIso/sprites';
import type { View } from '../src/gameIso/rig/facing';

const SEED = 7;
function renderSvg(id: string, view: View): string {
  const r = resolveById(id);
  if (r.kind === 'rig') {
    const p = entityRigProfile(id, SEED);
    return p ? bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, view, [])) : '';
  }
  const plan = planById(r.plan);
  if (!plan || !plan.hasView(r.species, view)) return '';
  return bonesToSvg(plan.resolve(r.species, view, plan.restPose(), planOptsForRecord(id)));
}
const ids = (process.argv[2] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const labelOf = (id: string) => creatures.find((c) => c.id === id)?.label ?? id;
const CW = 130, CH = 170;
const rows = ids.map((id, ri) => {
  const cells = (['front', 'profile'] as View[]).map((view, ci) =>
    `<g transform="translate(${ci * CW},0)"><rect width="${CW - 4}" height="${CH - 16}" fill="#222a36"/>` +
    `<g transform="translate(${(CW - 4) / 2 - 60},${CH - 16 - 150})">${renderSvg(id, view)}</g>` +
    `<text x="${(CW - 4) / 2}" y="${CH - 4}" text-anchor="middle" font-size="9" fill="#cdd" font-family="sans-serif">${view}</text></g>`,
  );
  const res = resolveById(id);
  return `<g transform="translate(0,${ri * CH})">${cells.join('')}` +
    `<text x="${2 * CW + 8}" y="40" font-size="12" fill="#fff" font-family="sans-serif">${labelOf(id)}</text>` +
    `<text x="${2 * CW + 8}" y="58" font-size="10" fill="#8ab" font-family="sans-serif">${res.kind}/${res.plan}/${res.species}</text></g>`;
});
const W = 2 * CW + 280, H = ids.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${rows.join('')}</svg>`;
mkdirSync('public/qc', { recursive: true });
writeFileSync('public/qc/zoo.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log(`OK -> public/qc/zoo.png (${ids.length})`);
