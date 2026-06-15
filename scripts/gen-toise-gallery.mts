/**
 * Galerie TOISE — l'échelle FINALE en jeu de chaque créature (art speciesScale × Taille
 * sizeTokenScale), pieds au sol, avec un HUMAIN de référence en filigrane dans chaque cellule.
 * C'est le juge du calibrage des échelles : un cheval (Grande) ne doit pas faire 3 humains.
 * Les cellules sont rendues au pixel de l'échelle finale (cellules grandes = créatures grandes),
 * groupées par catégorie de Taille (LDB 85), triées par échelle croissante.
 * Lancer : npx tsx scripts/gen-toise-gallery.mts → public/toise-gallery.html
 */
import { writeFileSync } from 'node:fs';
import { resolveRig, type ResolvedBone } from '../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { DEFS } from '../src/gameIso/sprites';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { planById, bodyPlanOf, resolveByName, type BodyPlanId } from '../src/gameIso/rig/bodyPlan';
import { sizeTokenScale } from '../src/gameIso/sizeScale';
import { parseSizeLabel, SIZE_LABEL, SIZE_ORDER, type SizeCategory } from '../src/engine/size';
import { creatures } from '../src/data/index';

/** Taille du statbloc (trait « Taille (X) », plage → borne haute), défaut Moyenne. */
function sizeOf(traits: string[] | undefined): SizeCategory {
  for (const t of traits ?? []) {
    const m = t.match(/^Taille\s*\(([^)]+)\)/i);
    if (m) { const s = parseSizeLabel(m[1]); if (s) return s; }
  }
  return 'moyenne';
}

/** Os STATIQUES (repos) d'une créature — bipède de face (rig), gabarit en profil. */
function restBones(name: string): ResolvedBone[] {
  const planId = bodyPlanOf(name);
  if (planId !== 'monolithic' && planId !== 'biped') {
    const plan = planById(planId as BodyPlanId);
    const species = resolveByName(name).species;
    return plan.resolve(species, 'profile', plan.restPose(), {});
  }
  const prof = entityRigProfile(name, 7);
  if (!prof) return [];
  return resolveRig(prof.appearance, prof.equip, {}, prof.tenue, 'front', []);
}

const HUMAN_REF = bonesToSvg(restBones('Humain'));

function cell(name: string, k: number, size: SizeCategory): string {
  const svgBody = bonesToSvg(restBones(name));
  const W = Math.max(126, Math.ceil(120 * k) + 6);
  const H = Math.ceil(150 * k) + 6;
  // pieds au sol (bas de cellule) : l'humain de réf (k=1) et la créature partagent la ligne.
  return `<figure style="margin:0;text-align:center">
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="background:#171b26">
      <g transform="translate(${(W - 120) / 2},${H - 6 - 150})" opacity="0.22">${HUMAN_REF}</g>
      <g transform="translate(${(W - 120 * k) / 2},${H - 6 - 150 * k}) scale(${+k.toFixed(3)})">${svgBody}</g>
      <line x1="0" y1="${H - 5}" x2="${W}" y2="${H - 5}" stroke="#3a4256" stroke-width="2"/>
    </svg>
    <figcaption style="color:#cdd;font:11px sans-serif;max-width:${W}px">${name}<br><span style="color:#7e8aa0">×${k.toFixed(2)}</span></figcaption></figure>`;
}

interface Row { name: string; size: SizeCategory; k: number }
const rows: Row[] = [];
const seen = new Set<string>();
for (const c of creatures) {
  if (seen.has(c.label)) continue;
  seen.add(c.label);
  const size = sizeOf(c.traits);
  const art = resolveByName(c.label).scale;
  rows.push({ name: c.label, size, k: art * sizeTokenScale(size) });
}
// Espèces jouables (référence intra-Moyenne : elfe > humain > nain…).
for (const sp of ['Humain', 'Elfe', 'Nain', 'Halfling', 'Gnome']) {
  if (!seen.has(sp)) rows.push({ name: sp, size: 'moyenne', k: resolveByName(sp).scale });
}

const CATS = Object.keys(SIZE_ORDER) as SizeCategory[];
const sections = CATS.map((cat) => {
  const list = rows.filter((r) => r.size === cat).sort((a, b) => a.k - b.k);
  if (!list.length) return '';
  return `<h2 style="color:#d8a93b;font:15px sans-serif;margin:24px 0 8px">${SIZE_LABEL[cat]} — ×${sizeTokenScale(cat)} <span style="color:#7e8aa0;font-size:12px">(${list.length})</span></h2>
  <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">${list.map((r) => cell(r.name, r.k, r.size)).join('')}</div>`;
}).join('');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Toise — échelles en jeu</title></head>
<body style="background:#11141c;padding:18px;margin:0">
<svg width="0" height="0"><defs>${DEFS}</defs></svg>
<a href="galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif;margin:10px 0 2px">Toise — échelle FINALE en jeu (art × Taille), pieds au sol</h1>
<p style="color:#9ab;font:12px sans-serif;margin:0 0 6px">Chaque cellule : la créature à son échelle de rendu réelle, l'humain de référence (×1) en filigrane. Les cellules sont à l'échelle ENTRE elles.</p>
${sections}
</body></html>`;
writeFileSync('public/toise-gallery.html', html);
console.log(`OK: public/toise-gallery.html (${rows.length} entrées)`);
