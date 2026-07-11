/**
 * QC one-off : planche-contact de TOUS les décors (props) — chaque prop rendu dans sa boîte 120×150,
 * sur fond sombre, avec les dégradés (DEFS) + les classes d'ambiance (anim.css). Sert à relire d'un
 * coup d'œil les nouveaux assets. Sortie : public/qc-decor.html (servi par Vite : /qc-decor.html).
 * Lancer : npx tsx scripts/_qc-decor-sheet.mts
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROPS, propSvg, propViewSvg } from '../src/gameIso/catalog/decor/index';
import { DEFS } from '../src/gameIso/sprites';
import type { View } from '../src/gameIso/rig/facing';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const anim = readFileSync(join(ROOT, 'src/gameIso/anim.css'), 'utf8');

// Nouveaux props de cette passe (mis en avant) vs existants.
const NEW = new Set(['mannequin','rack-armes','etendard','colonne-brisee','arche-ruine','gravats','grille','detritus','ossements','tombe','sarcophage','barriere','tribune','rack-lances','souche','roseaux','menhir','toile','cocon','champignon','stalagmite','rocher','marmite','terrier','cage','roue-dentee','cercle-runique','autel','pieu','urne','chandelier','tas-or','oeuf-dragon','crane-monstre']);

const onlyNew = process.argv.includes('--new');
const all = Object.keys(PROPS).sort((a, b) => (NEW.has(b) ? 1 : 0) - (NEW.has(a) ? 1 : 0) || a.localeCompare(b));
const ids = onlyNew ? all.filter((id) => NEW.has(id)) : all;
const W = onlyNew ? 168 : 120, H = onlyNew ? 210 : 150;
const svgBox = (svg: string) =>
  `<svg viewBox="0 0 120 150" width="${W}" height="${H}"><defs>${DEFS}</defs>${svg}</svg>`;

const cells = ids.map((id) => {
  let svg: string;
  try { svg = propSvg(id); } catch { svg = `<text x="10" y="80" fill="red">ERR</text>`; }
  return `<figure class="${NEW.has(id) ? 'neuf' : ''}">${svgBox(svg)}<figcaption>${id}${NEW.has(id) ? ' ✦' : ''}</figcaption></figure>`;
}).join('\n');

// Props DIRECTIONNELS : trois vues brutes (face/profil/dos) côte à côte, comme head-views/tenue-views.
// La machinerie (`propSvg`) sélectionne la vue + le miroir selon `dir`/`camRot` ; ici on rend l'art brut.
const directional = all.filter((id) => PROPS[id].views);
const VIEWS: View[] = ['front', 'profile', 'back'];
const dirRows = directional.map((id) => {
  const cells3 = VIEWS.map((v) => {
    let svg = propViewSvg(id, v) ?? '';
    if (!svg) svg = `<text x="10" y="80" fill="red">—</text>`;
    return `<figure>${svgBox(svg)}<figcaption>${v}</figcaption></figure>`;
  }).join('');
  return `<div class="dir-row"><div class="dir-name">${id}</div><div class="grid">${cells3}</div></div>`;
}).join('\n');

const html = `<!doctype html><meta charset="utf8"><title>QC décors</title><style>
body{margin:0;background:#2a2620;color:#cfc8ba;font:13px system-ui;padding:16px}
h1{font-size:15px;color:#e8dcc0}
h2{font-size:14px;color:#e8dcc0;margin-top:22px}
.grid{display:flex;flex-wrap:wrap;gap:10px}
figure{margin:0;background:#5a513f;border-radius:6px;padding:4px;width:${W + 8}px;text-align:center}
figure.neuf{outline:2px solid #d8a93b;background:#4a4534}
figcaption{font-size:13px;margin-top:2px;color:#e0d8c2}
svg{display:block;background:linear-gradient(#7a6a4a,#5a4d35);border-radius:4px}
.dir-row{display:flex;align-items:center;gap:12px;margin:6px 0;border-bottom:1px solid #3a352a;padding-bottom:6px}
.dir-name{width:150px;color:#e8dcc0}
</style>
<h1>Planche décors — ${ids.length} props (✦ = ${NEW.size} nouveaux)</h1>
<div class="grid">${cells}</div>
${directional.length ? `<h2>Props directionnels — 3 vues (face / profil / dos)</h2>${dirRows}` : ''}
<style>${anim}</style>`;

writeFileSync(join(ROOT, 'public/qc-decor.html'), html, 'utf8');
console.log(`QC décor écrit : public/qc-decor.html (${ids.length} props)`);
