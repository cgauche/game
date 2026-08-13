/**
 * QC — DIAGNOSTIC D'OCCLUSION headless : prouve que le TRI EN PROFONDEUR (`floorDepth`/`wallDepth`, les
 * MÊMES qu'en jeu) est correct, SANS deviner sur un rendu texturé. Chaque FACE des builders (`buildFloors`/
 * `buildWalls`) est peinte en APLAT CATÉGORISÉ (hauteur/rôle) et triée par sa VRAIE profondeur — donc une
 * inversion se lit d'un coup d'œil : une couleur « basse » (cour/flanc) qui recouvre une couleur « haute »
 * (crête/étage) qu'elle devrait passer DERRIÈRE. Couvre les scènes de référence en iso + edge × 4 rotations.
 *   npx tsx scripts/qc/render-occlusion.mts   (npm run qc:occlusion)
 * Sortie : public/qc/occlusion-<sceneId>.png — 1 planche/scène (8 projections + légende).
 * NB : valide le renderer AFFINE (iso/edge), là où vit le tri per-tuile. Le POV est un renderer séparé
 * (geometry.ts) ; pour lui, `povPanel` de env-panels.ts rend une vue texturée à inspecter à l'œil.
 *
 * CLASSEMENT #1176 C3 — INSTRUMENT DE DIAGNOSTIC des règles d'occlusion du backend AFFINE. Ce qu'il
 * mesure (le tri per-tuile `floorDepth`/`wallDepth`) n'existe que dans ce backend : le monde volumique
 * résout la profondeur au tampon Z. MORT PLANIFIÉE à C5a, avec le backend qu'il diagnostique — le
 * porter serait porter le contournement. Il rend sa planche jusque-là.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { buildFloors } from '../../src/gameIso/builders/floors';
import { buildWalls } from '../../src/gameIso/builders/walls';
import { floorDepth } from '../../src/gameIso/backends/affineFloors';
import { wallDepth } from '../../src/gameIso/backends/affineWalls';
import { projGP } from '../../src/gameIso/backends/project';
import { stageSize, type Rot, type Dims } from '../../src/geometry/iso';
import type { Scene } from '../../src/state/scene';
import type { Face, FloorEl, WallEl } from '../../src/gameIso/builders/types';
import { reliefMaterial } from '../../src/gameIso/catalog/relief';
import { scenario as siege } from '../../src/scenes/test-scenarios/siege-explore';
import { scenario as arene } from '../../src/scenes/test-scenarios/arene';
import { scenario as opera } from '../../src/scenes/test-scenarios/opera';
import { scenario as caveau } from '../../src/scenes/test-scenarios/piege-caveau';

// ── Palette CATÉGORISÉE (documentée par la légende) ─────────────────────────────────────────────────
const C = {
  ground: '#8a8f99',   // sol z0 ~0 m (cour, terrain plat)
  upper: '#2bd0d0',    // dessus d'étage z≥1 (chemin de ronde, tablier)
  wedge: '#b6bac4',    // raccord de terrain (cosmétique, sur le dessus)
  flankNaturel: '#e23b3b', // flanc de relief NATUREL (talus/rampe de terre)
  flankBati: '#3b6be2', // flanc de relief BÂTI (masse de maçonnerie, bord élevé)
  deck: '#17b0a0',     // tablier fin (surplomb)
  pilier: '#444a55',   // pilier de surplomb
  crest: '#ff2bd0',    // MUR : crête/parapet/créneaux/linteau
  opening: '#ff7a1f',  // MUR : herse/porte/embrasure/fenêtre
  wall: '#17b26a',     // MUR : cloison pleine
};

/** Couleur d'une face de SOL : dessus (terrain) par étage/hauteur, flanc (relief) par matériau/rôle. */
function floorColor(f: Face, el: FloorEl): string {
  if (f.material.domain === 'relief') {
    if (f.material.part === 'pilier') return C.pilier;
    if (f.material.part === 'deck') return C.deck;
    return reliefMaterial(f.material.id).built ? C.flankBati : C.flankNaturel;
  }
  if (f.material.part === 'wedge') return C.wedge;
  if (el.cell.z >= 1) return C.upper;
  const h = f.poly[0].h;
  if (h > 0.5) { const g = Math.max(120, Math.min(230, Math.round(120 + h * 22))); return `#ff${g.toString(16).padStart(2, '0')}2b`; } // dessus élevé/rampe (clair = haut)
  return C.ground;
}

const CREST = new Set(['parapet', 'couronnement', 'linteau']);
const OPENING = new Set(['herse-barreau', 'embrasure', 'jambage', 'poteau', 'vantail', 'vantail-planche', 'vitre', 'meneau', 'poignee']);
/** Couleur d'une face de MUR : crête (parapet/créneaux) vs ouverture (herse/porte) vs cloison pleine. */
function wallColor(f: Face): string {
  const p = String(f.material.part ?? '');
  if (CREST.has(p)) return C.crest;
  if (OPENING.has(p)) return C.opening;
  return C.wall;
}

function poly(pts: [number, number][], fill: string, op = 1): string {
  const s = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return `<polygon points="${s}" fill="${fill}"${op < 1 ? ` fill-opacity="${op}"` : ''} stroke="#0a0b10" stroke-width="0.35" stroke-opacity="0.55"/>`;
}

/** Panneau : chaque face en aplat, triée par sa VRAIE profondeur (tri STABLE → ordre intra-tuile préservé).
 *  `activeZ` = étage de la zone active : `maxZ` (défaut) = tout plein ; `0` = VU DU SOL (l'émission des
 *  couches change — un toit de bloc plein vu d'en bas, etc.), là où vivent les bugs de couches. */
function occlusionPanel(scene: Scene, dims: Dims, activeZ: number): { w: number; h: number; svg: string } {
  const objs: { d: number; svg: string }[] = [];
  for (const el of buildFloors(scene, undefined, { activeZ }) as FloorEl[]) {
    const d = floorDepth(el, dims);
    for (const f of el.faces) objs.push({ d, svg: poly(f.poly.map((p) => projGP(p, dims)), floorColor(f, el), f.material.part === 'wedge' ? 0.7 : 1) });
  }
  for (const el of buildWalls(scene, undefined, { activeZ }) as WallEl[]) {
    const d = wallDepth(el, dims);
    for (const f of el.faces) objs.push({ d, svg: poly(f.poly.map((p) => projGP(p, dims)), wallColor(f)) });
  }
  objs.sort((a, b) => a.d - b.d); // stable → à profondeur égale, l'ordre d'émission du builder est conservé
  const st = stageSize(dims);
  return { w: st.w, h: st.h, svg: objs.map((o) => o.svg).join('') };
}

// ── Légende ──────────────────────────────────────────────────────────────────────────────────────
const LEGEND: [string, string][] = [
  [C.ground, 'sol z0 (~0 m)'], [`#ffcc2b`, 'dessus élevé / rampe'], [C.upper, 'dessus d’étage z≥1'],
  [C.flankNaturel, 'flanc naturel (talus)'], [C.flankBati, 'flanc bâti (maçonnerie)'], [C.deck, 'tablier'], [C.pilier, 'pilier'],
  [C.crest, 'MUR crête/créneaux'], [C.opening, 'MUR herse/porte'], [C.wall, 'MUR cloison'], [C.wedge, 'raccord terrain'],
];
function legendSvg(w: number, h: number): string {
  let s = `<rect width="${w}" height="${h}" fill="#14161f"/><text x="14" y="30" fill="#e8e2d2" font-family="sans-serif" font-size="20" font-weight="bold">Légende — occlusion</text>`;
  LEGEND.forEach(([col, lab], i) => {
    const y = 54 + i * 34;
    s += `<rect x="16" y="${y}" width="26" height="26" fill="${col}" stroke="#0a0b10"/><text x="52" y="${y + 19}" fill="#d8d3c4" font-family="sans-serif" font-size="17">${lab}</text>`;
  });
  s += `<text x="14" y="${54 + LEGEND.length * 34 + 24}" fill="#8a8f99" font-family="sans-serif" font-size="14">Inversion = couleur « basse » PAR-DESSUS une « haute ».</text>`;
  return s;
}

// ── Planche contact : iso rot 0-3 · edge rot 0-3 · légende ──────────────────────────────────────────
const CELL_W = 1180, CELL_H = 820, PAD = 10, LABEL_H = 30, HEADER_H = 56, COLS = 3;

function renderSheet(scene: Scene) {
  const rots: Rot[] = [0, 1, 2, 3];
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  const multi = scene.layers.length > 1;
  const panels: { label: string; p: { w: number; h: number; svg: string } }[] = [
    ...rots.map((rot) => ({ label: `iso rot${rot}`, p: occlusionPanel(scene, { ...scene.dimensions, rot }, maxZ) })),
    // VU DU SOL (activeZ=0) : couvre les bugs d'émission des couches (toit de bloc plein à nu, etc.) que la
    // vue pleine masque. Seulement si multi-couches (sinon activeZ=0 ≡ maxZ).
    ...(multi ? rots.map((rot) => ({ label: `iso rot${rot} — vu du sol (z0)`, p: occlusionPanel(scene, { ...scene.dimensions, rot }, 0) })) : []),
    ...rots.map((rot) => ({ label: `edge rot${rot}`, p: occlusionPanel(scene, { ...scene.dimensions, rot, edge: true }, maxZ) })),
  ];
  const total = panels.length + 1; // + légende
  const rows = Math.ceil(total / COLS);
  const W = COLS * CELL_W, H = HEADER_H + rows * CELL_H;
  const cells = panels.map(({ label, p }, idx) => {
    const cx = (idx % COLS) * CELL_W, cy = HEADER_H + Math.floor(idx / COLS) * CELL_H;
    const innerW = CELL_W - 2 * PAD, innerH = CELL_H - 2 * PAD - LABEL_H;
    const s = Math.min(innerW / p.w, innerH / p.h, 1.25);
    const ox = cx + PAD + (innerW - p.w * s) / 2, oy = cy + PAD + (innerH - p.h * s) / 2;
    return (
      `<svg x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${(p.w * s).toFixed(1)}" height="${(p.h * s).toFixed(1)}" viewBox="0 0 ${p.w} ${p.h}" preserveAspectRatio="xMidYMid meet"><rect width="${p.w}" height="${p.h}" fill="#0b0d12"/>${p.svg}</svg>` +
      `<rect x="${cx + 4}" y="${cy + 4}" width="${CELL_W - 8}" height="${CELL_H - 8}" fill="none" stroke="#2a2f3a" stroke-width="2"/>` +
      `<text x="${cx + CELL_W / 2}" y="${cy + CELL_H - 14}" fill="#e8e2d2" font-family="sans-serif" font-size="24" text-anchor="middle">${label}</text>`
    );
  });
  const lgi = panels.length, lcx = (lgi % COLS) * CELL_W, lcy = HEADER_H + Math.floor(lgi / COLS) * CELL_H;
  const legend = `<svg x="${lcx + PAD}" y="${lcy + PAD}" width="${CELL_W - 2 * PAD}" height="${CELL_H - 2 * PAD}">${legendSvg(CELL_W - 2 * PAD, CELL_H - 2 * PAD)}</svg><rect x="${lcx + 4}" y="${lcy + 4}" width="${CELL_W - 8}" height="${CELL_H - 8}" fill="none" stroke="#2a2f3a" stroke-width="2"/>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="#14161f"/>` +
    `<text x="${W / 2}" y="38" fill="#e8e2d2" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle">Occlusion — ${scene.nom} — ${scene.id} (${scene.dimensions.w}×${scene.dimensions.h}, ${scene.layers.length} couche${scene.layers.length > 1 ? 's' : ''})</text>` +
    cells.join('') + legend + `</svg>`;

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } }).render().asPng();
  mkdirSync('public/qc', { recursive: true });
  const file = `public/qc/occlusion-${scene.id}.png`;
  writeFileSync(file, png);
  console.log(`OK: ${file} (${W}×${H})`);
}

for (const scn of [siege, arene, opera, caveau]) renderSheet(scn.scene);
