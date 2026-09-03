/**
 * Migration #1509 — la TABLE MURALE devient le premier meuble à plus d'une case.
 *
 * Fait utilisateur (2026-08-31, verbatim, #1507/#1509) : « même si j'avoue que les table contre le
 * murs devraient faire 1x2 ». La recette de `table-murale-2-tabourets` couvrait une seule case : son
 * corps (plateau + consoles) mesure 1,92 m le long du mur, soit moins d'une case à 2 m/case
 * (`sceneMetresPerTile` par défaut). L'empreinte se DÉRIVANT du corps depuis le train A de ce socle
 * (`empreinteDeriveeDuProp`, `src/data/props.types.ts`), la seule façon d'obtenir 1×2 est de
 * RÉ-AUTHORER la recette — pas de figer un `foot`, qui ne tournerait pas avec le cap.
 *
 * GESTE : le corps est ÉTIRÉ dans le sens du mur (l'axe `x` du repère local, celui qui devient l'axe
 * du mur quand l'instance est au cap E/O), d'un facteur UNIQUE `K = 3 / 1,92`. Chaque abscisse locale
 * est multipliée par K — plateau, consoles, tabourets et ancres de place ensemble : la composition
 * AUTHORÉE de la recette est conservée à l'identique (les tabourets restent aux 2/3 de la
 * demi-longueur du plateau, comme avant l'étirement), seule l'échelle de l'axe du mur change. Les
 * SECTIONS (épaisseur des consoles, rayon des tabourets) et la PROFONDEUR ne sont pas touchées : ce
 * sont des cotes humaines, pas des longueurs de mur.
 *  - plateau 1,92 m → 3,00 m de long (⌈3/2⌉ = 2 cases), profondeur 1,00 m inchangée (⌈1/2⌉ = 1 case) ;
 *  - tabourets et places : ±0,64 m → ±1,00 m, soit le CENTRE de chacune des deux cases à 2 m/case —
 *    une place par case, ce que l'empreinte 2×1 rend enfin possible.
 *
 * ABORDS : les deux places s'abordaient en DIAGONALE (±1,−1), seule façon de leur donner deux cases
 * d'abord distinctes quand leurs deux sièges tombaient dans la MÊME case. Chaque siège ayant
 * désormais la sienne, l'abord redevient droit — (0,−1), depuis la salle, en face de son siège
 * (l'abord se compte depuis la CASE DU SIÈGE, `placesLocalesDuProp`).
 *
 * ENTRÉES : `src/data/props.json` (seule donnée lue et écrite). Cardinal : 1 recette, 1 volume,
 * 7 primitives, 2 places.
 *
 * MARQUEUR D'IDEMPOTENCE : la longueur du plateau. À 3,00 m le travail est fait, le script n'écrit rien.
 *
 * FAIL-FAST (porte de lecture, avant toute écriture) : entrée absente, cardinal de primitives ou de
 * places inattendu, cotes d'origine autres que celles mesurées, ou empreinte dérivée qui ne passerait
 * pas de 1×1 à 2×1 au cap d'identité — ce script étire UNE recette connue, il ne retaille pas une
 * recette qu'il ne reconnaît pas.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/props.json');
const ID = 'table-murale-2-tabourets';

/** Cotes MESURÉES sur l'arbre à l'écriture (2026-09-03) : longueur du plateau avant / après. */
const LONGUEUR_AVANT = 1.92;
const LONGUEUR_APRES = 3;
const K = LONGUEUR_APRES / LONGUEUR_AVANT;
const PRIMITIVES_ATTENDUES = 7;
const PLACES_ATTENDUES = 2;
/** L'ÉCHELLE à laquelle l'empreinte est jugée, en m/case : le défaut du monde (`LDB 15 l.12`). */
const MPT = 2;
/** Abord de chaque place APRÈS l'étirement : droit, depuis la salle (côté des tabourets, `y` local négatif). */
const ABORD_APRES = { x: 0, y: -1 };

const brut = fs.readFileSync(CIBLE, 'utf8');
const avant = JSON.parse(brut);
const echecs = [];
if (!Array.isArray(avant)) {
  console.error(`ARBITRAGE REQUIS — ${CIBLE} : racine non-tableau`);
  process.exit(1);
}

const entree = avant.find((e) => e?.id === ID);
if (!entree) {
  console.error(`ARBITRAGE REQUIS — ${CIBLE} : entrée « ${ID} » absente`);
  process.exit(1);
}

// ── L'empreinte que le CORPS dérive, recalculée ICI : une migration ne dépend pas du code applicatif
// (il changera ; le fichier migré, non). Même définition que `empreinteDeriveeDuProp` — sièges exclus,
// étendue au plan arrondie au supérieur, plancher 1 — au CAP D'IDENTITÉ (`S`), où la recette est
// écrite telle quelle et où aucune rotation n'entre.
const empriseLocale = (p) => {
  const dx = (p.kind === 'cylinder' ? p.radiusM : p.size.xM / 2);
  const dy = (p.kind === 'cylinder' ? p.radiusM : p.size.yM / 2);
  const dh = (p.kind === 'cylinder' ? p.heightM : p.size.hM) / 2;
  return {
    x0: p.center.xM - dx, x1: p.center.xM + dx,
    y0: p.center.yM - dy, y1: p.center.yM + dy,
    haut: p.center.hM + dh,
  };
};
const estSiege = (prop, p) => {
  const e = empriseLocale(p);
  return (prop.seatSlots ?? []).some((s) =>
    s.anchor.xM >= e.x0 - 1e-9 && s.anchor.xM <= e.x1 + 1e-9
    && s.anchor.yM >= e.y0 - 1e-9 && s.anchor.yM <= e.y1 + 1e-9
    && e.haut <= s.anchor.hM + 1e-9);
};
const empreinteDuCorps = (prop) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of prop.volume.primitives) {
    if (estSiege(prop, p)) continue;
    const e = empriseLocale(p);
    x0 = Math.min(x0, e.x0); x1 = Math.max(x1, e.x1);
    y0 = Math.min(y0, e.y0); y1 = Math.max(y1, e.y1);
  }
  const enCases = (m) => Math.max(1, Math.ceil(m / MPT - 1e-9));
  return Number.isFinite(x0) ? { w: enCases(x1 - x0), h: enCases(y1 - y0) } : { w: 1, h: 1 };
};

const plateau = (entree.volume?.primitives ?? []).find((p) => p.kind === 'box');
if (plateau && plateau.size.xM === LONGUEUR_APRES) {
  console.log(`src/data/props.json : no-op (déjà migré — ${ID}, plateau de ${LONGUEUR_APRES} m)`);
  process.exit(0);
}

if ((entree.volume?.primitives ?? []).length !== PRIMITIVES_ATTENDUES)
  echecs.push(`${ID} : ${(entree.volume?.primitives ?? []).length} primitive(s) ≠ ${PRIMITIVES_ATTENDUES} mesurées`);
if ((entree.seatSlots ?? []).length !== PLACES_ATTENDUES)
  echecs.push(`${ID} : ${(entree.seatSlots ?? []).length} place(s) ≠ ${PLACES_ATTENDUES} mesurées`);
if (!plateau || plateau.size.xM !== LONGUEUR_AVANT)
  echecs.push(`${ID} : plateau de ${plateau ? plateau.size.xM : 'aucune caisse'} m ≠ ${LONGUEUR_AVANT} m mesurés`);
const avantEmpreinte = entree.volume ? empreinteDuCorps(entree) : null;
if (!avantEmpreinte || avantEmpreinte.w !== 1 || avantEmpreinte.h !== 1)
  echecs.push(`${ID} : empreinte de départ ${avantEmpreinte ? `${avantEmpreinte.w}×${avantEmpreinte.h}` : 'sans recette'} ≠ 1×1 à ${MPT} m/case`);

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), RIEN n’est écrit :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

/** Les cotes sont AUTHORÉES : elles s'écrivent au centimètre près, jamais en résidu de flottant. */
const cote = (m) => Math.round(m * 1e6) / 1e6;

const etire = {
  ...entree,
  volume: {
    ...entree.volume,
    primitives: entree.volume.primitives.map((p) => ({
      ...p,
      center: { ...p.center, xM: cote(p.center.xM * K) },
      ...(p.kind === 'box' && p.size.xM === LONGUEUR_AVANT ? { size: { ...p.size, xM: LONGUEUR_APRES } } : {}),
    })),
  },
  seatSlots: entree.seatSlots.map((s) => ({
    ...s,
    anchor: { ...s.anchor, xM: cote(s.anchor.xM * K) },
    approach: { ...ABORD_APRES },
  })),
};

const apresEmpreinte = empreinteDuCorps(etire);
if (apresEmpreinte.w !== 2 || apresEmpreinte.h !== 1) {
  console.error(`ARBITRAGE REQUIS — ${ID} : l’étirement rend ${apresEmpreinte.w}×${apresEmpreinte.h} au lieu de 2×1 à ${MPT} m/case, RIEN n’est écrit`);
  process.exit(1);
}

const apres = avant.map((e) => (e?.id === ID ? etire : e));
const sortieTexte = JSON.stringify(apres, null, 2);
fs.writeFileSync(CIBLE, sortieTexte, 'utf8');

// ── PREUVE post-écriture : même cardinal d'entrées et même ordre, la recette étirée rend 2×1, et
// AUCUNE autre entrée n'a bougé (ce script étire UNE recette).
{
  const relu = JSON.parse(fs.readFileSync(CIBLE, 'utf8'));
  const post = [];
  if (relu.length !== avant.length) post.push(`POST : ${relu.length} entrée(s) ≠ ${avant.length}`);
  for (let i = 0; i < relu.length; i++) {
    if (relu[i].id !== avant[i].id) post.push(`POST [${i}] : id ${relu[i].id} ≠ ${avant[i].id}`);
    if (relu[i].id !== ID && JSON.stringify(relu[i]) !== JSON.stringify(avant[i])) post.push(`POST ${relu[i].id} : entrée altérée hors périmètre`);
  }
  const migre = relu.find((e) => e.id === ID);
  const empreinte = empreinteDuCorps(migre);
  if (empreinte.w !== 2 || empreinte.h !== 1) post.push(`POST ${ID} : empreinte ${empreinte.w}×${empreinte.h} ≠ 2×1`);
  if (post.length) {
    console.error(`ARBITRAGE REQUIS — ${post.length} anomalie(s) après écriture :`);
    for (const m of post) console.error(`  ${m}`);
    process.exit(1);
  }
}

console.log(
  `src/data/props.json : ${ID} étiré ×${K} sur l’axe du mur — plateau ${LONGUEUR_AVANT} m → ${LONGUEUR_APRES} m, `
  + `empreinte 1×1 → 2×1 à ${MPT} m/case (1×2 au cap E/O), deux places d’une case chacune, abord droit (#1509)`,
);
