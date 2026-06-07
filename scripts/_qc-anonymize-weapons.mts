/**
 * Anonymise les silhouettes d'armes pour l'audit AVEUGLE : copie public/qc/w-<slug>.png →
 * public/qc/audit-NN.png (ordre mélangé déterministe) + public/qc/audit-map.json {NN:slug}.
 * Le juge ne voit que l'ID NN. Usage : npx tsx scripts/_qc-anonymize-weapons.mts
 */
import { copyFileSync, writeFileSync } from 'node:fs';
import { WEAPON_FORMS } from '../src/gameIso/rig/parts/weaponForms';

// mélange déterministe (pas de Math.random) : tri par hash simple du slug.
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const order = WEAPON_FORMS.map((f) => f.slug).sort((a, b) => hash(a) - hash(b));

const map: Record<string, string> = {};
order.forEach((slug, i) => {
  const id = String(i).padStart(2, '0');
  copyFileSync(`public/qc/w-${slug}.png`, `public/qc/audit-${id}.png`);
  map[id] = slug;
});
writeFileSync('public/qc/audit-map.json', JSON.stringify(map, null, 2));
console.log(`OK — ${order.length} silhouettes anonymisées (audit-00..${String(order.length - 1).padStart(2, '0')}.png) + audit-map.json`);
