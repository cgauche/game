/**
 * Garde-fou : AUCUN renderer d'environnement ne porte de littéral de couleur (identité de matériau).
 * Toute couleur vient de la DONNÉE (`src/data/*.json`, defs de terrain) ou de `shade.ts` (la LUMIÈRE :
 * ombre d'orientation, occlusion, spéculaire). `#hex` / `rgb()` littéraux capturent aussi les anciennes
 * tables hex-valuées. Deux niveaux de couverture :
 *   1) balayage RÉCURSIF des arborescences pivot/backend/pov/catalog/stage — auto-couvre tout NOUVEAU
 *      fichier (plus de liste à tenir à la main) ;
 *   2) les renderers à la RACINE de `gameIso/`, nommés explicitement (`IsoStage`, `sprites`).
 * `catalog/decor/defs/` (les 97 defs de props) a son propre bloc plus bas (dessin par def, MAIS couleurs
 * tirées de la palette partagée) → exclu du balayage.
 *
 * HORS périmètre (couleur LÉGITIME, non balayés) : le rig (`rig/**` = bestiaire/équipement dessinés
 * « à la main »), les FX de combat (`fx/**`), le brouillard (`FogLayer` = chrome d'état, pas un matériau
 * du monde), `shade.ts` (helpers de voile lumineux sanctionnés `ao`/`spec`/`warm`), et les defs de
 * terrain (`state/terrain/defs/**` = DONNÉE d'identité matériau, gradient/swatch, au même titre qu'un
 * JSON). Les TOKENS (`BodyToken`/`tokenBodyKind`) sont couverts À PART (bloc « chrome » plus bas) : leur
 * couleur d'identité vient de teamColors (`ACTIVE_RING`/`hpColor`) ou d'une donnée d'apparence, le reste
 * est du chrome NEUTRE allowlisté ; tout AUTRE hex y est une fuite d'identité de matériau à attraper.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url)); // …/src/gameIso/

// Renderers d'environnement à la RACINE de gameIso/ (hors arborescence balayée) — nommés.
const ROOT_RENDERERS = [
  'IsoStage.tsx', // stage iso (coquille fine) — orchestration seule, zéro couleur
  'sprites.ts', // overlays de terrain (mur/arbre) + villageois d'ambiance — tons de decorPalette + ao()
];

// Arborescences pivot / backend / moteur de recettes / catalogue / stage / POV : chaque .ts/.tsx
// (hors test) est un renderer d'environnement (ou l'alimente en données) → hex-free.
// `catalog/decor/defs` a son bloc dédié (palette) → exclu du balayage.
const SWEEP_DIRS = ['builders', 'backends', 'detail', 'pov', 'catalog', 'stage'];

/** Fichiers .ts/.tsx (hors tests) d'un sous-arbre, chemins relatifs à `gameIso/`. */
function walk(abs: string, rel: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(abs, { withFileTypes: true })) {
    const childRel = `${rel}/${ent.name}`;
    if (ent.isDirectory()) {
      if (childRel.endsWith('catalog/decor/defs')) continue; // bloc dédié ci-dessous
      out.push(...walk(`${abs}/${ent.name}`, childRel));
    } else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      out.push(childRel);
    }
  }
  return out;
}

const COVERED = [...ROOT_RENDERERS, ...SWEEP_DIRS.flatMap((d) => walk(HERE + d, d))];

// `rgb(`/`hsl(` ne mordent que sur des CANAUX LITTÉRAUX : `rgb(${r},…)` (assemblage d'une couleur
// CALCULÉE, ex. `tint` du POV) n'est pas une identité en dur.
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]|\bhsla?\(\s*[\d.]/;

/** Retire commentaires (bloc + ligne, en préservant `://`) et imports — on ne teste que le code. */
function stripNoise(src: string): string {
  return src
    .replace(new RegExp('/\\*[\\s\\S]*?\\*/', 'g'), '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i > 0 && l[i - 1] === ':' ? l : i >= 0 ? l.slice(0, i) : l;
    })
    .filter((l) => !/^\s*import\b/.test(l))
    .join('\n');
}

function colorHits(src: string): string[] {
  return stripNoise(src)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => COLOR_LITERAL.test(l));
}

describe('garde-fou — aucune couleur en dur dans un renderer d’environnement', () => {
  it('le détecteur mord', () => {
    expect(colorHits('const a = "#5d4c36";')).toHaveLength(1);
    expect(colorHits('fill = `rgba(0,0,0,0.3)`;')).toHaveLength(1);
    expect(colorHits('const c = shade(app.wood.face, SIDE_N);')).toHaveLength(0);
    expect(colorHits('fill="var(--combat-gold)"')).toHaveLength(0);
    expect(colorHits('fill={`rgb(${mix(a, b)}, 0, 0)`}')).toHaveLength(0); // canaux calculés = OK
    expect(colorHits('// ancien: #5d4c36')).toHaveLength(0);
  });

  it('la surface couverte est complète (racine + balayage)', () => {
    expect(COVERED).toContain('sprites.ts');
    expect(COVERED).toContain('pov/geometry.ts');
    expect(COVERED).toContain('backends/affineWalls.ts');
    expect(COVERED.length).toBeGreaterThan(40);
  });

  it.each(COVERED)('%s : zéro couleur en dur', (rel) => {
    const hits = colorHits(readFileSync(HERE + rel, 'utf8'));
    expect(hits, `Couleurs en dur dans ${rel} :\n${hits.join('\n')}`).toEqual([]);
  });
});

// Chrome d'état des TOKENS : BodyToken (halo actif, PV, badges, ombres) et tokenBodyKind (bloc de siège)
// rendent l'ÉTAT de combat, pas un MATÉRIAU du monde. La couleur d'IDENTITÉ vient de teamColors
// (`ACTIVE_RING`/`hpColor`) ou d'une donnée (apparence de structure) ; le RESTE est du chrome NEUTRE
// allowlisté (ombres, fond de disque, tons de badge). Tout hex HORS allowlist = fuite d'identité à attraper.
const CHROME_RENDERERS = ['BodyToken.tsx', 'tokenBodyKind.tsx'];
const CHROME_ALLOW = new Set(['#000', '#1b2030', '#f2eef8', '#cdb8d8']);
// Extrait chaque littéral de couleur (hex, ou rgb/hsl à canaux LITTÉRAUX — `rgb(${…})` calculé exclu).
const CHROME_TOKEN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.][^)]*\)|\bhsla?\(\s*[\d.][^)]*\)/g;
/** Couleurs LITTÉRALES d'un fichier chrome, hors allowlist neutre (= identités de matériau interdites ici). */
function chromeLeaks(src: string): string[] {
  return (stripNoise(src).match(CHROME_TOKEN) ?? []).filter((tok) => !CHROME_ALLOW.has(tok));
}

describe('garde-fou — chrome des tokens : hex neutre allowlisté, tout autre = fuite', () => {
  it('le filtre attrape un hex hors allowlist, laisse passer un neutre', () => {
    expect(chromeLeaks('fill="#ff0000"')).toEqual(['#ff0000']);
    expect(chromeLeaks('fill="#000"')).toEqual([]);
  });
  it.each(CHROME_RENDERERS)('%s : zéro couleur d’identité en dur', (rel) => {
    const leaks = chromeLeaks(readFileSync(HERE + rel, 'utf8'));
    expect(leaks, `Couleurs d’identité en dur dans ${rel} (à sourcer via teamColors/données) :\n${leaks.join('\n')}`).toEqual([]);
  });
});

// Les 97 defs de décor : le dessin reste du code par def, MAIS toute couleur vient de la palette
// partagée (`P.<ton>`, `src/data/decorPalette.json`). Glob → couvre aussi tout nouveau `defs/<id>.ts`.
const DECOR_DEFS_DIR = HERE + 'catalog/decor/defs';
const DECOR_DEFS = readdirSync(DECOR_DEFS_DIR).filter((f) => f.endsWith('.ts'));

describe('garde-fou — decor defs consomment la palette (zéro couleur en dur)', () => {
  it('la liste des defs n’est pas vide', () => {
    expect(DECOR_DEFS.length).toBeGreaterThan(90);
  });
  it.each(DECOR_DEFS)('catalog/decor/defs/%s : zéro couleur en dur', (f) => {
    const hits = colorHits(readFileSync(`${DECOR_DEFS_DIR}/${f}`, 'utf8'));
    expect(hits, `Couleurs en dur dans decor/defs/${f} :\n${hits.join('\n')}`).toEqual([]);
  });
});
