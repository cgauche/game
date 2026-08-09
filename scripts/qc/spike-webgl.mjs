/**
 * QC — PLANCHES DU SPIKE WebGL (#1160) : pilote l'écran DEV `webglSpike` en headless (kit CDP
 * `scripts/recette/lib.mjs`), capture le CANEVAS (`toDataURL`, d'où `preserveDrawingBuffer`) sur une
 * grille scènes × vues × modes, et assemble une planche-contact qui met chaque rangée WebGL EN VIS-À-VIS
 * de la planche SVG existante (`public/qc/env-<scene>.png`) — la référence de comparaison.
 *
 * Serveur de dev : le kit s'ATTACHE, il ne démarre rien. Ce script vérifie `http://localhost:5173` et,
 * s'il ne répond pas, démarre LUI-MÊME `npm run dev` (arbre de process tué en sortie) ; un serveur déjà
 * lancé par l'utilisateur est réutilisé tel quel et JAMAIS tué.
 *   node scripts/qc/spike-webgl.mjs
 * Sortie : public/qc/spike/<scene>-<vue>-<mode>.png + public/qc/spike-webgl.html
 */
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { openApp, gotoScreen, evaluate, waitFor, consoleGuard, sleep, DEFAULT_URL } from '../recette/lib.mjs';

const OUT_DIR = 'public/qc/spike';
const SHEET = 'public/qc/spike-webgl.html';

/** Scènes-témoins de l'écran (mêmes ids que `SpikeScreen.tsx`) + la planche SVG qui leur fait face. */
const SCENES = [
  { id: 'siege-enceinte', label: 'Siège — enceinte', env: 'env-siege-explore.png', envNote: 'siege-explore (même carte de siège, variante explorable)' },
  { id: 'pont-vitrine', label: 'Pont — vitrine (relief)', env: null, envNote: 'aucune planche env-* (scène hors périmètre de render-env.mts)' },
  { id: 'opera', label: 'Opéra — théâtre', env: 'env-test-opera-theatre.png', envNote: 'test-opera-theatre' },
  { id: 'arene', label: 'Arène (hub)', env: 'env-arene-hub.png', envNote: 'arene-hub' },
  { id: 'vitrine-batiments', label: 'Vitrine — bâtiments', env: 'env-vitrine-batiments.png', envNote: 'vitrine-batiments' },
  { id: 'diligence', label: 'La Diligence (2 niveaux)', env: 'diligence.png', envNote: 'diligence (planche render-diligence.mts : 2 étages × 4 rotations)' },
];

/** Grille de base : 5 vues × 2 modes de matériau, à zoom 1. */
const VUES = [
  { key: 'iso-rot0', label: 'iso rot0', opts: { view: 'iso', rot: 0 } },
  { key: 'iso-rot2', label: 'iso rot2', opts: { view: 'iso', rot: 2 } },
  { key: 'edge-rot0', label: 'edge rot0', opts: { view: 'edge', rot: 0 } },
  { key: 'top', label: 'top', opts: { view: 'top', rot: 0 } },
  { key: 'pov', label: 'POV', opts: { view: 'pov', rot: 0 } },
];
const MODES = [
  { key: 'unlit', label: 'couleur cuite', opts: { lit: false } },
  { key: 'lit', label: 'éclairé (ombres PCF)', opts: { lit: true } },
];

/** DIVERGENCES ASSUMÉES du spike face au backend affine — l'encart de lecture de la planche. */
const DIVERGENCES = [
  'Sols en APLAT : une face = une couleur de matériau (`faceColors`), sans le motif de joints ni les accents seedés du backend affine (matériaux v2).',
  'Aucun dégradé de détail : les nappes/parois ne portent ni pattern ni liseré — la matière se juge à la couleur et à la silhouette.',
  "L'ombrage de FALAISE (assombrissement cuit par orientation) disparaît : en mode éclairé, c'est la lumière directionnelle qui creuse le relief.",
  "Nuit et fenêtres émissives HORS PÉRIMÈTRE : aucune source ponctuelle n'est montée (la planche SVG en porte un panneau, pas le spike).",
  "Art des props limité à 3 vues + miroir (`propSvg`) : le spike ne lève PAS cette contrainte — un billboard reste un dessin, pas un volume.",
  'Animation hors périmètre : aucune pose de marche, aucun `fx` d’ambiance — chaque capture est un arrêt sur image.',
];

// Une session CDP ABANDONNÉE (tentative d'ouverture ratée) laisse ses appels en vol se rejeter APRÈS sa
// fermeture : rejet non capté = process tué. On le TRACE (jamais muet) et on laisse le script continuer.
process.on('unhandledRejection', (e) => console.log(`CDP (session abandonnée) : ${e?.message ?? e}`));

const args = process.argv.slice(2);
const URL = args.find((a) => a.startsWith('http')) ?? DEFAULT_URL;

/** Le serveur répond-il ? */
async function serverUp(url) {
  try {
    const r = await fetch(url);
    return r.ok;
  } catch {
    return false;
  }
}

/** Démarre `npm run dev` si personne ne répond ; rend un `stop()` (no-op si le serveur préexistait). */
async function ensureServer(url) {
  if (await serverUp(url)) {
    console.log(`serveur de dev déjà en écoute sur ${url} — réutilisé (ne sera pas arrêté)`);
    return { stop: () => {} };
  }
  console.log('aucun serveur de dev — démarrage de `npm run dev`…');
  const proc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { stdio: 'ignore', shell: process.platform === 'win32' });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await sleep(500);
    if (await serverUp(url)) break;
  }
  if (!(await serverUp(url))) throw new Error('le serveur de dev démarré n’a jamais répondu (90 s)');
  // PRÉCHAUFFAGE : répondre à `/` ne veut pas dire « prêt ». Demander le module d'entrée force Vite à
  // pré-bundler les dépendances (three, react…) AVANT que Chrome ne charge la page — sans ça, le premier
  // chargement dépasse le délai d'attente du kit et la session avortée fait tomber le script.
  console.log('préchauffage du serveur (pré-bundle des dépendances)…');
  try { await fetch(new URL('/src/main.tsx', url)); } catch {}
  await sleep(2000);
  return {
    stop: () => {
      if (process.platform === 'win32' && proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
      else try { proc.kill(); } catch {}
    },
  };
}

/** Ouvre l'app en tolérant un serveur FROID : au premier chargement, Vite pré-bundle les dépendances
 *  (three compris) — l'app peut dépasser le délai d'attente du kit. Chaque tentative laisse le serveur
 *  plus chaud que la précédente. */
async function openAppTolerant(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await openApp(url);
    } catch (e) {
      last = e;
      console.log(`chargement de l'app raté (tentative ${i + 1}/${tries}) — le serveur chauffe, on réessaie… (${e.message})`);
      await sleep(3000);
    }
  }
  throw last;
}

/** Applique des options au spike et attend la frame rendue, puis capture le canevas. */
async function capture(session, opts, file) {
  await evaluate(session, `window.__spike.set(${JSON.stringify(opts)})`);
  const dataUrl = await evaluate(session, `document.querySelector('canvas').toDataURL('image/png')`);
  if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) throw new Error(`capture vide pour ${file}`);
  const buf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  writeFileSync(`${OUT_DIR}/${file}`, buf);
  return { file, bytes: buf.length };
}

function figure(file, legende) {
  return `<figure class="shot"><a href="spike/${file}"><img src="spike/${file}" alt="${legende}"></a><figcaption>${legende}</figcaption></figure>`;
}

function sheetHtml(shots, creature) {
  const sections = SCENES.map((scn) => {
    const mine = shots.filter((s) => s.scene === scn.id);
    const rows = MODES.map((mode) => {
      const cells = mine.filter((s) => s.mode === mode.key).map((s) => figure(s.file, s.label)).join('');
      return `<h3>${mode.label}</h3><div class="row">${cells}</div>`;
    }).join('');
    const extra = mine.filter((s) => s.extra);
    const extraRow = extra.length
      ? `<h3>rotations complètes (iso, couleur cuite)</h3><div class="row">${extra.map((s) => figure(s.file, s.label)).join('')}</div>`
      : '';
    const libre = mine.filter((s) => s.libre);
    const libreRow = libre.length
      ? `<h3>lacet libre (iso, couleur cuite — hors cran, aucune référence SVG en face)</h3><div class="row">${libre.map((s) => figure(s.file, s.label)).join('')}</div>`
      : '';
    const ref = scn.env && existsSync(`public/qc/${scn.env}`)
      ? `<div class="row"><figure class="shot ref"><a href="${scn.env}"><img src="${scn.env}" alt="${scn.env}"></a><figcaption>RÉFÉRENCE SVG — ${scn.envNote}</figcaption></figure></div>`
      : `<p class="note">RÉFÉRENCE SVG : ${scn.envNote}.</p>`;
    return `<section><h2>${scn.label} <span class="id">${scn.id}</span></h2>${rows}${extraRow}${libreRow}${ref}</section>`;
  }).join('');

  const creatureRow = `<section><h2>Planche CRÉATURE <span class="id">siege-enceinte, cadrage personnage</span></h2>` +
    `<p class="note">Le même héros riggé (billboard texturé depuis <code>bonesToSvg</code>) aux trois paliers de zoom, dans les DEUX conventions de taille monde (<code>billboardMath</code>) — l'arbitrage de #1160.</p>` +
    `<div class="row">${creature.map((s) => figure(s.file, s.label)).join('')}</div></section>`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Spike WebGL — planches</title>
<style>
 body { background:#11141c; color:#e8e2d2; font:13px/1.5 sans-serif; padding:16px; }
 h1 { font-size:20px; margin:0 0 4px; }
 h2 { font-size:16px; margin:24px 0 6px; border-bottom:1px solid #2a2f3a; padding-bottom:4px; }
 h3 { font-size:12px; color:#9fb0c8; font-weight:normal; margin:10px 0 4px; text-transform:uppercase; letter-spacing:.06em; }
 .id { color:#7c879a; font-weight:normal; font-size:12px; }
 .row { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-start; }
 .shot { margin:0; }
 .shot img { width:380px; border:1px solid #2a2f3a; background:#14161f; display:block; }
 .shot.ref img { width:780px; }
 figcaption { color:#9fb0c8; font-size:11px; padding-top:3px; }
 .note { color:#9fb0c8; }
 .divergences { border:1px solid #6b5a2a; background:#1b1a14; padding:10px 14px; margin:14px 0; }
 .divergences h2 { border:0; margin:0 0 6px; color:#e8c25a; }
 code { color:#c9b78a; }
</style></head><body>
<h1>Spike WebGL — rendu three vs planches SVG</h1>
<p class="note">Captures du canevas de l'écran DEV <code>webglSpike</code> (1280×720, zoom 1 sauf mention), pilotées par <code>window.__spike.set</code>. Chaque scène est suivie de SA planche de référence SVG (<code>public/qc/env-*.png</code>) — cliquer une image l'ouvre en pleine taille.</p>
<div class="divergences"><h2>Divergences assumées</h2><ul>${DIVERGENCES.map((d) => `<li>${d}</li>`).join('')}</ul></div>
${creatureRow}
${sections}
</body></html>`;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await ensureServer(URL);
  let session = null;
  try {
    session = await openAppTolerant(URL);
    const guard = consoleGuard(session);
    await gotoScreen(session, 'webglSpike', { settleMs: 300 });
    await waitFor(session, `typeof window.__spike?.set === 'function'`, { timeoutMs: 20000 });
    await evaluate(session, `window.__spike.ready`);

    const shots = [];
    for (const scn of SCENES) {
      for (const mode of MODES) {
        for (const vue of VUES) {
          const file = `${scn.id}-${vue.key}-${mode.key}.png`;
          await capture(session, { scene: scn.id, zoom: 1, focus: 'scene', ...vue.opts, ...mode.opts }, file);
          shots.push({ scene: scn.id, mode: mode.key, file, label: `${vue.label} — ${mode.label}` });
        }
      }
    }
    // Rotation ISO complète sur la scène de siège (l'épreuve du tri de profondeur).
    for (const rot of [0, 1, 2, 3]) {
      const file = `siege-enceinte-iso-rot${rot}-unlit.png`;
      await capture(session, { scene: 'siege-enceinte', view: 'iso', rot, zoom: 1, lit: false, focus: 'scene' }, file);
      shots.push({ scene: 'siege-enceinte', mode: 'unlit', extra: true, file, label: `iso rot${rot}` });
    }
    // LACET LIBRE : deux angles HORS cran (le départage de profondeur n'a plus d'ordre de peinture
    // affine à imiter, et l'art de décor tombe sur son cran le plus proche).
    for (const yawDeg of [25, 65]) {
      const file = `siege-enceinte-iso-yaw${yawDeg}-unlit.png`;
      await capture(session, { scene: 'siege-enceinte', view: 'iso', yawDeg, zoom: 1, lit: false, focus: 'scene' }, file);
      shots.push({ scene: 'siege-enceinte', mode: 'unlit', libre: true, file, label: `iso lacet ${yawDeg}°` });
    }
    // Planche CRÉATURE : un héros riggé, 3 zooms × 2 conventions, cadré sur le personnage.
    const creature = [];
    for (const convention of ['heroique', 'metrique']) {
      for (const zoom of [0.4, 1, 2.6]) {
        const file = `creature-${convention}-zoom${String(zoom).replace('.', '_')}.png`;
        await capture(session, { scene: 'siege-enceinte', view: 'iso', rot: 0, lit: false, focus: 'personnage', convention, zoom }, file);
        creature.push({ file, label: `${convention} — zoom ×${zoom}` });
      }
    }

    writeFileSync(SHEET, sheetHtml(shots, creature));
    const errs = guard.errors();
    guard.stop();
    console.log(`OK: ${shots.length + creature.length} PNG dans ${OUT_DIR}/`);
    for (const s of [...shots, ...creature]) console.log(`  ${OUT_DIR}/${s.file}`);
    console.log(`OK: ${SHEET}`);
    if (errs.length) {
      console.error(`CONSOLE: ${errs.length} erreur(s)`);
      for (const e of errs) console.error(`  [${e.type}] ${e.text}`);
      process.exitCode = 1;
    } else {
      console.log('CONSOLE: 0 erreur');
    }
  } finally {
    if (session) await session.close();
    server.stop();
  }
}

await main();
