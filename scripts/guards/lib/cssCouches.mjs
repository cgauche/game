// PARSEUR et MESURE PURE des TROIS COUCHES CSS (#1800) — sans disque : il LIT du texte et rend des
// règles, des déclarations, deux prédicats, et les sites d'IDENTITÉ et d'ESPACEMENT d'une IMAGE
// `{ fichiers, manifeste, partagees }` — partitionnée en STOCK (modules d'écran et `layout.css`) et
// zone EXEMPTE (feuilles partagées, modules de primitive), puis VENTILÉE entre deux images
// (`ventilerDecrue`). Le VERDICT
// appartient aux gardes (`src/ui/ui-ratchets.test.ts`, `reclassementCss.mjs`) ; la LECTURE des
// images (disque, ref git) à `cssCouchesAudit.ts`. Pur `.mjs` parce que les hooks de commit et de
// push le chargent sous `node` nu (#1806).
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
 *  (`build-primitives.mjs`) et `feuillesPartageesDe` (la liste lue dans une image) en dérivent. */
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

/**
 * Corps INTERNE de la tranche `@media` dont le prélude est `requete`, accolades appariées.
 * Source UNIQUE des lectures par tranche (`src/ui/ui-ratchets.test.ts`, `src/ui/CombatConsole.test.tsx`).
 * Une tranche ABSENTE lève : rendre `''` laissait passer au vert tout contrat qui l'interroge.
 * @param {string} css @param {string} requete @returns {string}
 */
export function mediaBlock(css, requete) {
  const at = css.indexOf(requete);
  if (at < 0) throw new Error(`tranche « ${requete} » absente de la feuille lue`);
  const ouvre = css.indexOf('{', at);
  let prof = 0;
  for (let i = ouvre; i < css.length; i++) {
    if (css[i] === '{') prof++;
    else if (css[i] === '}' && --prof === 0) return css.slice(ouvre + 1, i);
  }
  throw new Error(`tranche « ${requete} » non refermée`);
}

/**
 * La feuille PRIVÉE de toutes ses tranches `@media` : ce qui doit valoir à TOUTE largeur est là.
 * Une règle glissée dans une tranche disparaît de cette vue — c'est ce que les invariants traquent.
 * @param {string} css @returns {string}
 */
export function baseSection(css) {
  let out = css;
  for (;;) {
    const at = out.indexOf('@media');
    if (at < 0) return out;
    let prof = 0;
    let fin = out.length;
    for (let i = out.indexOf('{', at); i < out.length; i++) {
      if (out[i] === '{') prof++;
      else if (out[i] === '}' && --prof === 0) { fin = i + 1; break; }
    }
    out = out.slice(0, at) + out.slice(fin);
  }
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
  /* `contain` et `container` sont de la même famille : ils déclarent une PORTÉE de mise en page —
     ce sur quoi une boîte se mesure —, jamais une matière. Une rangée qui se déclare conteneur de
     requête (`container-type: size`) donne à ses surfaces un repère à elles ; c'est du placement,
     et c'est l'écran qui compose les rangées. */
  'isolation', 'contain', 'container', 'will-change', 'list-style',
]);

/** Familles de PLACEMENT à préfixe (`flex-grow`, `grid-template-columns`, `padding-top`…). */
const PREFIXES_DE_PLACEMENT = [
  'container-',
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

/** La couche LAYOUT : feuille partagée des primitives de PLACEMENT, mesurée comme un module d'écran —
 *  identité et espacement au stock (docs/charte-ui.md § « Architecture CSS »). */
export const FEUILLE_LAYOUT = 'src/ui/styles/layout.css';

/** Le manifeste des primitives, chemin UNIQUE : la frontière primitive / écran s'y lit. */
export const CHEMIN_MANIFESTE = 'src/data/primitives.manifest.json';

/** Ce fichier : la liste `FEUILLES_PARTAGEES` d'une image se lit dans SON texte (`feuillesPartageesDe`). */
export const CHEMIN_COUCHES = 'scripts/guards/lib/cssCouches.mjs';

/**
 * LECTEUR UNIQUE du manifeste d'une image. Absent → `[]` ; JSON invalide ou non-tableau → lève.
 * @param {string | null} texte @returns {{ id: string, css?: string }[]}
 */
export function manifesteDe(texte) {
  if (texte == null) return [];
  let m;
  try {
    m = JSON.parse(texte);
  } catch (e) {
    throw new Error(`${CHEMIN_MANIFESTE} illisible : ${e.message}`, { cause: e });
  }
  if (!Array.isArray(m)) throw new Error(`${CHEMIN_MANIFESTE} n'est pas un tableau`);
  return m;
}

/** La déclaration de `FEUILLES_PARTAGEES` dans le texte de `CHEMIN_COUCHES`. */
const DECLARATION_DES_PARTAGEES = /export const FEUILLES_PARTAGEES = \[([^\]]*)\]/;

/**
 * LECTEUR PUR de `FEUILLES_PARTAGEES` dans le TEXTE de `CHEMIN_COUCHES` d'une image. Absent → `[]` ;
 * texte sans la déclaration → lève.
 * @param {string | null} texte @returns {string[]}
 */
export function feuillesPartageesDe(texte) {
  if (texte == null) return [];
  const m = DECLARATION_DES_PARTAGEES.exec(sansCommentaires(texte));
  if (!m) throw new Error(`${CHEMIN_COUCHES} : déclaration \`FEUILLES_PARTAGEES\` introuvable`);
  return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]);
}

/** Le sélecteur NORMALISÉ d'une règle : la liste telle qu'elle est écrite, espaces réduits. Le
 *  contexte `@media` n'entre PAS dans la clé — il n'est pas un abri, et l'y mettre ferait dériver
 *  le stock au moindre déplacement de breakpoint. */
export const cleDeRegle = (selecteurs) => selecteurs.join(', ').replace(/\s+/g, ' ');

/**
 * Sites d'IDENTITÉ : une déclaration qui n'est pas du PLACEMENT.
 * @param {readonly { rel: string, text: string }[]} fichiers @returns {{ file: string, ref: string }[]}
 */
export function sitesIdentiteEcran(fichiers) {
  const sites = [];
  for (const f of fichiers) {
    for (const { selecteurs, corps } of reglesCss(f.text)) {
      const sel = cleDeRegle(selecteurs);
      for (const { prop } of declarations(corps)) {
        if (!estPlacement(prop)) sites.push({ file: f.rel, ref: `${sel} :: ${prop}` });
      }
    }
  }
  return sites;
}

/**
 * Sites d'ESPACEMENT hors échelle `--sp-*`.
 * @param {readonly { rel: string, text: string }[]} fichiers @returns {{ file: string, ref: string }[]}
 */
export function sitesEspacementHorsEchelle(fichiers) {
  const sites = [];
  for (const f of fichiers) {
    for (const { selecteurs, corps } of reglesCss(f.text)) {
      const sel = cleDeRegle(selecteurs);
      for (const { prop, valeur } of declarations(corps)) {
        if (PROPRIETES_A_ECHELLE.has(prop) && valeurHorsEchelle(valeur)) {
          sites.push({ file: f.rel, ref: `${sel} :: ${prop} :: ${valeur.replace(/\s+/g, ' ')}` });
        }
      }
    }
  }
  return sites;
}

/**
 * Les modules qu'une primitive POSSÈDE (champ `css` du manifeste).
 * @param {readonly { id: string, css?: string }[]} manifeste @returns {Set<string>}
 */
export function modulesDePrimitive(manifeste) {
  return new Set(manifeste.map((e) => e.css).filter((c) => typeof c === 'string'));
}

/**
 * La zone EXEMPTE d'une image, source UNIQUE de sa frontière : les modules revendiqués au manifeste
 * et les feuilles partagées de SA liste, hors `FEUILLE_LAYOUT`. Tout le reste est au stock.
 * @param {{ manifeste: readonly { id: string, css?: string }[], partagees: readonly string[] }} image
 * @returns {Set<string>}
 */
export function modulesExemptes({ manifeste, partagees }) {
  const out = modulesDePrimitive(manifeste);
  for (const f of partagees) if (f !== FEUILLE_LAYOUT) out.add(f);
  return out;
}

/**
 * Les modules d'ÉCRAN d'une image : son stock (`modulesExemptes` en est le complément) moins
 * `FEUILLE_LAYOUT`.
 * @param {{ fichiers: readonly { rel: string, text: string }[], manifeste: readonly { id: string, css?: string }[], partagees: readonly string[] }} image
 */
export function modulesDEcran(image) {
  const exempts = modulesExemptes(image);
  return image.fichiers.filter((f) => !exempts.has(f.rel) && f.rel !== FEUILLE_LAYOUT);
}

/**
 * La MÊME mesure jouée sur les deux zones d'une image. `stock` : tout ce qui n'est pas exempté —
 * modules d'écran et `FEUILLE_LAYOUT` —, ce que jugent les cliquets (xxi)/(xxii). `exempte` :
 * `modulesExemptes`.
 * @param {{ fichiers: readonly { rel: string, text: string }[], manifeste: readonly { id: string, css?: string }[], partagees: readonly string[] }} image
 */
export function partitionCss(image) {
  const exempts = modulesExemptes(image);
  const stock = image.fichiers.filter((f) => !exempts.has(f.rel));
  const exempte = image.fichiers.filter((f) => exempts.has(f.rel));
  return {
    stock: { identite: sitesIdentiteEcran(stock), espacement: sitesEspacementHorsEchelle(stock) },
    exempte: { identite: sitesIdentiteEcran(exempte), espacement: sitesEspacementHorsEchelle(exempte) },
  };
}

/**
 * Sites qu'un module porterait s'il était un module d'ÉCRAN, PAR VOLET : le prix d'une revendication,
 * mesuré sur l'image où elle est posée. Texte absent → 0.
 * @param {string} module @param {string | null} texte
 * @returns {{ identite: number, espacement: number, n: number }} `n` = identité + espacement
 */
export function sitesSiEcran(module, texte) {
  if (texte == null) return { identite: 0, espacement: 0, n: 0 };
  const f = [{ rel: module, text: texte }];
  const identite = sitesIdentiteEcran(f).length;
  const espacement = sitesEspacementHorsEchelle(f).length;
  return { identite, espacement, n: identite + espacement };
}

/**
 * Les revendications ARMÉES entre deux côtés `{ manifeste, partagees, lire }` : un module exempté à la
 * tête, NEUF ou à 0 site à la base, qui en porte N > 0 à la tête (#1806, juge de
 * diff du 2026-09-23). `touches` = les chemins que le geste modifie : un module déjà exempté et
 * intouché a le même texte aux deux bouts, il ne s'arme donc pas — il n'est pas lu.
 * @param {{ manifeste: readonly { id: string, css?: string }[], partagees: readonly string[], lire: (f: string) => string | null }} base
 * @param {typeof base} tete @param {Iterable<string>} touches
 * @returns {{ module: string, identite: number, espacement: number, n: number }[]} triées
 */
export function revendicationsArmees(base, tete, touches) {
  const avant = modulesExemptes(base);
  const touche = new Set(touches);
  return [...modulesExemptes(tete)]
    .filter((m) => !avant.has(m) || touche.has(m))
    .sort()
    .filter((m) => !avant.has(m) || sitesSiEcran(m, base.lire(m)).n === 0)
    .map((module) => ({ module, ...sitesSiEcran(module, tete.lire(module)) }))
    .filter((r) => r.n > 0);
}

/** Les deux volets d'une mesure CSS. */
const VOLETS = ['identite', 'espacement'];

/** Sites qu'un chemin porte AU STOCK d'un côté : une feuille de `RACINE_DES_MODULES` non exemptée. */
const sitesAuStock = (cote, exempts, f) =>
  f.startsWith(RACINE_DES_MODULES) && f.endsWith('.css') && !exempts.has(f)
    ? sitesSiEcran(f, cote.lire(f))
    : { identite: 0, espacement: 0, n: 0 };

/**
 * Le PRIX d'un intervalle `base → tete`, par volet : ce que les revendications ARMÉES
 * (`revendicationsArmees`) ont fait sortir du stock, soit `min(Σ N du volet, max(0, −Δstock du
 * volet))` — un intervalle dont le stock ne baisse pas ne coûte rien (juge de seconde passe du
 * 2026-09-23). La MÊME fonction sert le commit (parent, commit), la plage poussée (base, tête) et
 * `ventilerDecrue`. `Δstock` se lit sur les seuls chemins qui peuvent changer : `touches` et les
 * modules dont la frontière bouge.
 * @param {Parameters<typeof revendicationsArmees>[0]} base @param {typeof base} tete
 * @param {Iterable<string>} touches
 * @returns {{ revendications: ReturnType<typeof revendicationsArmees>, deltaStock: { identite: number, espacement: number }, identite: number, espacement: number, n: number }}
 */
export function prixDuReclassement(base, tete, touches) {
  const chemins = [...touches];
  const revendications = revendicationsArmees(base, tete, chemins);
  const deltaStock = { identite: 0, espacement: 0 };
  const prix = { identite: 0, espacement: 0, n: 0 };
  if (!revendications.length) return { revendications, deltaStock, ...prix };
  const exBase = modulesExemptes(base);
  const exTete = modulesExemptes(tete);
  const frontiere = [...exBase, ...exTete].filter((m) => exBase.has(m) !== exTete.has(m));
  for (const f of new Set([...chemins, ...frontiere])) {
    const avant = sitesAuStock(base, exBase, f);
    const apres = sitesAuStock(tete, exTete, f);
    for (const v of VOLETS) deltaStock[v] += apres[v] - avant[v];
  }
  for (const v of VOLETS) {
    prix[v] = Math.min(revendications.reduce((s, r) => s + r[v], 0), Math.max(0, -deltaStock[v]));
  }
  prix.n = prix.identite + prix.espacement;
  return { revendications, deltaStock, ...prix };
}

/** Le côté `{ manifeste, partagees, lire }` d'une image mesurable. */
const coteDe = (image) => {
  const textes = new Map(image.fichiers.map((f) => [f.rel, f.text]));
  return { manifeste: image.manifeste, partagees: image.partagees, lire: (f) => textes.get(f) ?? null };
};

/**
 * VENTILATION d'une décrue entre deux images, par volet : `deltaStock`, `deltaExempte`,
 * `entre = max(0, min(−deltaStock, deltaExempte))` (sites ENTRÉS en zone exempte),
 * `disparu = −(deltaStock + deltaExempte)` (négatif = matière APPARUE), `reclasse = min(prix du
 * volet, entre)` (`prixDuReclassement`), `primitivise = entre − reclasse`. Aucun appariement de
 * déclarations.
 * @param {{ fichiers: readonly { rel: string, text: string }[], manifeste: readonly { id: string, css?: string }[], partagees: readonly string[] }} base
 * @param {typeof base} tete
 */
export function ventilerDecrue(base, tete) {
  const b = partitionCss(base);
  const t = partitionCss(tete);
  const chemins = [...base.fichiers, ...tete.fichiers].map((f) => f.rel);
  const prix = prixDuReclassement(coteDe(base), coteDe(tete), chemins);
  const volet = (v) => {
    const deltaStock = t.stock[v].length - b.stock[v].length;
    const deltaExempte = t.exempte[v].length - b.exempte[v].length;
    const entre = Math.max(0, Math.min(-deltaStock, deltaExempte));
    const reclasse = Math.min(prix[v], entre);
    return {
      stock: [b.stock[v].length, t.stock[v].length],
      exempte: [b.exempte[v].length, t.exempte[v].length],
      deltaStock,
      deltaExempte,
      entre,
      disparu: 0 - (deltaStock + deltaExempte),
      reclasse,
      primitivise: entre - reclasse,
    };
  };
  return { identite: volet('identite'), espacement: volet('espacement'), revendications: prix.revendications };
}

/**
 * Ligne lisible d'un volet ventilé : bornes, `ENTRÉ`, `DISPARU` (ou `APPARU`), `RECLASSÉ`,
 * `PRIMITIVISÉ`.
 * @param {string} nom @param {ReturnType<typeof ventilerDecrue>['identite']} v @returns {string}
 */
export function ligneDeVentilation(nom, v) {
  const signe = (n) => (n > 0 ? `+${n}` : String(n));
  const solde = v.disparu < 0 ? `APPARU ${-v.disparu}` : `DISPARU ${v.disparu}`;
  return `${nom.padEnd(10)} stock ${v.stock[0]} → ${v.stock[1]} (Δ ${signe(v.deltaStock)}) · exempté ${v.exempte[0]} → ${v.exempte[1]} (Δ ${signe(v.deltaExempte)}) · ENTRÉ ${v.entre} · ${solde} · RECLASSÉ ${v.reclasse} · PRIMITIVISÉ ${v.primitivise}`;
}
