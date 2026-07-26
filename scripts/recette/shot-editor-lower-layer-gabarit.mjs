#!/usr/bin/env node
// Recette navigateur — gabarit ÉDITEUR de couche inférieure (#830 suite, opacité réglable) :
// ouvre l'éditeur, charge « La Diligence — exploration », passe en Couche 1 (vue plan par défaut),
// capture au réglage par défaut puis aux deux extrêmes du curseur d'opacité du gabarit.
//
// Usage : node scripts/recette/shot-editor-lower-layer-gabarit.mjs [--url http://localhost:5173/] [--out dir]
import { openApp, gotoScreen, evaluate, waitFor, sleep, consoleGuard, shot } from './lib.mjs';

function parseArgs(argv) {
  const out = { url: undefined, out: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') out.url = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
}

async function clickRowOuvrir(session, needle) {
  const rect = await evaluate(session, `(() => {
    const rows = Array.from(document.querySelectorAll('.listrow'));
    const row = rows.find((r) => (r.textContent || '').includes(${JSON.stringify(needle)}));
    if (!row) return null;
    row.scrollIntoView({ block: 'center' });
    const btn = Array.from(row.querySelectorAll('button')).find((b) => (b.textContent || '').includes('Ouvrir'));
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error(`clickRowOuvrir : rangée/bouton introuvable pour « ${needle} »`);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
}

async function clickButtonText(session, texte) {
  const rect = await evaluate(session, `(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const el = Array.from(document.querySelectorAll('button')).find((b) => norm(b.textContent).includes(${JSON.stringify(texte)}));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error(`clickButtonText : aucun bouton ne matche « ${texte} »`);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
}

/** Fixe la valeur du curseur `input.ed-subfield input[type=range]` (le gabarit, seul range de la
 *  barre d'étages) en dispatchant `input`+`change` — React écoute `onChange`. */
async function setGabaritSlider(session, pct) {
  await evaluate(session, `(() => {
    const input = document.querySelector('.ed-level-bar .ed-subfield input[type="range"]');
    if (!input) throw new Error('curseur du gabarit introuvable');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(${pct}));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await openApp(args.url ?? undefined, { width: 1600, height: 950 });
  try {
    const guard = consoleGuard(session);

    await gotoScreen(session, 'editor');
    await waitFor(session, `!!document.querySelector('svg.editor-iso')`);

    await clickButtonText(session, 'Fichier');
    await sleep(150);
    await clickButtonText(session, 'Ouvrir');
    await waitFor(session, `!!document.querySelector('.listrow')`);
    await clickRowOuvrir(session, 'La Diligence');
    await waitFor(session, `!!document.querySelector('svg.editor-iso') && !document.querySelector('.wide')`);
    // Tracé réel dessiné (pas une carte vide) — attendre le nombre de formes, jamais un délai fixe.
    await waitFor(session, `document.querySelectorAll('svg.editor-iso path, svg.editor-iso polygon').length > 200`, { timeoutMs: 10000 });

    // Couche 1 (bouton ▲ « Couche supérieure ») — scopé à `.ed-level-bar` (CrewPicker réutilise le
    // même glyphe ailleurs dans l'éditeur, jamais monté ici sans sélection de véhicule).
    const layerBtn = await evaluate(session, `(() => {
      const btn = Array.from(document.querySelectorAll('.ed-level-bar button')).find((b) => b.title === 'Couche supérieure');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    if (!layerBtn) throw new Error('bouton « Couche supérieure » introuvable');
    await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: layerBtn.x, y: layerBtn.y, button: 'left', clickCount: 1 });
    await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: layerBtn.x, y: layerBtn.y, button: 'left', clickCount: 1 });
    await waitFor(session, `document.querySelector('.ed-level-z')?.textContent?.includes('Couche 1')`);
    console.log('couche active :', await evaluate(session, `document.querySelector('.ed-level-z')?.textContent`));
    await sleep(200);

    const shapeCount = await evaluate(session, `document.querySelectorAll('svg.editor-iso path, svg.editor-iso polygon').length`);
    console.log('formes SVG dessinées (Couche 1) :', shapeCount);
    if (!shapeCount) throw new Error('capture vide — aucune forme dessinée en Couche 1');

    // 1) Réglage par DÉFAUT du curseur.
    const defaultPct = await evaluate(session, `document.querySelector('.ed-level-bar .ed-subfield input[type="range"]')?.value`);
    console.log('gabarit — valeur par défaut du curseur :', defaultPct);
    await shot(session, 'editor-couche1-gabarit-defaut', args.out);

    // 2) Extrême BAS (0 = masqué).
    await setGabaritSlider(session, 0);
    await sleep(150);
    await shot(session, 'editor-couche1-gabarit-min', args.out);

    // 3) Extrême HAUT (100 = plein).
    await setGabaritSlider(session, 100);
    await sleep(150);
    await shot(session, 'editor-couche1-gabarit-max', args.out);

    const errors = guard.errors();
    if (errors.length) {
      console.error(`console — ${errors.length} erreur(s)/exception(s) :`);
      for (const e of errors) console.error(`  [${e.type}] ${e.text}`);
      process.exitCode = 1;
    } else {
      console.log('console — 0 erreur');
    }
  } finally {
    await session.close();
  }
}

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
