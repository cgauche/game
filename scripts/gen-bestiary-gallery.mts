/**
 * Galerie BESTIAIRE — rendu RÉEL en jeu (rig) de chaque créature de la data, par le MÊME
 * chemin que l'IsoStage : gabarit non-bipède (quadrupède / ailé / serpentin / arachnide /
 * aviaire / céphalopode / spectral / squig / amorphe / jabberslythe) via `planStaticSvg`,
 * sinon rig humanoïde via `entityRigProfile`. Une entrée par créature, groupée par plan
 * corporel. Remplace les anciennes planches monolithiques périmées (sprites-gallery /
 * bestiary-views), figées depuis la migration vers les gabarits.
 * Lancer : npx tsx scripts/gen-bestiary-gallery.mts → public/bestiary-gallery.html
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { entityRigProfile, classifyEnemy } from '../src/gameIso/rig/enemyProfile';
import { planStaticSvg } from '../src/gameIso/rig/bodyPlan';
import { creatureMatch, creatureSpeciesScale } from '../src/gameIso/rig/creatures';
import { creatures } from '../src/data/index';

const PLAN_LABEL: Record<string, string> = {
  biped: 'Humanoïdes (rig)',
  quadruped: 'Quadrupèdes',
  winged: 'Ailés',
  serpentine: 'Serpentins',
  arachnid: 'Arachnides',
  avian: 'Volatiles',
  cephalopod: 'Céphalopodes',
  spectral: 'Spectraux / éthérés',
  squig: 'Squigs',
  amorphous: 'Amorphes',
  jabberslythe: 'Jabberslythe',
};
const PLAN_ORDER = ['biped', 'quadruped', 'winged', 'serpentine', 'arachnid', 'avian', 'cephalopod', 'spectral', 'squig', 'amorphous', 'jabberslythe'];

const planOf = (name: string): string => (classifyEnemy(name) === 'rig' ? 'biped' : creatureMatch(name)?.plan ?? 'biped');

/** Art d'une créature, exactement comme l'IsoStage le résout (non-bipède rigué, sinon rig humanoïde). */
function art(name: string): string {
  const rigged = planStaticSvg(name, 'front');
  if (rigged) return rigged;
  const p = entityRigProfile(name, 7);
  if (p) return renderToStaticMarkup(React.createElement(RigSprite, { appearance: p.appearance, equip: p.equip, career: p.career, overlays: p.overlays }));
  return '<text x="60" y="80" text-anchor="middle" fill="#a55" font-size="9">— sans rendu —</text>';
}

function cell(name: string): string {
  // Recentre/échelle selon la taille d'espèce (Dragon/Géant grands, rat/oiseau petits) — comme en jeu.
  const sc = creatureSpeciesScale(name);
  const z = sc > 1 ? +(1 / sc).toFixed(2) : 1;
  const g = z !== 1 ? `<g transform="translate(60,75) scale(${z}) translate(-60,-75)">${art(name)}</g>` : art(name);
  const svg = `<svg viewBox="0 0 120 150" width="116" height="145"><defs>${DEFS}</defs><rect width="120" height="150" fill="#171b26"/>${g}</svg>`;
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#cdd;font:11px sans-serif">${name}</figcaption></figure>`;
}

const groups = new Map<string, string[]>();
for (const c of creatures) {
  const p = planOf(c.label);
  (groups.get(p) ?? groups.set(p, []).get(p)!).push(c.label);
}
const sections = PLAN_ORDER.filter((p) => groups.has(p))
  .map((p) => {
    const names = groups.get(p)!;
    const cells = names.map(cell).join('');
    return `<h2 style="color:#d8a93b;font:15px sans-serif;margin:24px 0 8px">${PLAN_LABEL[p] ?? p} <span style="color:#7e8aa0;font-size:12px">(${names.length})</span></h2>` +
      `<div style="display:grid;grid-template-columns:repeat(auto-fill,120px);gap:14px">${cells}</div>`;
  })
  .join('');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bestiaire — rendu en jeu</title></head>
<body style="background:#11141c;padding:18px;margin:0">
<a href="galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif;margin:10px 0 2px">Bestiaire — ${creatures.length} créatures, rendu RÉEL en jeu (rig)</h1>
<p style="color:#9ab;font:12px sans-serif;margin:0 0 6px">Chaque créature rendue par le chemin de l'IsoStage : gabarit non-bipède (quad/ailé/serpentin/…) ou rig humanoïde. Fini les sprites monolithiques périmés.</p>
${sections}
</body></html>`;
writeFileSync('public/bestiary-gallery.html', html);
console.log(`OK: public/bestiary-gallery.html (${creatures.length} créatures, ${groups.size} plans)`);
