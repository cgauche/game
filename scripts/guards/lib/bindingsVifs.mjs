/**
 * VOCABULAIRE des bindings VIFS (#1692) — dérivé du SEAM lui-même (`src/data/overrides.ts`), jamais
 * une liste tenue à la main : le bloc `const ARRAYS = { … }` est la déclaration UNIQUE des datasets
 * mutés en place, et il donne les deux choses dont une garde a besoin — la CLÉ de dataset (celle que
 * `versionDuDataset` connaît) et le NOM du binding exporté que les modules importent.
 *
 * Sert aux deux gardes structurelles :
 *  - « aucun index figé au niveau module sur un dataset mutable » (`index-vif-guard.test.ts`) ;
 *  - « aucune écriture hors du seam » (`seam-ecriture-guard.test.ts`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { listerArbre } from './lister.mjs';

export const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

/** Retire commentaires de ligne et de bloc (jamais les chaînes : on ne lit que des déclarations). */
function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** Le corps du littéral `const <nom> = { … }` d'un module (accolades équilibrées). */
function corpsDuLitteral(src, nom) {
  const debut = src.indexOf(`const ${nom} = {`);
  if (debut < 0) throw new Error(`bindingsVifs : \`const ${nom} = {\` introuvable dans overrides.ts`);
  const i = src.indexOf('{', debut);
  let profondeur = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') profondeur++;
    else if (src[j] === '}') {
      profondeur--;
      if (profondeur === 0) return src.slice(i + 1, j);
    }
  }
  throw new Error(`bindingsVifs : littéral \`${nom}\` non refermé`);
}

/** Découpe un corps de littéral en entrées, aux virgules de PROFONDEUR 0. */
function entrees(corps) {
  const out = [];
  let profondeur = 0, courant = '';
  for (const c of corps) {
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    if (c === ',' && profondeur === 0) { out.push(courant); courant = ''; continue; }
    courant += c;
  }
  out.push(courant);
  return out.map((e) => e.trim()).filter(Boolean);
}

/** Les entrées du littéral `ARRAYS` du seam : `[clé de dataset, nom du binding]`. Un même binding
 *  peut porter PLUSIEURS clés (`shipConstruction.standard`/`.speedTraits`…) : la liste les garde
 *  toutes, l'index par binding n'en retient qu'une (il ne sert qu'à NOMMER le fautif). */
function entreesDuSeam() {
  const src = sansCommentaires(readFileSync(join(RACINE, 'src/data/overrides.ts'), 'utf8'));
  const out = [];
  for (const e of entrees(corpsDuLitteral(src, 'ARRAYS'))) {
    const avecCle = e.match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/);
    if (avecCle) { out.push([avecCle[1], avecCle[2]]); continue; }
    const seul = e.match(/^([A-Za-z_$][\w$]*)$/);
    if (seul) out.push([seul[1], seul[1]]);
  }
  if (out.length < 100) throw new Error(`bindingsVifs : ${out.length} entrées lues, le littéral ARRAYS a changé de forme`);
  return out;
}

/** Les CLÉS de dataset-tableau déclarées par le seam — doit être exactement `DATASET_KEYS`. */
export function clesDuSeam() {
  return entreesDuSeam().map(([cle]) => cle);
}

/** Nom du binding VIF → clé de dataset, pour tout dataset-tableau du seam. */
export function bindingsVifs() {
  const parBinding = new Map();
  for (const [cle, binding] of entreesDuSeam()) if (!parBinding.has(binding)) parBinding.set(binding, cle);
  return parBinding;
}

/** Les noms LOCAUX d'un fichier qui désignent un binding vif — un nom IMPORTÉ, éventuellement renommé
 *  (`import { props as propsData }`), ou EXPORTÉ par le module propriétaire du dataset lui-même
 *  (`export const MOUNT_PROFILES`). Un homonyme local non exporté (`const props = []` dans une scène)
 *  n'est PAS le dataset : le vocabulaire ne le retient pas. */
export function nomsVifsDuFichier(src, parBinding) {
  const noms = new Map();
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)) {
    for (const spec of m[1].split(',')) {
      const [source, alias] = spec.trim().split(/\s+as\s+/).map((x) => x.trim());
      if (parBinding.has(source)) noms.set(alias || source, parBinding.get(source));
    }
  }
  for (const [binding, cle] of parBinding) {
    if (new RegExp(`^export (const|let|var) ${binding}\\b`, 'm').test(src)) noms.set(binding, cle);
  }
  return noms;
}

/** Les ALIAS d'un import NAMESPACE (`import * as D from '../data'`) : `D.traits` désigne le dataset
 *  aussi sûrement qu'un import nommé, et aucun `(?<![.\w])traits` ne le verrait. */
export function espacesDeNomsDuFichier(src) {
  return [...src.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"][^'"]+['"]/g)].map((m) => m[1]);
}

/** Les ACCESSEURS VIFS du dépôt : tout `const <nom> = memoParVersion|indexParId|indexParChamp(…)`
 *  déclaré sous `src/`. Les APPELER au niveau module (`const ENGINS = siegeEngines().filter(…)`)
 *  re-fige exactement ce que l'accesseur vient de dévier : la valeur rendue est celle de la version
 *  courante, capturée une fois pour toute la vie du module. Vocabulaire DÉRIVÉ, jamais recopié. */
let _accesseurs = null;
export function accesseursVifs() {
  if (_accesseurs) return _accesseurs;
  const out = new Set();
  for (const chemin of fichiersSources()) {
    const src = sansCommentaires(readFileSync(join(RACINE, chemin), 'utf8'));
    for (const m of src.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:memoParVersion|indexParId|indexParChamp)\s*\(/g)) {
      out.add(m[1]);
    }
  }
  _accesseurs = out;
  return out;
}

/** Les noms LOCAUX d'un fichier qui désignent un ACCESSEUR VIF — importé (éventuellement renommé) ou
 *  déclaré sur place. Même règle que `nomsVifsDuFichier` : un homonyme local non vif n'y entre pas. */
export function accesseursDuFichier(src, vifs) {
  const noms = new Set();
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)) {
    for (const spec of m[1].split(',')) {
      const [source, alias] = spec.trim().split(/\s+as\s+/).map((x) => x.trim());
      if (vifs.has(source)) noms.add(alias || source);
    }
  }
  for (const m of src.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:memoParVersion|indexParId|indexParChamp)\s*\(/g)) {
    noms.add(m[1]);
  }
  return noms;
}

/** Les DÉCLARATIONS de niveau module d'un source TS : `[const|let|var] … ;`, texte complet, hors
 *  toute fonction/classe/bloc (profondeur d'accolades 0 au moment de la déclaration). S'y ajoutent
 *  les trois autres formes qui s'ÉVALUENT tout autant à l'import et qu'aucun `const` ne porte :
 *  `export default <expr>;`, l'AFFECTATION NUE (`M = new Map(…)`, sur un `let` déclaré plus haut) et
 *  la BOUCLE de niveau module. Chaînes, gabarits, regex et commentaires sont traversés sans compter
 *  leurs délimiteurs. */
export function declarationsDeNiveauModule(src) {
  const out = [];
  let i = 0, profondeur = 0;
  const ligneDe = (pos) => src.slice(0, pos).split('\n').length;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
    if (c === "'" || c === '"' || c === '`') { i = finDeChaine(src, i); continue; }
    if (c === '{') { profondeur++; i++; continue; }
    if (c === '}') { profondeur--; i++; continue; }
    if (profondeur === 0 && (i === 0 || /[\s;})]/.test(src[i - 1]))) {
      const reste = src.slice(i);
      if (/^(export\s+)?(const|let|var)\s+[A-Za-z_$]/.test(reste) || /^(export\s+)?(const|let|var)\s*[[{]/.test(reste)) {
        const fin = finDeDeclaration(src, i);
        out.push({ ligne: ligneDe(i), texte: src.slice(i, fin) });
        i = fin;
        continue;
      }
      // `export default new Map(traits.map(…))` : aucun `const` ne le porte, et il s'évalue à l'import.
      if (/^export\s+default\b/.test(reste)) {
        const fin = finDeDeclaration(src, i);
        out.push({ ligne: ligneDe(i), texte: src.slice(i, fin) });
        i = fin;
        continue;
      }
      // AFFECTATION NUE de module (`let M; … M = new Map(traits.map(…));`) : la déclaration `let M;`
      // est innocente, c'est l'affectation qui fige. `a === b`, `a =>` et `a += …` n'en sont pas.
      if (/^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*=(?![=>])/.test(reste)) {
        const fin = finDeDeclaration(src, i);
        out.push({ ligne: ligneDe(i), texte: src.slice(i, fin) });
        i = fin;
        continue;
      }
      // Une BOUCLE de niveau module remplit son index à l'import tout autant qu'un `new Map(…)` :
      // `const m = new Map(); for (const t of traits) m.set(t.id, t);` sert l'ancien monde pareil.
      if (/^(for|while)\s*\(/.test(reste)) {
        const fin = finDeBoucle(src, i);
        out.push({ ligne: ligneDe(i), texte: src.slice(i, fin), boucle: true });
        i = fin;
        continue;
      }
    }
    i++;
  }
  return out;
}

/** Fin d'une boucle de niveau module : sa parenthèse refermée, puis son bloc `{…}` (ou son unique
 *  instruction jusqu'au `;`). */
function finDeBoucle(src, i) {
  let j = src.indexOf('(', i), profondeur = 0;
  for (; j < src.length; j++) {
    if (src[j] === '(') profondeur++;
    else if (src[j] === ')') { profondeur--; if (profondeur === 0) { j++; break; } }
  }
  while (j < src.length && /\s/.test(src[j])) j++;
  if (src[j] !== '{') return finDeDeclaration(src, j);
  profondeur = 0;
  for (; j < src.length; j++) {
    if (src[j] === '{') profondeur++;
    else if (src[j] === '}') { profondeur--; if (profondeur === 0) return j + 1; }
  }
  return src.length;
}

function finDeChaine(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === q) return j + 1;
  }
  return src.length;
}

/** Fin d'une déclaration de niveau module : le `;` ou le saut de ligne atteint à profondeur 0. */
function finDeDeclaration(src, i) {
  let profondeur = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j) - 1; continue; }
    if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j) + 1; continue; }
    if (c === "'" || c === '"' || c === '`') { j = finDeChaine(src, j) - 1; continue; }
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    else if (c === ';' && profondeur === 0) return j + 1;
    if (profondeur < 0) return j;
  }
  return src.length;
}

const PRIMITIVES_VIVES = /\b(indexParId|indexParChamp|memoParVersion)\s*\(/;
/** Toute méthode qui rend une valeur DÉRIVÉE du contenu : l'appeler au niveau module fige ce contenu,
 *  qu'on en fasse une `Map` (index) ou un tableau (vue). Les deux ont le même défaut de fond. */
const RECEVEUR = '(map|filter|flatMap|reduce|reduceRight|slice|concat|find|findIndex|findLast|some|every|sort|reverse|join|forEach|keys|values|entries|at)';
const MUTATEURS = 'push|splice|pop|shift|unshift|sort|reverse|fill|copyWithin';

/** Le VOCABULAIRE d'un fichier : chaque motif désigne une LECTURE du contenu d'un dataset du seam —
 *  binding importé/exporté (`traits.filter`), espace de noms (`D.traits.map`), accès par la clé
 *  (`datasetArray('traits').map`), et `for (const t of traits)`. */
function motifsDeLecture(noms, espaces, parBinding, accesseurs = new Set()) {
  const out = [];
  for (const nom of noms.keys()) {
    out.push([nom, `(?<![.\\w])${nom}\\s*\\.\\s*${RECEVEUR}\\b`]);
    out.push([nom, `(?<![.\\w])for\\s*\\([^)]*\\bof\\s+${nom}\\s*\\)`]);
    out.push([nom, `\\[\\s*\\.\\.\\.\\s*${nom}\\s*[,\\]]`]);
    out.push([nom, `(?<![.\\w])${nom}\\s*(?:\\[|\\.\\s*length\\b)`]);
    // DÉSTRUCTURATION (`const [premier] = traits`, `const { length } = creatures`) : elle extrait le
    // contenu sans nommer aucune méthode ni aucun indice — l'élément capturé est figé comme un index.
    out.push([nom, `^\\s*(?:export\\s+)?(?:const|let|var)?\\s*[\\[{][^=;]*[\\]}]\\s*=\\s*${nom}(?![\\w$(])`]);
  }
  // ACCESSEUR VIF RE-FIGÉ : `const ENGINS = siegeEngines().filter(…)`, `new Map(oupsTable().map(…))`.
  // L'appel au niveau module capture la valeur de la version COURANTE — la dévie de l'accesseur ne
  // change rien, le module servira cette valeur-là jusqu'au rechargement.
  for (const nom of accesseurs) out.push([`${nom}()`, `(?<![.\\w])${nom}\\s*\\(\\s*\\)`]);
  // `import * as D` ne nomme rien : c'est le MEMBRE qui désigne le dataset — tout le vocabulaire du
  // seam est donc candidat derrière un espace de noms, pas seulement ce que le fichier importe.
  for (const espace of espaces) {
    for (const binding of parBinding.keys()) {
      out.push([`${espace}.${binding}`, `(?<![.\\w])${espace}\\s*\\.\\s*${binding}\\s*(?:\\.\\s*${RECEVEUR}\\b|\\[|\\.\\s*length\\b)`]);
    }
  }
  out.push(['datasetArray(…)', `datasetArray\\s*\\(\\s*['"][\\w$-]+['"]\\s*\\)\\s*(?:as\\s[^;=]*?)?\\.\\s*${RECEVEUR}\\b`]);
  return out;
}

/** Les ouvertures de CORPS DE FONCTION dans une déclaration : flèche, `function`, accesseur
 *  (`get x() {`) et méthode abrégée (`pool(): T {`) — un `if (…) {` n'en est pas une. */
const FRONTIERES_DE_CORPS = /=>|\bfunction\b|\b(?:get|set)\s+[A-Za-z_$][\w$]*\s*\(|(?<!\b(?:if|for|while|switch|catch|return)\s*)\b[A-Za-z_$][\w$]*\s*\([^()]*\)\s*(?::[^{;()]*)?\{/;

/** L'IIFE de module (`const M = (() => new Map(traits.map(…)))();`, `(function () {…})()`) : son corps
 *  N'EST PAS un abri — il s'exécute à l'import comme le reste de la déclaration. Reconnue par ses deux
 *  bouts : une parenthèse ouvrante qui enveloppe une flèche/`function` juste après le `=`, et l'appel
 *  `()` qui referme le déclarateur. */
const EST_IIFE = (texte) => /=\s*\(\s*(?:async\s+)?(?:function\b|\()/.test(texte) && /\)\s*\(\s*\)\s*;?\s*$/.test(texte.trim());

/** Une lecture est ÉVALUÉE À L'IMPORT si aucune frontière de corps ne la précède DANS son déclarateur :
 *  après l'une d'elles, elle vit dans un corps, donc à chaque APPEL (lecture vive) — sauf si ce corps
 *  est celui d'une IIFE, appelée sur place. */
function positionVive(texte, index) {
  if (EST_IIFE(texte)) return false;
  return FRONTIERES_DE_CORPS.test(texte.slice(0, index));
}

/** Les DÉCLARATEURS SŒURS d'une déclaration, aux virgules de PROFONDEUR 0 (`const a = () => x, B = …`
 *  en porte deux) : sans cette découpe, la flèche du PREMIER servirait d'abri au second. */
function declarateurs(texte) {
  const out = [];
  let profondeur = 0, debut = 0;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    // Commentaires TRAVERSÉS : une parenthèse de prose (« // 1) Espèces ») déséquilibrerait le
    // compteur et couperait le déclarateur en deux, ce qui rend vif ce qui ne l'est pas.
    if (c === '/' && texte[i + 1] === '/') { const f = texte.indexOf('\n', i); if (f < 0) break; i = f; continue; }
    if (c === '/' && texte[i + 1] === '*') { const f = texte.indexOf('*/', i); if (f < 0) break; i = f + 1; continue; }
    if (c === "'" || c === '"' || c === '`') { i = finDeChaine(texte, i) - 1; continue; }
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    else if (c === ',' && profondeur === 0) { out.push(texte.slice(debut, i)); debut = i + 1; }
  }
  out.push(texte.slice(debut));
  return out;
}

/** Les VALEURS FIGÉES d'un source : index (`new Map(traits.map(…))`) ET vues dérivées
 *  (`const armes = trappings.filter(…)`) bâtis au niveau module sur un dataset du seam OU sur le
 *  retour d'un ACCESSEUR VIF appelé là (`siegeEngines().filter(…)`), sans passer par les primitives
 *  vives. Une valeur figée SERT L'ANCIEN MONDE après une édition au Codex.
 *  Le nom qu'une déclaration fautive DÉCLARE rejoint le vocabulaire : l'index bâti ensuite sur cette
 *  vue (`new Map(armes.map(…))`) est nommé lui aussi. Rend des lignes `fichier:ligne — …`. */
export function indexFiges(chemin, src, parBinding, vifs = accesseursVifs()) {
  const noms = nomsVifsDuFichier(src, parBinding);
  const espaces = espacesDeNomsDuFichier(src);
  const accesseurs = accesseursDuFichier(src, vifs);
  if (!noms.size && !espaces.length && !accesseurs.size && !src.includes('datasetArray')) return [];
  const out = [];
  for (const decl of declarationsDeNiveauModule(src)) {
    if (PRIMITIVES_VIVES.test(decl.texte)) continue;
    const morceaux = decl.boucle ? [decl.texte] : declarateurs(decl.texte);
    let vu = false;
    for (const [nom, motif] of motifsDeLecture(noms, espaces, parBinding, accesseurs)) {
      for (const morceau of morceaux) {
        const m = morceau.match(new RegExp(motif));
        if (!m || (!decl.boucle && positionVive(morceau, m.index))) continue;
        out.push(`${chemin}:${decl.ligne} — valeur figée à l’import sur la source vive « ${nom} » : ${decl.texte.split('\n')[0].trim()}`);
        const declare = decl.texte.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
        if (declare) noms.set(declare[1], nom);
        vu = true;
        break;
      }
      if (vu) break;
    }
  }
  return out;
}

/** Les ÉCRITURES HORS SEAM d'un source : une mutation posée directement sur le binding d'un dataset —
 *  par une méthode mutante (`traits.push(…)`), par sa `length`, ou PAR INDEX (`traits[0] = …`,
 *  `traits[0].label = …`, qui ne passe par aucune méthode et échappe donc au premier motif). */
export function ecrituresHorsSeam(chemin, src, parBinding) {
  const noms = nomsVifsDuFichier(src, parBinding);
  if (!noms.size) return [];
  const lignes = src.split('\n');
  const out = [];
  for (const nom of noms.keys()) {
    const parMethode = `\\.\\s*(?:(?:${MUTATEURS})\\s*\\(|length\\s*=[^=])`;
    const parIndex = `\\[[^\\]]*\\]\\s*(?:\\.\\s*[A-Za-z_$][\\w$]*\\s*)*=(?![=>])`;
    const rx = new RegExp(`(?<![.\\w])${nom}\\s*(?:${parMethode}|${parIndex})`);
    lignes.forEach((l, i) => {
      if (rx.test(l)) out.push(`${chemin}:${i + 1} — écriture hors seam sur le dataset « ${nom} » : ${l.trim()}`);
    });
  }
  return out;
}

/** Tous les `.ts`/`.tsx` de `src/`, chemins relatifs à la racine du dépôt, à ORDRE TOTAL
 *  (`listerArbre`, #1679 L3b : un listing brut suit l'ordre du système de fichiers). */
export function fichiersSources() {
  return listerArbre(join(RACINE, 'src'), { filtre: (rel) => /\.tsx?$/.test(rel) }).map((rel) => `src/${rel}`);
}
