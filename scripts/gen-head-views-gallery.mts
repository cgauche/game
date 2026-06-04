/**
 * Galerie QC des vues de TÊTE héros (E·7, STAGING) : compose visage+cheveux dans une
 * boîte de tête pour front / profil / dos, à partir de GENERATED_HEADS (front) et
 * headViews.json (généré). Permet de valider AVANT de brancher sur le rendu live.
 * Lancer : npx tsx scripts/gen-head-views-gallery.mts → public/head-views.html
 */
import { writeFileSync } from 'node:fs';
import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';
import headViews from '../src/gameIso/rig/parts/generated/headViews.json';
import { DEFS } from '../src/gameIso/sprites';

const HV = headViews as Record<string, { visage?: { back?: string; profile?: string }; cheveux?: { back?: string; profile?: string } }>;

function headCell(key: string, view: 'front' | 'profile' | 'back') {
  const front = GENERATED_HEADS[key] as { visage?: string; cheveux?: string };
  const v = HV[key];
  const visage = view === 'front' ? front?.visage : v?.visage?.[view] ?? front?.visage;
  const cheveux = view === 'front' ? front?.cheveux : v?.cheveux?.[view] ?? front?.cheveux;
  // boîte de tête : on cadre le repère local de l'os tête (~ x −12..12, y −10..22) agrandi
  const svg =
    `<svg viewBox="-16 -14 32 36" width="80" height="90"><defs>${DEFS}</defs>` +
    `<rect x="-16" y="-14" width="32" height="36" fill="#1b1f2b"/>` +
    `<g>${cheveux ?? ''}${visage ?? ''}</g></svg>`;
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#bcd;font:10px sans-serif">${view}</figcaption></figure>`;
}

const rows = Object.keys(GENERATED_HEADS).map((k) =>
  `<div style="display:flex;align-items:center;gap:10px;margin:5px 0;border-bottom:1px solid #222">
     <div style="width:120px;color:#eee;font:12px sans-serif">${k}${HV[k] ? '' : ' <span style="color:#a55">(pas de vues)</span>'}</div>
     <div style="display:flex;gap:8px">${headCell(k, 'front')}${headCell(k, 'profile')}${headCell(k, 'back')}</div>
   </div>`,
);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Têtes — vues</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Têtes héros — vues dos/profil (E·7, STAGING — à valider)</h1>
<p style="color:#9ab;font:12px sans-serif">Colonnes : face · profil · dos (composent visage+cheveux). Le dos doit être SANS yeux. Si OK → brancher dans cosmetic.ts.</p>
${rows.join('')}
</body></html>`;
writeFileSync('public/head-views.html', html);
console.log(`OK: public/head-views.html (${Object.keys(GENERATED_HEADS).length} têtes × 3 vues)`);
