import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { creatures } from '../../../data';
import { resolveByName } from '../bodyPlan';
import { entityRigProfile } from '../enemyProfile';

it('DIAG: derived kit per rig creature', () => {
  const rows: string[] = [];
  let rigCount = 0, armed = 0, armoured = 0;
  for (const c of creatures) {
    const r = resolveByName(c.id);
    if (r.kind !== 'rig') continue;
    rigCount++;
    const p = entityRigProfile(c.id, 7);
    if (!p) continue;
    const w = p.equip.weapons.map((x) => x.name);
    const a = p.equip.armour.map((x) => `${x.name}:${x.pa}`);
    if (w.length) armed++;
    if (a.length) armoured++;
    if (w.length || a.length) rows.push(`${c.label} => W[${w.join(', ')}] A[${a.join(', ')}]`);
  }
  writeFileSync('_diag-kit.txt', `RIG creatures: ${rigCount} | armed: ${armed} | armoured: ${armoured}\n` + rows.join('\n'));
});
