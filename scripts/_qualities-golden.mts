/** Golden master qualités : dump chaque QualityDef (données + comportement de critTrigger sur
 *  des rolls témoins) → JSON, pour prouver l'iso-comportement avant/après la migration.
 *  Usage : npx tsx scripts/_qualities-golden.mts <out.json> */
import { writeFileSync } from 'node:fs';
import { QUALITIES } from '../src/engine/qualities/registry';

const ROLLS = [10, 11, 20, 15, 100, 99];
const dump = Object.fromEntries(
  Object.keys(QUALITIES).sort().map((k) => {
    const { critTrigger, ...data } = QUALITIES[k] as any;
    return [k, { ...data, _critTrigger: critTrigger ? ROLLS.map((r) => critTrigger({ roll: r })) : null }];
  }),
);
writeFileSync(process.argv[2], JSON.stringify(dump, null, 0));
console.log('qualities golden:', Object.keys(QUALITIES).length, 'qualités →', process.argv[2]);
