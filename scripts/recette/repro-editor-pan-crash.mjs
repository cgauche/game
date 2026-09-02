#!/usr/bin/env node
// Recette navigateur — pan répété/rapide (clic-milieu + glisser) sur l'éditeur avec La Diligence
// chargée : 0 erreur console attendue, l'Editor ne doit JAMAIS se démonter (SceneErrorBoundary).
//
// Usage : node scripts/recette/repro-editor-pan-crash.mjs [--url <url>]
import { openApp, gotoScreen, evaluate, waitFor, sleep, consoleGuard } from './lib.mjs';

function parseArgs(argv) {
  const out = { url: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') out.url = argv[++i];
  }
  return out;
}

/** Clique le bouton « Ouvrir » de la RANGÉE dont le texte contient `needle` (scope le clic — un
 *  `clickButtonByText('Ouvrir')` nu attraperait la 1re rangée de la modale, pas forcément la bonne). */
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

/** Un pan clic-milieu + glisser, RAPIDE (aucun délai entre down/move/up) — la fenêtre de course du
 *  crash diagnostiqué (panRef remis à `null` par pointerUp pendant qu'un setView différé le lit). */
async function fastPan(session, x0, y0, x1, y1) {
  await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'middle', buttons: 4 });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (x0 + x1) / 2, y: (y0 + y1) / 2, button: 'middle', buttons: 4 });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1, button: 'middle', buttons: 4 });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'middle' });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await openApp(args.url ?? undefined, { width: 1600, height: 950 });
  try {
    const guard = consoleGuard(session);

    await gotoScreen(session, 'editor');
    await waitFor(session, `!!document.querySelector('svg.editor-iso')`);

    // Charge le scénario « La Diligence — exploration » (scènes/test-scenarios/diligence.ts) dans
    // l'éditeur (Fichier → Ouvrir → Scénarios de test → La Diligence), remplaçant la scène par défaut.
    await clickButtonText(session, 'Fichier');
    await sleep(150);
    await clickButtonText(session, 'Ouvrir');
    await waitFor(session, `!!document.querySelector('.listrow')`);
    await clickRowOuvrir(session, 'La Diligence');
    await waitFor(session, `!!document.querySelector('svg.editor-iso') && !document.querySelector('.wide')`);
    await sleep(300);

    console.log('scène chargée :', await evaluate(session, `document.querySelector('h2[title]')?.getAttribute('title')`));

    // Pan répété/rapide : 20 allers-retours clic-milieu + glisser sur des points variés du canvas.
    const N = 20;
    for (let i = 0; i < N; i++) {
      const x0 = 500 + (i % 5) * 40;
      const y0 = 400 + (i % 3) * 30;
      const x1 = x0 + (i % 2 === 0 ? 180 : -140);
      const y1 = y0 + (i % 2 === 0 ? -90 : 110);
      await fastPan(session, x0, y0, x1, y1);
    }
    await sleep(300);

    const editorAlive = await evaluate(session, `!!document.querySelector('svg.editor-iso')`);
    const crashed = await evaluate(session, `!!document.querySelector('.scene-error-boundary')`);
    console.log(`Editor toujours monté : ${editorAlive} | panneau de crash affiché : ${crashed}`);

    const errors = guard.errors();
    if (errors.length) {
      console.error(`console — ${errors.length} erreur(s)/exception(s) :`);
      for (const e of errors) console.error(`  [${e.type}] ${e.text}`);
    } else {
      console.log('console — 0 erreur');
    }

    if (!editorAlive || crashed || errors.length) {
      process.exitCode = 1;
    } else {
      console.log(`OK — ${N} pans rapides, Editor monté, console propre.`);
    }
  } finally {
    await session.close();
  }
}

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
