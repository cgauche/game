/**
 * Ingère l'art retenu par le workflow weapons-redo : pour chaque slug ayant un
 * art-ref/directional/weapons-redo/<slug>/chosen.json ({front}), fusionne dans
 * GENERATED_WEAPONS en PRÉSERVANT GENERATED_ARMOUR et les arts non régénérés.
 * Usage : npx tsx scripts/_ingest-weapons-redo.mts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GENERATED_WEAPONS, GENERATED_ARMOUR } from '../src/gameIso/rig/parts/generated/weaponsArmour';
import { WEAPON_FORMS } from '../src/gameIso/rig/parts/weaponForms';

const decode = (s: string) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const weapons: Record<string, string> = { ...GENERATED_WEAPONS };
let n = 0;
for (const f of WEAPON_FORMS) {
  const p = `art-ref/directional/weapons-redo/${f.slug}/chosen.json`;
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const frag = j.front ?? j.svg;
  if (frag && String(frag).trim()) { weapons[f.slug] = decode(String(frag).trim()); n++; }
}

const banner = '// Généré par scripts/_ingest-weapons-redo.mts depuis le workflow weapons-redo — NE PAS éditer à la main.\n';
writeFileSync(
  'src/gameIso/rig/parts/generated/weaponsArmour.ts',
  banner +
    'export const GENERATED_WEAPONS: Record<string, string> = ' + JSON.stringify(weapons, null, 2) + ';\n\n' +
    "export const GENERATED_ARMOUR: Record<string, Partial<Record<'tete' | 'torse' | 'bras' | 'jambes', string>>> = " +
    JSON.stringify(GENERATED_ARMOUR, null, 2) + ';\n',
);
console.log(`ingéré ${n} armes ; total GENERATED_WEAPONS=${Object.keys(weapons).length} ; armour préservé=${Object.keys(GENERATED_ARMOUR).length}`);
