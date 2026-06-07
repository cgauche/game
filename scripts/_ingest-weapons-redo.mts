/**
 * Ingère l'art retenu par le workflow weapons-redo dans le REGISTRE d'armes (weapons/defs/).
 * Pour chaque slug ayant art-ref/directional/weapons-redo/<slug>/chosen.json ({front}),
 * réécrit SON fichier `weapons/defs/<slug>.ts` (métadonnée préservée depuis WEAPON_DEFS + art
 * neuf). Les autres defs ne sont pas touchés (1 arme = 1 fichier indépendant).
 * Usage : npx tsx scripts/_ingest-weapons-redo.mts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { WEAPON_DEFS } from '../src/gameIso/rig/parts/weapons/_registry.generated';

const decode = (s: string) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Slugs explicites en argument = ne réingère QUE ceux-là (sinon TOUS ceux ayant un chosen.json,
// y compris des chosen.json PÉRIMÉS de runs précédents → écrase l'override lisibilité committé).
const only = new Set(process.argv.slice(2));
let n = 0;
for (const d of WEAPON_DEFS) {
  if (only.size && !only.has(d.slug)) continue;
  const p = `art-ref/directional/weapons-redo/${d.slug}/chosen.json`;
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const frag = j.front ?? j.svg;
  if (!frag || !String(frag).trim()) continue;
  const art = decode(String(frag).trim());
  const body =
    `import type { WeaponDef } from '../types';\n\n` +
    `export const weapon: WeaponDef = {\n` +
    `  slug: ${JSON.stringify(d.slug)},\n` +
    `  label: ${JSON.stringify(d.label)},\n` +
    `  type: ${JSON.stringify(d.type)},\n` +
    `  group: ${JSON.stringify(d.group)},\n` +
    `  target: ${JSON.stringify(d.target)},\n` +
    `  art: ${JSON.stringify(art)},\n` +
    `};\n`;
  writeFileSync(`src/gameIso/rig/parts/weapons/defs/${d.slug}.ts`, body);
  n++;
}
console.log(`ingéré ${n} armes → weapons/defs/ (puis \`npm run gen\` si nouveaux slugs)`);
