/**
 * AUDIT (lecture seule) de la cohérence du bestiaire vs galeries : pour chaque clé du
 * sprite monolithique legacy (creatureSprites.json) et chaque créature de la data, dit
 * comment le JEU la rend réellement (plan du registre) → repère les entrées « anciennes »
 * (riggées mais encore présentes en sprite monolithique) et les doublons inter-galeries.
 * Usage : npx tsx scripts/_audit-gallery.mts
 */
import { readFileSync } from 'node:fs';
import { CREATURES, creatureMatch } from '../src/gameIso/rig/creatures';
import { classifyEnemy } from '../src/gameIso/rig/enemyProfile';
import { creatures as dataCreatures } from '../src/data/index';

const mono: Record<string, string> = JSON.parse(readFileSync('src/gameIso/creatureSprites.json', 'utf8'));
const monoKeys = Object.keys(mono);

const planOf = (name: string): string => {
  if (classifyEnemy(name) === 'rig') return 'biped(rig)';
  const d = creatureMatch(name);
  return d ? d.plan : 'biped(rig, no def)';
};

console.log(`\n=== Registre : ${CREATURES.length} defs ===`);
const byPlan = new Map<string, number>();
for (const c of CREATURES) byPlan.set(c.plan, (byPlan.get(c.plan) ?? 0) + 1);
console.log([...byPlan].map(([p, n]) => `${p}:${n}`).join('  '));

console.log(`\n=== creatureSprites.json : ${monoKeys.length} clés monolithiques → rendu réel ===`);
const stale: string[] = [];
const trulyMono: string[] = [];
for (const k of monoKeys) {
  const plan = planOf(k);
  const isMono = plan === 'monolithic';
  if (!isMono) stale.push(`${k}  →  ${plan}`);
  else trulyMono.push(k);
}
console.log(`\n-- ANCIENS (riggés mais encore en sprite monolithique = art périmé affiché dans sprites-gallery) : ${stale.length} --`);
console.log(stale.join('\n'));
console.log(`\n-- ENCORE MONOLITHIQUES (légitimes : aucun gabarit rig) : ${trulyMono.length} --`);
console.log(trulyMono.join(', '));

console.log(`\n=== Data bestiaire : ${dataCreatures.length} créatures → rendu réel ===`);
const dataByPlan = new Map<string, string[]>();
for (const c of dataCreatures) {
  const plan = planOf(c.label);
  (dataByPlan.get(plan) ?? dataByPlan.set(plan, []).get(plan)!).push(c.label);
}
for (const [plan, names] of [...dataByPlan].sort()) console.log(`  ${plan} (${names.length}) : ${names.join(', ')}`);

// Créatures monolithiques sans entrée data (orphelines de gallery) et inversement.
const dataLabels = new Set(dataCreatures.map((c) => c.label));
const monoNotInData = monoKeys.filter((k) => !dataLabels.has(k));
console.log(`\n=== Clés monolithiques absentes de la data (${monoNotInData.length}) : ${monoNotInData.join(', ')}`);
