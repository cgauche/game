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
//   · en combat, la console (`.combat-console`) est MONTÉE, peuplée, et chacune de ses cases
//     (`.cc-cell`) reçoit son propre clic ;
//   · en combat, `.combat-feed` et `.initiative-strip` n'ont aucune surface commune ;
//   · en combat, le tiroir du journal OUVERT (déplié par clic réel) ne recouvre pas la console ;
//   · en combat, la piste `.is-tiles` DÉFILE (scrollWidth > clientWidth) et tient dans sa bande ;
//   · en combat, la frise en BANDE horizontale va jusqu'au bord droit (réserve ≤ 8px) et son cartouche
//     de Round reste visible à TOUT décalage de défilement de la piste ;
//   · la piste du groupe (`.pd-track`) tient sur UNE ligne (aucune carte à un autre `y`) ;
//   · quand le rail est DISSOUS (`display: contents`, ≤700), son ouvreur d'écran se pose LUI-MÊME
//     (position hors flux) et reçoit son clic. ANGLE MORT DÉCLARÉ : cet ouvreur n'est monté que
//     lorsqu'un navire est en jeu (`CampaignView.tsx`) — le scénario `enc-mutants` sondé ici ne le
//     porte pas, le verdict est donc CONDITIONNEL à sa présence, et sa structure reste gardée en
//     unité (`src/ui/ui-ratchets.test.ts`) ;
//   · en exploration, la boîte pleine ligne de `.objective-banner` n'avale aucun clic hors de sa
//     tête : le point sondé à droite de `.objective-head` rend la scène ;
//   · en exploration, chaque portrait du groupe (`.party-dock .ptile`) reçoit son clic — la pile de
//     contexte (haut-gauche) ne mord pas sur le haut-centre, qui appartient au GROUPE.
//
// Sortie : exit 1 au premier défaut (liste complète imprimée), exit 0 si tout passe.
import { pathToFileURL } from 'node:url';
import { openApp, evaluate, setViewport, sleep, clickButtonByText, cliquerSelecteur, resoudreModales, VUE_REFERENCE } from './lib.mjs';

// Les trois largeurs étroites (700/560/360) portent les recouvrements ; les deux larges portent la
// zone morte du bandeau d'objectif, dont la boîte n'excède sa tête qu'au-delà de 900px — sonder
// 700/560/360 seuls rendait cette vérification AVEUGLE (marge morte mesurée à 0px).
// La plus large est la vue de RÉFÉRENCE (`vues-recette.json`), jamais un couple recopié (#1847).
const DEFAULT_WIDTHS = [VUE_REFERENCE.largeur, 1100, 900, 700, 560, 360];
const HEIGHT = VUE_REFERENCE.hauteur;

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
  // Une boîte NON RENDUE (repliée, écran d'un parent en display:none) a un rect 0×0 : elle n'a aucun
  // clic à recevoir, et le point (0,0) rend le décor — la juger « recouverte » est un FAUX POSITIF
  // (mesuré : à 560 et 360 la bande de groupe est repliée sur sa poignée, piste en display none).
  const reaches = (el) => {
    const r = el.getBoundingClientRect();
    const rendu = r.width > 0 && r.height > 0;
    const top = rendu ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
    return { rendu, ok: !!(top && (top === el || el.contains(top))), hitBy: cn(top), rect: box(r) };
  };
  const overlap = (a, b) => {
    if (!a || !b) return null;
    const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    return (ox > 0 && oy > 0) ? { ox: +ox.toFixed(1), oy: +oy.toFixed(1) } : null;
  };

  const strip = document.querySelector('.initiative-strip');
  const tiles = document.querySelector('.is-tiles');
  const ptiles = [...document.querySelectorAll('.party-dock .ptile')].map((p, i) => ({ i, ...reaches(p) }));
  // Console de combat (pont du tour) : chacune de ses cases se sonde comme une commande de vue.
  // (Aucun accent grave dans cette sonde : elle vit dans un gabarit de chaîne.)
  const pont = document.querySelector('.combat-console');
  const dockBtns = [...document.querySelectorAll('.combat-console button.cc-cell')].map((b, i) => ({
    i, label: (b.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) || (b.getAttribute('title') || '').trim(), ...reaches(b),
  }));

  // TIROIR DU JOURNAL : sa réserve du bas ne se juge qu'au panneau DÉPLIÉ (fermé, il ne recouvre
  // rien). C'est le seul état où la question « passe-t-il sous la console ? » a un sens.
  const panneau = document.querySelector('.ld-panel');
  const rp = panneau ? panneau.getBoundingClientRect() : null;
  const tiroir = document.querySelector('.log-drawer') ? {
    ouvert: !!(rp && rp.width > 0 && rp.height > 0),
    rect: box(rp),
    surPont: overlap(rp, pont ? pont.getBoundingClientRect() : null),
  } : null;

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

  // Rail d'outils DISSOUS (≤700, hud.css) : il ne porte plus l'ancrage de ses enfants, son ouvreur
  // d'écran doit se poser lui-même (sinon il retombe dans le flux du stage).
  const rail = document.querySelector('.hud-rail');
  const rails = rail ? {
    dissous: getComputedStyle(rail).display === 'contents',
    ouvreurs: [...document.querySelectorAll('.hud-rail > .worldmap-btn')].map((b, i) => ({
      i, label: (b.getAttribute('title') || '').trim(), position: getComputedStyle(b).position, ...reaches(b),
    })),
  } : null;

  // Frise : réserve de droite et VISIBILITÉ du cartouche de Round à fond de défilement. La mesure
  // déplace la piste puis la REMET où elle était — aucune trace pour les largeurs suivantes.
  let frise = null;
  if (strip && tiles) {
    const rs = strip.getBoundingClientRect();
    const dansLaPiste = (el) => {
      const r = el.getBoundingClientRect(), rt = tiles.getBoundingClientRect();
      return r.width > 0 && r.height > 0
        && r.right > rt.x + 0.5 && r.x < rt.right - 0.5
        && r.bottom > rt.y + 0.5 && r.y < rt.bottom - 0.5;
    };
    // L'acteur AU TRAIT doit être dans le champ de la piste : elle défile, il peut vivre hors champ.
    const actif = tiles.querySelector('.is-cell[aria-current="step"]');
    const auTraitVisible = actif ? dansLaPiste(actif) : null;
    const round = tiles.querySelector('.is-round');
    let roundVisible = null;
    if (round) {
      const avantX = tiles.scrollLeft, avantY = tiles.scrollTop;
      tiles.scrollLeft = tiles.scrollWidth;
      tiles.scrollTop = tiles.scrollHeight;
      roundVisible = dansLaPiste(round);
      tiles.scrollLeft = avantX;
      tiles.scrollTop = avantY;
    }
    frise = {
      bande: getComputedStyle(tiles).flexDirection === 'row',
      margeDroite: +(window.innerWidth - rs.right).toFixed(1),
      roundVisible,
      auTraitVisible,
    };
  }

  // Piste du GROUPE : une rangée enroulée mange le champ — toutes les cartes partagent UNE ordonnée.
  // (Aucun accent grave ici : ce bloc vit dans un gabarit de chaîne.)
  const track = document.querySelector('.pd-track');
  const rendues = track ? [...track.children].filter((c) => c.getBoundingClientRect().width > 0) : [];
  const poignee = document.querySelector('.party-dock .pd-handle');
  const groupe = document.querySelector('.party-dock') ? {
    cartes: rendues.length,
    lignes: new Set(rendues.map((c) => Math.round(c.getBoundingClientRect().y))).size,
    // Bande REPLIÉE : c'est la poignée qui porte alors l'affordance du groupe.
    poignee: poignee ? reaches(poignee) : null,
  } : null;

  return {
    largeur: window.innerWidth,
    combat: !!strip,
    rail: rails,
    frise,
    groupe,
    portraits: ptiles,
    objectif: objective,
    feedXfrise: overlap(rectOf('.combat-feed'), rectOf('.initiative-strip')),
    piste: tiles && strip ? {
      scrollWidth: tiles.scrollWidth, clientWidth: tiles.clientWidth, bande: strip.clientWidth,
      defile: tiles.scrollWidth > tiles.clientWidth, tientDansLaBande: tiles.clientWidth <= strip.clientWidth,
    } : null,
    dock: pont ? { rect: box(pont.getBoundingClientRect()) } : null,
    tiroir,
    dockBtns,
  };
})()`;

/**
 * Amène le combat jusqu'aux CASES du tour d'un héros (`.combat-console button.cc-cell`). Pendant la
 * pause d'initiative de début de Round, le pont ne porte que le bandeau de phase et son bouton
 * « Commencer … » (`.cc-phase [data-action='round-start']`, `src/ui/CombatConsole.tsx`), qui n'est PAS
 * dans une fenêtre : `resoudreModales` ne le voit pas, et `fastForward` ne le franchit pas. Sans ce
 * clic la sonde mesurait la phase (un bouton) au lieu du pont de tour — elle ne pouvait constater
 * aucun recouvrement des cases.
 *
 * Le tour du héros est posé en MISE EN PLACE (`__wfrp.turn`, triche de recette documentée) au lieu
 * d'être atteint en avançant les tours d'IA : la cascade de Défense gèle le combat au tour 4
 * (défaut de JEU #1852, chantier à part). C'est le HUD qu'on mesure ici, pas la boucle de tours —
 * et un blocage résiduel reste NOMMÉ (round, tour, phase, attentes posées).
 */
async function monterLeDock(session) {
  /** État d'avancement du combat — c'est lui qui NOMME un blocage, au lieu d'un « ça ne monte pas ». */
  const AVANCEMENT = `(() => {
    const st = window.__wfrp.store.getState();
    const b = st.battle;
    return {
      cellules: document.querySelectorAll('.combat-console button.cc-cell').length,
      tour: b ? b.turn : null,
      round: b ? b.round : null,
      actif: b ? ((b.combatants.find((c) => c.id === b.order[b.turn]) || {}).label || null) : null,
      phase: document.querySelector('.cc-phase') ? (document.querySelector('.cc-phase').textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60) : null,
      modale: !!document.querySelector('.modal-overlay'),
      attentes: Object.keys(st).filter((k) => /^pending/.test(k) && st[k]),
    };
  })()`;
  let precedent = null;
  let immobile = 0;
  for (let i = 0; i < 12; i++) {
    const etat = await evaluate(session, AVANCEMENT);
    if (etat.cellules > 0) return;
    // Un tour qui ne bouge plus n'est pas une lenteur : c'est un blocage, et il se DIT avec la
    // mesure qui le prouve (qui joue, quelle fenêtre est ouverte, quelles attentes sont posées).
    immobile = etat.tour === precedent ? immobile + 1 : 0;
    precedent = etat.tour;
    if (immobile >= 3) {
      throw new Error(`le combat n'avance plus : Round ${etat.round}, tour ${etat.tour} (${etat.actif}), phase « ${etat.phase} », `
        + `fenêtre ${etat.modale ? 'ouverte' : 'ABSENTE'}, attentes posées : ${etat.attentes.join(', ') || 'aucune'}`);
    }
    if (await evaluate(session, `!!document.querySelector(".cc-phase [data-action='round-start']:not(:disabled)")`)) {
      await clickButtonByText(session, 'Commencer');
      await sleep(900);
      await resoudreModales(session, 'ouverture de Round');
      continue;
    }
    const verdict = await evaluate(session, `(() => {
      const b = window.__wfrp.store.getState().battle;
      if (!b) return 'aucun combat';
      const id = b.order.find((x) => ((b.combatants.find((c) => c.id === x) || {}).kind) === 'hero');
      return id ? window.__wfrp.turn(id) : 'aucun héros dans l ordre d initiative';
    })()`);
    console.log(`  (mise en place : premier tour tenu par un héros — ${verdict})`);
    await sleep(900);
    await resoudreModales(session, 'mise en place du tour');
  }
  throw new Error('la console (.combat-console .cc-cell) ne monte pas : le combat ne parvient pas au tour d’un héros');
}

/**
 * Défauts d'une mesure, en clair (liste vide = tout passe). PURE : elle ne lit que `m` — c'est ce
 * qui la rend testable à fixtures (`hud-clickables.test.mjs`, gate `test:recette`).
 * @param {any} m mesure rendue par `PROBE` @param {string} phase `'exploration'` | `'combat'`
 * @returns {string[]}
 */
export function defauts(m, phase) {
  const out = [];
  // Rail DISSOUS : son ouvreur d'écran porte son propre ancrage, ou il retombe dans le flux.
  if (m.rail?.dissous) {
    // Un rail dissous SANS ouvreur ne rendait aucun verdict : la mesure était verte par VACUITÉ.
    if (!m.rail.ouvreurs.length) out.push(`${phase} ${m.largeur}px : le rail d'outils est dissous et ne porte aucun ouvreur d'écran — sonde aveugle sur l'accès à la carte`);
    for (const b of m.rail.ouvreurs) {
      if (b.position === 'static') out.push(`${phase} ${m.largeur}px : l'ouvreur « ${b.label} » du rail dissous est en flux (position: static) — il retombe dans le stage`);
    }
  }
  for (const b of m.rail?.ouvreurs ?? []) {
    if (!b.ok) out.push(`${phase} ${m.largeur}px : l'ouvreur « ${b.label} » ${JSON.stringify(b.rect)} ne reçoit pas son clic — recouvert par ${b.hitBy}`);
  }
  // Bande de groupe : UNE ligne. Une rangée enroulée mangeait 21 % de l'écran à 1280 (grief vision).
  // Seules les cartes RENDUES comptent : repliée, la bande n'en rend aucune (ce n'est pas une ligne
  // de plus, c'est une autre forme).
  if (m.groupe && m.groupe.cartes > 0 && m.groupe.lignes > 1) {
    out.push(`${phase} ${m.largeur}px : la piste du groupe s'enroule sur ${m.groupe.lignes} lignes (${m.groupe.cartes} cartes) — elle doit tenir sur une seule`);
  }
  // Le GROUPE reste ATTEIGNABLE, déplié comme replié : une carte rendue, ou la poignée qui la
  // rouvre. Sans ce verdict, une bande repliée rendait la mesure des portraits verte par VACUITÉ.
  if (m.groupe && m.groupe.cartes === 0) {
    if (!m.groupe.poignee) out.push(`${phase} ${m.largeur}px : le groupe ne rend aucune carte ET n'offre aucune poignée — il est hors d'atteinte`);
    else if (!m.groupe.poignee.rendu) out.push(`${phase} ${m.largeur}px : la poignée du groupe replié n'est pas rendue — le groupe est hors d'atteinte`);
    else if (!m.groupe.poignee.ok) out.push(`${phase} ${m.largeur}px : la poignée du groupe replié ${JSON.stringify(m.groupe.poignee.rect)} ne reçoit pas son clic — recouverte par ${m.groupe.poignee.hitBy}`);
  }
  if (m.combat) {
    if (m.frise) {
      // Le haut-droite est LIBRE : la bande va jusqu'au bord, comme à gauche.
      if (m.frise.bande && m.frise.margeDroite > 8) {
        out.push(`${phase} ${m.largeur}px : la frise en bande réserve ${m.frise.margeDroite}px à sa droite — aucune colonne n'y vit (plafond 8px)`);
      }
      if (m.frise.roundVisible === false) {
        out.push(`${phase} ${m.largeur}px : le cartouche de Round sort du champ quand la piste est défilée — la frise perd sa tête`);
      }
      if (m.frise.roundVisible === null) out.push(`${phase} ${m.largeur}px : aucun cartouche de Round (.is-round) — sonde aveugle sur la tête de frise`);
      // COUVERTURE : `auTraitVisible` vaut `null` tant qu'aucune entrée n'est au trait (pause
      // d'initiative, combat fini) — il n'y a alors rien à ramener dans le champ, et rien à dire.
      if (m.frise.auTraitVisible === false) {
        out.push(`${phase} ${m.largeur}px : l'acteur au trait est hors du champ de la frise — rien ne l'y ramène (scrollIntoView)`);
      }
    }
    // La console doit être MONTÉE et peuplée : sans elle la sonde mesure le bandeau de phase (un seul
    // bouton) et ne voit aucun des recouvrements du pont de tour.
    if (!m.dock) out.push(`${phase} ${m.largeur}px : aucune console (.combat-console) — sonde aveugle sur le pont de tour`);
    else if (!m.dockBtns.length) out.push(`${phase} ${m.largeur}px : la console ne porte aucune case — sonde aveugle`);
    for (const b of m.dockBtns) {
      if (!b.ok) out.push(`${phase} ${m.largeur}px : la case « ${b.label} » ${JSON.stringify(b.rect)} ne reçoit pas son clic — recouverte par ${b.hitBy}`);
    }
    if (m.feedXfrise) out.push(`${phase} ${m.largeur}px : le fil d'événements recouvre la frise d'initiative de ${m.feedXfrise.ox}×${m.feedXfrise.oy}px`);
    // TIROIR DU JOURNAL : c'est ici que se mesure sa réserve du bas — un panneau qui passe SOUS la
    // console de tour lui mange ses cases. Fermé, il n'y a rien à dire ; pas ouvrable, la mesure est
    // aveugle et le dit.
    if (m.tiroir) {
      if (!m.tiroir.ouvert) out.push(`${phase} ${m.largeur}px : le tiroir du journal ne s'ouvre pas (panneau non rendu) — sonde aveugle sur sa réserve du bas`);
      else if (m.tiroir.surPont) out.push(`${phase} ${m.largeur}px : le tiroir du journal ouvert recouvre la console de ${m.tiroir.surPont.ox}×${m.tiroir.surPont.oy}px`);
    }
    if (m.piste) {
      if (!m.piste.tientDansLaBande) out.push(`${phase} ${m.largeur}px : la piste d'initiative (${m.piste.clientWidth}px) déborde de sa bande (${m.piste.bande}px) — overflow-x ne mord pas`);
      // Le défilement n'est EXIGÉ que si le contenu excède la bande : en colonne latérale (largeurs
      // larges) la piste tient d'un bloc, et l'exiger partout rendrait le verdict faux.
      if (m.piste.scrollWidth > m.piste.bande && !m.piste.defile) out.push(`${phase} ${m.largeur}px : la piste d'initiative ne défile pas (scrollWidth ${m.piste.scrollWidth} ≤ clientWidth ${m.piste.clientWidth}) — des combattants sont hors d'atteinte`);
    }
  } else {
    if (!m.objectif) out.push(`${phase} ${m.largeur}px : aucun bandeau d'objectif — sonde aveugle sur la zone morte`);
    else if (m.objectif.avale) out.push(`${phase} ${m.largeur}px : ${m.objectif.marge}px de carte à droite de l'objectif avalent les clics (${m.objectif.hitBy})`);
    // Portraits RENDUS seulement : une tuile de bande repliée n'est pas recouverte, elle n'est pas
    // montée à l'écran — c'est le verdict de POIGNÉE (ci-dessus) qui garde ce cas-là.
    const rendus = m.portraits.filter((p) => p.rendu);
    if (!m.portraits.length) out.push(`${phase} ${m.largeur}px : aucun portrait de groupe — sonde aveugle`);
    for (const p of rendus) {
      if (!p.ok) out.push(`${phase} ${m.largeur}px : le portrait ${p.i} du groupe ne reçoit pas son clic — recouvert par ${p.hitBy}`);
    }
  }
  return out;
}

/** Chaque défaut est NOMMÉ là où il est mesuré : un compte « 4 défaut(s) » ne dit rien, et le bilan
 *  final ne s'imprime jamais si la mise en place meurt à la phase suivante. */
const dire = (liste) => { for (const e of liste) console.log(`   · ${e}`); };

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
      const bande = !m.groupe ? 'aucune bande de groupe'
        : m.groupe.cartes === 0 ? `bande REPLIÉE sur sa poignée (${m.groupe.poignee ? 'poignée ' + (m.groupe.poignee.ok ? 'atteignable' : 'RECOUVERTE') : 'SANS poignée'})`
          : `${m.groupe.cartes} carte(s) sur ${m.groupe.lignes} ligne(s)`;
      console.log(`exploration ${w}px — ${bande}, ${m.portraits.filter((p) => p.rendu).length} portrait(s) rendu(s), marge morte objectif ${m.objectif ? m.objectif.marge + 'px' : 'n/a'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      dire(d);
      echecs.push(...d);
    }

    // ── Combat ─────────────────────────────────────────────────────────────────────────────────
    await setViewport(session, VUE_REFERENCE.largeur, VUE_REFERENCE.hauteur);
    await sleep(300);
    await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
    await sleep(1500);
    await resoudreModales(session, 'ouverture de combat');
    await monterLeDock(session);
    // Le tiroir du journal ne se juge QU'OUVERT : on le déplie par CLIC RÉEL sur sa poignée (glyphe
    // seul → par sélecteur), au PREMIER tour tenu par un héros — console complète, avant tout tour
    // d'IA. Son état React traverse les changements de largeur : un seul clic pour les six mesures.
    await cliquerSelecteur(session, '.log-drawer .ld-btn');
    await sleep(400);

    for (const w of args.widths) {
      await setViewport(session, w, HEIGHT);
      await sleep(600);
      const m = await evaluate(session, PROBE);
      if (!m.combat) throw new Error(`combat ${w}px : aucune frise d'initiative — le combat n'est pas monté`);
      const d = defauts(m, 'combat');
      console.log(`combat ${w}px — dock ${m.dock ? m.dock.rect.h + 'px de haut / ' + m.dockBtns.length + ' contrôle(s)' : 'ABSENT'}, piste ${m.piste.clientWidth}/${m.piste.scrollWidth}px dans une bande de ${m.piste.bande}px, frise ${m.frise ? (m.frise.bande ? 'bande' : 'colonne') + ' à ' + m.frise.margeDroite + 'px du bord, Round ' + (m.frise.roundVisible ? 'visible' : 'HORS CHAMP') : 'n/a'}, chevauchement fil×frise ${m.feedXfrise ? m.feedXfrise.ox + '×' + m.feedXfrise.oy + 'px' : 'aucun'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      dire(d);
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

// Le VERDICT (`defauts`) s'importe pour être testé à fixtures ; la sonde ne s'OUVRE que lancée en CLI.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => {
    console.error(`ERR ${e.message}`);
    process.exit(1);
  });
}
