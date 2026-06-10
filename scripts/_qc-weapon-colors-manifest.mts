/**
 * Manifeste des COULEURS réellement utilisées dans les 48 defs d'arme (hex + dégradés
 * url(#...)), avec fréquences → fonde le classifieur déterministe couleur→token.
 * Usage : npx tsx scripts/_qc-weapon-colors-manifest.mts
 */
import { WEAPON_DEFS } from '../src/gameIso/rig/parts/weapons/_registry.generated';

const counts = new Map<string, number>();
const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);

for (const d of WEAPON_DEFS) {
  for (const m of d.art.matchAll(/#[0-9a-fA-F]{6}\b/g)) bump(m[0].toLowerCase());
  for (const m of d.art.matchAll(/url\(#([\w]+)\)/g)) bump('url(#' + m[1] + ')');
}

const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log(`${rows.length} couleurs distinctes sur ${WEAPON_DEFS.length} armes :\n`);
for (const [c, n] of rows) console.log(`${String(n).padStart(4)}  ${c}`);
