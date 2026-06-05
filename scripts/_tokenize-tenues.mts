/**
 * Applique la CLASSIFICATION couleur (workflow `classify-tenue-colors`) aux tenues :
 *   1. Lit public/qc/tenue-colormap.json  = [{career, assignments:[{hex, token}]}]
 *   2. Lit public/qc/tenue-hex.json        = fréquences par hex (pour choisir le hex
 *      représentatif d'un token quand plusieurs hex y sont assignés)
 *   3. Réécrit careerTenuesAuto.ts en remplaçant CHAQUE hex classé par son `@token`
 *      (la géométrie n'est JAMAIS touchée — seules les valeurs de couleur changent).
 *   4. Génère careerPalettes.ts : CAREER_PALETTES[career][token] = hex EXACT d'origine
 *      → rendu par défaut sans perte ; recoloriage cohérent via buildTokenMap.
 * Idempotent (un fichier déjà tokenisé n'a plus de hex à remplacer).
 * Lancer : npx tsx scripts/_tokenize-tenues.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { GENERATED_CAREER_TENUES_AUTO } from '../src/gameIso/rig/parts/generated/careerTenuesAuto';

const PARTS = ['torse', 'jambes', 'bras', 'tete'] as const;
type PartKey = (typeof PARTS)[number];

type Assign = { hex: string; token: string };
type CareerMap = { career: string; assignments: Assign[] };

const colormap: CareerMap[] = JSON.parse(readFileSync('public/qc/tenue-colormap.json', 'utf8'));
const manifest: Record<string, { hex: { hex: string; count: number }[] }> = JSON.parse(
  readFileSync('public/qc/tenue-hex.json', 'utf8'),
);

const countOf = (career: string, hex: string) =>
  manifest[career]?.hex.find((h) => h.hex === hex.toLowerCase())?.count ?? 0;

const tenues: Record<string, Partial<Record<PartKey, string>>> = {};
const palettes: Record<string, Record<string, string>> = {};
let replaced = 0;
let kept = 0;

for (const career of Object.keys(GENERATED_CAREER_TENUES_AUTO)) {
  const src = GENERATED_CAREER_TENUES_AUTO[career] as Partial<Record<PartKey, string>>;
  const entry = colormap.find((c) => c.career === career);
  // hex (minuscule) → token ; ignore 'keep' (reste en dur).
  const hex2token = new Map<string, string>();
  const tokenHexes: Record<string, string[]> = {}; // token → hex assignés (pour palette)
  for (const a of entry?.assignments ?? []) {
    const hex = a.hex.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(hex) || a.token === 'keep') continue;
    hex2token.set(hex, a.token);
    (tokenHexes[a.token] ??= []).push(hex);
  }

  // Réécrit chaque part : remplace les hex classés par @token (insensible à la casse).
  const out: Partial<Record<PartKey, string>> = {};
  for (const part of PARTS) {
    const svg = src[part];
    if (svg == null) continue;
    out[part] = svg.replace(/#[0-9a-fA-F]{6}/g, (m) => {
      const tk = hex2token.get(m.toLowerCase());
      if (tk) { replaced++; return '@' + tk; }
      kept++;
      return m;
    });
  }
  tenues[career] = out;

  // Palette par défaut : pour chaque token, le hex le PLUS FRÉQUENT qui lui est assigné.
  const pal: Record<string, string> = {};
  for (const [token, hexes] of Object.entries(tokenHexes)) {
    pal[token] = hexes.slice().sort((a, b) => countOf(career, b) - countOf(career, a))[0];
  }
  if (Object.keys(pal).length) palettes[career] = pal;
}

// ── Écrit careerTenuesAuto.ts (tokenisé) ─────────────────────────────────────
const ORDER: PartKey[] = ['torse', 'jambes', 'bras', 'tete'];
const tenueBody = Object.entries(tenues)
  .map(([career, parts]) => {
    const lines = ORDER.filter((p) => parts[p] != null).map((p) => `    ${JSON.stringify(p)}: ${JSON.stringify(parts[p])}`);
    return `  ${JSON.stringify(career)}: {\n${lines.join(',\n')}\n  }`;
  })
  .join(',\n');
const tenueFile = `// Généré par scripts/_ingest-rig-art.mjs puis TOKENISÉ par scripts/_tokenize-tenues.mjs — NE PAS éditer à la main.
/** Tenues de carrière GÉNÉRÉES (auto), couleurs en tokens @palette. Les overrides manuels vivent dans careerTenues.ts. */
export const GENERATED_CAREER_TENUES_AUTO: Record<string, Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', string>>> = {
${tenueBody}
};
`;
writeFileSync('src/gameIso/rig/parts/generated/careerTenuesAuto.ts', tenueFile);

// ── Écrit careerPalettes.ts ──────────────────────────────────────────────────
const palBody = Object.entries(palettes)
  .map(([career, pal]) => {
    const inner = Object.entries(pal)
      .map(([tk, hex]) => `${tk}: ${JSON.stringify(hex)}`)
      .join(', ');
    return `  ${JSON.stringify(career)}: { ${inner} }`;
  })
  .join(',\n');
const palFile = `/**
 * Palettes par DÉFAUT des tenues de carrière — GÉNÉRÉ par scripts/_tokenize-tenues.mjs
 * à partir de la classification couleur (workflow). NE PAS éditer à la main.
 *
 * Pour chaque carrière, le hex EXACT d'origine par token (vet1, vet1O, vet1H, cuir,
 * metal, peau…). Fusionné SOUS les surcharges utilisateur dans composeRig → rendu par
 * défaut identique à l'art dessiné, recoloriage cohérent quand l'utilisateur choisit.
 */
import type { StoredPalette } from '../../palette';

export const CAREER_PALETTES: Record<string, StoredPalette> = {
${palBody}
};
`;
writeFileSync('src/gameIso/rig/parts/generated/careerPalettes.ts', palFile);

console.log(`OK — ${Object.keys(palettes).length} carrières avec palette ; ${replaced} hex tokenisés, ${kept} laissés en dur.`);
