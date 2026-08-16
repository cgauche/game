import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou i18n — narration moteur (Phase C, cf. docs/i18n-seam.md).
 *
 * Règle : toute ligne de JOURNAL de combat/effet doit passer par le catalogue (`t(...)` / `tr(...)`),
 * jamais par un littéral FR brut. Le scan échoue si un SITE D'ÉMISSION de journal contient un littéral
 * de chaîne FRANÇAIS (cf. `isFrench`) au lieu d'un appel `t`.
 *
 * PÉRIMÈTRE INVERSÉ #410 (2026-07-13) : ancien jumeau exact du garde emoji FAINÉANT — l'ancienne
 * version n'auditait qu'une allowlist de fichiers MIGRÉS, laissant passer TOUT nouveau littéral FR
 * d'un fichier non listé. Le scan balaie désormais TOUT `src/engine` + `src/state` (walk récursif) ;
 * chaque fichier porte une BASELINE gelée de son stock de littéraux FR (la dette ne CROÎT plus), et
 * les fichiers MIGRÉS restent à ZÉRO (invariant enforced). Tout nouveau fichier naît couvert
 * (baseline 0). Le stock gelé (Phase C, à résorber au catalogue) DÉCROÎT au fil des migrations.
 *
 * Couvre les FORMES d'émission de journal (PAS les libellés de MODALE/UI `{label:…}`/`prompt:` —
 * surface UI distincte, Phase D différée) :
 *   - `ev('<kind>', `…``               (événement de journal)
 *   - `.log(`…`` / `.log('…'`          (journal direct)
 *   - `<arr>.push(`…``                  (poussée d'une LIGNE de journal — string nu en littéral)
 *   - `castRefused(…, `…``              (refus d'incantation journalisé)
 *   - `return `…``                      (issue renvoyée par un describer pur, ex. flowOutcomes)
 *
 * NON couvert volontairement : les tableaux `outcome: […]` / `options: […]` / `label:`/`prompt:`
 * d'étape de MODALE (surface UI distincte, Phase D) — leurs chaînes ne sont PAS du journal.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url)); // src/state/ → ../../ = racine du repo
const SCAN_DIRS = ['src/engine', 'src/state'];

/** Fichiers DISPENSÉS par NATURE (#1117) : leur sortie n'est pas une surface de JEU mais une sortie
 *  d'OUTIL de développement — la console de recette (`__wfrp.*`), lue par un développeur/recetteur,
 *  jamais par un joueur. Traduire ces verdicts n'a aucun sens, et les compter dans un cliquet
 *  anti-hausse ne mesure rien (chaque helper de recette en ajoute par construction : la baseline
 *  monterait à chaque outil, ce qui n'est pas un cliquet). Dispense STRUCTURELLE et NOMINATIVE — elle
 *  ne s'étend pas d'elle-même : ajouter un fichier ici demande de justifier que sa surface est
 *  hors-jeu. */
const DEV_ONLY = new Set([
  'src/state/devtools.ts', // outillage `__wfrp` de la recette navigateur (docs/recette-navigateur.md)
]);

/** Fichiers dont la narration de JOURNAL est entièrement passée au catalogue (Phase C) — baseline
 *  ZÉRO INVARIANTE : un littéral FR y réapparaissant échoue, quelle que soit la baseline générale. */
const MIGRATED = new Set([
  'src/engine/conditions.ts',
  'src/engine/ops.ts',
  'src/engine/psychology.ts',
  'src/state/combat/turnHooks.ts',
  'src/state/outOfCombatUpkeep.ts',
  'src/state/combatManeuvers.ts',
  'src/state/flowOutcomes.ts',
  'src/state/combatSlice.ts',
  'src/state/combatFlow.ts',
  'src/state/pursuitFlow.ts', // #1279 : toute la narration de poursuite est passee au catalogue
  'src/state/interludeFlow.ts', // #1318 V8c₁ : `if.*`
  'src/state/massBattleFlow.ts', // #1318 V8c₁ : `mbf.*`
  'src/state/merchantFlow.ts', // #1318 V8c₁ : `mf.*`
  'src/engine/disease.ts', // #1318 V8c₂ : `dz.*` (le moteur pur résout par `t()`, comme `ops.ts`)
  'src/state/combatEffects.ts', // #1318 V8c₂ : `eff.*`
  'src/state/store.ts', // #1318 V8c₂ : `store.*`
  'src/state/travelFlow.ts', // #1318 V8c₂ : `tf.*`
  'src/state/riverVoyageFlow.ts', // #1318 V8c₂ : `rv.*`
  'src/engine/healing.ts', // #1318 V8c₃ : `heal.*` (le moteur pur résout par `t()`, comme `ops.ts`)
  'src/engine/rest.ts', // #1318 V8c₃ : `rest.*`
  'src/state/restFlow.ts', // #1318 V8c₃ : `rf.*`
  'src/state/shipCrew.ts', // #1318 V8c₃ : `crew.*`
  'src/state/seaVoyageFlow.ts', // #1318 V8c₃ : `sv.*`
]);

/** Stock GELÉ par fichier (recensement #410, 2026-07-13) — littéraux FR de narration hors catalogue,
 *  Phase C à résorber. Toute HAUSSE échoue (régression) ; toute BAISSE doit ABAISSER la baseline. Les
 *  fichiers MIGRÉS (ci-dessus) n'y figurent PAS : leur invariant est ZÉRO.
 *
 *  GEL COURANT #1318 V8c₃ (2026-08-17) — `GEL_TOTAL` littéraux sur `GEL_FICHIERS` fichiers, tels que
 *  les voit le prédicat de francité ci-dessous (`isFrench`, qui compte aussi le FR SANS accent), le
 *  lecteur de littéraux (`readString` honore l'ÉCHAPPEMENT) et les SEPT formes d'émission. Ces entrées
 *  ne sont pas des dettes nouvelles : ce sont des littéraux de toujours, qu'une mesure plus fine rend
 *  visibles. UN mouvement dans ce lot, −74 sur 37 → 32 fichiers : les CINQ de la tranche 3 passés
 *  MIGRÉS (`seaVoyageFlow` 27, `healing` 7, `engine/rest` 7, `restFlow` 5, `shipCrew` 9 = −55) et
 *  `engine/trauma` ramené de 20 à 1 (−19 ; son unique reliquat est un ID de type, cf. la note sur son
 *  entrée). Aucune forme nouvelle : la 7ᵉ (V8c₂) suffisait à ce périmètre — ce que le lot a trouvé en
 *  plus (166 sites INVISIBLES au prédicat) l'a été à la PASSE HUMAINE, et ces sites-là n'entraient dans
 *  aucun compte, ni avant ni après.
 *  Les DEUX chiffres ci-dessus sont des CONSTANTES assertées contre la table (`GEL_TOTAL`/`GEL_FICHIERS`,
 *  dernier test du fichier) : ce commentaire a menti une fois (92 annoncés pour 103 tenus), il ne le
 *  peut plus sans rougir.
 *  `state/combatFlow.ts` reste MIGRÉ (invariant ZÉRO) : les littéraux que ce prédicat y a révélés sont
 *  au catalogue (`cf.gangwayCollapse`/`cf.spellNotFound`/`cf.cannotCast`/`cf.cannotPray`/`cf.oups`,
 *  plus `cf.outOfAction`/`cf.noLineOfSight`, et les DEUX que la 7ᵉ forme y a trouvés —
 *  `cf.componentAbsorbs`/`cf.sourceRebuilds` : un fichier « MIGRÉ » ne l'est que pour ce que le
 *  détecteur sait voir, et cette tranche l'a mesuré plutôt que supposé). */
/** Le GEL ANNONCÉ au commentaire ci-dessus, en CONSTANTES — assertées contre la table réelle par le
 *  dernier test du fichier. Un commentaire de gel n'est pas une mesure : celui-ci a annoncé 92 pour
 *  103 tenus (V8c₃, rattrapé par le juge). Désormais, un chiffre faux rougit. */
const GEL_TOTAL = 103;
const GEL_FICHIERS = 32;

const BASELINE: Record<string, number> = {
  'src/engine/drunkenness.ts': 2,
  'src/engine/exposure.ts': 4,
  'src/engine/items.ts': 3,
  'src/engine/money.ts': 3,
  'src/engine/mountTravel.ts': 5,
  'src/engine/provisions.ts': 10,
  'src/engine/qualities/craftEconomy.ts': 3,
  'src/engine/shipCritical.ts': 5,
  'src/engine/social.ts': 1,
  'src/engine/spellRangeFormat.ts': 5,
  'src/engine/structureCritical.ts': 1,
  'src/engine/suffocation.ts': 4,
  'src/engine/tavernGame.ts': 2,
  'src/engine/traits/dispatch.ts': 1,
  // NON-MIGRABLE DÉLIBÉRÉ (V8c₃) : le SEUL littéral restant est `return 'mobilité';` (`traumaOpKind`) —
  // une valeur du type `PassiveKind`, donc un ID accentué, pas une phrase de journal. Le prédicat le
  // compte par son accent ; le passer au catalogue serait faux (c'est du typage), et le maquiller en
  // table pour le soustraire au détecteur serait pire (fausse décroissance). Il reste DIT, à 1.
  'src/engine/trauma.ts': 1,
  'src/engine/travel.ts': 1,
  'src/state/combat/roundHooks.ts': 1,
  'src/state/corruptionFlow.ts': 5,
  // `src/state/devtools.ts` : aucune baseline — DISPENSÉ par nature (`DEV_ONLY`, #1117).
  'src/state/keybindings.ts': 1,
  'src/state/medicFlow.ts': 4,
  'src/state/mount.ts': 1,
  'src/state/netFlow.ts': 4,
  'src/state/partyFlow.ts': 7,
  'src/state/portFlow.ts': 4,
  'src/state/rollFlowFactory.ts': 3,
  // Légendes de l'export ASCII, semées à la déclaration : ce ne sont pas des lignes de JOURNAL, mais
  // elles se gèlent au même titre — à passer au catalogue avec leur surface.
  'src/state/sceneToAscii.ts': 3,
  'src/state/seaActivities.ts': 5,
  'src/state/shipManeuver.ts': 1,
  'src/state/shipwreck.ts': 3,
  'src/state/summonFlow.ts': 1,
  'src/state/travelPostes.ts': 4,
  'src/state/upkeep.ts': 5,
};

/**
 * PRÉDICAT DE FRANCITÉ — HEURISTIQUE, et c'est dit ici (#1333, V8c₀).
 *
 * Trois marques, dans cet ordre : (1) une lettre ACCENTUÉE ; (2) des GUILLEMETS français `« »`
 * (ponctuation de locale) ; (3) un MOT-OUTIL français ou une ÉLISION (`d'`, `l'`, `n'`…) dans un
 * littéral qui contient au moins une espace. La marque (1) seule laissait passer ~67 littéraux FR
 * mesurés sur `src/engine`+`src/state` (« pas de ligne de vue », « Impossible de sauvegarder en plein
 * combat. », « Bourse insuffisante pour … ») — un texte français sans accent restait invisible.
 *
 * Les marques (2) et (3) se lisent sur la PROSE du littéral, ses interpolations `${…}` ôtées : le code
 * interpolé n'est pas du texte, et le lire déclenchait sur `${n > 1 ? 's' : ''}` (élision apparente).
 *
 * LIMITES RÉSIDUELLES, nommées (le garde MESURE ce qu'il sait voir, il ne certifie pas le zéro) :
 *   - phrase FR sans accent, sans guillemets ET sans mot-outil : `reprend connaissance.`,
 *     `Vente : …`, la forme `{sujet} — {quoi} !` (`{label} — MALADRESSE ({roll}) !`, `interludeFlow`)
 *     restent hors du compte. MESURÉ sur trois d'entre eux (`isFrench` rendu `false` pour les trois) :
 *     `combatEffects.ts:1568` « incante … (rituel garanti). », `consumableFlow.ts:128` « utilise : … »,
 *     `partyFlow.ts:615` « +{xp} PX (Ambition accomplie). ». Conséquence à dire : le compte de
 *     `consumableFlow.ts` est 0 — le fichier n'a donc PAS d'entrée de baseline, et cette absence ne
 *     veut pas dire « aucun texte FR », seulement « aucun que ce prédicat sache voir » ;
 *   - littéral d'UN SEUL mot FR (`Carreaux`, `Aucun`, `Standard`) : indiscernable d'un id/clé ASCII —
 *     écarté volontairement (l'espace est la condition de la marque 3) ;
 *   - un mot-outil FR dans une chaîne TECHNIQUE la ferait compter (aucun cas mesuré sur le stock
 *     courant : 0 faux positif sur les 67 littéraux nouvellement captés) ;
 *   - le périmètre reste celui des FORMES d'émission ci-dessus — un littéral posé ailleurs (champ
 *     `reason:`, retour d'objet) n'est vu par aucune marque, faute d'être scanné.
 */
const ACCENT = /[éèêëàâäçôöûùîïœÉÈÊÀÂÇÔÛ]/;
const FR_QUOTES = /[«»]/;
const FR_WORDS =
  /(^|[^A-Za-zÀ-ÿ])(le|la|les|un|une|des|du|de|au|aux|et|est|ne|pas|sur|par|pour|dans|avec|sans|que|qui|ce|cette|ces|son|ses|leur|vers|chez|entre|sous|contre|se|en|vous|votre)([^A-Za-zÀ-ÿ]|$)/i;
const FR_ELISION = /(^|[^A-Za-zÀ-ÿ])[dlnjcmst]['’]/i;

/** `lit` = littéral AVEC ses délimiteurs, tel que rendu par `readString`. */
export function isFrench(lit: string): boolean {
  if (ACCENT.test(lit)) return true;
  const prose = lit.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ');
  if (FR_QUOTES.test(prose)) return true;
  return /\s/.test(prose) && (FR_WORDS.test(prose) || FR_ELISION.test(prose));
}

/** Retire commentaires de ligne et de bloc (sans toucher aux chaînes — heuristique suffisante ici). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Sites d'émission de JOURNAL : le littéral de chaîne suit DIRECTEMENT l'ouverture (pas un `t(`/`tr(`). */
const EMIT_SHAPES: RegExp[] = [
  /\.log\(\s*(['"`])/g, // get().log('…') / env.log(`…`)
  /\bev\('[a-z]+',\s*(['"`])/g, // ev('kind', `…`)
  /\.push\(\s*(['"`])/g, // <journalArray>.push(`…`)
  /castRefused\([^;]*?,\s*(['"`])/g, // castRefused(get, set, c, `…`)
  /\breturn\s+(['"`])/g, // return `…` (describer pur ; PAS `return [` = tableau de modale)
];

/** Forme INITIALISEUR d'un tableau de lignes : `const lines: string[] = [`…`, `…`]`. Semer le tableau
 *  à la déclaration OU l'alimenter par `.push` est le MÊME site d'émission ; sans cette forme, déplacer
 *  un littéral de l'un vers l'autre le faisait DISPARAÎTRE du compte (fausse décroissance de baseline,
 *  mesurée sur `interludeFlow.ts` au passage de #942 L7). Les éléments de tête sont lus un à un —
 *  compter le seul premier rejouerait le même trou d'un cran plus loin. */
const ARRAY_SEED = /:\s*string\[\]\s*=\s*\[/g;

/**
 * Extrait le littéral de chaîne qui commence au délimiteur `quote` à la position `from`.
 *
 * L'ÉCHAPPEMENT est honoré (`\'`, `\"`, `` \` ``, `\\`) : un délimiteur précédé d'un backslash ne
 * ferme pas le littéral. Sans ce pas de plus, `'Impossible d\'ouvrir une bataille de masse…'` était
 * lu comme `'Impossible d\'` — un fragment que `isFrench` déclare FAUX (l'élision y perd son
 * apostrophe, et aucun mot-outil ne subsiste) : la phrase entière échappait au compte (mesuré sur
 * `massBattleFlow.ts` au lot V8c₁).
 */
function readString(body: string, from: number, quote: string): string | null {
  for (let i = from + 1; i < body.length; i++) {
    if (body[i] === '\\') { i++; continue; }
    if (body[i] === quote) return body.slice(from, i + 1);
  }
  return null;
}

/**
 * 6ᵉ FORME (#1318 V8c₁) : `.log(` dont l'argument n'est PAS un littéral COLLÉ à l'ouverture — le cas
 * réel est le TERNAIRE, `get().log(free ? `…` : `…`)`, qui cachait DEUX phrases joueur du chemin
 * d'achat le plus fréquenté (`merchantFlow.ts`) : les cinq formes ci-dessus exigent le délimiteur
 * immédiatement après l'ouverture, donc elles ne voyaient ni l'une ni l'autre.
 *
 * On lit ici tous les littéraux de PROFONDEUR 0 de l'appel — ceux passés en argument DIRECT, quelle
 * que soit l'expression qui les enchâsse (ternaire, concaténation). Un littéral sous appel imbriqué
 * (`get().log(t('mf.buy', { label }))`) est à profondeur 1 : jamais compté, c'est du catalogue.
 * Les appels dont le PREMIER argument est déjà un littéral appartiennent à la forme 1 et sont laissés
 * à elle (sans quoi ils compteraient deux fois).
 */
function logDepth0Literals(body: string): string[] {
  const out: string[] = [];
  const rx = /\.log\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body))) {
    let i = m.index + m[0].length;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] === '"' || body[i] === "'" || body[i] === '`') continue; // forme 1 : à elle de compter
    let prof = 0;
    while (i < body.length) {
      const c = body[i];
      if (c === '(' || c === '[' || c === '{') { prof++; i++; continue; }
      if (c === ']' || c === '}') { prof--; i++; continue; }
      if (c === ')') { if (prof === 0) break; prof--; i++; continue; }
      if (c === '"' || c === "'" || c === '`') {
        const lit = readString(body, i, c);
        if (!lit) break;
        if (prof === 0) out.push(lit);
        i += lit.length;
        continue;
      }
      i++;
    }
  }
  return out;
}

/**
 * 7ᵉ FORME (#1318 V8c₂) : `return [ … ]` — un describer qui RENVOIE SON JOURNAL en tableau. La forme 5
 * (`return` + délimiteur) exige le littéral immédiatement après `return`, et `ARRAY_SEED` ne connaît que
 * la déclaration annotée (`: string[] = [`) : entre les deux, le retour direct d'un tableau de lignes
 * n'était vu par PERSONNE. Le trou est mesuré, pas supposé — `engine/disease.ts` en portait QUATRE
 * (contraction, développement, les deux issues de Gangrène), et la mutation qui remettait l'un d'eux en
 * littéral laissait l'invariant ZÉRO du fichier VERT.
 *
 * Même lecture que la 6ᵉ forme : littéraux de PROFONDEUR 0 du tableau (ceux qui SONT des lignes), pas
 * ceux d'un appel imbriqué (`return [t('dz.develop', { … })]` est à profondeur 1 — c'est du catalogue).
 */
function returnArrayLiterals(body: string): string[] {
  const out: string[] = [];
  const rx = /\breturn\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body))) {
    let i = m.index + m[0].length;
    let prof = 0;
    while (i < body.length) {
      const c = body[i];
      if (c === '(' || c === '[' || c === '{') { prof++; i++; continue; }
      if (c === ')' || c === '}') { prof--; i++; continue; }
      if (c === ']') { if (prof === 0) break; prof--; i++; continue; }
      if (c === '"' || c === "'" || c === '`') {
        const lit = readString(body, i, c);
        if (!lit) break;
        if (prof === 0) out.push(lit);
        i += lit.length;
        continue;
      }
      i++;
    }
  }
  return out;
}

/** Compte les littéraux FR de narration d'un fichier (hors catalogue). */
export function narrationCount(raw: string): number {
  const body = stripComments(raw);
  let n = 0;
  ARRAY_SEED.lastIndex = 0;
  let seed: RegExpExecArray | null;
  while ((seed = ARRAY_SEED.exec(body))) {
    let i = seed.index + seed[0].length;
    for (;;) {
      while (i < body.length && /\s/.test(body[i])) i++;
      const q = body[i];
      if (q !== '"' && q !== "'" && q !== '`') break;
      const lit = readString(body, i, q);
      if (!lit) break;
      if (isFrench(lit)) n++;
      i += lit.length;
      while (i < body.length && /\s/.test(body[i])) i++;
      if (body[i] !== ',') break;
      i++;
    }
  }
  for (const shape of EMIT_SHAPES) {
    shape.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = shape.exec(body))) {
      const quote = m[1];
      const litStart = m.index + m[0].length - 1;
      const lit = readString(body, litStart, quote);
      if (lit && isFrench(lit)) n++;
    }
  }
  for (const lit of logDepth0Literals(body)) if (isFrench(lit)) n++;
  for (const lit of returnArrayLiterals(body)) if (isFrench(lit)) n++;
  return n;
}

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.[tj]sx?$/.test(e)) {
        const rel = relative(ROOT, p).split('\\').join('/');
        if (DEV_ONLY.has(rel)) continue; // sortie d'OUTIL de dev : hors périmètre de la narration de JEU
        const n = narrationCount(readFileSync(p, 'utf8'));
        if (n > 0) counts[rel] = n;
      }
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  return counts;
}

describe('garde-fou i18n — narration moteur (Phase C, #410 inversé)', () => {
  it('aucun fichier de src/engine|src/state ne dépasse sa baseline gelée de littéraux FR', () => {
    const counts = countsByFile();
    const over: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const b = MIGRATED.has(rel) ? 0 : BASELINE[rel] ?? 0;
      if (n > b) over.push(`${rel} : ${n} littéral(aux) FR (baseline gelée ${b})`);
    }
    expect(
      over,
      `Nouveau(x) littéral(aux) FR de narration hors catalogue — passer par t(...)/tr(...) :\n${over.join('\n')}`,
    ).toEqual([]);
  });

  it('les fichiers MIGRÉS restent à ZÉRO littéral FR (invariant Phase C)', () => {
    const counts = countsByFile();
    const regressed: string[] = [];
    for (const rel of MIGRATED) {
      const n = counts[rel] ?? 0;
      if (n > 0) regressed.push(`${rel} : ${n} littéral(aux) FR (doit rester 0)`);
    }
    expect(regressed, `Régression d'un fichier MIGRÉ — la narration doit rester au catalogue :\n${regressed.join('\n')}`).toEqual([]);
  });

  it('le lecteur de littéraux honore l’ÉCHAPPEMENT : une phrase à apostrophe échappée est COMPTÉE', () => {
    // Fixture posée ICI, jamais lue dans l'arbre : le scan ignore les `.test.ts`.
    // Avant le correctif, la lecture s'arrêtait au `\'` — le fragment `'Impossible d\'` ne portait plus
    // ni élision ni mot-outil, et la phrase entière sortait du compte (cas réel : `massBattleFlow.ts`).
    expect(narrationCount("get().log('Impossible d\\'ouvrir une bataille de masse en plein combat tactique.');")).toBe(1);
    expect(narrationCount("  return 'La bataille s\\'achève sans vainqueur clair.';")).toBe(1);
    // Le délimiteur ÉCHAPPÉ ne coupe plus le littéral : les deux moitiés ne comptent pas pour deux.
    expect(narrationCount("get().log('Le tuteur demande l\\'argent d\\'un maître.');")).toBe(1);
    // Aucune régression sur la forme ordinaire (sans échappement).
    expect(narrationCount('get().log("Bourse insuffisante pour payer le panier.");')).toBe(1);
    // …ni faux positif sur une chaîne technique échappée.
    expect(narrationCount("get().log('a\\'b');")).toBe(0);
  });

  it('6ᵉ FORME : un `.log(` TERNAIRE compte SES DEUX branches (l’argument n’est pas collé à l’ouverture)', () => {
    // Le site réel (`merchantFlow.ts`, chemin d'achat) : deux phrases joueur, zéro vue avant ce lot.
    const ternaire = 'get().log(free ? `Achat : ${e} (dans les moyens du Statut du groupe — Tenir les comptes).` : `Vente : ${e} à la criée.`);';
    expect(narrationCount(ternaire)).toBe(2);
    // Un littéral sous appel IMBRIQUÉ reste du catalogue : profondeur 1, jamais compté.
    expect(narrationCount("get().log(t('mf.buy', { label: 'Épée' }));")).toBe(0);
    // La forme 1 garde ses appels : un littéral collé ne compte pas DEUX fois.
    expect(narrationCount("get().log(`Bourse insuffisante pour ${x}.`);")).toBe(1);
  });

  it('7ᵉ FORME : un `return [ … ]` compte SES lignes (le journal RENDU en tableau)', () => {
    // Le site réel (`engine/disease.ts`, contraction/développement/Gangrène) : quatre phrases joueur
    // dans un fichier déclaré MIGRÉ — l'invariant ZÉRO restait VERT quand on les y remettait.
    expect(narrationCount("  return [`${c.label} développe : ${diseaseLabel(name)}.`];")).toBe(1);
    // Deux lignes dans le même retour comptent DEUX fois.
    expect(narrationCount('return [`Le groupe arrive à ${to}.`, `La nuit tombe sur le camp.`];')).toBe(2);
    // Un littéral sous appel IMBRIQUÉ reste du catalogue : profondeur 1, jamais compté.
    expect(narrationCount("return [t('dz.develop', { name: c.label, disease: 'Peste noire' })];")).toBe(0);
    // …et un retour de tableau TECHNIQUE (ids) ne déclenche rien.
    expect(narrationCount("return ['infection-du-sang', 'blessure-purulente'];")).toBe(0);
  });

  it('le GEL ANNONCÉ au commentaire est le gel TENU par la table (le chiffre ne peut plus mentir)', () => {
    const entrees = Object.entries(BASELINE);
    const total = entrees.reduce((n, [, b]) => n + b, 0);
    expect(entrees.length, `GEL_FICHIERS annonce ${GEL_FICHIERS} fichiers, la table en porte ${entrees.length}`).toBe(GEL_FICHIERS);
    expect(total, `GEL_TOTAL annonce ${GEL_TOTAL} littéraux, la table en somme ${total}`).toBe(GEL_TOTAL);
  });

  it('CLIQUET : toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE', () => {
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, b] of Object.entries(BASELINE)) {
      const n = counts[rel] ?? 0;
      if (n < b) stale.push(`${rel} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINE').toEqual([]);
  });
});
