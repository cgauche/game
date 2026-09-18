/**
 * MESURE des TROIS COUCHES CSS (#1800) — définition UNIQUE, partagée par les cliquets (xxi)/(xxii)
 * (`src/ui/ui-ratchets.test.ts`) et le régénérateur `scripts/ui/regen-css-couches-stock.mts`.
 *
 * Trois classes de défaut, trois collections SÉPARÉES (jamais un champ `famille` : `regenStock.mts`
 * n'écrit que `{ fichier, ref, occurrence }`, et une famille mesurée mais jamais écrite rendrait
 * tout le stock neuf ET périmé à chaque run) :
 *   1. IDENTITÉ en module d'ÉCRAN — une déclaration qui PEINT (couleur, bordure, police, rayon,
 *      ombre, curseur, transition…) là où seul le PLACEMENT est légitime ; elle appartient à une
 *      primitive, et se solde en la DÉPLAÇANT vers le module de sa primitive, jamais en effaçant
 *      son aspect.
 *   2. ESPACEMENT hors échelle — un `gap`/`padding`/`margin` en littéral `px`/`rem`/`em` au lieu
 *      d'un pas `var(--sp-*)`, en module d'écran ET dans `layout.css` (la couche s'applique sa
 *      propre règle ; les modules de PRIMITIVE, eux, portent leur densité comme leur matière).
 *   3. STYLE INLINE — toute forme de `style=` dans `src/ui` hors l'unique exception légale
 *      (arbitrage A2, 2026-09-18) : un littéral d'objet dont TOUTES les clés sont des variables
 *      CSS, consommées par une classe (patron `.swatch`).
 *
 * FRONTIÈRE module de PRIMITIVE / module d'ÉCRAN : elle dérive du CATALOGUE, jamais d'une liste
 * gravée ici — une primitive déclare au manifeste (`src/data/primitives.manifest.json`, champ
 * `css`) le module qu'elle POSSÈDE. Tout autre `src/ui/styles/*.css` hors feuilles partagées est un
 * module d'écran.
 *
 * Chaque fonction de mesure est PURE sur les fichiers qu'elle reçoit : les preuves par mutation lui
 * passent des fixtures en mémoire, jamais le disque.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readCorpus } from './sourceCorpus.mjs';
import {
  declarations,
  estPlacement,
  FEUILLES_PARTAGEES,
  PROPRIETES_A_ECHELLE,
  reglesCss,
  valeurHorsEchelle,
} from './cssCouches.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

/** Un fichier tel que `readCorpus` le rend — ou une FIXTURE de même forme. */
export type Fichier = { rel: string; text: string };

/** Un site mesuré, forme d'entrée de `sitesEnEntrees` (`stock.mjs`). */
export type Site = { file: string; ref: string };

type EntreeManifeste = { id: string; css?: string };

/** Les modules de `src/ui/styles/` qu'une primitive POSSÈDE (champ `css` du manifeste). */
export function modulesDePrimitive(
  manifeste: readonly EntreeManifeste[] = JSON.parse(
    readFileSync(`${RACINE}src/data/primitives.manifest.json`, 'utf8'),
  ),
): Set<string> {
  return new Set(manifeste.map((e) => e.css).filter((c): c is string => typeof c === 'string'));
}

/** Les modules d'ÉCRAN : `src/ui/styles/*.css` moins les feuilles partagées, moins les modules de
 *  primitive. Ce sont EUX que le cliquet (xxi) juge. */
export function modulesDEcran(
  fichiers: readonly Fichier[] = feuillesDeStyle(),
  primitives: ReadonlySet<string> = modulesDePrimitive(),
): Fichier[] {
  return fichiers.filter((f) => !FEUILLES_PARTAGEES.includes(f.rel) && !primitives.has(f.rel));
}

/** Toutes les feuilles de `src/ui/styles/`. */
export const feuillesDeStyle = (): readonly Fichier[] =>
  readCorpus(['src/ui/styles'], { exts: ['.css'] });

/** Le sélecteur NORMALISÉ d'une règle : la liste telle qu'elle est écrite, espaces réduits. Le
 *  contexte `@media` n'entre PAS dans la clé — il n'est pas un abri, et l'y mettre ferait dériver
 *  le stock au moindre déplacement de breakpoint. */
const cleDeRegle = (selecteurs: readonly string[]) => selecteurs.join(', ').replace(/\s+/g, ' ');

/** Sites d'IDENTITÉ : une déclaration qui n'est pas du PLACEMENT, dans un module d'écran. */
export function sitesIdentiteEcran(fichiers: readonly Fichier[]): Site[] {
  const sites: Site[] = [];
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

/** Sites d'ESPACEMENT hors échelle `--sp-*`. */
export function sitesEspacementHorsEchelle(fichiers: readonly Fichier[]): Site[] {
  const sites: Site[] = [];
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

/** Neutralise commentaires bloc et ligne en préservant les positions — un `style={{…}}` cité en
 *  prose n'est pas du markup. */
const sansCommentaires = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, p: string) => p + ' ');

/** Fin de l'expression `{…}` ouverte en `i` (chaînes et gabarits neutralisés). */
function finExpression(src: string, i: number): number {
  let prof = 0;
  let quote: string | null = null;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (quote) { if (c === quote && src[k - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return k; }
  }
  return -1;
}

/** Découpe une liste `a, b, c` au niveau 0 (accolades, crochets, parenthèses et chaînes exclus). */
function membres(src: string): string[] {
  const out: string[] = [];
  let prof = 0;
  let quote: string | null = null;
  let courant = '';
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (quote) { courant += c; if (c === quote && src[k - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; courant += c; continue; }
    if ('{[('.includes(c)) prof++;
    else if ('}])'.includes(c)) prof--;
    if (c === ',' && prof === 0) { out.push(courant.trim()); courant = ''; continue; }
    courant += c;
  }
  if (courant.trim()) out.push(courant.trim());
  return out;
}

/** La balise porteuse et sa première classe LITTÉRALE, lues en amont du `style=`. */
function porteur(src: string, at: number): string {
  const avant = src.slice(0, at);
  const ouvre = avant.lastIndexOf('<');
  if (ouvre < 0) return '?';
  const balise = /^<([A-Za-z][\w.]*)/.exec(avant.slice(ouvre))?.[1] ?? '?';
  const classe = /className\s*=\s*[{`"']*\s*([a-zA-Z][\w-]*)/.exec(avant.slice(ouvre))?.[1];
  return classe ? `${balise}.${classe}` : balise;
}

/**
 * Sites de STYLE INLINE. La SEULE forme légale est un littéral d'objet dont toutes les clés sont des
 * variables CSS (`'--x'`), avec ou sans `as CSSProperties` final. Tout le reste est un site :
 * `expr` pour une valeur non littérale (`style={s}`, `style={c ? {…} : undefined}`, `{{ ...base }}`),
 * `vide` pour `style={{}}`, la liste TRIÉE des clés sinon.
 */
export function sitesStyleInline(fichiers: readonly Fichier[]): Site[] {
  const sites: Site[] = [];
  for (const f of fichiers) {
    const src = sansCommentaires(f.text);
    const re = /\bstyle\s*=\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const ouvre = m.index + m[0].length - 1;
      const ferme = finExpression(src, ouvre);
      if (ferme < 0) continue;
      const expr = src.slice(ouvre + 1, ferme).trim();
      const ref = refDeStyleInline(expr, src, ouvre, ferme);
      if (ref) sites.push({ file: f.rel, ref: `${porteur(src, m.index)} :: ${ref}` });
    }
  }
  return sites;
}

/** La réf du site, ou `null` quand la forme est LÉGALE (toutes les clés sont des variables CSS). */
function refDeStyleInline(expr: string, src: string, ouvre: number, ferme: number): string | null {
  if (!expr.startsWith('{')) return 'expr';
  const debutObjet = src.indexOf('{', ouvre + 1);
  const finObjet = finExpression(src, debutObjet);
  if (finObjet < 0) return 'expr';
  const apres = src.slice(finObjet + 1, ferme).trim();
  // `as CSSProperties` est une ANNOTATION, pas une valeur — la forme des deux sites canoniques.
  if (apres && !/^as\s+[\w.<>[\]| ]+$/.test(apres)) return 'expr';
  const entrees = membres(src.slice(debutObjet + 1, finObjet));
  if (entrees.length === 0) return 'vide';
  const cles: string[] = [];
  for (const e of entrees) {
    if (e.startsWith('...')) return 'expr';
    const brut = /^(['"])(.*?)\1\s*:/.exec(e)?.[2] ?? /^\[?([A-Za-z_$][\w$]*)\]?\s*:/.exec(e)?.[1];
    if (brut == null) return 'expr';
    cles.push(brut);
  }
  if (cles.every((c) => c.startsWith('--'))) return null;
  return [...cles].sort().join(',');
}

/** Les trois collections mesurées sur le corpus RÉEL. */
export function mesureCssCouches(): { identite: Site[]; espacement: Site[]; inline: Site[] } {
  const feuilles = feuillesDeStyle();
  const ecrans = modulesDEcran(feuilles);
  const layout = feuilles.filter((f) => f.rel === 'src/ui/styles/layout.css');
  return {
    identite: sitesIdentiteEcran(ecrans),
    espacement: sitesEspacementHorsEchelle([...ecrans, ...layout]),
    inline: sitesStyleInline(readCorpus(['src/ui'], { exts: ['.tsx'] })),
  };
}

/** Motifs de refus des trois volets (dernière phrase de `refusDeCroissance`, `stock.mjs`). */
export const MOTIF_IDENTITE =
  "Une classe d'écran qui PEINT se corrige en portant son aspect dans le module de sa primitive, elle ne s'entérine pas ici.";
export const MOTIF_ESPACEMENT =
  "Un espacement se pose sur l'échelle `var(--sp-*)` de base.css, il ne s'entérine pas ici.";
export const MOTIF_INLINE =
  "Une géométrie calculée se pose en VARIABLE CSS consommée par une classe (patron `.swatch`), elle ne s'entérine pas ici.";
