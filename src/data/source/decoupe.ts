// Bibliothèque de DÉCOUPE des chapitres `Source/` : SOURCE UNIQUE du parsing et de la résolution.
// Une adresse rend la prose VERBATIM du livre sans la dupliquer ailleurs : un fragment de BLOCS
// — { sec, secOcc, b0, b1 } — désigne une suite contiguë de blocs d'une section ; sa sœur, le
// fragment de CELLULE — { sec, secOcc, row, col } — rend une case de table par CLÉ (jamais par
// indice). Une `DescRef` monte jusqu'à trois fragments d'un même chapitre.
//
// Module PUR : aucune entrée/sortie, aucun registre de livres — le chapitre lui arrive déjà lu
// (`scripts/source/lecteur-fs.mjs`). Il est chargé tel quel par Node nu (`scripts/source/*.mjs`) et
// par vitest ; c'est cette absence d'entrée/sortie qui le laisse chargeable par le navigateur. Sous
// Node nu, sa syntaxe est effaçable et ses imports internes portent leur EXTENSION explicite.
//
// CONVENTIONS DE PARSING, mesurées sur l'extraction Marker réelle :
//  - HEADINGS : seuls les headings ATX (`#`..`######`) ouvrent une section. Les lignes en gras seul
//    (`**Agitateur – Bronze 2**`) NE sont PAS traitées comme des headings : mesure sur le livre de
//    base — `16 - États.md`, `21 - Psychologie.md`, `10 - Talents.md` en comptent 0 ; `08 - Statut.md`
//    en compte 44 pour 282 headings ATX, et il s'agit de noms de niveau de carrière ouvrant un
//    paragraphe, pas de titres de rubrique. Les prendre pour des headings fragmenterait les sections
//    sans gain d'adressage (les blocs, eux, restent identiques).
//  - Un heading peut être précédé sur SA ligne d'un marqueur de folio
//    (`<span id="page-169-0" data-folio="168"></span>### **Brisé**`, `16 - États.md:59`).
//  - SLUG : translittéré ASCII (accents retirés) — un slug se tape en ligne de commande et se pose
//    dans un JSON ; `occ` (rang 1-based parmi les slugs identiques du chapitre) lève l'ambiguïté des
//    titres répétés (« Évolution de Carrière » ×31 dans `08 - Statut.md`).
//  - BLOCS : segments séparés par une ou plusieurs lignes vides ; le heading lui-même n'est pas un
//    bloc. Les balises `<span …>` sont retirées du texte rendu, leur `data-folio` est collecté.
//  - FOLIO COURANT : les marqueurs `data-folio` sont rares et arbitrairement placés dans le flux ; un
//    état ROULANT sur le chapitre donne à chaque section et à chaque bloc le dernier folio rencontré
//    à ou avant son ouverture (`folio`), en plus des marqueurs INTERNES au bloc (`folios`).
//  - RECOLLAGE DE FOLIO : un saut de folio coupe des paragraphes en plein milieu
//    (`21 - Psychologie.md:45-48`, `05 - _gjdgxs.md:44`). Deux blocs séparés par une coupure PORTEUSE
//    DE FOLIO (bloc vide réduit à son marqueur, ou bloc suivant ouvert par un marqueur) sont recollés
//    par une espace quand le bloc précédent ne finit pas par une ponctuation finale (`.!?»”:;`) —
//    testée SOUS l'habillage markdown, un `…une autre.*` fermant une emphase étant bel et bien
//    terminé (`05 - _gjdgxs.md:438`) — et que le bloc suivant n'ouvre pas un paragraphe logique
//    (emphase `*`/`**`, puce, table).
import { normalize as normalizeCitation } from './normalize.ts';
import { hash32 } from '../hash.ts';

/** Bloc d'affichage : le markdown rendu, le folio courant à son ouverture, ses marqueurs internes. */
export interface Bloc { md: string; folio: number | null; folios: number[] }

/** Section adressable d'un chapitre (`slug` + `occ` = son adresse). */
export interface Section {
  slug: string;
  occ: number;
  title: string;
  level: number;
  line: number;
  folio: number | null;
  blocks: Bloc[];
}

/** Chapitre parsé. */
export interface ChapitreParse { sections: Section[] }

/** Fragment de BLOCS : suite contiguë `b0..b1` des blocs d'une section, empreinte comprise. */
export interface FragmentBlocs {
  kind: 'blocs';
  sec: string;
  secOcc: number;
  b0: number;
  b1: number;
  sum: string;
}

/** Fragment de CELLULE : case d'une table, adressée par clé de ligne × en-tête de colonne. */
export interface FragmentCellule {
  kind: 'cellule';
  sec: string;
  secOcc: number;
  row: string;
  col: string;
  sum: string;
}

export type Fragment = FragmentBlocs | FragmentCellule;

/** Adresse complète d'une prose : jusqu'à trois fragments d'un même chapitre d'un même livre. */
export interface DescRef { book: string; ch: string; parts: Fragment[] }

export type CodeErreur =
  | 'section-inconnue'
  | 'bornes-hors-limites'
  | 'empreinte-divergente'
  | 'ligne-introuvable'
  | 'ligne-ambigue'
  | 'table-sans-en-tetes'
  | 'colonne-inconnue'
  | 'fragment-trop-court'
  | 'fragment-ambigu'
  | 'fragments-chevauchants'
  | 'montage-hors-plafond';

export interface ErreurResolution {
  error: CodeErreur;
  detail: string;
  /** Indice 0-based du fragment FAUTIF, quand l'erreur en désigne un — pour un chevauchement, le
   *  SECOND des deux (`chevauchementDe` : c'est celui que le geste vient d'ajouter ou de déplacer).
   *  Absent pour une erreur qui porte sur l'adresse entière (`montage-hors-plafond`).
   *  C'est ce qui permet à un éditeur d'afficher le refus DANS la rangée concernée. */
  fragment?: number;
}

export interface Resolu { md: string; folios: number[] }

export const estErreur = (r: Resolu | ErreurResolution): r is ErreurResolution => 'error' in r;

/** Longueur normalisée minimale d'un fragment de BLOCS en montage (en deçà, l'adresse n'est pas
 *  discriminante). Une `cellule` n'y est pas soumise — voir la règle D, `resoudreAdresse`. */
const MIN_FRAGMENT = 40;
/** Nombre maximal de fragments d'une adresse. */
const MAX_FRAGMENTS = 3;
/** Longueur d'amorce testée avant de tenter un run complet (filtre bon marché). */
const PROBE = 24;

const SPAN_TAG = /<\/?span[^>]*>/g;
const FOLIO_ATTR = /data-folio="(\d+)"/g;
const HEADING = /^(?:<span[^>]*>\s*<\/span>\s*)*(#{1,6})\s+(.*)$/;
const OPENS_ON_FOLIO = /^\s*<span[^>]*data-folio=/;
const TERMINAL = /[.!?»”:;]$/;
const TRAILING_DECOR = /[*_`~\s]+$/;
const OPENS_EMPHASIS = /^\s*\*/;
const TABLE_LINE = /^\s*\|/;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s/;
/** Clé de ligne de table trop positionnelle pour adresser (fourchette d100, numéro nu). */
const RANGE_KEY = /^\d+\s*[-–—]?\s*\d*$/;

/** Retire les balises `<span>` (le contenu textuel est conservé). */
const stripSpans = (s: string): string => s.replace(SPAN_TAG, '');

/** Folios (`data-folio`) portés par un fragment de texte, dans l'ordre. */
function foliosIn(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(FOLIO_ATTR)) out.push(Number(m[1]));
  return out;
}

/** Titre affichable d'un heading : markdown d'emphase et `#` de fermeture retirés. */
const cleanTitle = (s: string): string =>
  stripSpans(s).replace(/#+\s*$/, '').replace(/[*_`]/g, '').trim();

/** Slugifie un titre : minuscules, accents TRANSLITTÉRÉS, tout le reste en tirets. */
function slugify(titre: string): string {
  return cleanTitle(titre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalisation de COMPARAISON (verbatim tolérant à l'habillage) : délègue au normaliseur de
 * citations de l'Atlas (`normalize` : emphase, guillemets, apostrophes, tirets, casse, espaces
 * insécables, accents CONSERVÉS) après retrait des balises `<span>`, puis aplatit la ponctuation de
 * table (espaces autour des `|`, tirets de la ligne de séparation).
 */
export function normText(s: string): string {
  return normalizeCitation(stripSpans(s))
    .replace(/\s*\|\s*/g, '|')
    .replace(/-{2,}/g, '-')
    .trim();
}

/**
 * Joint des fragments DÉJÀ normalisés en une chaîne comparable : l'espace de jointure est réabsorbé
 * autour des `|` de table (`normText` colle déjà les cellules, un bloc-table recollé à la prose qui
 * le précède ne doit pas rouvrir cet espace).
 */
export const joinNorm = (parts: string[]): string =>
  parts.filter(Boolean).join(' ').replace(/\s*\|\s*/g, '|');

/** Un entier 32 bits en 8 hex. */
const hex8 = (n: number): string => n.toString(16).padStart(8, '0');

/**
 * Empreinte d'un texte résolu — helper UNIQUE : 64 bits en 16 hex, deux passes FNV-1a du texte
 * NORMALISÉ sous DEUX SELS distincts (`'a'` et `'b'` : un sel unique rendrait deux moitiés
 * identiques, donc 32 bits utiles). Portée par chaque fragment (`sum`) et vérifiée à la résolution :
 * une source ré-extraite qui bouge sous une adresse se signale au lieu de rendre un autre texte.
 */
export function sumOf(md: string): string {
  const n = normText(md);
  return hex8(hash32('a', n)) + hex8(hash32('b', n));
}

/** Deux blocs coupés par un saut de folio sont-ils recollables ? */
function recollable(prev: string, next: string): boolean {
  if (TERMINAL.test(prev.replace(TRAILING_DECOR, ''))) return false;
  if (TABLE_LINE.test(prev.split('\n').pop() ?? '')) return false;
  if (TABLE_LINE.test(next) || OPENS_EMPHASIS.test(next) || BULLET.test(next)) return false;
  return true;
}

/**
 * Découpe un corps de section en blocs d'affichage (spans retirés, folios collectés, recollage des
 * paragraphes coupés par un saut de folio).
 */
function toBlocks(lignes: string[], folioIn: number | null): { blocks: Bloc[]; folioOut: number | null } {
  const raw: string[] = [];
  let cur: string[] = [];
  for (const l of lignes) {
    if (l.trim() === '') { if (cur.length) { raw.push(cur.join('\n')); cur = []; } } else cur.push(l);
  }
  if (cur.length) raw.push(cur.join('\n'));

  const out: Bloc[] = [];
  let running = folioIn;
  let carry: number[] = [];
  let carryCut = false;
  for (const text of raw) {
    const folios = foliosIn(text);
    const md = stripSpans(text).trim();
    const at = carry.length
      ? carry[carry.length - 1]
      : (OPENS_ON_FOLIO.test(text) && folios.length ? folios[0] : running);
    if (folios.length) running = folios[folios.length - 1];
    if (!md) { carry.push(...folios); carryCut = true; continue; }
    const cut = carryCut || OPENS_ON_FOLIO.test(text);
    const blockFolios = [...carry, ...folios];
    carry = []; carryCut = false;
    const prev = out[out.length - 1];
    if (prev && cut && recollable(prev.md, md)) {
      prev.md = `${prev.md} ${md}`;
      prev.folios.push(...blockFolios);
    } else {
      out.push({ md, folio: at ?? null, folios: blockFolios });
    }
  }
  return { blocks: out, folioOut: running };
}

/**
 * Parse un chapitre en sections adressables, folio courant roulant compris.
 * @param texte contenu markdown du chapitre, quelles que soient ses fins de ligne
 */
export function parseChapitre(texte: string): ChapitreParse {
  // Fins de ligne ramenées au LF ICI, à l'entrée : ce module est PUR et reçoit son texte de
  // n'importe quel chargeur (lecteur fs, `fetch` d'un asset, fixture), dont tous ne normalisent pas.
  // Mesuré sur `21 - Psychologie.md` du livre de base : en CRLF, `HEADING` ne reconnaît aucun titre
  // (`.` ne franchit pas `\r`, et `$` sans `/m` ne se pose pas devant un `\r` final) — 1 section au
  // lieu de 17, et l'empreinte du premier bloc passe de `ad420a63fa3b93c2` à `3eef49e6fee82961`.
  const lignes = texte.replace(/\r\n?/g, '\n').split('\n');
  const sections: Section[] = [];
  const seen = new Map<string, number>();
  let running: number | null = null;
  let cur: Omit<Section, 'blocks'> & { lines: string[] } =
    { slug: '', occ: 1, title: '', level: 0, line: 1, folio: null, lines: [] };
  const push = () => {
    const { lines: body, ...rest } = cur;
    const { blocks, folioOut } = toBlocks(body, cur.folio);
    sections.push({ ...rest, blocks });
    running = folioOut;
  };
  for (let i = 0; i < lignes.length; i++) {
    const m = HEADING.exec(lignes[i]);
    if (!m) { cur.lines.push(lignes[i]); continue; }
    push();
    const title = cleanTitle(m[2]);
    const slug = slugify(m[2]) || '-';
    const occ = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, occ);
    const head = foliosIn(lignes[i]);
    if (head.length) running = head[head.length - 1];
    cur = { slug, occ, title, level: m[1].length, line: i + 1, folio: running, lines: [] };
  }
  push();
  return { sections };
}

/** Section visée par un fragment, ou `null` si le chapitre n'en porte aucune à cette adresse. */
const sectionDe = (chapitre: ChapitreParse, frag: Fragment): Section | null =>
  chapitre.sections.find((s) => s.slug === frag.sec && s.occ === frag.secOcc) ?? null;

/** Plage de folios couverte par des blocs : courant du premier, plus tous les marqueurs internes. */
const foliosOf = (blocks: Bloc[]): number[] => [
  ...new Set(
    [blocks[0]?.folio, ...blocks.flatMap((b) => b.folios)].filter((f): f is number => f != null),
  ),
];

/** Contrôle d'empreinte : le `sum` d'un fragment est REQUIS et comparé au texte réellement résolu. */
function checkSum(frag: Fragment, md: string, ou: string): ErreurResolution | null {
  const got = sumOf(md);
  if (got === frag.sum) return null;
  return { error: 'empreinte-divergente', detail: `${ou} : sum=${frag.sum} attendu, texte résolu=${got}` };
}

/** Parse un bloc-table markdown. Rend `null` si le bloc n'est pas une table. */
function parseTable(md: string): { headers: string[]; rows: string[][] } | null {
  const lignes = md.split('\n').filter((l) => TABLE_LINE.test(l));
  if (lignes.length < 2) return null;
  const cells = (l: string) =>
    l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const isSeparator = (l: string) => cells(l).every((c) => /^:?-{2,}:?$/.test(c));
  const headers = cells(lignes[0]);
  const rows = lignes.slice(1).filter((l) => !isSeparator(l)).map(cells);
  return { headers, rows };
}

/** Tables d'une section, dans l'ordre du document. */
type TableDeSection = { block: Bloc; table: { headers: string[]; rows: string[][] } };
const tablesOf = (section: Section): TableDeSection[] =>
  section.blocks
    .map((b) => ({ block: b, table: parseTable(b.md) }))
    .filter((t): t is TableDeSection => t.table != null);

/** Ligne de table dont une cellule vaut la clé cherchée. */
interface LigneTrouvee { block: Bloc; headers: string[]; row: string[]; cols: number[] }

/**
 * Lignes d'une section dont une cellule vaut `target` (déjà normalisé). Une ligne qui répond dans
 * plusieurs de ses colonnes ne compte qu'une fois.
 */
function rowsMatching(section: Section, target: string): LigneTrouvee[] {
  const out: LigneTrouvee[] = [];
  for (const { block, table } of tablesOf(section)) {
    for (const row of table.rows) {
      const cols = row.map((c, i) => (normText(c) === target ? i : -1)).filter((i) => i >= 0);
      if (cols.length) out.push({ block, headers: table.headers, row, cols });
    }
  }
  return out;
}

/** Désignation lisible d'un fragment, portée par ses erreurs. */
const ouDe = (frag: Fragment): string =>
  frag.kind === 'cellule'
    ? `§${frag.sec}#${frag.secOcc} [${frag.row}]×[${frag.col}]`
    : `§${frag.sec}#${frag.secOcc} blocs ${frag.b0}-${frag.b1}`;

/** Résout un fragment de BLOCS (suite contiguë de blocs d'une section), empreinte NON vérifiée. */
function blocsBruts(chapitre: ChapitreParse, frag: FragmentBlocs): Resolu | ErreurResolution {
  const section = sectionDe(chapitre, frag);
  if (!section) return { error: 'section-inconnue', detail: `§${frag.sec}#${frag.secOcc}` };
  const { b0, b1 } = frag;
  if (!Number.isInteger(b0) || !Number.isInteger(b1) || b0 < 0 || b1 < b0 || b1 >= section.blocks.length) {
    return {
      error: 'bornes-hors-limites',
      detail: `${ouDe(frag)} (section : ${section.blocks.length} blocs)`,
    };
  }
  const blocks = section.blocks.slice(b0, b1 + 1);
  return { md: blocks.map((b) => b.md).join('\n\n'), folios: foliosOf(blocks) };
}

/**
 * Résout un fragment de CELLULE (empreinte NON vérifiée) : la ligne dont une cellule vaut `row`
 * (recherche dans TOUTES les colonnes de la section), croisée avec l'en-tête `col`.
 */
function celluleBrute(chapitre: ChapitreParse, frag: FragmentCellule): Resolu | ErreurResolution {
  const section = sectionDe(chapitre, frag);
  if (!section) return { error: 'section-inconnue', detail: `§${frag.sec}#${frag.secOcc}` };
  const ou = ouDe(frag);
  const hits = rowsMatching(section, normText(String(frag.row ?? '')));
  if (hits.length === 0) return { error: 'ligne-introuvable', detail: ou };
  if (hits.length > 1) return { error: 'ligne-ambigue', detail: `${ou} : ${hits.length} lignes` };
  const hit = hits[0];
  if (!hit.headers.some((h) => normText(h))) return { error: 'table-sans-en-tetes', detail: ou };
  const want = normText(String(frag.col ?? ''));
  const c = hit.headers.findIndex((h) => normText(h) === want);
  if (c < 0) return { error: 'colonne-inconnue', detail: `${ou} : en-têtes = ${hit.headers.join(' / ')}` };
  return { md: (hit.row[c] ?? '').trim(), folios: foliosOf([hit.block]) };
}

/** Texte d'un fragment, empreinte NON vérifiée. */
const resoudreBrut = (chapitre: ChapitreParse, frag: Fragment): Resolu | ErreurResolution =>
  frag.kind === 'cellule' ? celluleBrute(chapitre, frag) : blocsBruts(chapitre, frag);

/** Résout UN fragment d'un chapitre déjà parsé, empreinte comprise. */
export function resoudreFragment(chapitre: ChapitreParse, frag: Fragment): Resolu | ErreurResolution {
  const res = resoudreBrut(chapitre, frag);
  if (estErreur(res)) return res;
  return checkSum(frag, res.md, ouDe(frag)) ?? res;
}

/** Empreinte à POSER sur un fragment que l'on vient de bâtir (l'adresse n'en porte pas encore). */
export function empreinteDe(chapitre: ChapitreParse, frag: Fragment): string | ErreurResolution {
  const res = resoudreBrut(chapitre, frag);
  return estErreur(res) ? res : sumOf(res.md);
}

/** Bloc d'un chapitre vu à plat : son adresse de section, son rang, son texte normalisé. */
export interface BlocPlat { sec: string; secOcc: number; idx: number; md: string; norm: string }

/** Mémo par IDENTITÉ du chapitre parsé : la normalisation des ~1 300 blocs d'un chapitre est
 *  refaite à chaque recherche sans lui (le balayage d'un dataset en fait des dizaines de milliers). */
const _plats = new WeakMap<ChapitreParse, BlocPlat[]>();

/** Aplatit un chapitre en blocs adressables, en ordre de document. */
export function blocsPlats(chapitre: ChapitreParse): BlocPlat[] {
  const memo = _plats.get(chapitre);
  if (memo) return memo;
  const out: BlocPlat[] = [];
  for (const s of chapitre.sections) {
    s.blocks.forEach((b, idx) => {
      out.push({ sec: s.slug, secOcc: s.occ, idx, md: b.md, norm: normText(b.md) });
    });
  }
  _plats.set(chapitre, out);
  return out;
}

/** Toutes les positions du chapitre où un run contigu de blocs vaut exactement `target`. */
function runsBruts(blocks: BlocPlat[], target: string): { i: number; j: number }[] {
  const probe = target.slice(0, PROBE);
  const out: { i: number; j: number }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (!blocks[i].norm || !blocks[i].norm.startsWith(probe.slice(0, blocks[i].norm.length))) continue;
    if (!target.startsWith(blocks[i].norm.slice(0, PROBE))) continue;
    const parts: string[] = [];
    for (let j = i; j < blocks.length; j++) {
      if (!blocks[j].norm) break;
      parts.push(blocks[j].norm);
      const acc = joinNorm(parts);
      if (acc === target) { out.push({ i, j }); break; }
      if (!target.startsWith(acc)) break;
    }
  }
  return out;
}

/** Convertit un run de blocs en fragments (un par section traversée), empreintes calculées. */
function runEnFragments(
  chapitre: ChapitreParse,
  blocks: BlocPlat[],
  run: { i: number; j: number },
): FragmentBlocs[] {
  const frags: FragmentBlocs[] = [];
  for (let k = run.i; k <= run.j; k++) {
    const b = blocks[k];
    const last = frags[frags.length - 1];
    if (last && last.sec === b.sec && last.secOcc === b.secOcc && b.idx === last.b1 + 1) {
      last.b1 = b.idx;
    } else {
      frags.push({ kind: 'blocs', sec: b.sec, secOcc: b.secOcc, b0: b.idx, b1: b.idx, sum: '' });
    }
  }
  for (const f of frags) {
    const sum = empreinteDe(chapitre, f);
    if (typeof sum === 'string') f.sum = sum;
  }
  return frags;
}

/**
 * Cherche dans UN chapitre le premier run contigu de blocs dont la concaténation normalisée vaut
 * `targetNorm`, et le rend en fragments prêts à adresser. `null` si rien ne correspond.
 */
export function findRuns(chapitre: ChapitreParse, targetNorm: string): FragmentBlocs[] | null {
  const blocks = blocsPlats(chapitre);
  const runs = runsBruts(blocks, targetNorm);
  return runs.length ? runEnFragments(chapitre, blocks, runs[0]) : null;
}

/** Cellule d'un chapitre portant le texte cherché. */
export interface CelluleTrouvee { sec: string; secOcc: number; headers: string[]; row: string[]; col: number }

/** Cellules du chapitre dont le texte normalisé vaut `targetNorm`. */
export function findCells(chapitre: ChapitreParse, targetNorm: string): CelluleTrouvee[] {
  const out: CelluleTrouvee[] = [];
  for (const s of chapitre.sections) {
    for (const hit of rowsMatching(s, targetNorm)) {
      for (const col of hit.cols) {
        out.push({ sec: s.slug, secOcc: s.occ, headers: hit.headers, row: hit.row, col });
      }
    }
  }
  return out;
}

/**
 * Bâtit le fragment de cellule d'un `findCells` : clé de ligne = première cellule de la ligne qui la
 * désigne SANS AMBIGUÏTÉ dans sa section, les clés positionnelles (fourchette d100) passant en
 * dernier recours. Rend `null` si la ligne n'a pas de clé sûre ou la table pas d'en-têtes.
 */
export function cellRefFor(chapitre: ChapitreParse, hit: CelluleTrouvee): FragmentCellule | null {
  const col = hit.headers[hit.col];
  if (!col || !normText(col)) return null;
  const section = chapitre.sections.find((s) => s.slug === hit.sec && s.occ === hit.secOcc);
  if (!section) return null;
  const vise = normText(hit.row[hit.col] ?? '');
  const candidates = hit.row
    .map((c, i) => ({ c: c.trim(), i }))
    .filter(({ c, i }) => c && i !== hit.col)
    .sort((a, b) => Number(RANGE_KEY.test(a.c)) - Number(RANGE_KEY.test(b.c)));
  for (const { c } of candidates) {
    if (rowsMatching(section, normText(c)).length !== 1) continue;
    const frag: FragmentCellule = { kind: 'cellule', sec: hit.sec, secOcc: hit.secOcc, row: c, col, sum: '' };
    const sum = empreinteDe(chapitre, frag);
    if (typeof sum !== 'string') continue;
    const res = resoudreFragment(chapitre, { ...frag, sum });
    if (estErreur(res) || normText(res.md) !== vise) continue;
    return { ...frag, sum };
  }
  return null;
}

/** Nombre de places du chapitre où le texte normalisé d'un fragment se retrouve à l'identique. */
function occurrences(chapitre: ChapitreParse, frag: Fragment, texteNorm: string): number {
  if (frag.kind === 'cellule') return findCells(chapitre, texteNorm).length;
  return runsBruts(blocsPlats(chapitre), texteNorm).length;
}

/**
 * Indices des BLOCS d'une section que ce fragment couvre — prédicat de couverture UNIQUE, partagé par
 * le verrou de chevauchement et par tout ce qui doit savoir ce qui est déjà cité (l'éditeur d'adresse,
 * pour offrir un fragment neuf sur un passage LIBRE). Un fragment de CELLULE couvre UN seul bloc :
 * celui de SA table, c'est-à-dire celui où la clé de ligne la résout SANS AMBIGUÏTÉ — la même
 * condition que `celluleBrute`. Deux tables d'une même section qui partagent une clé de ligne ne
 * résolvent pas (`ligne-ambigue`) : la couverture est alors VIDE, pas double.
 * Rend un ensemble VIDE quand la section ou la table n'existe pas — l'erreur est dite ailleurs.
 */
export function blocsCouverts(chapitre: ChapitreParse, frag: Fragment): Set<number> {
  const out = new Set<number>();
  const section = sectionDe(chapitre, frag);
  if (!section) return out;
  if (frag.kind === 'blocs') {
    for (let i = Math.max(0, frag.b0); i <= Math.min(frag.b1, section.blocks.length - 1); i++) out.add(i);
    return out;
  }
  const hits = rowsMatching(section, normText(String(frag.row ?? '')));
  if (hits.length !== 1) return out;
  const idx = section.blocks.indexOf(hits[0].block);
  if (idx >= 0) out.add(idx);
  return out;
}

/**
 * Deux fragments d'un MONTAGE se recouvrent-ils ? Un montage cite des passages DISTINCTS : deux
 * fragments d'une MÊME section dont les blocs couverts se croisent (le cas dégénéré étant le fragment
 * répété, et le cas mixte la table entière PUIS une de ses cellules) rendraient le même texte deux
 * fois, et l'adresse dirait plus que le livre. Verrou STRUCTUREL, au même étage que le plafond de
 * trois fragments : ni l'éditeur ni une migration ne peuvent le contourner.
 *
 * L'erreur DÉSIGNE LE SECOND des deux (`fragment: j`) : c'est celui qu'on vient d'ajouter ou de
 * déplacer dans la quasi-totalité des gestes d'édition, donc celui à corriger ; son détail nomme le
 * premier, pour que l'auteur sache LEQUEL il redit.
 *
 * CE QUE LE VERROU NE COUVRE PAS : deux fragments de SECTIONS DIFFÉRENTES qui citent le même texte.
 * `fragment-ambigu` ne les attrape pas non plus quand chacun est unique DANS SON CHAPITRE au sens du
 * balayage de runs — un livre qui répète un encadré mot pour mot sous deux titres reste adressable
 * deux fois dans un même montage. Le juger demanderait de comparer les TEXTES résolus, pas les
 * positions : c'est une autre question, et elle n'a pas de cas mesuré.
 */
function chevauchementDe(chapitre: ChapitreParse, ref: DescRef): ErreurResolution | null {
  const memeSection = (a: Fragment, b: Fragment) => a.sec === b.sec && a.secOcc === b.secOcc;
  for (let i = 0; i < ref.parts.length; i++) {
    for (let j = i + 1; j < ref.parts.length; j++) {
      const a = ref.parts[i];
      const b = ref.parts[j];
      if (!memeSection(a, b)) continue;
      const couvertsA = blocsCouverts(chapitre, a);
      const memeCellule = a.kind === 'cellule' && b.kind === 'cellule' && a.row === b.row && a.col === b.col;
      const croise = memeCellule || [...blocsCouverts(chapitre, b)].some((k) => couvertsA.has(k));
      // Deux CELLULES du même bloc-table qui ne désignent PAS la même case citent bien deux textes.
      if (croise && !(a.kind === 'cellule' && b.kind === 'cellule' && !memeCellule)) {
        return {
          error: 'fragments-chevauchants',
          fragment: j,
          detail: `${ref.book} ch.${ref.ch} : ${ouDe(b)} cite le même passage que le fragment ${i + 1} (${ouDe(a)})`,
        };
      }
    }
  }
  return null;
}

/**
 * Résout une adresse complète : chaque fragment, joints par une ligne vide, folios en union
 * ordonnée. Un montage (2 fragments et plus) plafonne à trois fragments.
 *
 * RÈGLE D — le plancher de longueur et l'unicité ne valent que pour un fragment `blocs`. Un fragment
 * de blocs désigne son texte PAR CE TEXTE : trop court ou répété ailleurs, il retomberait sur un
 * autre passage à la première ré-extraction (769 des 5 397 blocs du livre de base portent un texte
 * qui apparaît ailleurs, mesure 2026-09-05). Une `cellule` ne désigne rien par son texte : elle est
 * adressée EXACTEMENT par (section, clé de ligne, en-tête de colonne), et l'ambiguïté d'une clé a
 * déjà son refus propre (`ligne-ambigue`, `resoudreFragment`). Lui appliquer le plancher rendait un
 * remède IMPOSSIBLE à l'écran — « étendez les bornes de blocs » sur un fragment qui n'a pas de
 * bornes (mesuré en recette : « Humain » d'une table de races, valide seul, refusé dès le 2ᵉ
 * fragment).
 */
export function resoudreAdresse(chapitre: ChapitreParse, ref: DescRef): Resolu | ErreurResolution {
  if (ref.parts.length > MAX_FRAGMENTS) {
    return {
      error: 'montage-hors-plafond',
      detail: `${ref.book} ch.${ref.ch} : ${ref.parts.length} fragments (plafond ${MAX_FRAGMENTS})`,
    };
  }
  const chevauchement = chevauchementDe(chapitre, ref);
  if (chevauchement) return chevauchement;
  const morceaux: string[] = [];
  const folios: number[] = [];
  for (let i = 0; i < ref.parts.length; i++) {
    const frag = ref.parts[i];
    const res = resoudreFragment(chapitre, frag);
    if (estErreur(res)) return { ...res, fragment: i };
    if (ref.parts.length > 1 && frag.kind === 'blocs') {
      const n = normText(res.md);
      const ou = `${ref.book} ch.${ref.ch} §${frag.sec}#${frag.secOcc}`;
      if (n.length < MIN_FRAGMENT) {
        return {
          error: 'fragment-trop-court',
          fragment: i,
          detail: `${ou} : ${n.length} caractères normalisés (minimum ${MIN_FRAGMENT})`,
        };
      }
      const vus = occurrences(chapitre, frag, n);
      if (vus !== 1) {
        return { error: 'fragment-ambigu', fragment: i, detail: `${ou} : ce texte apparaît ${vus} fois dans le chapitre` };
      }
    }
    morceaux.push(res.md);
    for (const f of res.folios) if (!folios.includes(f)) folios.push(f);
  }
  return { md: morceaux.join('\n\n'), folios };
}
