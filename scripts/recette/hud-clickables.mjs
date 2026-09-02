#!/usr/bin/env node
// CLI de preuve navigateur : le HUD RESTE CLIQUABLE aux largeurs étroites. Promotion en test des
// sondes qui ont trouvé les défauts du lot #1135 — une surface du HUD peut en recouvrir une autre
// sans qu'aucun test de rendu ne bronche (les cliquets CSS lisent des déclarations, pas des pixels).
// Voir docs/recette-navigateur.md § « Preuve headless (agents) ».
//
// Usage :
//   node scripts/recette/hud-clickables.mjs
//   node scripts/recette/hud-clickables.mjs --widths 700,560,360
//   node scripts/recette/hud-clickables.mjs --url <autre serveur>   # défaut : le port de CET arbre
//
// Sans `--url`, la cible est le serveur de DEV de cet arbre (`DEFAULT_URL`, scripts/port-dev.mjs) ;
// une preview (`npm run preview`) a son propre port, imprimé à son lancement.
//
// Ce qui est VÉRIFIÉ, à chaque largeur, par `elementFromPoint` au centre de chaque surface :
//   · chaque `.vc-btn` (commandes de vue) reçoit SON propre clic — rien ne le recouvre ;
//   · en combat, la console (`.combat-console`) est MONTÉE, peuplée, et chacune de ses cases
//     (`.cc-cell`) reçoit son propre clic ;
//   · en combat, `.combat-feed` et `.initiative-strip` n'ont aucune surface commune ;
//   · en combat, la piste `.is-tiles` DÉFILE (scrollWidth > clientWidth) et tient dans sa bande ;
//   · en exploration, la boîte pleine ligne de `.objective-banner` n'avale aucun clic hors de sa
//     tête : le point sondé à droite de `.objective-head` rend la scène ;
//   · en exploration, chaque portrait du groupe (`.party-dock .ptile`) reçoit son clic — la pile de
//     contexte (haut-gauche) ne mord pas sur le haut-centre, qui appartient au GROUPE.
//
// Sortie : exit 1 au premier défaut (liste complète imprimée), exit 0 si tout passe.
import { openApp, evaluate, setViewport, sleep, clickButtonByText } from './lib.mjs';

// Les trois largeurs étroites (700/560/360) portent les recouvrements ; les deux larges portent la
// zone morte du bandeau d'objectif, dont la boîte n'excède sa tête qu'au-delà de 900px — sonder
// 700/560/360 seuls rendait cette vérification AVEUGLE (marge morte mesurée à 0px).
const DEFAULT_WIDTHS = [1600, 1100, 900, 700, 560, 360];
const HEIGHT = 780;
// Boutons d'avancement d'une cascade d'ouverture de combat, par ordre de préférence : la cascade se
// résout par les VRAIS boutons (jamais en forçant l'état), comme un joueur.
const CASCADE_LABELS = ['Tout lancer', 'Commencer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'];

function parseArgs(argv) {
  const out = { url: undefined, widths: DEFAULT_WIDTHS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--widths') out.widths = argv[++i].split(',').map((n) => Number(n.trim()));
    else throw new Error(`Option inconnue : ${a}`);
  }
  return out;
}

/** Sonde DOM : mesures + verdicts d'atteignabilité, en UN aller-retour par largeur. */
const PROBE = `(() => {
  const cn = (e) => e ? ((e.className && e.className.baseVal !== undefined ? e.className.baseVal : String(e.className || '')) + ' <' + e.tagName + '>') : 'rien';
  const rectOf = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
  const box = (r) => r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } : null;
  const reaches = (el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { ok: !!(top && (top === el || el.contains(top))), hitBy: cn(top), rect: box(r) };
  };
  const overlap = (a, b) => {
    if (!a || !b) return null;
    const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    return (ox > 0 && oy > 0) ? { ox: +ox.toFixed(1), oy: +oy.toFixed(1) } : null;
  };

  const vcBtns = [...document.querySelectorAll('.vc-btn')].map((b, i) => ({
    i, label: (b.getAttribute('title') || '').trim(), ...reaches(b),
  }));
  const strip = document.querySelector('.initiative-strip');
  const tiles = document.querySelector('.is-tiles');
  const ptiles = [...document.querySelectorAll('.party-dock .ptile')].map((p, i) => ({ i, ...reaches(p) }));
  // Console de combat (pont du tour) : chacune de ses cases se sonde comme une commande de vue.
  // (Aucun accent grave dans cette sonde : elle vit dans un gabarit de chaîne.)
  const pont = document.querySelector('.combat-console');
  const dockBtns = [...document.querySelectorAll('.combat-console button.cc-cell')].map((b, i) => ({
    i, label: (b.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) || (b.getAttribute('title') || '').trim(), ...reaches(b),
  }));

  let objective = null;
  const banner = document.querySelector('.objective-banner');
  const head = document.querySelector('.objective-head');
  if (banner && head) {
    const rb = banner.getBoundingClientRect(), rh = head.getBoundingClientRect();
    // Marge MORTE = ce que la boîte pleine ligne ajoute à droite de la tête. Si elle existe, un point
    // en son milieu doit rendre la SCÈNE, pas la bannière.
    const marge = rb.right - rh.right;
    if (marge > 4) {
      const px = rh.right + marge / 2, py = rb.y + rh.height / 2;
      const top = document.elementFromPoint(px, py);
      objective = { marge: +marge.toFixed(1), sondeA: { x: +px.toFixed(1), y: +py.toFixed(1) },
        avale: !!(top && banner.contains(top)), hitBy: cn(top) };
    } else {
      objective = { marge: +marge.toFixed(1), avale: false, hitBy: 'boîte au ras de la tête (aucune marge morte)' };
    }
  }

  return {
    largeur: window.innerWidth,
    combat: !!strip,
    vcBtns,
    portraits: ptiles,
    objectif: objective,
    feedXfrise: overlap(rectOf('.combat-feed'), rectOf('.initiative-strip')),
    piste: tiles && strip ? {
      scrollWidth: tiles.scrollWidth, clientWidth: tiles.clientWidth, bande: strip.clientWidth,
      defile: tiles.scrollWidth > tiles.clientWidth, tientDansLaBande: tiles.clientWidth <= strip.clientWidth,
    } : null,
    dock: pont ? { rect: box(pont.getBoundingClientRect()) } : null,
    dockBtns,
  };
})()`;

/** Résout toute fenêtre ouverte par ses VRAIS boutons (cascade d'ouverture, bilan de round…). */
async function resoudreModales(session, etape) {
  for (let i = 0; i < 40; i++) {
    if (!(await evaluate(session, `!!document.querySelector('.modal-overlay')`))) return;
    const textes = await evaluate(session, `[...document.querySelectorAll('.modal-overlay button:not(:disabled)')].map((b) => b.textContent.trim()).filter(Boolean).join(' | ')`);
    const label = CASCADE_LABELS.find((l) => textes.includes(l));
    if (!label) throw new Error(`[${etape}] fenêtre bloquée, aucun bouton d'avancement connu parmi : ${textes}`);
    await clickButtonByText(session, label);
    await sleep(600);
  }
  throw new Error(`[${etape}] les fenêtres ne se referment pas après 40 avancements`);
}

/**
 * Amène le combat jusqu'aux CASES du tour d'un héros (`.combat-console button.cc-cell`). Pendant la
 * pause d'initiative de début de Round, le pont ne porte que le bandeau de phase et son bouton
 * « Commencer … » (`.cc-phase [data-action='round-start']`, `src/ui/CombatConsole.tsx`), qui n'est PAS
 * dans une fenêtre : `resoudreModales` ne le voit pas, et `fastForward` ne le franchit pas. Sans ce
 * clic la sonde mesurait la phase (un bouton) au lieu du pont de tour — elle ne pouvait constater
 * aucun recouvrement des cases.
 */
async function monterLeDock(session) {
  for (let i = 0; i < 8; i++) {
    if (await evaluate(session, `!!document.querySelector('.combat-console button.cc-cell')`)) return;
    if (await evaluate(session, `!!document.querySelector(".cc-phase [data-action='round-start']:not(:disabled)")`)) {
      await clickButtonByText(session, 'Commencer');
      await sleep(900);
      await resoudreModales(session, 'ouverture de Round');
      continue;
    }
    await evaluate(session, `window.__wfrp.fastForward()`);
    await sleep(1200);
    await resoudreModales(session, 'tours IA');
  }
  throw new Error('la console (.combat-console .cc-cell) ne monte pas : le combat ne parvient pas au tour d’un héros');
}

/** Défauts d'une mesure, en clair (liste vide = tout passe). */
function defauts(m, phase) {
  const out = [];
  if (!m.vcBtns.length) out.push(`${phase} ${m.largeur}px : aucune commande de vue dans le DOM (.vc-btn) — sonde aveugle`);
  for (const b of m.vcBtns) {
    if (!b.ok) out.push(`${phase} ${m.largeur}px : la commande de vue « ${b.label} » ${JSON.stringify(b.rect)} ne reçoit pas son clic — recouverte par ${b.hitBy}`);
  }
  if (m.combat) {
    // La console doit être MONTÉE et peuplée : sans elle la sonde mesure le bandeau de phase (un seul
    // bouton) et ne voit aucun des recouvrements du pont de tour.
    if (!m.dock) out.push(`${phase} ${m.largeur}px : aucune console (.combat-console) — sonde aveugle sur le pont de tour`);
    else if (!m.dockBtns.length) out.push(`${phase} ${m.largeur}px : la console ne porte aucune case — sonde aveugle`);
    for (const b of m.dockBtns) {
      if (!b.ok) out.push(`${phase} ${m.largeur}px : la case « ${b.label} » ${JSON.stringify(b.rect)} ne reçoit pas son clic — recouverte par ${b.hitBy}`);
    }
    if (m.feedXfrise) out.push(`${phase} ${m.largeur}px : le fil d'événements recouvre la frise d'initiative de ${m.feedXfrise.ox}×${m.feedXfrise.oy}px`);
    if (m.piste) {
      if (!m.piste.tientDansLaBande) out.push(`${phase} ${m.largeur}px : la piste d'initiative (${m.piste.clientWidth}px) déborde de sa bande (${m.piste.bande}px) — overflow-x ne mord pas`);
      // Le défilement n'est EXIGÉ que si le contenu excède la bande : en colonne latérale (largeurs
      // larges) la piste tient d'un bloc, et l'exiger partout rendrait le verdict faux.
      if (m.piste.scrollWidth > m.piste.bande && !m.piste.defile) out.push(`${phase} ${m.largeur}px : la piste d'initiative ne défile pas (scrollWidth ${m.piste.scrollWidth} ≤ clientWidth ${m.piste.clientWidth}) — des combattants sont hors d'atteinte`);
    }
  } else {
    if (!m.objectif) out.push(`${phase} ${m.largeur}px : aucun bandeau d'objectif — sonde aveugle sur la zone morte`);
    else if (m.objectif.avale) out.push(`${phase} ${m.largeur}px : ${m.objectif.marge}px de carte à droite de l'objectif avalent les clics (${m.objectif.hitBy})`);
    if (!m.portraits.length) out.push(`${phase} ${m.largeur}px : aucun portrait de groupe — sonde aveugle`);
    for (const p of m.portraits) {
      if (!p.ok) out.push(`${phase} ${m.largeur}px : le portrait ${p.i} du groupe ne reçoit pas son clic — recouvert par ${p.hitBy}`);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await openApp(args.url);
  const echecs = [];
  try {
    // ── Exploration ────────────────────────────────────────────────────────────────────────────
    await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
    await sleep(1500);
    await resoudreModales(session, 'ouverture');
    // Un objectif courant : c'est ce qu'un effet de scène pose (`combatEffects.ts`, op `objective`).
    // Le scénario de test n'en porte pas — sans lui la zone morte du bandeau n'est pas sondable.
    await evaluate(session, `window.__wfrp.store.setState({ objectives: [{ id: 'recette-hud', text: 'Retrouver la piste des mutants dans les collines' }] })`);
    await sleep(400);
    await resoudreModales(session, 'pose objectif');

    for (const w of args.widths) {
      await setViewport(session, w, HEIGHT);
      await sleep(500);
      const m = await evaluate(session, PROBE);
      if (m.combat) throw new Error(`exploration ${w}px : la frise d'initiative est montée — l'app n'est pas en exploration`);
      const d = defauts(m, 'exploration');
      console.log(`exploration ${w}px — ${m.vcBtns.length} commande(s) de vue, ${m.portraits.length} portrait(s), marge morte objectif ${m.objectif ? m.objectif.marge + 'px' : 'n/a'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      echecs.push(...d);
    }

    // ── Combat ─────────────────────────────────────────────────────────────────────────────────
    await setViewport(session, 1600, 900);
    await sleep(300);
    await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
    await sleep(1500);
    await resoudreModales(session, 'ouverture de combat');
    await monterLeDock(session);

    for (const w of args.widths) {
      await setViewport(session, w, HEIGHT);
      await sleep(600);
      const m = await evaluate(session, PROBE);
      if (!m.combat) throw new Error(`combat ${w}px : aucune frise d'initiative — le combat n'est pas monté`);
      const d = defauts(m, 'combat');
      console.log(`combat ${w}px — ${m.vcBtns.length} commande(s) de vue, dock ${m.dock ? m.dock.rect.h + 'px de haut / ' + m.dockBtns.length + ' contrôle(s)' : 'ABSENT'}, piste ${m.piste.clientWidth}/${m.piste.scrollWidth}px dans une bande de ${m.piste.bande}px, chevauchement fil×frise ${m.feedXfrise ? m.feedXfrise.ox + '×' + m.feedXfrise.oy + 'px' : 'aucun'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      echecs.push(...d);
    }
  } finally {
    await session.close();
  }

  if (echecs.length) {
    console.error(`\n${echecs.length} défaut(s) d'atteignabilité du HUD :`);
    for (const e of echecs) console.error(`  · ${e}`);
    process.exit(1);
  }
  console.log('\nHUD atteignable à toutes les largeurs sondées.');
}

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
