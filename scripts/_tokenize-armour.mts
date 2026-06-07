/**
 * Tokenise la couleur de GENERATED_ARMOUR (4 matériaux × 4 emplacements) comme les armes :
 * couleurs → @tokens (@metal acier, @cuir cuir/rembourré) + ombres, le reste (outlines) gardé.
 * Émet une palette PAR MATÉRIAU (ARMOUR_PALETTES) → défaut sans perte + skin par objet.
 * Réécrit src/gameIso/rig/parts/generated/armour.ts. Idempotent (skip si déjà ARMOUR_PALETTES).
 * Usage : npx tsx scripts/_tokenize-armour.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { GENERATED_ARMOUR } from '../src/gameIso/rig/parts/generated/armour';

const FILE = 'src/gameIso/rig/parts/generated/armour.ts';
if (/ARMOUR_PALETTES/.test(readFileSync(FILE, 'utf8'))) { console.log('déjà tokenisé — ignoré'); process.exit(0); }

const GRADIENT_MID: Record<string, string> = { 'url(#g_steel)': '#9aa6b8', 'url(#g_steelD)': '#676f80', 'url(#g_axe)': '#a4acb9' };
const effHex = (c: string) => (c.startsWith('url(') ? GRADIENT_MID[c] ?? '#9aa6b8' : c);
function hsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, l: 0 };
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return { h, s, l };
}
type Fam = 'metal' | 'cuir' | null;
function family(c: string): Fam {
  if (c.startsWith('url(')) return 'metal'; // les dégradés d'armure sont métalliques (g_steel/D)
  const { s, l } = hsl(c);
  if (l < 0.13) return null;          // outline quasi-noir
  if (s < 0.16) return 'metal';        // gris désaturé = acier
  if (hsl(c).h >= 186 && hsl(c).h <= 250) return 'metal'; // bleu-acier
  if (hsl(c).h >= 6 && hsl(c).h <= 55) return 'cuir';     // brun/beige (cuir, rembourré, surpiqûres)
  return null;
}

const SLOTS = ['tete', 'torse', 'bras', 'jambes'] as const;
const out: Record<string, Partial<Record<string, string>>> = {};
const palettes: Record<string, Record<string, string>> = {};

for (const mat of Object.keys(GENERATED_ARMOUR)) {
  const slotArt = GENERATED_ARMOUR[mat] as Partial<Record<string, string>>;
  // 1) collecte toutes les couleurs du matériau (tous slots) → familles + lightness
  const byFam: Record<'metal' | 'cuir', Array<{ color: string; l: number; n: number }>> = { metal: [], cuir: [] };
  const counts = new Map<string, number>();
  for (const slot of SLOTS) {
    const svg = slotArt[slot]; if (!svg) continue;
    for (const m of svg.matchAll(/#[0-9a-fA-F]{6}\b/g)) counts.set(m[0].toLowerCase(), (counts.get(m[0].toLowerCase()) ?? 0) + 1);
    for (const m of svg.matchAll(/url\(#[\w]+\)/g)) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  }
  for (const [color, n] of counts) { const f = family(color); if (f) byFam[f].push({ color, l: hsl(effHex(color)).l, n }); }

  // 2) couleur→token (tier par lightness) + palette représentative
  const color2token = new Map<string, string>();
  const pal: Record<string, string> = {};
  for (const fam of ['metal', 'cuir'] as const) {
    const items = byFam[fam]; if (!items.length) continue;
    const ls = items.map((i) => i.l).sort((a, b) => a - b); const med = ls[Math.floor(ls.length / 2)];
    const repr: Record<string, { hex: string; n: number; grad: boolean }> = {};
    for (const it of items) {
      const tier = it.l >= med + 0.07 ? 'H' : it.l <= med - 0.07 ? 'O' : '';
      const tok = fam + tier; color2token.set(it.color, '@' + tok);
      const grad = it.color.startsWith('url('); const cur = repr[tok];
      if (!cur || (cur.grad && !grad) || (cur.grad === grad && it.n > cur.n)) repr[tok] = { hex: effHex(it.color), n: it.n, grad };
    }
    for (const [tok, r] of Object.entries(repr)) pal[tok] = r.hex;
  }
  palettes[mat] = pal;

  // 3) réécrit l'art de chaque slot
  const matOut: Partial<Record<string, string>> = {};
  for (const slot of SLOTS) {
    let svg = slotArt[slot]; if (!svg) continue;
    svg = svg.replace(/url\(#[\w]+\)/g, (m) => color2token.get(m) ?? m).replace(/#[0-9a-fA-F]{6}\b/g, (m) => color2token.get(m.toLowerCase()) ?? m);
    matOut[slot] = svg;
  }
  out[mat] = matOut;
}

const body =
  `// Armure générée par le workflow d'art (matériau × emplacement), COULEUR TOKENISÉE (@metal/@cuir\n` +
  `// + ombres) — défaut résolu par ARMOUR_PALETTES, recolorable par un skin d'objet (cf. armourPart).\n` +
  `import type { StoredPalette } from '../../palette';\n\n` +
  `export const GENERATED_ARMOUR: Record<string, Partial<Record<'tete' | 'torse' | 'bras' | 'jambes', string>>> = ${JSON.stringify(out, null, 2)};\n\n` +
  `/** Palette par DÉFAUT par matériau (hex exact des @tokens) → rendu sans perte ; un skin d'objet l'override. */\n` +
  `export const ARMOUR_PALETTES: Record<string, StoredPalette> = ${JSON.stringify(palettes, null, 2)};\n`;
writeFileSync(FILE, body);
console.log(`OK — armure tokenisée. Palettes : ${Object.entries(palettes).map(([m, p]) => `${m}={${Object.keys(p).join(',')}}`).join(' ; ')}`);
