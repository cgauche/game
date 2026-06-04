/**
 * One-off : ingère la sortie d'un workflow d'art (têtes/armes/armures), décode les
 * entités HTML, et génère src/gameIso/rig/parts/generated/{heads,weaponsArmour}.ts.
 * Usage : node scripts/_ingest-rig-art.mjs <chemin-output-json>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/_ingest-rig-art.mjs <output.json>'); process.exit(1); }

const decode = (s) =>
  String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const parsed = JSON.parse(readFileSync(file, 'utf8'));
const data = parsed.result ?? parsed;
const heads = data.heads ?? [];
const wa = data.weaponsArmour ?? [];

// --- Têtes : { 'Espèce:Sexe': { visage, cheveux } } ---
const headsObj = {};
for (const h of heads) {
  const entry = {};
  for (const p of h.parts ?? []) entry[p.slot] = decode(p.svg);
  headsObj[h.key] = entry;
}

// --- Armes / armures ---
const weaponsObj = {};
const armourObj = {};
for (const it of wa) {
  if (it.category === 'arme') {
    const a = (it.parts ?? []).find((p) => p.slot === 'arme');
    if (a) weaponsObj[it.key] = decode(a.svg);
  } else if (it.category === 'armure') {
    const m = {};
    for (const p of it.parts ?? []) m[p.slot] = decode(p.svg);
    armourObj[it.key] = m;
  }
}

mkdirSync('src/gameIso/rig/parts/generated', { recursive: true });

const banner = '// Généré par scripts/_ingest-rig-art.mjs depuis un workflow d’art — NE PAS éditer à la main.\n';
writeFileSync(
  'src/gameIso/rig/parts/generated/heads.ts',
  banner +
    '/** Têtes (visage + cheveux) par "Espèce:Sexe", dessinées depuis l’art officiel. */\n' +
    'export const GENERATED_HEADS: Record<string, { visage?: string; cheveux?: string }> = ' +
    JSON.stringify(headsObj, null, 2) + ';\n',
);
writeFileSync(
  'src/gameIso/rig/parts/generated/weaponsArmour.ts',
  banner +
    "export const GENERATED_WEAPONS: Record<string, string> = " + JSON.stringify(weaponsObj, null, 2) + ';\n\n' +
    "export const GENERATED_ARMOUR: Record<string, Partial<Record<'tete' | 'torse' | 'bras' | 'jambes', string>>> = " +
    JSON.stringify(armourObj, null, 2) + ';\n',
);

console.log(`heads: ${Object.keys(headsObj).length} (${Object.keys(headsObj).join(', ')})`);
console.log(`weapons: ${Object.keys(weaponsObj).length} (${Object.keys(weaponsObj).join(', ')})`);
console.log(`armours: ${Object.keys(armourObj).length} (${Object.keys(armourObj).join(', ')})`);
