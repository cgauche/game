#!/usr/bin/env node
// CLI de preuve navigateur : LE PONT DE CONSOLE TIENT SON CONTENU, ET SA BANDE NE BOUGE PAS D'UNE
// FORME À L'AUTRE. Promotion en script de recette des sondes qui ont trouvé les défauts du lot
// « pont continu / forme spectatrice » — aucun test jsdom ne peut les voir : jsdom ne fait pas de
// mise en page, et les cliquets CSS lisent des déclarations, pas des pixels.
// Voir docs/recette-navigateur.md § « Preuve headless (agents) ».
//
// Usage :
//   node scripts/recette/console-pont-formes.mjs
//   node scripts/recette/console-pont-formes.mjs [--url <url>] --widths 900,700
//   node scripts/recette/console-pont-formes.mjs --mesures      (imprime les mesures, aucun verdict)
//
// Ce qui est VÉRIFIÉ, à chaque largeur et dans les TROIS formes de console :
//   · AUCUNE AMPUTATION — `.cc-dock` et chacune de ses régions tiennent dans leur boîte
//     (`scrollHeight <= clientHeight`), et aucun contrôle du pont ne descend sous le bas du champ ;
//   · BANDE STABLE — la hauteur rendue de `.combat-console` est la MÊME dans les trois formes
//     (pont complet du tour du joueur · forme spectatrice du tour adverse · ouverture de combat) ;
//   · BANDEAU D'OUVERTURE — sa boîte ne recouvre ni la bande de groupe, ni la frise d'initiative,
//     ni le fil de combat ;
//   · MÉDAILLON CENTRÉ — son centre tombe sur celui du champ (forme spectatrice).
//
// Sortie : exit 1 au premier défaut (liste complète imprimée), exit 0 si tout passe.
import { openApp, evaluate, setViewport, sleep, clickButtonByText } from './lib.mjs';

/** Largeurs canon de la charte (900 / 700 / 560) plus les deux bureaux. */
const DEFAULT_WIDTHS = [1600, 1100, 900, 800, 700, 560, 360];
const HEIGHT = 800;
// Boutons d'avancement, par ordre de préférence. La mise en place traverse des tours d'IA : une
// modale de DÉFENSE peut s'ouvrir (l'ennemi frappe un héros) — elle se résout par ses vrais boutons,
// comme un joueur, sinon la sonde reste bloquée devant.
const CASCADE_LABELS = ['Tout lancer', 'Commencer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer', 'Parade', 'Esquive', 'Encaisser', 'Subir', 'Renoncer'];

function parseArgs(argv) {
  const out = { url: undefined, widths: DEFAULT_WIDTHS, mesures: false, stress: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--widths') out.widths = argv[++i].split(',').map((n) => Number(n.trim()));
    else if (a === '--mesures') out.mesures = true;
    else if (a === '--stress') out.stress = Number(argv[++i] ?? 105);
    else throw new Error(`Option inconnue : ${a}`);
  }
  return out;
}

/** Sonde DOM : toutes les mesures d'une forme, en UN aller-retour. */
const PROBE = `(() => {
  const box = (r) => r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1), right: +r.right.toFixed(1) } : null;
  const rect = (sel) => { const e = document.querySelector(sel); return e ? box(e.getBoundingClientRect()) : null; };
  const debord = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    return { sel, scroll: e.scrollHeight, client: e.clientHeight, deborde: e.scrollHeight - e.clientHeight };
  };
  const recouvre = (a, b) => {
    if (!a || !b) return null;
    const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    return (ox > 0.5 && oy > 0.5) ? { ox: +ox.toFixed(1), oy: +oy.toFixed(1) } : null;
  };
  const dock = document.querySelector('.cc-dock');
  const pont = document.querySelector('.combat-console');
  const bandeau = rect(".cc-phase[data-phase='ouverture']");
  // CONTRÔLES du pont : tout ce qu'un joueur doit pouvoir viser, plus les textes gravés dont la
  // coupe est un défaut de rendu (nom du porteur, libellés de plaque).
  const controles = [...document.querySelectorAll('.combat-console button, .combat-console .cc-arch-name, .combat-console [data-nom]')].map((e) => {
    const r = e.getBoundingClientRect();
    return { quoi: (e.getAttribute('data-cell') || e.getAttribute('data-action') || e.className || e.tagName).slice(0, 28), rect: box(r) };
  });
  return {
    forme: dock ? dock.getAttribute('data-forme') : null,
    pont: pont ? box(pont.getBoundingClientRect()) : null,
    debords: [debord('.cc-dock'), debord('.cc-bay-left'), debord('.cc-bay-right'), debord('.cc-corner'), debord('.cc-arch')].filter(Boolean),
    bandeau,
    medaillon: rect('[data-medaillon]'),
    groupe: rect('.party-dock'),
    frise: rect('.initiative-strip'),
    fil: rect('.combat-feed'),
    surGroupe: recouvre(bandeau, rect('.party-dock')),
    surFrise: recouvre(bandeau, rect('.initiative-strip')),
    surFil: recouvre(bandeau, rect('.combat-feed')),
    surRail: recouvre(bandeau, rect('.hud-rail')),
    surPont: recouvre(bandeau, rect('.combat-console')),
    arche: (() => {
      const a = document.querySelector('.cc-arch');
      if (!a) return null;
      const cs = getComputedStyle(a);
      const enfants = [...a.children].map((e) => ({ q: (e.className || e.tagName).toString().slice(0, 22), h: +e.getBoundingClientRect().height.toFixed(1) }));
      const portrait = a.querySelector('.ptile');
      return { h: +a.getBoundingClientRect().height.toFixed(1), pad: cs.paddingTop + '/' + cs.paddingBottom, gap: cs.rowGap, enfants, portrait: portrait ? +portrait.getBoundingClientRect().height.toFixed(1) : null };
    })(),
    // Hauteur DÉCLARÉE de la bande, résolue par le moteur (les calc/max/clamp ne se lisent pas au
    // texte) : une boîte témoin qui ne porte QUE cette hauteur.
    deckDeclare: (() => {
      const t = document.createElement('div');
      t.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:var(--cc-deck-h)';
      document.body.appendChild(t);
      const h = +t.getBoundingClientRect().height.toFixed(1);
      t.remove();
      return h;
    })(),
    pontSurFil: recouvre(pont ? box(pont.getBoundingClientRect()) : null, rect('.combat-feed')),
    pontSurFrise: recouvre(pont ? box(pont.getBoundingClientRect()) : null, rect('.initiative-strip')),
    controles,
    champ: box(document.querySelector('.stage').getBoundingClientRect()),
  };
})()`;

async function resoudreModales(session, etape) {
  for (let i = 0; i < 40; i++) {
    if (!(await evaluate(session, `!!document.querySelector('.modal-overlay')`))) return;
    const textes = await evaluate(session, `[...document.querySelectorAll('.modal-overlay button:not(:disabled)')].map((b) => b.textContent.trim()).filter(Boolean).join(' | ')`);
    const label = CASCADE_LABELS.find((l) => textes.includes(l));
    if (!label) throw new Error(`[${etape}] fenêtre bloquée, aucun bouton d'avancement connu parmi : ${textes}`);
    await clickButtonByText(session, label);
    await sleep(500);
  }
  throw new Error(`[${etape}] les fenêtres ne se referment pas après 40 avancements`);
}

/** Amène le combat jusqu'aux CASES du tour d'un héros (le pont COMPLET). */
async function jusquAuTourDuJoueur(session) {
  for (let i = 0; i < 6; i++) {
    await resoudreModales(session, 'mise en place');
    if (await evaluate(session, `!!document.querySelector('.combat-console button.cc-cell')`)) return;
    if (await evaluate(session, `!!document.querySelector(".cc-phase [data-action='round-start']:not(:disabled)")`)) {
      await clickButtonByText(session, 'Commencer');
      await sleep(800);
      await resoudreModales(session, 'ouverture de Round');
      continue;
    }
    await evaluate(session, AU_TOUR_DU_JOUEUR);
    await sleep(600);
  }
  const etat = await evaluate(session, `(() => {
    const s = window.__wfrp.store.getState();
    const b = s.battle;
    const dock = document.querySelector('.cc-dock');
    return JSON.stringify({ over: b && b.over, turn: b && b.turn, forme: dock && dock.getAttribute('data-forme'), pause: !!s.pendingRoundStart, modale: !!document.querySelector('.modal-overlay') });
  })()`);
  throw new Error(`le pont COMPLET ne monte pas : le combat ne parvient pas au tour d’un héros — ${etat}`);
}

/** Force le tour sur un HÉROS de l'ordre — la forme COMPLÈTE. La sonde mesure la MISE EN PAGE des
 *  trois formes : le tour se pose par le store, comme celui de l'adversaire, plutôt que de dépendre
 *  du hasard des tours d'IA (le déroulé du combat, lui, est couvert par `hud-clickables.mjs`). */
const AU_TOUR_DU_JOUEUR = `(() => {
  const s = window.__wfrp.store.getState();
  const b = s.battle;
  const i = b.order.findIndex((id) => (b.combatants.find((c) => c.id === id) || {}).kind === 'hero');
  if (i < 0) throw new Error('aucun héros dans l’ordre d’initiative');
  window.__wfrp.store.setState({ battle: { ...b, turn: i, acted: false }, pendingRoundStart: null });
  return i;
})()`;

/** Force le tour sur le premier combattant NON contrôlé de l'ordre (forme spectatrice). */
const AU_TOUR_ADVERSE = `(() => {
  const s = window.__wfrp.store.getState();
  const b = s.battle;
  const i = b.order.findIndex((id) => (b.combatants.find((c) => c.id === id) || {}).kind === 'enemy');
  if (i < 0) throw new Error('aucun ennemi dans l’ordre d’initiative');
  window.__wfrp.store.setState({ battle: { ...b, turn: i }, pendingRoundStart: null });
  return i;
})()`;

/** Rouvre une pause de Round 1 (forme d'OUVERTURE : bandeau centré + médaillon). */
const A_L_OUVERTURE = `(() => {
  const s = window.__wfrp.store.getState();
  window.__wfrp.store.setState({ battle: { ...s.battle, turn: -1 }, pendingRoundStart: { round: 1, readyBySeat: {} } });
  return true;
})()`;

/** Défauts d'une mesure de forme (liste vide = tout passe). */
function defauts(m, w, forme) {
  const out = [];
  const ou = `${forme} ${w}px`;
  if (!m.pont) return [`${ou} : aucun pont (.combat-console) — sonde aveugle`];
  if (m.forme !== (forme === 'pont complet' ? 'complete' : 'spectatrice')) {
    out.push(`${ou} : le pont rend la forme « ${m.forme} », pas celle attendue`);
  }
  // AMPUTATION : une région dont le contenu ne tient pas dans sa boîte est coupée à l'écran.
  for (const d of m.debords) {
    if (d.deborde > 1) out.push(`${ou} : ${d.sel} ampute son contenu de ${d.deborde}px (scrollHeight ${d.scroll} > clientHeight ${d.client})`);
  }
  // … et rien du pont ne descend sous le bas du champ (le débord d'une bande ancrée en bas sort de
  // l'écran : c'est ainsi que le nom du héros et la plaque de sortie étaient tranchés).
  for (const c of m.controles) {
    const hors = +(c.rect.bottom - m.champ.bottom).toFixed(1);
    if (hors > 1) out.push(`${ou} : « ${c.quoi} » sort du champ par le bas de ${hors}px`);
    if (c.rect.y < m.champ.y - 1) out.push(`${ou} : « ${c.quoi} » sort du champ par le haut de ${+(m.champ.y - c.rect.y).toFixed(1)}px`);
  }
  // La bande RENDUE vaut la bande DÉCLARÉE : sans cette égalité, une dérive du chrome d'arche
  // pousse le pont vers le haut sans qu'aucune région ne déborde — le pont mange alors le terrain
  // et recouvre le fil (mesuré : +105px de chrome ⇒ 222,5×20px de fil recouvert).
  // Elle n'est exigée que là où le pont est une LIGNE : sous 700 les régions s'EMPILENT dans la
  // forme complète, et la bande vaut la pile.
  if (w > 700 || m.forme === 'spectatrice') {
    const ecart = +(m.pont.h - m.deckDeclare).toFixed(1);
    if (Math.abs(ecart) > 1) out.push(`${ou} : la bande RENDUE fait ${m.pont.h}px pour ${m.deckDeclare}px DÉCLARÉS (écart ${ecart}px)`);
  }
  if (m.pontSurFil) out.push(`${ou} : le pont recouvre le fil de combat de ${m.pontSurFil.ox}×${m.pontSurFil.oy}px`);
  if (m.pontSurFrise) out.push(`${ou} : le pont recouvre la frise d'initiative de ${m.pontSurFrise.ox}×${m.pontSurFrise.oy}px`);
  if (forme === 'ouverture') {
    if (!m.bandeau) out.push(`${ou} : aucun bandeau d'ouverture centré — sonde aveugle`);
    else {
      if (m.surGroupe) out.push(`${ou} : le bandeau d'ouverture recouvre la bande de groupe de ${m.surGroupe.ox}×${m.surGroupe.oy}px`);
      if (m.surFrise) out.push(`${ou} : le bandeau d'ouverture recouvre la frise d'initiative de ${m.surFrise.ox}×${m.surFrise.oy}px`);
      if (m.surFil) out.push(`${ou} : le bandeau d'ouverture recouvre le fil de combat de ${m.surFil.ox}×${m.surFil.oy}px`);
      if (m.surRail) out.push(`${ou} : le bandeau d'ouverture recouvre le rail d'outils de ${m.surRail.ox}×${m.surRail.oy}px`);
      if (m.surPont) out.push(`${ou} : le bandeau d'ouverture recouvre le pont de ${m.surPont.ox}×${m.surPont.oy}px`);
      const dc = Math.abs(m.bandeau.x + m.bandeau.w / 2 - (m.champ.x + m.champ.w / 2));
      if (dc > 1) out.push(`${ou} : le bandeau d'ouverture est décentré de ${dc.toFixed(1)}px`);
      // POSITION DE RÉFÉRENCE (RT « round 0 ») : EN HAUT de la carte. Elle ne cède que là où la zone
      // haute est pleine (sous 700, frise en bande et fil monté en haut) — pas un pixel avant.
      if (w > 700 && m.bandeau.y > m.champ.y + m.champ.h / 2) {
        out.push(`${ou} : le bandeau d'ouverture a quitté le HAUT de la carte (y=${m.bandeau.y} dans un champ de ${m.champ.h}px)`);
      }
    }
  }
  if (m.forme === 'spectatrice') {
    if (!m.medaillon) out.push(`${ou} : aucun médaillon — la forme spectatrice est vide`);
    else {
      const dc = Math.abs(m.medaillon.x + m.medaillon.w / 2 - (m.champ.x + m.champ.w / 2));
      if (dc > 1) out.push(`${ou} : le médaillon est décentré de ${dc.toFixed(1)}px`);
    }
  }
  return out;
}

/** Attend que le pont rende la forme voulue : mesurer un DOM à moitié posé rend la sonde aveugle. */
async function attendreForme(session, forme) {
  for (let i = 0; i < 30; i++) {
    if (await evaluate(session, `((d) => !!d && d.getAttribute('data-forme') === '${forme}')(document.querySelector('.cc-dock'))`)) return;
    await sleep(200);
  }
  throw new Error(`le pont ne rend pas la forme « ${forme} » après 6s`);
}

async function mesurer(session, w) {
  const formes = {};
  await setViewport(session, w, HEIGHT);
  await sleep(500);
  // La console se remonte après un changement de viewport : on ATTEND qu'elle soit là plutôt que de
  // mesurer un DOM à moitié posé (une mesure absente rendrait la sonde aveugle sans le dire).
  await attendreForme(session, 'complete');
  formes['pont complet'] = await evaluate(session, PROBE);
  await evaluate(session, AU_TOUR_ADVERSE);
  await attendreForme(session, 'spectatrice');
  formes['spectatrice'] = await evaluate(session, PROBE);
  await evaluate(session, A_L_OUVERTURE);
  await attendreForme(session, 'spectatrice');
  formes['ouverture'] = await evaluate(session, PROBE);
  return formes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await openApp(args.url);
  const echecs = [];
  try {
    await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
    await sleep(1500);
    await resoudreModales(session, 'ouverture');
    await setViewport(session, 1600, HEIGHT);
    await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
    await sleep(1500);
    await resoudreModales(session, 'ouverture de combat');
    await jusquAuTourDuJoueur(session);
    // STRESS : le CONTENU de l'arche dérive (une rangée de plus, un chrome mal calibré) SANS que sa
    // déclaration bouge, et on exige que la sonde le voie. Faire dériver le TOKEN ne prouverait
    // rien : la réserve en découle, elle suivrait la dérive (mesuré : aucun défaut).
    if (args.stress) {
      await evaluate(session, `(() => {
        const st = document.createElement('style');
        st.textContent = '.cc-arch { padding-top: ${args.stress}px; }';
        document.head.appendChild(st);
        return true;
      })()`);
      await sleep(400);
    }
    for (const w of args.widths) {
      // Chaque largeur repart du TOUR DU JOUEUR : les deux autres formes sont posées par-dessus.
      await evaluate(session, AU_TOUR_DU_JOUEUR);
      await sleep(300);
      await resoudreModales(session, `largeur ${w}`);
      const formes = await mesurer(session, w);
      const z = formes['ouverture'];
      if (args.mesures && formes['pont complet'].arche) console.log(`    arche ${JSON.stringify(formes['pont complet'].arche)}`);
      if (args.mesures) console.log(`    zones hautes — groupe ${JSON.stringify(z.groupe)} · frise ${JSON.stringify(z.frise)} · fil ${JSON.stringify(z.fil)}`);
      const hauteurs = Object.entries(formes).map(([f, m]) => `${f} ${m.pont ? m.pont.h : '—'}px`).join(' · ');
      console.log(`${w}×${HEIGHT} — bande : ${hauteurs}${formes['ouverture'].bandeau ? ` · bandeau y=${formes['ouverture'].bandeau.y} h=${formes['ouverture'].bandeau.h}` : ''}`);
      for (const [f, m] of Object.entries(formes)) {
        for (const d of m.debords) console.log(`    ${f} [${m.forme}] · ${d.sel} : scroll ${d.scroll} / client ${d.client}${d.deborde > 1 ? `  ← DÉBORDE de ${d.deborde}px` : ''}`);
        if (!args.mesures) echecs.push(...defauts(m, w, f));
      }
      // BANDE STABLE : la hauteur rendue ne bouge pas d'une forme à l'autre.
      // BANDE STABLE — exigée là où le pont est une LIGNE (au-delà de 700px). Sous 700 les régions
      // s'EMPILENT : le pont complet fait alors trois rangées, et réserver cette pile pour un
      // médaillon avalerait la moitié du terrain. La forme y change donc de hauteur, par dessein.
      if (w > 700) {
        const hs = Object.entries(formes).filter(([, m]) => m.pont).map(([f, m]) => [f, m.pont.h]);
        const ref = hs[0];
        for (const [f, h] of hs.slice(1)) {
          if (Math.abs(h - ref[1]) > 1 && !args.mesures) echecs.push(`${w}px : la bande passe de ${ref[1]}px (${ref[0]}) à ${h}px (${f}) — la géométrie bat d'une forme à l'autre`);
        }
      }
    }
  } finally {
    await session.close();
  }

  // En mode STRESS le verdict s'INVERSE : c'est l'absence de défaut qui est l'échec — une sonde
  // qu'aucune dérive ne fait rougir ne prouve rien.
  if (args.stress) {
    if (!echecs.length) {
      console.error(`
SONDE AVEUGLE : +${args.stress}px dans l'arche n'ont produit AUCUN défaut.`);
      process.exit(1);
    }
    console.log(`
Sonde RÉFUTABLE : +${args.stress}px dans l'arche produisent ${echecs.length} défaut(s) —`);
    for (const e of echecs) console.log(`  · ${e}`);
    return;
  }
  if (echecs.length) {
    console.error(`\n${echecs.length} défaut(s) du pont de console :`);
    for (const e of echecs) console.error(`  · ${e}`);
    process.exit(1);
  }
  console.log('\nPont de console : aucune amputation, bande stable dans les trois formes, bandeau d’ouverture dégagé.');
}

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
