// CROISSANCE D'UN STOCK NOMINATIF dans un diff. Un stock (tableau/Set/Map/objet de chemins
// `src/…`, `scripts/…`, `docs/…`, parfois `fichier:ligne`) est une DETTE qui va vers zéro : il
// DÉCROÎT. Un stock qui naît ou grossit est une exemption de plus, et l'ajout d'une ligne y est
// toujours le chemin le plus court pour rendre une CI verte — c'est exactement ce que le cliquet
// doit rendre visible (même raison que l'interdit du PLAFOND en tête de `stock.mjs`).
//
// FRONTIÈRE (celle de `stock.mjs`) : cette lib CALCULE, le VERDICT appartient à l'appelant — le
// garde de solde (au commit) et les portes a posteriori (dernier commit, plage poussée) décident,
// avec quel message et sous quelle dérogation.
//
// PÉRIMÈTRE : les fichiers où un stock vit dans ce dépôt — tests de `src/**`, libs de garde
// `scripts/guards/lib/**`, tests de `scripts/**`, tables JSON de `scripts/hooks/`. Il est exprimé
// en EXPRESSIONS RÉGULIÈRES et non en littéraux de chemin : un tableau de chemins écrit ici serait
// lui-même vu comme un stock par la règle qu'il sert.
//
// PORTÉE DE MODULE : une entrée ne compte que si elle vit au niveau du MODULE. Un littéral écrit
// dans un corps de fonction (`test(…)`, `it(…)`, une fabrique) est une DONNÉE LOCALE, pas un stock :
// il ne survit pas à l'appel qui le porte et ne s'ajoute à aucune dette. La position se décide sur
// le POST-IMAGE du fichier par l'AST TypeScript, jamais par indentation (les trois « entrées » de
// `429b9a1a2`, les deux faux positifs de `91c928d16` et le `+8` de `572e60b8b` sont tous de cette
// classe ; précédent `0d6ddeee1` : la classe se règle au garde, jamais à la fixture).
//
// CE QUE LA RÈGLE MESURE MAL, par construction, et qui doit se lire ici plutôt que se découvrir :
//   · plusieurs entrées sur UNE ligne = SOUS-COMPTAGE (la ligne compte pour une), jamais une cécité :
//     la croissance reste vue, son ampleur est minorée ;
//   · un stock dont les entrées ne nomment aucun fichier (id numérique, nom de symbole seul —
//     `fermetures-sans-solde.test.mjs` en est un) est hors de vue ;
//   · sans image lisible (fichier supprimé, binaire, appelant qui n'en fournit pas), la portée ne se
//     décide pas : l'entrée COMPTE — la porte perd sa précision, jamais sa vue ;
//   · les porteurs en `.mts` sont hors périmètre — aucun n'en porte aujourd'hui (mesuré : les 65
//     `.mts` de `scripts/guards/lib/` sont tous des `.d.mts` générés, et aucun `.mts` de `scripts/`
//     ne porte 3 entrées littérales) ; le jour où il en naît un, cette liste l'accueille.
import { createRequire } from 'node:module'

/** Fichiers susceptibles de porter un stock nominatif. */
const PORTEURS = [
  /^src\/.+\.test\.tsx?$/,
  /^scripts\/guards\/lib\/.+\.mjs$/,
  /^scripts\/.+\.test\.mjs$/,
  /^scripts\/hooks\/[^/]+\.json$/,
];

/** Chemin de dépôt : une racine suivie, puis tout sauf des espaces. */
const CHEMIN = String.raw`(?:src|scripts|docs)\/[^'"\`\s]+`;
/** Nom de fichier NU, extension de code ou de donnée : la clé `'criticals.json'` du registre
 *  `AUTO_RESOLUS` (src/state/flowtest-derived-stake.test.ts) est une entrée de stock au même titre
 *  qu'un chemin — l'exiger complet laisserait passer le cas FONDATEUR de cette porte. */
const NOM_NU = String.raw`[\w.-]+\.(?:ts|tsx|mjs|mts|json|md|css)`;
/** Un jeton d'entrée entre quotes : `:ligne`/`:symbole` et balise commentée DANS la chaîne
 *  (`'src/ui/X.test.tsx // div'`) tolérés. Sans espace dans le chemin : une PROSE qui cite un
 *  chemin au milieu d'une phrase entre quotes n'est pas une entrée. */
const JETON = String.raw`['"\`](?:${CHEMIN}|${NOM_NU})(?::[\w.|:-]+)?(?:\s+\/\/\s*[^'"\`]*)?['"\`]`;

/**
 * Une ENTRÉE littérale de stock, DEUX formes — la ligne entière fait foi dans les deux cas :
 *   · le jeton OUVRE la ligne : élément de liste/Set (`'src/x.test.ts',`), clé d'objet
 *     (`'criticals.json': 'raison',`), ou tuple dont il est la clé (`['src/x.ts', { n: 32, … }],`) ;
 *   · le jeton FERME un tuple crocheté (`['CritEscalation', 'onRepeat', 'src/x.ts:325'],`) —
 *     forme réelle des stocks de sites de ce dépôt, que la première ne voit pas.
 */
const ENTREE_EN_TETE = new RegExp(String.raw`^\s*\[?\s*${JETON}\s*(?:[,:][^\n]*)?$`);
const ENTREE_EN_QUEUE = new RegExp(String.raw`^\s*\[[^\n]*${JETON}\s*\][,;]?\s*(?:\/\/[^\n]*)?$`);

/** Le fichier peut-il porter un stock ? */
export function estPorteurDeStock(chemin) {
  const rel = String(chemin ?? '').replace(/\\/g, '/');
  return PORTEURS.some((re) => re.test(rel));
}

/** La ligne (sans son marqueur de diff) est-elle une entrée littérale de stock ? */
export function estEntreeDeStock(ligne) {
  const l = String(ligne ?? '');
  return ENTREE_EN_TETE.test(l) || ENTREE_EN_QUEUE.test(l);
}

// ── Portée de module, décidée par l'AST ───────────────────────────────────────────────────────────

/** Le compilateur TypeScript du dépôt (devDependency, déjà le parseur des générateurs de `docs/`),
 *  chargé À LA DEMANDE : cette lib est importée par le garde PreToolUse, qui s'exécute à CHAQUE
 *  commande du canal — un `import` de tête ferait payer le chargement du compilateur à un `ls`. */
let compilateur = null;
function typescript() {
  if (!compilateur) compilateur = createRequire(import.meta.url)('typescript');
  return compilateur;
}

/** Extension → dialecte à parser. Un `.mjs`/`.cjs` se parse en JS ; hors de cette table (JSON…),
 *  aucun AST n'est demandé : le fichier est plat, tout y est en portée de module. */
const DIALECTE = { ts: 'TS', mts: 'TS', cts: 'TS', tsx: 'TSX', js: 'JS', mjs: 'JS', cjs: 'JS', jsx: 'JSX' };

/**
 * Prédicat « cette ligne (1-based) de `source` est en PORTÉE DE MODULE », ou `null` si le dialecte
 * n'a pas d'AST ici. La portée se lit sur la STRUCTURE, jamais sur l'indentation.
 *
 * Est LOCAL ce qui vit dans une fonction passée en ARGUMENT d'un appel — le corps d'un `test(…)`,
 * d'un `it(…)`, d'un `describe(…)`, d'un `map(…)` : ce qu'on y écrit meurt avec l'appel. Est de
 * MODULE tout le reste, y compris ce qu'une simple enveloppe pourrait sembler cacher : une IIFE
 * (`export const STOCK = (() => [ … ])()`), une fonction ou une flèche DÉCLARÉE puis exportée
 * (`export function stock() { return [ … ] }`). Marquer toute FunctionLike rendait la règle
 * contournable par trois enveloppes d'une ligne (mesuré 2026-09-04) : un stock reste un stock, quelle
 * que soit la façade qui le sert.
 */
export function porteeDeModule(source, chemin) {
  const ext = String(chemin ?? '').replace(/\\/g, '/').split('.').pop().toLowerCase();
  if (!DIALECTE[ext]) return null;
  const texte = String(source ?? '');
  const ts = typescript();
  const sf = ts.createSourceFile(String(chemin), texte, ts.ScriptTarget.Latest, true, ts.ScriptKind[DIALECTE[ext]]);
  const locales = new Set();
  const marquer = (node) => {
    const debut = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    const fin = sf.getLineAndCharacterOfPosition(Math.min(node.end, texte.length)).line;
    for (let l = debut; l <= fin; l++) locales.add(l + 1);
  };
  const visiter = (node) => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      visiter(node.expression);
      for (const arg of node.arguments ?? []) {
        // Une fonction imbriquée est déjà couverte par l'englobante : la descente s'arrête là.
        if (ts.isFunctionLike(arg)) marquer(arg);
        else visiter(arg);
      }
      return;
    }
    ts.forEachChild(node, visiter);
  };
  ts.forEachChild(sf, visiter);
  return (ligne) => !locales.has(ligne);
}

/** Prédicat de portée pour un fichier, à partir d'un lecteur d'image. Sans lecteur, sans image ou
 *  sans dialecte : TOUT compte (la porte perd sa précision, jamais sa vue). */
function gardeDePortee(lire, fichier) {
  if (typeof lire !== 'function') return () => true;
  let source;
  try { source = lire(fichier); } catch { return () => true; }
  if (typeof source !== 'string') return () => true;
  try { return porteeDeModule(source, fichier) ?? (() => true); } catch { return () => true; }
}

/** En-têtes de diff qui ne portent ni contenu ni numérotation. */
const ENTETE_INERTE =
  /^(?:diff --git |--- |index |old mode |new mode |similarity |dissimilarity |rename |copy |new file mode |deleted file mode |Binary files |GIT binary patch|\\)/;

/**
 * Croissance NETTE des stocks nominatifs d'un diff unifié (`-U0` ou non : seuls les `+`/`-`
 * comptent). Un fichier n'est rendu que si ses entrées AJOUTÉES dépassent ses entrées RETIRÉES.
 *
 * Les entrées AJOUTÉES sont situées dans le POST-IMAGE (`lirePostImage(chemin)`), les RETIRÉES dans
 * le PRÉ-IMAGE (`lirePreImage(chemin)`) — sans quoi le retrait d'une fixture locale compenserait
 * l'ajout d'une vraie entrée. Les deux lecteurs sont fournis par l'appelant : la lib reste PURE.
 * @param {string} diffU0
 * @param {{ lirePostImage?: (chemin: string) => string | null,
 *           lirePreImage?: (chemin: string) => string | null }} [images]
 * @returns {{ fichier: string, ajoutees: number, retirees: number, net: number, exemples: string[] }[]}
 *   trié par fichier ; `exemples` = jusqu'à 3 entrées ajoutées, telles qu'écrites.
 * @throws {TypeError} si le diff n'est pas une CHAÎNE : la signature est POSITIONNELLE, et un appel
 *   en objet (`croissanceDesStocks({ diff })`) stringifiait `[object Object]` — donc `[]` sur TOUS
 *   les commits, y compris sur des croissances réelles. Un juge a publié ce faux zéro le 2026-09-04
 *   (revue de palier n°4, trouvaille 5) : la lib ne peut pas distinguer un diff vide d'un appel mal
 *   formé, elle refuse donc de deviner.
 */
export function croissanceDesStocks(diffU0, { lirePostImage = null, lirePreImage = null } = {}) {
  if (typeof diffU0 !== 'string') {
    throw new TypeError(
      `croissanceDesStocks(diffU0, images) attend le diff en CHAÎNE, reçu ${typeof diffU0} `
      + '— la signature est POSITIONNELLE : croissanceDesStocks(diff, { lirePostImage, lirePreImage })',
    );
  }
  /** @type {Map<string, { ajoutees: { texte: string, ligne: number }[], retirees: number[] }>} */
  const parFichier = new Map();
  let courant = null;
  let numAncien = 0;
  let numNouveau = 0;
  for (const brute of diffU0.split('\n')) {
    const ligne = brute.replace(/\r$/, '');
    const entete = /^\+\+\+ (?:b\/)?(.+)$/.exec(ligne);
    if (entete) {
      const chemin = entete[1].trim();
      courant = chemin !== '/dev/null' && estPorteurDeStock(chemin) ? chemin.replace(/\\/g, '/') : null;
      numAncien = 0;
      numNouveau = 0;
      continue;
    }
    const hunk = /^@@+ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(ligne);
    if (hunk) {
      numAncien = Number(hunk[1]);
      numNouveau = Number(hunk[2]);
      continue;
    }
    if (ENTETE_INERTE.test(ligne)) continue;
    if (!courant) continue;
    const ajout = ligne.startsWith('+');
    const retrait = ligne.startsWith('-');
    if (!ajout && !retrait) {
      // Ligne de CONTEXTE : elle existe des deux côtés et fait avancer les deux numérotations.
      numAncien += 1;
      numNouveau += 1;
      continue;
    }
    const numero = ajout ? numNouveau++ : numAncien++;
    const contenu = ligne.slice(1);
    if (!estEntreeDeStock(contenu)) continue;
    if (!parFichier.has(courant)) parFichier.set(courant, { ajoutees: [], retirees: [] });
    const compte = parFichier.get(courant);
    if (ajout) compte.ajoutees.push({ texte: contenu.trim(), ligne: numero });
    else compte.retirees.push(numero);
  }
  return [...parFichier]
    .map(([fichier, { ajoutees, retirees }]) => {
      const enModulePost = gardeDePortee(lirePostImage, fichier);
      const enModulePre = gardeDePortee(lirePreImage, fichier);
      const retenues = ajoutees.filter((e) => enModulePost(e.ligne)).map((e) => e.texte);
      const perdues = retirees.filter((n) => enModulePre(n)).length;
      return {
        fichier,
        ajoutees: retenues.length,
        retirees: perdues,
        net: retenues.length - perdues,
        exemples: retenues.slice(0, 3),
      };
    })
    .filter((c) => c.net > 0)
    .sort((a, b) => a.fichier.localeCompare(b.fichier, 'en'));
}

/** Longueur minimale d'un motif de cliquet : sous ce seuil, c'est un tampon, pas une raison. */
export const MOTIF_MIN = 20;

/**
 * Cliquets DÉCLARÉS par un message de commit : `CLIQUET: <fichier> +N — <motif>`. Le tiret peut
 * être cadratin, demi-cadratin ou trait d'union ; un motif plus court que `MOTIF_MIN` n'est pas
 * retenu (l'appelant voit alors le fichier comme non couvert).
 * @param {string} message
 * @returns {{ fichier: string, n: number, motif: string }[]}
 */
export function cliquetsDuMessage(message) {
  const out = [];
  for (const m of String(message ?? '').matchAll(/^[^\S\n]*CLIQUET\s*:\s*(\S+)\s*\+(\d+)\s*[—–-]\s*(.+)$/gm)) {
    const motif = m[3].trim();
    if (motif.length >= MOTIF_MIN) out.push({ fichier: m[1].replace(/\\/g, '/'), n: Number(m[2]), motif });
  }
  return out;
}

/**
 * Croissances NON COUVERTES par un cliquet du message : un cliquet ne couvre un fichier que s'il
 * ANNONCE LE BON COMPTE (`+N` = la croissance nette réelle) — sinon la ligne serait un tampon qui
 * survit à l'ajout suivant.
 * @param {{ diff: string, message: string }} p
 * @param {Parameters<typeof croissanceDesStocks>[1]} [images]
 * @returns {{ fichier: string, ajoutees: number, retirees: number, net: number, exemples: string[],
 *   declare: number | null }[]}
 */
export function croissancesNonCouvertes({ diff, message }, images) {
  const cliquets = cliquetsDuMessage(message);
  return croissanceDesStocks(diff, images)
    .map((c) => {
      const pourCeFichier = cliquets.filter((k) => k.fichier === c.fichier);
      const couvert = pourCeFichier.some((k) => k.n === c.net);
      return couvert ? null : { ...c, declare: pourCeFichier.length ? pourCeFichier[0].n : null };
    })
    .filter(Boolean);
}

/** Refus lisible d'une croissance : ce qui a grossi, de combien, trois exemples, et le geste. */
export function raisonDeRefus(croissances) {
  const lignes = croissances.map((c) => {
    const compte = `+${c.net} entrée(s) nette(s) (${c.ajoutees} ajoutée(s), ${c.retirees} retirée(s))`;
    const declare = c.declare === null ? '' : ` — le message annonce \`+${c.declare}\`, pas +${c.net}`;
    return `${c.fichier} : ${compte}${declare} — ex. ${c.exemples.join(' · ')}`;
  });
  return (
    `⛔ STOCK NOMINATIF qui NAÎT ou GRANDIT : ${lignes.join(' || ')}. Un stock nominatif est une ` +
    "DETTE vers zéro, jamais un registre : retirer l'entrée, ou porter la règle dans le socle pour " +
    "qu'aucune entrée ne soit nécessaire. Si la croissance est délibérée, le message de commit la " +
    'DIT : `CLIQUET: <fichier> +N — <motif>` (motif d’au moins ' + MOTIF_MIN + ' caractères).'
  );
}
