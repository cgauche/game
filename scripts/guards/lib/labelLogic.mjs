// Mécanique de scan du garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc
// agents). Module ESM pur, exécutable par `node` nu — consommé par
// src/state/label-logic-guard.test.ts ET par un futur hook pre-commit.

/** Retire les commentaires de bloc et de ligne (pas les chaînes).
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Carte par label : constante hurlante `XXX_BY_LABEL`/`XXXBYLABEL`, ou fonction/variable `byLabel`. */
export const BY_LABEL_RX = /(BY_?LABEL|byLabel)/;

/** Comparaison D'ÉGALITÉ sur `.label`, dans un sens ou l'autre. Le membre en face de `.label` doit
 *  être un accès `mot(.mot)*` COLLÉ (pas d'appel/parenthèse/optional-chaining entre les deux) : ça
 *  exclut `find((x) => x.id === id)?.label` (extraction d'AFFICHAGE après un lookup PAR ID), qui
 *  n'est pas une comparaison mais une résolution de libellé légitime. */
export const LABEL_EQ_RX = /\.label\s*===|===\s*[\w.]+\.label\b/;

/** PRÉDICAT sur `.label` : `.label` comme ARGUMENT d'un `.test(`/`.exec(` (regex évaluée contre un
 *  label), ou comme RÉCEPTEUR d'une méthode de chaîne prédicative (`.label.startsWith(`/`.endsWith(`/
 *  `.match(`/`.includes(`/`.test(`/`.search(`/`.indexOf(`). Même défaut que `LABEL_EQ_RX` : logique
 *  qui distingue des cas par IDENTITÉ de libellé plutôt que par `id` stable. */
export const LABEL_PREDICATE_RX = /\.test\([^)]*\.label\b|\.label\.(?:match|includes|startsWith|endsWith|test|search|indexOf)\(/;

/** `switch` sur `.label` : un aiguillage par libellé est la même famille de logique-par-label qu'une
 *  carte `BY_LABEL`, juste écrite en `switch`. */
export const LABEL_SWITCH_RX = /switch\s*\([^)]*\.label\b/;

/** DÉRIVATION D'IDENTITÉ depuis un libellé : `slugId(x.label)` (#637). Re-dériver un `id` à partir du
 *  `.label` (affichage multilangue) au runtime couple l'identité à la langue — une traduction change
 *  l'id, cassant lookups/références/sauvegardes. L'`id` est explicite et OBLIGATOIRE sur l'entité,
 *  jamais dérivé. Vise `.label` SEULEMENT (pas `.name` : la conversion d'un fragment TEXTE saisi en
 *  éditeur — `slugId(p.name)` d'un `splitLabel` — est la couture label→id d'authoring tolérée). */
export const SLUG_FROM_LABEL_RX = /slugId\s*\(\s*[\w.]+\.label\b/;

/** Champs d'AFFICHAGE d'une entité : `label` ET `name` (#598 — `Weapon.name`/`ItemInstance.name`/
 *  `Combatant.name` sont des libellés). ⚠ `name` est AMBIGU dans ce dépôt : `ConditionInstance.name`
 *  et l'instance de maladie portent un **id** sous ce nom (dette #598, résorbée par le renommage
 *  `name`→`id`) — d'où le baseline nommé côté test, JAMAIS un élargissement aveugle. */
const DISPLAY_FIELD = '(?:label|name)';

/** Champ d'affichage interpolé dans un littéral de gabarit qui sert de **CLÉ** (`key: \`x:${w.name}\``).
 *  C'est la forme qui a laissé vivre `weapon:${weapon.name}` (#598) : la garde `.label` d'origine ne
 *  voyait ni `name`, ni la construction de clé par template. On ne vise QUE la construction d'identité
 *  (`key` en propriété ou en affectation) — les ~700 interpolations d'AFFICHAGE (`${c.name} touche…`)
 *  restent hors de portée, la lecture d'un libellé pour l'afficher étant précisément son usage légitime. */
export const DISPLAY_KEY_TEMPLATE_RX = new RegExp('\\bkey\\s*[:=]\\s*`[^`]*\\$\\{[^}]*\\.' + DISPLAY_FIELD + '\\b');

/** Champ d'affichage d'une entité en INDEX de LECTURE : `manualOpen[cl.name]`, `NAME_TO_GROUP[w.name]`.
 *  Le `[` doit suivre un réceptacle (identifiant/`)`/`]`) — un littéral de TABLEAU (`[v.id, v.label]`,
 *  paire d'un `Object.fromEntries`) n'est pas une indexation. */
const DISPLAY_INDEX_RX = new RegExp('[\\w)\\]]\\[[^\\]]*\\.' + DISPLAY_FIELD + '\\b[^\\]]*\\]');

/** …mais une ÉCRITURE d'index (`m[x.label] = v`, `acc[it.name] ??= …`) CONSTRUIT un index par texte —
 *  la conversion label→id tolérée (CLAUDE.md) ; seule la LECTURE (une décision) est visée. */
const INDEX_WRITE_RX = /\]\s*(?:\?\?|\|\||&&|[-+*/%])?=[^=]/;

/** Méthodes d'INTERROGATION d'une collection — `set`/`add` en sont volontairement ABSENTS : REMPLIR un
 *  index depuis du texte est la couture tolérée ; INTERROGER une collection avec le libellé d'une entité
 *  qu'on tient (donc dont on a l'`id`) est la faute. */
const LOOKUP_CALL_RX = /\.(?:has|get|delete)\(/g;

/**
 * `.label`/`.name` d'une entité passé en CLÉ d'interrogation — `owned.has(x.label)`,
 * `idx.get(concreteLabel(e.label, s))` (#602). L'argument est délimité par COMPTAGE de parenthèses :
 * sans ça, `byId.get(id)?.label` (résolution d'un libellé APRÈS un lookup PAR ID — lecture d'affichage
 * légitime, ~50 sites) serait flaguée à tort.
 * @param {string} line @returns {boolean}
 */
export function hasDisplayLookupKey(line) {
  const FIELD_RX = new RegExp('\\.' + DISPLAY_FIELD + '\\b');
  for (const m of line.matchAll(LOOKUP_CALL_RX)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < line.length && depth > 0; i++) {
      if (line[i] === '(') depth++;
      else if (line[i] === ')') depth--;
    }
    if (FIELD_RX.test(line.slice(start, depth === 0 ? i - 1 : line.length))) return true;
  }
  return false;
}

/** Champ d'affichage comme CLÉ DE COLLECTION (#602) : interrogation `has`/`get`/`delete`, ou LECTURE
 *  d'index. @param {string} line @returns {boolean} */
export function hasDisplayCollectionKey(line) {
  return hasDisplayLookupKey(line) || (DISPLAY_INDEX_RX.test(line) && !INDEX_WRITE_RX.test(line));
}

/**
 * Scan complet d'un fichier source : toute logique par label — carte `BY_LABEL`/`byLabel`, comparaison
 * d'égalité sur `.label`, PRÉDICAT sur `.label` (regex/méthode de chaîne), `switch` sur `.label`, ou
 * champ d'AFFICHAGE (`label`/`name`) interpolé dans une CLÉ (`DISPLAY_KEY_TEMPLATE_RX`, #598), ou
 * champ d'affichage servant de CLÉ DE COLLECTION (`hasDisplayCollectionKey`, #602) — ligne par ligne,
 * commentaires retirés.
 *
 * Frontière de la règle #602 (doctrine, pas liste d'exceptions) : CONSTRUIRE un index depuis du texte
 * (`.set(x.label, …)`, `m[x.label] = …`) est la conversion label→id TOLÉRÉE ; INTERROGER une collection
 * (`has`/`get`/`delete`, lecture d'index) avec le libellé d'une entité qu'on tient — donc dont on a
 * l'`id` — est la faute. Une résolution de texte HUMAIN entrant (auto-liage de prose, import de
 * statbloc) se déclare par une fonction dont le paramètre EST du texte, et ne lit alors aucun `.label`.
 *
 * LIMITE CONNUE (heuristique volontairement précise plutôt qu'à faux positifs, cf. #142) : ce scan est
 * SYNTACTIQUE — il ne détecte que les sites où `.label` est TEXTUELLEMENT adjacent à l'opérateur/la
 * méthode incriminée. Un prédicat testé contre une VARIABLE qui *tient* un label sans que `.label`
 * apparaisse sur la même ligne (ex. `const lbl = x.label; regex.test(lbl)`) échappe au scan — à
 * détecter par revue de code, pas par cette garde mécanique.
 *
 * Chaque finding porte sa `rule` : les règles `.label` HISTORIQUES (#142) valent `label-logic` et
 * restent à TOLÉRANCE ZÉRO ; la règle `display-key` (#598, champ d'affichage interpolé en CLÉ) est
 * distinguée pour que l'appelant puisse lui adosser un baseline SANS relâcher les premières.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'label-logic' | 'display-key' }[]}
 */
export function scanLabelLogic(relPath, contenu) {
  const findings = [];
  const body = stripComments(contenu);
  body.split('\n').forEach((line, i) => {
    const labelLogic =
      BY_LABEL_RX.test(line) ||
      LABEL_EQ_RX.test(line) ||
      LABEL_PREDICATE_RX.test(line) ||
      LABEL_SWITCH_RX.test(line) ||
      SLUG_FROM_LABEL_RX.test(line);
    // Une ligne qui viole les DEUX est rapportée sous `label-logic` (la règle la plus stricte prime,
    // sinon un baseline `display-key` amnistierait au passage une vraie logique-par-label).
    if (labelLogic) findings.push({ line: i + 1, detail: line.trim(), rule: 'label-logic' });
    else if (hasDisplayCollectionKey(line)) findings.push({ line: i + 1, detail: line.trim(), rule: 'collection-key' });
    else if (DISPLAY_KEY_TEMPLATE_RX.test(line)) findings.push({ line: i + 1, detail: line.trim(), rule: 'display-key' });
  });
  return findings;
}
