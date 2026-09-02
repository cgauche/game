// CROISSANCE D'UN STOCK NOMINATIF dans un diff. Un stock (tableau/Set/Map/objet de chemins
// `src/…`, `scripts/…`, `docs/…`, parfois `fichier:ligne`) est une DETTE qui va vers zéro : il
// DÉCROÎT. Un stock qui naît ou grossit est une exemption de plus, et l'ajout d'une ligne y est
// toujours le chemin le plus court pour rendre une CI verte — c'est exactement ce que le cliquet
// doit rendre visible (même raison que l'interdit du PLAFOND en tête de `stock.mjs`).
//
// FRONTIÈRE (celle de `stock.mjs`) : cette lib CALCULE, le VERDICT appartient à l'appelant — le
// garde de solde (au commit) et le test a posteriori (sur le dernier commit) décident, avec quel
// message et sous quelle dérogation.
//
// PÉRIMÈTRE : les fichiers où un stock vit dans ce dépôt — tests de `src/**`, libs de garde
// `scripts/guards/lib/**`, tests de `scripts/**`, tables JSON de `scripts/hooks/`. Il est exprimé
// en EXPRESSIONS RÉGULIÈRES et non en littéraux de chemin : un tableau de chemins écrit ici serait
// lui-même vu comme un stock par la règle qu'il sert.
//
// CE QUE LA RÈGLE MESURE MAL, par construction, et qui doit se lire ici plutôt que se découvrir :
//   · plusieurs entrées sur UNE ligne = SOUS-COMPTAGE (la ligne compte pour une), jamais une cécité :
//     la croissance reste vue, son ampleur est minorée ;
//   · un stock dont les entrées ne nomment aucun fichier (id numérique, nom de symbole seul —
//     `fermetures-sans-solde.test.mjs` en est un) est hors de vue ;
//   · les porteurs en `.mts` sont hors périmètre — aucun n'en porte aujourd'hui (mesuré : les 65
//     `.mts` de `scripts/guards/lib/` sont tous des `.d.mts` générés, et aucun `.mts` de `scripts/`
//     ne porte 3 entrées littérales) ; le jour où il en naît un, cette liste l'accueille.

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

/**
 * Croissance NETTE des stocks nominatifs d'un diff unifié (`-U0` ou non : seuls les `+`/`-`
 * comptent). Un fichier n'est rendu que si ses entrées AJOUTÉES dépassent ses entrées RETIRÉES.
 * @param {string} diffU0
 * @returns {{ fichier: string, ajoutees: number, retirees: number, net: number, exemples: string[] }[]}
 *   trié par fichier ; `exemples` = jusqu'à 3 entrées ajoutées, telles qu'écrites.
 */
export function croissanceDesStocks(diffU0) {
  /** @type {Map<string, { ajoutees: string[], retirees: number }>} */
  const parFichier = new Map();
  let courant = null;
  for (const brute of String(diffU0 ?? '').split('\n')) {
    const ligne = brute.replace(/\r$/, '');
    const entete = /^\+\+\+ (?:b\/)?(.+)$/.exec(ligne);
    if (entete) {
      const chemin = entete[1].trim();
      courant = chemin !== '/dev/null' && estPorteurDeStock(chemin) ? chemin.replace(/\\/g, '/') : null;
      continue;
    }
    if (/^(?:diff --git |--- |index |@@ )/.test(ligne)) continue;
    if (!courant) continue;
    const ajout = ligne.startsWith('+');
    const retrait = ligne.startsWith('-');
    if (!ajout && !retrait) continue;
    const contenu = ligne.slice(1);
    if (!estEntreeDeStock(contenu)) continue;
    if (!parFichier.has(courant)) parFichier.set(courant, { ajoutees: [], retirees: 0 });
    const compte = parFichier.get(courant);
    if (ajout) compte.ajoutees.push(contenu.trim());
    else compte.retirees += 1;
  }
  return [...parFichier]
    .map(([fichier, { ajoutees, retirees }]) => ({
      fichier, ajoutees: ajoutees.length, retirees, net: ajoutees.length - retirees, exemples: ajoutees.slice(0, 3),
    }))
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
 * @returns {{ fichier: string, ajoutees: number, retirees: number, net: number, exemples: string[],
 *   declare: number | null }[]}
 */
export function croissancesNonCouvertes({ diff, message }) {
  const cliquets = cliquetsDuMessage(message);
  return croissanceDesStocks(diff)
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
