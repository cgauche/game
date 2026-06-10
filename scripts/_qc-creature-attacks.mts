/** QC des poses d'attaque de créature (pic de phase) : Dragon (morsure/caudale/souffle/arme) +
 *  un quadrupède (morsure). → public/qc/creature-attacks.png. npx tsx scripts/_qc-creature-attacks.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { planById, bodyPlanOf, type BodyPlanId } from '../src/gameIso/rig/bodyPlan';
import { creatureMatch, creatureSpeciesScale } from '../src/gameIso/rig/creatures';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { quadAttackPose } from '../src/gameIso/rig/anim/creatureAttackPoses';
import type { AttackKind } from '../src/engine/creatureAttacks';

const ROWS: Array<[name: string, kinds: AttackKind[]]> = [
  ['Dragon', ['morsure', 'caudale', 'souffle', 'arme']],
  ['Ours', ['morsure', 'arme', 'caudale']],
  ['Loup', ['morsure', 'caudale']],
];
const CELL = 150, CH = 160;

function svgFor(name: string, kind: AttackKind | null): string {
  const id = bodyPlanOf(name) as BodyPlanId;
  const plan = planById(id);
  const species = creatureMatch(name)?.name ?? plan.speciesNames()[0] ?? '';
  const pose = kind ? quadAttackPose(kind, 0.5) : plan.restPose();
  const sc = creatureSpeciesScale(name);
  const z = sc > 1 ? +(1 / sc).toFixed(3) : 1;
  const inner = bonesToSvg(plan.resolve(species, 'profile', pose, {}));
  return `<g transform="translate(60,78) scale(${z}) translate(-60,-78)">${inner}</g>`;
}

mkdirSync('public/qc', { recursive: true });
const cells: string[] = [];
ROWS.forEach(([name, kinds], r) => {
  const cols: Array<AttackKind | null> = [null, ...kinds];
  cols.forEach((kind, c) => {
    const x = c * CELL, y = r * CH;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CELL}" height="${CH}" fill="${c % 2 ? '#1d2230' : '#171b26'}"/>${svgFor(name, kind)}<text x="${CELL / 2}" y="${CH - 8}" text-anchor="middle" font-size="10" fill="#cdd">${kind ?? `${name} · repos`}</text></g>`);
  });
});
const W = (1 + Math.max(...ROWS.map((r) => r[1].length))) * CELL, H = ROWS.length * CH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#0c0e14"/>${cells.join('')}</svg>`;
writeFileSync('public/qc/creature-attacks.png', new Resvg(svg, { background: '#0c0e14', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK → public/qc/creature-attacks.png');
