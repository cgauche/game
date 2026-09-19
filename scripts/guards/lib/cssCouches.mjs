// PARSEUR des TROIS COUCHES CSS (#1800) — pur, sans disque : il LIT du texte et rend des règles,
// des déclarations et deux prédicats. Le VERDICT appartient aux gardes (`src/ui/ui-ratchets.test.ts`),
// la MESURE à `cssCouchesAudit.ts` qui, lui, touche le disque.
//
// Pourquoi un LEXER et pas une regex : la regex plate `([^{}]+)\{([^{}]*)\}` ne voit pas les blocs
// IMBRIQUÉS — elle rend le CONTENU d'un `@media` comme s'il vivait au premier niveau, et perd donc
// le contexte. Un contexte n'est pas un abri : `@media (max-width:700px) { .x { font-size:12px } }`
// déclare autant d'identité qu'au premier niveau. Le lexer empile les préludes `@media`/`@supports`/
// `@container` et les rend dans `media` ; il SAUTE `@keyframes`/`@font-face`/`@property`/
// `@counter-style`, dont le corps n'est pas fait de sélecteurs (`from`/`to`/pourcentages).
//
// CONTRAT partagé avec le cliquet (xx) : `reglesCss` rend le MÊME `{ selecteurs, corps }` qu'avant
// la réécriture, enrichi de `media`.

/** Feuilles PARTAGÉES de `src/ui/styles/` : aucune primitive ne les possède, aucun module d'écran
 *  n'en fait partie. Source UNIQUE — `SHARED_CSS_FILES` (ui-ratchets), `CSS_PARTAGES`
 *  (`build-primitives.mjs`) et `modulesDEcran()` en dérivent tous. */
export const FEUILLES_PARTAGEES = [
  'src/ui/styles/base.css',
  'src/ui/styles/components.css',
  'src/ui/styles/tabs.css',
  'src/ui/styles/layout.css',
];

/** Couche des modules de style de `src/ui`. */
export const RACINE_DES_MODULES = 'src/ui/styles/';

/** Zone d'un chemin : ses deux premiers segments (`src/ui/`, `src/gameIso/`). */
const zoneDe = (chemin) => `${String(chemin).split('/').slice(0, 2).join('/')}/`;

/**
 * Un module de primitive vit dans `RACINE_DES_MODULES`, ou — pour une primitive qui n'habite pas
 * `src/ui` — dans la ZONE de son `fichier` (#1806 A3). Tout autre chemin sort de la couche.
 * @param {string} fichier @param {string} css @returns {boolean}
 */
export function moduleHorsCouche(fichier, css) {
  if (!String(css).endsWith('.css')) return true;
  if (String(css).startsWith(RACINE_DES_MODULES)) return false;
  const zone = zoneDe(fichier);
  return zone === 'src/ui/' || !String(css).startsWith(zone);
}

/** At-rules dont le corps ne porte PAS de sélecteurs : leur bloc entier est sauté. */
const AT_SANS_SELECTEURS = /^@(keyframes|-webkit-keyframes|font-face|property|counter-style)\b/;

/** Neutralise les commentaires `/* … *\/` en préservant les positions (espaces et sauts de ligne). */
const sansCommentaires = (texte) =>
  texte.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/**
 * Règles d'une feuille, à TOUTE profondeur.
 * @param {string} texte
 * @returns {{ selecteurs: string[], corps: string, media: string | null }[]} `media` = les préludes
 *   at-rule empilés, joints par ` && ` (`null` au premier niveau).
 */
export function reglesCss(texte) {
  const src = sansCommentaires(texte);
  /** @type {{ selecteurs: string[], corps: string, media: string | null }[]} */
  const out = [];
  /** @type {string[]} */
  const contexte = [];
  let tampon = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      tampon += c;
      if (c === quote && src[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; tampon += c; continue; }
    if (c === '{') {
      const tete = tampon.trim().replace(/\s+/g, ' ');
      tampon = '';
      if (tete.startsWith('@')) {
        if (AT_SANS_SELECTEURS.test(tete)) { i = finDeBloc(src, i); continue; }
        contexte.push(tete);
        continue;
      }
      // Règle : son corps court jusqu'à sa propre accolade fermante.
      const fin = finDeBloc(src, i);
      const selecteurs = decoupeSelecteurs(tete);
      if (selecteurs.length) {
        out.push({ selecteurs, corps: src.slice(i + 1, fin), media: contexte.length ? contexte.join(' && ') : null });
      }
      i = fin;
      continue;
    }
    if (c === '}') { contexte.pop(); tampon = ''; continue; }
    // At-rule DÉCLARATION (`@import …;`, `@charset …;`) : elle se clôt sur `;`, sans bloc — le tampon
    // repart à zéro, sans quoi son prélude se collerait à la tête de la règle suivante.
    if (c === ';') { tampon = ''; continue; }
    tampon += c;
  }
  return out;
}

/**
 * Découpe une LISTE de sélecteurs sur ses virgules de NIVEAU 0 : celles d'un `:has()`/`:is()`/
 * `:not()`/`:where()` séparent des arguments, pas des sélecteurs — `label:has(> a, > .btn)` est UN
 * sélecteur, et le couper en deux inventait une règle fantôme (`> .btn)`) tout en perdant la vraie.
 * @param {string} tete @returns {string[]}
 */
export function decoupeSelecteurs(tete) {
  const out = [];
  let prof = 0;
  let courant = '';
  let quote = null;
  for (let k = 0; k < tete.length; k++) {
    const c = tete[k];
    if (quote) { courant += c; if (c === quote && tete[k - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; courant += c; continue; }
    if (c === '(' || c === '[') prof++;
    else if (c === ')' || c === ']') prof--;
    else if (c === ',' && prof === 0) { out.push(courant); courant = ''; continue; }
    courant += c;
  }
  out.push(courant);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Index de l'accolade fermante appairée à celle ouverte en `i`. */
function finDeBloc(src, i) {
  let prof = 0;
  let quote = null;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (quote) { if (c === quote && src[k - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return k; }
  }
  return src.length;
}

/**
 * Déclarations d'un corps de règle. Les `;` entre parenthèses ne séparent rien.
 * @param {string} corps @returns {{ prop: string, valeur: string }[]}
 */
export function declarations(corps) {
  const out = [];
  let prof = 0;
  let courant = '';
  const pousser = (d) => {
    const at = d.indexOf(':');
    if (at < 0) return;
    const prop = d.slice(0, at).trim();
    const valeur = d.slice(at + 1).trim();
    if (prop && valeur) out.push({ prop, valeur });
  };
  for (const c of corps) {
    if (c === '(') prof++;
    else if (c === ')') prof--;
    if (c === ';' && prof === 0) { pousser(courant); courant = ''; continue; }
    courant += c;
  }
  pousser(courant);
  return out;
}

/** Propriétés de PLACEMENT, liste FERMÉE (docs/charte-ui.md § « Architecture CSS ») : elles PLACENT,
 *  bornent, ferrent ou retirent une puce — elles ne PEIGNENT pas. Tout le reste est de l'IDENTITÉ et
 *  appartient à une primitive. `cursor` est de l'identité : l'affordance est la matière d'un contrôle. */
export const PROPRIETES_DE_PLACEMENT = new Set([
  'display', 'flex', 'grid', 'gap', 'row-gap', 'column-gap', 'order',
  'position', 'inset', 'top', 'right', 'bottom', 'left', 'z-index',
  'width', 'height', 'aspect-ratio', 'box-sizing',
  'margin', 'padding', 'overflow', 'float', 'clear', 'columns',
  'transform', 'transform-origin', 'translate', 'rotate', 'scale',
  'text-align', 'vertical-align', 'white-space', 'text-overflow', 'overflow-wrap', 'word-break', 'hyphens',
  'visibility', 'pointer-events', 'touch-action', 'user-select', 'resize',
  'isolation', 'contain', 'will-change', 'list-style',
]);

/** Familles de PLACEMENT à préfixe (`flex-grow`, `grid-template-columns`, `padding-top`…). */
const PREFIXES_DE_PLACEMENT = [
  'flex-', 'grid-', 'place-', 'align-', 'justify-', 'inset-', 'min-', 'max-',
  'margin-', 'padding-', 'overflow-', 'overscroll-', 'scroll-', 'column-', 'list-style-',
];

/** Vrai si la propriété PLACE. Une variable CSS (`--x`) est un PARAMÈTRE de primitive (patron
 *  `.swatch`), jamais une matière — elle reste hors du stock d'identité. */
export const estPlacement = (prop) =>
  prop.startsWith('--')
  || PROPRIETES_DE_PLACEMENT.has(prop)
  || PREFIXES_DE_PLACEMENT.some((p) => prop.startsWith(p));

/** Propriétés dont la VALEUR doit se poser sur l'échelle `--sp-*` (base.css). */
export const PROPRIETES_A_ECHELLE = new Set([
  'gap', 'row-gap', 'column-gap',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-block-start', 'padding-block-end',
  'padding-inline', 'padding-inline-start', 'padding-inline-end',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-block', 'margin-block-start', 'margin-block-end',
  'margin-inline', 'margin-inline-start', 'margin-inline-end',
]);

/** Un littéral de longueur non nul (`12px`, `1.5rem`) — `0`, `auto`, `%`/`vw`/`vh`, `env()` et
 *  `var(--sp-*)` passent, un multiple calculé (`calc(3 * var(--sp-md))`) aussi. */
const LITTERAL_DE_LONGUEUR = /(?<![\w.#-])(\d*\.?\d+)(px|rem|em)(?![\w-])/g;

/** Vrai si la valeur contient un littéral de longueur non nul — donc hors échelle. */
export function valeurHorsEchelle(valeur) {
  LITTERAL_DE_LONGUEUR.lastIndex = 0;
  let m;
  while ((m = LITTERAL_DE_LONGUEUR.exec(valeur))) if (Number(m[1]) !== 0) return true;
  return false;
}
