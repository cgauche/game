#!/usr/bin/env node
// CLI de preuve navigateur : À LA HAUTEUR RÉELLE, TOUT RESTE ATTEIGNABLE (#1847). Aucun test jsdom
// ne peut le voir — jsdom ne met rien en page, et un cliquet CSS lit des déclarations, pas des
// pixels. Voir docs/recette-navigateur.md § « La HAUTEUR réelle ».
//
// Usage :
//   node scripts/recette/hauteur-reelle.mjs
//   node scripts/recette/hauteur-reelle.mjs [--url <url>] --vues portable
//   node scripts/recette/hauteur-reelle.mjs --mesures     (imprime les mesures, aucun verdict)
//
// Écrans parcourus, à CHACUNE des trois vues de `vues-recette.json` (bureau, portable, mobile) :
//   `menu`, `party`, `creator`, `compendium`, `editor`, `test`, `coop` ; la campagne en exploration
//   puis en combat ; le menu SYSTÈME ouvert par une vraie frappe d'Échap et ses sous-écrans
//   (Options, onglet Clavier, Coopération) atteints par de vrais clics ; la fenêtre de jet de
//   l'ouverture de combat.
// Ce qui y est VÉRIFIÉ :
//   · AUCUN SCROLLPORT DE PAGE — le contenu défile DANS un cadre, jamais `document` lui-même :
//     ce qui est ancré (en-tête, actions) reste ancré ;
//   · AUCUNE COMMANDE INATTEIGNABLE dans une carte de menu — aucun défilement ne la ramène ;
//   · AUCUN CORPS DE MODALE ÉCRASÉ — la fenêtre de jet tient ce que son CSS déclare réclamer ;
//   · ACTEUR AU TRAIT DANS SON CHAMP — la frise d'initiative ramène l'entrée courante en vue.
// Les VERDICTS sont des détecteurs PURS (`detecteurs-hauteur.mjs`), testés à fixtures par
// `test:recette` : la MESURE vit ici, le JUGEMENT là-bas.
//
// Sortie : la liste complète des défauts, exit 1 s'il en reste, exit 0 sinon.
// Résidu mesuré sur l'arbre : Codex à 360×740, page 3007/740 — #1860. Aucune liste d'exemption ici :
// la sonde reste rouge tant qu'il vit.
import {
  openApp, evaluate, setViewport, sleep, gotoScreen, resoudreModales, realKey, clickButtonByText, VUES_RECETTE,
} from './lib.mjs';
import {
  scrollportDePage, commandesInatteignables, corpsDeModaleEcrase, courantHorsChamp,
} from './detecteurs-hauteur.mjs';

function parseArgs(argv) {
  const out = { url: undefined, vues: VUES_RECETTE, mesures: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--vues') {
      const noms = argv[++i].split(',').map((n) => n.trim());
      out.vues = VUES_RECETTE.filter((v) => noms.includes(v.nom));
      if (!out.vues.length) throw new Error(`--vues : aucune vue connue parmi « ${noms.join(', ')} » (${VUES_RECETTE.map((v) => v.nom).join(', ')})`);
    } else if (a === '--mesures') out.mesures = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  return out;
}

/** Sonde DOM — le relevé de HAUTEUR d'un écran, en UN aller-retour.
 *  La PAGE, c'est `document.scrollingElement` : le scrollport de dernier recours, celui qu'aucun
 *  écran ne doit laisser déborder. De chaque CADRE défilant on relève sa boîte et sa course — une
 *  boîte qui couvre le viewport EST un scrollport de page, et une boîte qui commence sous la
 *  fenêtre ne montre rien de ce qu'elle tient. De chaque CARTE DE MENU on relève ce qu'aucun
 *  défilement ne peut ramener en vue. */
const PROBE = `(() => {
  const page = document.scrollingElement || document.documentElement;
  const bord = (e) => { const r = e.getBoundingClientRect(); return { left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
  const nomDe = (e) => (e.className && typeof e.className === 'string'
    ? '.' + e.className.trim().split(/\\s+/).join('.')
    : e.tagName.toLowerCase()).slice(0, 60);

  const defileurs = [];
  for (const e of document.querySelectorAll('*')) {
    if (e === page || e === document.body) continue;
    const st = getComputedStyle(e);
    if (!/(auto|scroll)/.test(st.overflowY)) continue;
    if (e.scrollHeight - e.clientHeight <= 1) continue;
    defileurs.push({ sel: nomDe(e), scrollH: e.scrollHeight, clientH: e.clientHeight, boite: bord(e) });
  }

  // FENÊTRE DE JET : le voile PUBLIE son contrat (\`--roll-fenetre\` et les deux planchers,
  // roll-shell.css) ; la sonde le lit et le transmet, elle n'en fabrique aucune valeur.
  const modales = [];
  const voile = document.querySelector('.modal-overlay:has(.roll-modal)') || document.querySelector('.modal-overlay');
  const corps = voile ? voile.querySelector('.rs-scroll') : null;
  const boite = voile ? voile.querySelector('.modal') : null;
  if (voile && corps) {
    const cs = getComputedStyle(voile);
    const px = (nom) => { const v = parseFloat(cs.getPropertyValue(nom)); return Number.isFinite(v) ? v : null; };
    modales.push({
      quoi: (boite ? nomDe(boite) : '.modal'),
      corps: { clientH: corps.clientHeight, scrollH: corps.scrollHeight },
      place: Math.round(voile.getBoundingClientRect().height),
      boite: boite ? Math.round(boite.getBoundingClientRect().height) : null,
      reclame: px('--roll-fenetre'),
      plancherHaut: px('--roll-band-min') ?? 0,
      plancherBas: px('--roll-dock-min') ?? 0,
      bandeHaute: Math.round(parseFloat(cs.paddingTop)),
      bandeBasse: Math.round(parseFloat(cs.paddingBottom)),
    });
  }

  // CARTES DE MENU (menu principal, écrans à carte, menu SYSTÈME et ses sous-écrans) : on RELÈVE le
  // bas de chaque commande, le bas du corps défilant et la course qui lui reste. Le critère
  // d'atteignabilité est au détecteur, pas ici.
  const cartes = [];
  for (const carte of document.querySelectorAll('.menu-card')) {
    const cc = carte.querySelector('.menu-card-body');
    if (!cc) continue;
    const cb = cc.getBoundingClientRect();
    const commandes = [];
    for (const e of carte.querySelectorAll('button, a[href], input, select')) {
      const b = e.getBoundingClientRect();
      if (!b.height) continue;
      commandes.push({ nom: (e.textContent || e.tagName).replace(/\\s+/g, ' ').trim().slice(0, 28) || e.tagName, bas: +b.bottom.toFixed(1) });
    }
    cartes.push({
      sel: nomDe(carte),
      corpsBas: +cb.bottom.toFixed(1),
      restant: +(cc.scrollHeight - cc.clientHeight - cc.scrollTop).toFixed(1),
      commandes,
    });
  }

  // FRISE D'INITIATIVE : l'entrée AU TRAIT, et la piste qui la porte (son scrollport).
  const piste = document.querySelector('.initiative-strip .is-tiles');
  const cell = document.querySelector('.initiative-strip [aria-current="step"]');
  return {
    page: { scrollH: page.scrollHeight, clientH: page.clientHeight },
    fenetre: { largeur: window.innerWidth, hauteur: window.innerHeight },
    defileurs,
    modales,
    cartes,
    piste: piste ? bord(piste) : null,
    courant: cell ? { nom: (cell.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30) || 'au trait', ...bord(cell) } : null,
  };
})()`;

/** Tous les défauts d'un relevé, pour une vue et un écran donnés. */
function defauts(m, vue, ecran) {
  const ou = `${vue.largeur}×${vue.hauteur} (${vue.nom})`;
  return [
    ...scrollportDePage({ vue: ou, ecran, page: m.page, fenetre: m.fenetre, defileurs: m.defileurs }),
    ...commandesInatteignables({ vue: ou, ecran, cartes: m.cartes }),
    ...corpsDeModaleEcrase({ vue: `${ou} · ${ecran}`, modales: m.modales }),
    ...courantHorsChamp({ vue: `${ou} · ${ecran}`, courant: m.courant, piste: m.piste }),
  ];
}

/** Imprime le relevé d'un écran, TOUJOURS — une sonde dit ce qu'elle a mesuré, pas seulement ce
 *  qu'elle reproche. */
function dire(m, vue, ecran, mauvais) {
  const jet = m.modales[0];
  const frise = m.courant ? ` · au trait « ${m.courant.nom} » [${m.courant.left}..${m.courant.right}] dans piste [${m.piste.left}..${m.piste.right}]` : '';
  const cartes = m.cartes.length
    ? ` · cartes ${m.cartes.map((c) => `${c.sel} (${c.commandes.length} commandes, corps ${c.corpsBas} + ${c.restant} de course)`).join(', ')}`
    : '';
  console.log(
    `  ${ecran.padEnd(26)} page ${m.page.scrollH}/${m.page.clientH}`
    + `${m.defileurs.length ? ` · cadres ${m.defileurs.map((d) => `${d.sel} ${d.scrollH}/${d.clientH}`).join(', ')}` : ''}`
    + cartes
    + `${jet ? ` · JET corps ${jet.corps.clientH}/${jet.corps.scrollH} boîte ${jet.boite} réclame ${jet.reclame} bandes ${jet.bandeHaute}/${jet.bandeBasse} dans ${jet.place}` : ''}`
    + `${frise}`
    + ` → ${mauvais.length ? `${mauvais.length} défaut(s)` : 'OK'}`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await openApp(args.url);
  const echecs = [];
  try {
    for (const vue of args.vues) {
      await setViewport(session, vue.largeur, vue.hauteur);
      await sleep(400);
      console.log(`\n── ${vue.largeur}×${vue.hauteur} (${vue.nom}) ──────────────────────────────`);
      const juger = (m, ecran) => {
        const d = args.mesures ? [] : defauts(m, vue, ecran);
        dire(m, vue, ecran, d);
        echecs.push(...d);
      };

      // ── Écrans plein-champ, atteints par le routeur. `test` et `coop` en sont : ce sont des
      //    CARTES DE MENU, et leur hôte a perdu son `overflow-y` avec les autres. ───────────────
      for (const ecran of ['menu', 'party', 'creator', 'compendium', 'editor', 'test', 'coop']) {
        await gotoScreen(session, ecran, { settleMs: 900 });
        juger(await evaluate(session, PROBE), ecran);
      }

      // ── Campagne : exploration, le menu SYSTÈME et ses sous-écrans, puis le combat ───────────
      await gotoScreen(session, 'menu', { settleMs: 300 });
      await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
      await sleep(1600);
      await resoudreModales(session, `${vue.nom} · ouverture`);
      await sleep(400);
      juger(await evaluate(session, PROBE), 'campagne (exploration)');

      // Le menu SYSTÈME s'ouvre par une VRAIE frappe d'Échap, et ses sous-écrans par de VRAIS
      // clics : c'est le seul chemin où le joueur les rencontre, et le seul qui prouve que le
      // contrat de carte tient aussi sous le voile de pause.
      await realKey(session, { key: 'Escape' });
      await sleep(800);
      juger(await evaluate(session, PROBE), 'menu système');
      for (const [libelle, nom] of [['Options', 'menu système › Options'], ['Clavier', 'menu système › Options/Clavier']]) {
        try {
          await clickButtonByText(session, libelle);
        } catch (e) {
          echecs.push(`${vue.largeur}×${vue.hauteur} (${vue.nom}) · ${nom} : « ${libelle} » introuvable — sonde aveugle sur ce sous-écran (${e.message.slice(0, 60)})`);
          continue;
        }
        await sleep(800);
        juger(await evaluate(session, PROBE), nom);
      }
      await realKey(session, { key: 'Escape' });
      await sleep(500);
      try {
        await clickButtonByText(session, 'Coopération');
        await sleep(800);
        juger(await evaluate(session, PROBE), 'menu système › Coopération');
      } catch (e) {
        echecs.push(`${vue.largeur}×${vue.hauteur} (${vue.nom}) · menu système › Coopération : introuvable — sonde aveugle (${e.message.slice(0, 60)})`);
      }
      await realKey(session, { key: 'Escape' });
      await sleep(400);
      await realKey(session, { key: 'Escape' });
      await sleep(500);

      await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
      await sleep(1800);
      // La cascade d'OUVERTURE DE COMBAT est la plus longue fenêtre de jet du jeu (Initiative de
      // tous les combattants). On la juge AVANT de la résoudre — la résoudre d'abord rendrait la
      // sonde aveugle sur la seule modale de jet que le combat ouvre sans geste de joueur.
      juger(await evaluate(session, PROBE), 'fenêtre de jet (combat)');

      await resoudreModales(session, `${vue.nom} · ouverture de combat`);
      await sleep(800);
      juger(await evaluate(session, PROBE), 'campagne (combat)');
    }
  } finally {
    await session.close();
  }

  if (echecs.length) {
    console.error(`\n${echecs.length} défaut(s) de HAUTEUR :`);
    for (const e of echecs) console.error(`  · ${e}`);
    process.exit(1);
  }
  console.log('\nHauteur réelle : aucun scrollport de page, aucun corps de modale écrasé, acteur au trait en vue — aux trois vues.');
}

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
