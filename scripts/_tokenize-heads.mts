/**
 * Applique la CLASSIFICATION couleur des têtes (workflow classify-head-colors) :
 *   1. Lit public/qc/head-colormap.json = [{key, assignments:[{slot, hex, token}]}]
 *   2. Réécrit heads.ts en tokenisant visage/cheveux (hex -> @peau/@cheveux/keep).
 * Les palettes par espèce/sexe sont maintenant maintenues à la main dans le registre Race
 * (race.palette / race.paletteF dans src/gameIso/rig/races/defs/), accessibles via racePalette().
 * Idempotent. Lancer : npx tsx scripts/_tokenize-heads.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';

type Assign = { slot: 'visage' | 'cheveux'; hex: string; token: string };
const colormap: { key: string; assignments: Assign[] }[] = JSON.parse(readFileSync('public/qc/head-colormap.json', 'utf8'));
const heads: Record<string, { visage?: string; cheveux?: string }> = {};
let replaced = 0;

for (const key of Object.keys(GENERATED_HEADS)) {
  const src = GENERATED_HEADS[key] as { visage?: string; cheveux?: string };
  const entry = colormap.find((c) => c.key === key);
  const out: { visage?: string; cheveux?: string } = {};

  for (const slot of ['visage', 'cheveux'] as const) {
    const svg = src[slot];
    if (svg == null) continue;
    const map = new Map<string, string>(); // hex(min) -> token
    for (const a of entry?.assignments ?? []) {
      if (a.slot !== slot || a.token === 'keep') continue;
      const hex = a.hex.toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(hex)) continue;
      map.set(hex, a.token);
    }
    out[slot] = svg.replace(/#[0-9a-fA-F]{6}/g, (m) => {
      const tk = map.get(m.toLowerCase());
      if (tk) { replaced++; return '@' + tk; }
      return m;
    });
  }
  heads[key] = out;
}

// ── heads.ts (tokenisé) ──────────────────────────────────────────────────────
const headBody = Object.entries(heads)
  .map(([key, parts]) => {
    const lines = (['visage', 'cheveux'] as const).filter((p) => parts[p] != null).map((p) => `    ${JSON.stringify(p)}: ${JSON.stringify(parts[p])}`);
    return `  ${JSON.stringify(key)}: {\n${lines.join(',\n')}\n  }`;
  })
  .join(',\n');
writeFileSync(
  'src/gameIso/rig/parts/generated/heads.ts',
  `// Généré par scripts/_ingest-rig-art.mjs puis TOKENISÉ par scripts/_tokenize-heads.mjs — NE PAS éditer à la main.\n` +
    `/** Têtes (visage + cheveux) par "Espèce:Sexe", couleurs en tokens @peau/@cheveux (défauts par espèce dans le registre Race via racePalette()). */\n` +
    `export const GENERATED_HEADS: Record<string, { visage?: string; cheveux?: string }> = {\n${headBody}\n};\n`,
);

console.log(`OK — ${Object.keys(heads).length} têtes tokenisées ; ${replaced} hex remplacés.`);
