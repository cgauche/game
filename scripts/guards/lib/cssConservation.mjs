// PREUVE STATIQUE qu'une migration CSS conserve le rendu (#1806, épic #1811). Trois mesures sur le
// graphe d'imports d'une feuille d'entrée, lu dans deux IMAGES (avant / après) :
//   · `ecarts`     — les déclarations (média | sélecteur | propriété | valeur) DISPARUES et APPARUES ;
//                    le reliquat d'un déplacement « tel quel » est vide, celui d'une recomposition
//                    est la liste des changements VOULUS, à relire un par un ;
//   · `inversions` — les paires de déclarations CONSERVÉES, de même sujet, même propriété, même
//                    importance et même poids, dont l'ordre relatif a changé : à poids égal c'est
//                    l'ordre d'import qui tranche, médias compris (une base passée après sa
//                    surcharge responsive la tue) ;
//   · `bascules`   — une déclaration dont le SÉLECTEUR a changé (disparue ici, apparue là, même
//                    propriété / valeur / média, composé de droite apparenté) et qui ne l'emporte
//                    plus, ou l'emporte désormais, sur une déclaration CONSERVÉE visant une classe
//                    commune (`.party-dock` → `.stage > .party-dock` passe devant `.party-dock.on`).
// ANGLES MORTS, à couvrir au markup : (a) deux classes POSÉES ENSEMBLE sur un élément sans jamais
// partager un composé (`.skin-tole[data-ton]` et `.vc-btn`) ne forment ni paire ni bascule — une
// peau se garde par un contrat de poids (`src/ui/ui-ratchets.test.ts`) ; (b) une inversion ou une
// bascule ne compte que si les deux sélecteurs peuvent viser le MÊME élément : la sonde rapporte,
// elle ne connaît pas le DOM.
// PUR : la lecture des fichiers est injectée (`lire(rel) → texte | null`).
import { posix } from 'node:path';
import { declarations, reglesCss } from './cssCouches.mjs';

const IMPORT_RX = /@import\s+(?:url\()?['"]([^'"]+)['"]\)?[^;]*;/g;

/**
 * Les feuilles du graphe d'imports, dans l'ordre où le navigateur les applique (un import est
 * déplié AVANT le reste de sa feuille ; une feuille déjà vue n'est pas relue).
 * @param {string} entree @param {(rel: string) => string | null} lire
 * @returns {{ rel: string, texte: string }[]}
 */
export function deplierImports(entree, lire, vus = new Set()) {
  if (vus.has(entree)) return [];
  vus.add(entree);
  const texte = lire(entree);
  if (texte === null) return [];
  const feuilles = [];
  const propre = texte.replace(IMPORT_RX, (_, cible) => {
    feuilles.push(...deplierImports(posix.normalize(posix.join(posix.dirname(entree), cible)), lire, vus));
    return '';
  });
  feuilles.push({ rel: entree, texte: propre });
  return feuilles;
}

/** Découpe une liste d'arguments à la virgule de niveau 0. */
function argumentsDe(liste) {
  const out = [];
  let [niveau, debut] = [0, 0];
  for (let i = 0; i < liste.length; i++) {
    if (liste[i] === '(') niveau++;
    else if (liste[i] === ')') niveau--;
    else if (liste[i] === ',' && niveau === 0) { out.push(liste.slice(debut, i)); debut = i + 1; }
  }
  return [...out, liste.slice(debut)];
}

const plusLourd = (a, b) => (comparerTriplets(a, b) >= 0 ? a : b);
const comparerTriplets = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Poids `[ids, classes, éléments]` d'un sélecteur. `:not()` / `:is()` / `:has()` pèsent leur argument
 * le plus lourd, `:where()` ne pèse rien, toute autre pseudo-classe (fonctionnelle ou non) pèse une
 * classe, un pseudo-élément pèse un élément.
 * @param {string} selecteur @returns {[number, number, number]}
 */
export function poids(selecteur) {
  const p = [0, 0, 0];
  let s = selecteur;
  // Pseudo-classes fonctionnelles, de l'intérieur vers l'extérieur.
  for (let garde = 0; garde < 32; garde++) {
    const m = /:([a-z-]+)\(((?:[^()]|\([^()]*\))*)\)/.exec(s);
    if (!m) break;
    if (m[1] === 'not' || m[1] === 'is' || m[1] === 'has') {
      const lourd = argumentsDe(m[2]).map((x) => poids(x)).reduce(plusLourd, [0, 0, 0]);
      for (let i = 0; i < 3; i++) p[i] += lourd[i];
    } else if (m[1] !== 'where') p[1] += 1;
    s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
  }
  s = s.replace(/\[[^\]]*\]/g, () => { p[1] += 1; return ' '; });
  s = s.replace(/::[a-z-]+/g, () => { p[2] += 1; return ' '; });
  s = s.replace(/:[a-z-]+/g, () => { p[1] += 1; return ' '; });
  s = s.replace(/#[\w-]+/g, () => { p[0] += 1; return ' '; });
  s = s.replace(/\.[\w-]+/g, () => { p[1] += 1; return ' '; });
  p[2] += (s.match(/[a-zA-Z][\w-]*/g) ?? []).length;
  return p;
}

/** Spécificité lisible `ids-classes-éléments`. */
export const specificite = (selecteur) => poids(selecteur).join('-');

/** −1 / 0 / 1 : le premier sélecteur pèse moins / autant / plus que le second. */
export const comparerPoids = (a, b) => Math.sign(comparerTriplets(poids(a), poids(b)));

const composeDeDroite = (selecteur) => {
  const parts = selecteur.replace(/\([^)]*\)/g, '').trim().split(/\s+|>|\+|~/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
};
const classesDe = (compose) => (compose.match(/\.[a-zA-Z_-][\w-]*/g) ?? []).map((c) => c.slice(1));

/** Le SUJET d'un sélecteur : les classes de son composé de droite, triées (à défaut, le composé). */
export function sujet(selecteur) {
  const droite = composeDeDroite(selecteur);
  const classes = classesDe(droite).sort();
  return classes.length ? classes.join('.') : droite;
}

const compacter = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Toutes les déclarations du graphe, dans l'ordre de cascade.
 * @returns {{ pos: number, rel: string, media: string, sel: string, prop: string, valeur: string, important: boolean }[]}
 */
export function aplatir(entree, lire) {
  const out = [];
  for (const { rel, texte } of deplierImports(entree, lire)) {
    for (const regle of reglesCss(texte)) {
      for (const sel of regle.selecteurs) {
        for (const d of declarations(regle.corps)) {
          const valeur = compacter(d.valeur);
          out.push({ pos: out.length, rel, media: compacter(regle.media ?? ''), sel: compacter(sel), prop: d.prop, valeur, important: /!\s*important\s*$/.test(valeur) });
        }
      }
    }
  }
  return out;
}

const cleDe = (e) => `${e.media}|${e.sel}|${e.prop}|${e.valeur}`;

function parCle(entrees) {
  const m = new Map();
  for (const e of entrees) m.set(cleDe(e), [...(m.get(cleDe(e)) ?? []), e]);
  return m;
}

/** Déclarations DISPARUES (dans `avant`, plus dans `apres`) et APPARUES — comptées en multi-ensemble. */
export function ecarts(avant, apres) {
  const [a, b] = [parCle(avant), parCle(apres)];
  const surplus = (de, vers) => [...de].flatMap(([k, l]) => l.slice(0, Math.max(0, l.length - (vers.get(k)?.length ?? 0))));
  return { disparues: surplus(a, b), apparues: surplus(b, a) };
}

const derniers = (entrees) => new Map([...parCle(entrees)].map(([k, l]) => [k, l[l.length - 1]]));

/**
 * Paires conservées dont l'ordre relatif a changé, à sujet / propriété / importance / poids égaux.
 * Deux déclarations du MÊME sélecteur sous le MÊME média ne forment pas une paire (redéclaration).
 * @returns {{ groupe: string, a: string, b: string, deplacements: [string, string][] }[]}
 */
export function inversions(avant, apres) {
  const [a, b] = [derniers(avant), derniers(apres)];
  const groupes = new Map();
  for (const [k, e] of a) {
    if (!b.has(k)) continue;
    const g = `${sujet(e.sel)}|${e.prop}|${specificite(e.sel)}${e.important ? '|!important' : ''}`;
    groupes.set(g, [...(groupes.get(g) ?? []), k]);
  }
  const out = [];
  for (const [groupe, cles] of groupes) {
    for (let i = 0; i < cles.length; i++) {
      for (let j = i + 1; j < cles.length; j++) {
        const [x, y] = [cles[i], cles[j]];
        if (a.get(x).sel === a.get(y).sel && a.get(x).media === a.get(y).media) continue;
        if (Math.sign(a.get(x).pos - a.get(y).pos) === Math.sign(b.get(x).pos - b.get(y).pos)) continue;
        out.push({ groupe, a: x, b: y, deplacements: [[a.get(x).rel, b.get(x).rel], [a.get(y).rel, b.get(y).rel]] });
      }
    }
  }
  return out;
}

/** `x` l'emporte-t-il sur `y` à la cascade : importance, puis poids, puis ordre. */
const lEmporte = (x, y) => (x.important !== y.important ? x.important : (comparerPoids(x.sel, y.sel) || Math.sign(x.pos - y.pos)) > 0);

const partagentUneClasse = (selA, selB) => {
  const b = new Set(classesDe(composeDeDroite(selB)));
  return classesDe(composeDeDroite(selA)).some((c) => b.has(c));
};

/**
 * Bascules de cascade causées par un CHANGEMENT DE SÉLECTEUR : pour chaque déclaration apparue dont
 * l'ancêtre disparu se reconnaît (même propriété, valeur et média, composé de droite apparenté),
 * toute déclaration CONSERVÉE de même propriété, de valeur différente et visant une classe commune,
 * contre laquelle le verdict de cascade n'est plus le même.
 * @returns {{ avant: string, apres: string, contre: string, gagnaitAvant: boolean, gagneApres: boolean }[]}
 */
export function bascules(avant, apres) {
  const { disparues, apparues } = ecarts(avant, apres);
  const [a, b] = [derniers(avant), derniers(apres)];
  const out = [];
  for (const neuve of apparues) {
    const ancetre = disparues.find((d) => d.prop === neuve.prop && d.valeur === neuve.valeur && d.media === neuve.media && d.sel !== neuve.sel && partagentUneClasse(d.sel, neuve.sel));
    if (!ancetre) continue;
    for (const [k, rivaleApres] of b) {
      const rivaleAvant = a.get(k);
      if (!rivaleAvant || rivaleApres.prop !== neuve.prop || rivaleApres.valeur === neuve.valeur) continue;
      if (!partagentUneClasse(rivaleApres.sel, neuve.sel) && !partagentUneClasse(rivaleApres.sel, ancetre.sel)) continue;
      const [gagnaitAvant, gagneApres] = [lEmporte(ancetre, rivaleAvant), lEmporte(neuve, rivaleApres)];
      if (gagnaitAvant !== gagneApres) out.push({ avant: cleDe(ancetre), apres: cleDe(neuve), contre: k, gagnaitAvant, gagneApres });
    }
  }
  return out;
}
