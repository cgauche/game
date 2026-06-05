/**
 * Applique la CLASSIFICATION couleur des têtes (workflow classify-head-colors) :
 *   1. Lit public/qc/head-colormap.json = [{key, assignments:[{slot, hex, token}]}]
 *   2. Réécrit heads.ts en tokenisant visage/cheveux (hex -> @peau/@cheveux/keep).
 *   3. Génère speciesPalettes.ts : SPECIES_PALETTES[espèce:sexe][token] = hex EXACT
 *      d'origine -> rendu par défaut sans perte (peau/cheveux par espèce), recolor cohérent.
 * Idempotent. Lancer : npx tsx scripts/_tokenize-heads.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

type Assign = { slot: 'visage' | 'cheveux'; hex: string; token: string };
const colormap: { key: string; assignments: Assign[] }[] = JSON.parse(readFileSync('public/qc/head-colormap.json', 'utf8'));
const countOf = (key: string, slot: string, hex: string) => {
  const d = JSON.parse(readFileSync(`public/qc/head-hex/${slug(key)}.json`, 'utf8'));
  return (d[slot] as { hex: string; count: number }[]).find((h) => h.hex === hex.toLowerCase())?.count ?? 0;
};

const heads: Record<string, { visage?: string; cheveux?: string }> = {};
const palettes: Record<string, Record<string, string>> = {};
let replaced = 0;

for (const key of Object.keys(GENERATED_HEADS)) {
  const src = GENERATED_HEADS[key] as { visage?: string; cheveux?: string };
  const entry = colormap.find((c) => c.key === key);
  const out: { visage?: string; cheveux?: string } = {};
  const tokenHexes: Record<string, { hex: string; count: number }[]> = {};

  for (const slot of ['visage', 'cheveux'] as const) {
    const svg = src[slot];
    if (svg == null) continue;
    const map = new Map<string, string>(); // hex(min) -> token
    for (const a of entry?.assignments ?? []) {
      if (a.slot !== slot || a.token === 'keep') continue;
      const hex = a.hex.toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(hex)) continue;
      map.set(hex, a.token);
      (tokenHexes[a.token] ??= []).push({ hex, count: countOf(key, slot, hex) });
    }
    out[slot] = svg.replace(/#[0-9a-fA-F]{6}/g, (m) => {
      const tk = map.get(m.toLowerCase());
      if (tk) { replaced++; return '@' + tk; }
      return m;
    });
  }
  heads[key] = out;

  const pal: Record<string, string> = {};
  for (const [token, hs] of Object.entries(tokenHexes)) {
    pal[token] = hs.slice().sort((a, b) => b.count - a.count)[0].hex;
  }
  if (Object.keys(pal).length) palettes[key] = pal;
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
    `/** Têtes (visage + cheveux) par "Espèce:Sexe", couleurs en tokens @peau/@cheveux (défauts par espèce dans speciesPalettes.ts). */\n` +
    `export const GENERATED_HEADS: Record<string, { visage?: string; cheveux?: string }> = {\n${headBody}\n};\n`,
);

// ── speciesPalettes.ts ───────────────────────────────────────────────────────
const palBody = Object.entries(palettes)
  .map(([key, pal]) => `  ${JSON.stringify(key)}: { ${Object.entries(pal).map(([t, h]) => `${t}: ${JSON.stringify(h)}`).join(', ')} }`)
  .join(',\n');
writeFileSync(
  'src/gameIso/rig/parts/generated/speciesPalettes.ts',
  `/**\n * Palettes par DÉFAUT de PEAU et CHEVEUX par espèce:sexe — GÉNÉRÉ par scripts/_tokenize-heads.mjs.\n` +
    ` * NE PAS éditer à la main. Fusionné SOUS la carrière et les surcharges dans composeRig →\n` +
    ` * carnation/cheveux justes par espèce au défaut (elfe blond, etc.), recolor cohérent.\n */\n` +
    `import type { StoredPalette } from '../../palette';\n\n` +
    `export const SPECIES_PALETTES: Record<string, StoredPalette> = {\n${palBody}\n};\n`,
);

console.log(`OK — ${Object.keys(palettes).length} têtes avec palette espèce ; ${replaced} hex tokenisés.`);
