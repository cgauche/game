import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { stripLiterals } from './cascade-step-difficulty-guard.test';

/**
 * CLIQUET — une étape de cascade qui LANCE dit son ENJEU (#1117, arbitrage user : « Louvoyage… ça
 * se mange ? » / « Faudrait globaliser ça, histoire qu'on sache pourquoi on fait un jet »). Une étape
 * qui LANCE doit ÉNONCER ce qu'elle met en jeu (`CascadeStep.stake`, référence de donnée résolue par
 * `resolveStake`) : sans lui, la modale demande un jet sans dire pourquoi.
 *
 * Le discriminant est la FORME, pas un drapeau : `stepInteraction` (`state/cascade.ts`) rend `'jet'
 * dès que `step.target != null` — `interactive` ne gouverne QUE les rangées d'une étape à
 * participants (`stepReady`, cas `batch`). Une étape mono est donc rendue et lancée par le joueur
 * qu'elle porte ou non `interactive: true`, et `result: null` y est facultatif : ces deux champs
 * n'ont jamais mesuré ce que le cliquet vise.
 *
 * Même parseur que `cascade-step-difficulty-guard` (commentaires et contenus de chaînes/gabarits
 * neutralisés avant le parcours d'accolades) — un invariant par fichier. Baseline NOMINATIVE et
 * DÉCROISSANTE : un site doté ABAISSE sa ligne.
 */

/** COUVERTURE des quatre scans : `src/state` (les flux) ET `src/scenes` (les Flows AUTHORÉS des
 *  documents de scène — ils décrivent des jets pour de vrai, et un `testFlow` y est aussi muet
 *  qu'ailleurs). Un détecteur ne mesure que sa couverture : elle est NOMMÉE ici, la clé de baseline
 *  porte le dossier (`state/…`, `scenes/…`). */
const SRC = join(process.cwd(), 'src');
const SCAN_ROOTS = [join(SRC, 'state'), join(SRC, 'scenes')];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { out.push(...sourceFiles(p)); continue; }
    if (e.endsWith('.ts') && !e.includes('.test.')) out.push(p);
  }
  return out;
}

/** Tous les fichiers scannés, tous dossiers de couverture confondus. */
const scanned = () => SCAN_ROOTS.flatMap(sourceFiles);
/** Clé de baseline d'un fichier scanné : chemin RELATIF à `src/` (`state/combatFlow.ts`). */
const keyOf = (f: string) => f.slice(SRC.length + 1).split(sep).join('/');

/** La propriété `name` est-elle posée au PREMIER niveau du littéral `lit` ? (Un `kind` enfoui dans un
 *  sous-objet — `outcome: { kind }` d'un Test étendu — ne fait pas de son porteur une étape.) */
function hasTopLevelKey(lit: string, name: string): boolean {
  let depth = 0;
  for (const m of lit.matchAll(new RegExp(`[{}]|(?<=[{,]\\s*)${name}\\s*[:,}]`, 'g'))) {
    if (m[0] === '{') depth++;
    else if (m[0] === '}') depth--;
    else if (depth === 1) return true;
  }
  return false;
}

/** Étapes qui LANCENT (cible posée), sans `stake` — renvoie leurs numéros de ligne (1-based). */
export function stepsWithoutStake(src: string): number[] {
  const s = stripLiterals(src);
  // POSE DIFFÉRÉE : un flux qui dote ses étapes APRÈS construction (`st.stake = nightStake(st.kind)`,
  // cascade de nuit) couvre ses littéraux hors de leur portée lexicale — le scan ne peut pas les lire
  // comme muets. La dotation reste vérifiée par le catalogue d'enjeux de CE flux.
  if (/\.stake\s*=\s*/.test(s)) return [];
  const lines: number[] = [];
  const seen = new Set<number>();
  // Les formes qui LANCENT, telles que `stepInteraction` les reconnaît (`state/cascade.ts`) :
  //  - `'jet'`   = une CIBLE en position de PROPRIÉTÉ (`target: <expr>` ou le raccourci `target,`) ;
  //    une valeur de chaîne est blanchie par `stripLiterals` → `target: 'party'` (cible d'un EFFET)
  //    ne matche pas ;
  //  - `...rollStep({…})` = la MÊME cible, posée par le MONTEUR CANONIQUE (#1153) : depuis que les
  //    flux DÉCLARENT leur ligne au lieu de la calculer, la cible n'est plus un littéral de l'étape.
  //    Sans cette forme, le cliquet devient AVEUGLE sur tout site migré (couverture, pas exemption) ;
  //  - `actor:` = la DÉCLARATION d'un mint MONO (`monoStep`, #1262) : la cible n'est plus même montée
  //    au site, c'est le mint qui la pose — seul le porteur déclaré (`actor`, jamais `actorId`) et le
  //    `kind` restent visibles. Même raison que ci-dessus : sans elle, migrer rendrait le cliquet vert ;
  //  - `'table'` = un TIRAGE SUR TABLEAU (`table: <expr>`), qui met tout autant en jeu (Blessure
  //    critique, Oups, Colère des dieux, mutation) et n'a PAS de `target` — angle mort jumeau de
  //    celui d'`interactive`, levé ici.
  for (const m of s.matchAll(/(?<=[{,]\s*)(?:target\s*(?::\s*[^\s,}]|[,}])|table\s*:\s*[^\s,}]|actor\s*:\s*[^\s,}])|\.\.\.rollStep\(/g)) {
    const i = m.index!;
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (s[j] === '}') depth++;
      else if (s[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    if (start < 0 || seen.has(start)) continue;
    seen.add(start);
    // Seule une accolade OUVRANT UN LITTÉRAL est une étape : celle d'un corps de fonction, d'une
    // interface ou d'un bloc est précédée d'autre chose que `(`/`,`/`[`/`=`/`?`/`return`.
    if (!/(?:[([,=?]|\breturn)$/.test(s.slice(0, start).replace(/\s+$/, ''))) continue;
    depth = 0;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (end < 0) continue;
    const lit = s.slice(start, end);
    if (!hasTopLevelKey(lit, 'kind')) continue; // CONTRIBUTEUR batch (aucun kind) / pending d'un autre flux

    if (!/\b(actorId|actor|worldOwner|rollLabel)\s*[:,}]/.test(lit)) continue; // aucun lanceur nommé : pas une étape
    // `stake:`, raccourci `stake,` — et `{ …, stake }` en dernière propriété (le littéral est tranché
    // AVANT son accolade fermante : la fin de chaîne y tient lieu de délimiteur).
    if (/\bstake\s*(?:[,:]|$)/.test(lit)) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/**
 * Jets DÉCRITS au seam (`RollRequest`, `state/rollSeam.ts`) sans enjeu — l'AUTRE forme qui lance :
 * `openRoll` construit l'étape à partir d'elle, donc un `RollRequest` muet produit une étape muette
 * que le scan d'étapes ci-dessus ne peut pas voir (le littéral d'étape est DANS le seam, générique).
 *
 * CONTRAT (#1117 vague 3, « `RollRequest.stake` devient-il REQUIS ? ») : le champ reste optionnel au
 * TYPE tant que la baseline ci-dessous est peuplée, et s'y ferme le jour où elle atteint 0. La garde
 * rend le critère mesurable : tout site soldé s'y retire, tout site neuf muet ROUGIT.
 */
export function rollRequestsWithoutStake(src: string): number[] {
  const s = stripLiterals(src);
  const lines: number[] = [];
  const seen = new Set<number>();
  for (const m of s.matchAll(/(?<=[{,]\s*)klass\s*:\s*[^\s,}]/g)) {
    const i = m.index!;
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (s[j] === '}') depth++;
      else if (s[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    if (start < 0 || seen.has(start)) continue;
    seen.add(start);
    if (!/(?:[([,=?]|\breturn)$/.test(s.slice(0, start).replace(/\s+$/, ''))) continue;
    depth = 0;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (end < 0) continue;
    const lit = s.slice(start, end);
    if (!hasTopLevelKey(lit, 'actionLabel')) continue; // pas une `RollRequest` (un `klass` d'autre chose)
    if (/\bstake\s*(?:[,:]|$)/.test(lit)) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/** Baseline NOMINATIVE des `RollRequest` muettes — même contrat que celle des étapes. */
const BASELINE_REQ: Record<string, number> = {
  // La PORTE elle-même : ses `RollRequest` de commodité sont GÉNÉRIQUES — `openPartyTest` et
  // `openWorldTest` TRANSMETTENT désormais le `stake` de leur appelant (donc soldées) ; la dernière
  // est la forme qui n'a pas encore de spec porteuse.
  'state/rollSeam.ts': 1,
  'state/tavernFlow.ts': 1, // jeux de taverne (NADJ) : fiche de règle à curer
  // SONDE DE SURFACE des Activités en mer (`seaActivitiesConfirm`, `resolveSurface`) : la `RollRequest`
  // ne décrit aucun jet propre — elle route les étapes DÉJÀ mintées vers M ou I. L'enjeu de ces étapes
  // est l'Activité choisie, énoncée par son panneau (même arbitrage que la baseline d'étapes).
  'state/seaActivities.ts': 1,
  'state/seaVoyageFlow.ts': 3, // jets de bord passant par le seam : à doter avec le lot maritime
};

/**
 * TROISIÈME forme qui lance : un `FlowTest` passé à `testFlow(…)` et joué par `runCombatFlow` —
 * `resolveFlowTest` en fait une étape via `simpleTriggeredTestStep`, DANS le seam. Le littéral
 * d'étape est donc générique : les deux scans ci-dessus ne peuvent pas le voir muet (trou trouvé en
 * recette L2 sur l'Approche menaçante, `combatFlow.approachFearTrigger`). Un détecteur ne mesure que
 * sa couverture : celle-ci est le 1ᵉʳ argument littéral de `testFlow(`.
 */
export function flowTestsWithoutStake(src: string): number[] {
  const s = stripLiterals(src);
  const lines: number[] = [];
  for (const m of s.matchAll(/\btestFlow\s*\(\s*\{/g)) {
    const start = s.indexOf('{', m.index!);
    let depth = 0;
    let end = -1;
    for (let j = start + 1; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (end < 0) continue;
    const lit = s.slice(start, end);
    if (/\bstake\s*(?:[,:]|$)/.test(lit)) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/**
 * QUATRIÈME forme qui lance — nommée par le JUGE avant qu'une recette ne la trouve. Les trois scans
 * précédents mesurent des PORTES (le littéral d'étape, la `RollRequest` du seam, le 1ᵉʳ argument de
 * `testFlow`) ; or un jet se DÉCRIT dans un littéral, et ce littéral entre par bien d'autres portes :
 * un nœud `{ kind:'test', test:{…} }` monté à la main, un `FlowTest` passé DIRECTEMENT à
 * `openSkillTest`, un `spec` d'`openPartyTest`, un `extendedTest`, un pending de chirurgie. Toutes
 * produisent un jet, aucune n'était mesurée.
 *
 * Le discriminant est donc la FORME du DESCRIPTEUR, pas la fonction qui le reçoit : un littéral qui
 * nomme CE QU'ON TESTE (`skill` / `characteristic`) ET COMMENT (difficulté fixe, dynamique, ou
 * opposition) DÉCRIT un jet, et doit dire ce qu'il met en jeu. Cette couverture est un SUR-ENSEMBLE de
 * celle de `flowTestsWithoutStake` — c'est exactement ce que PROUVE le rejeu de l'ancien périmètre
 * ci-dessous, site par site.
 *
 * NB `noSupport`/`gate`/`menace`/`label` ne sont PAS requis : facultatifs sur un descripteur réel, les
 * exiger rétrécirait la mesure au sous-ensemble le mieux authoré — l'inverse du but.
 */
export function literalTestsWithoutStake(src: string): number[] {
  const s = stripLiterals(src);
  const lines: number[] = [];
  const seen = new Set<number>();
  for (const m of s.matchAll(/(?<=[{,]\s*)(?:skill|characteristic)\s*:\s*[^\s,}]/g)) {
    const i = m.index!;
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (s[j] === '}') depth++;
      else if (s[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    if (start < 0 || seen.has(start)) continue;
    seen.add(start);
    if (!/(?:[([,=?:]|\breturn)$/.test(s.slice(0, start).replace(/\s+$/, ''))) continue; // pas un littéral
    depth = 0;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (end < 0) continue;
    const lit = s.slice(start, end);
    // Un `FlowTest` réel nomme SA difficulté (fixe ou dynamique) OU son OPPOSITION (un Test opposé n'a
    // pas de difficulté propre — Piège-lame, LDB 62 l.280 : sans cette branche, la mesure perdrait un
    // site que l'ancien scan voyait, cf. le rejeu ci-dessous).
    if (!hasTopLevelKey(lit, 'difficulty') && !hasTopLevelKey(lit, 'difficultyBy') && !hasTopLevelKey(lit, 'opposed')) continue;
    if (/\bstake\s*(?:[,:]|$)/.test(lit)) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/** Baseline NOMINATIVE de la 4ᵉ forme — stock mesuré le 2026-08-06 : 19 descripteurs de jet muets
 *  sur 11 fichiers, dont 7 que les trois scans précédents ne voyaient PAS ; 12 sur 8 fichiers depuis
 *  que les producteurs de `testFlow` sont dotés ; 4 sur 3 fichiers depuis que le HORS-COMBAT est doté
 *  (Test étendu, Commandant d'équipe, Avantage par Compétence, Ragot d'auberge, marché terrestre ×2,
 *  Chirurgie/rééducation, Recherche active, port ×3). SUR-ENSEMBLE de `BASELINE_FLOW` (les arguments
 *  de `testFlow` ont la même forme), donc chaque fichier y compte au moins autant. Décroissante comme
 *  les autres : un site doté ABAISSE sa ligne. */
const BASELINE_LITERAL: Record<string, number> = {
  // `seaVoyageFlow.ts` : jet de bord — dernier descripteur muet de `src/state`. La ligne NOMME le site
  // restant : toute dotation l'abaisse à 0, et le fichier ne peut pas en regagner un sans rougir.
  'state/seaVoyageFlow.ts': 1,
  // Flows AUTHORÉS de scène (couverture `src/scenes`) — mêmes sites que `BASELINE_FLOW`, même dette :
  'scenes/test-scenarios/opera.ts': 2,
  'scenes/test-scenarios/piege-caveau.ts': 1,
};

/** Baseline NOMINATIVE des `FlowTest` muets. `src/state` est SOLDÉ (vague 5) : ses 7 producteurs de
 *  Flow, joués par `runCombatFlow` OU `runFlow`, fournissent leur `FlowTest.stake` (Escalade et Saut →
 *  la fiche Chute ; Surprise → l'État Surpris ; Vigilance → le Talent ; Focalisation interrompue et
 *  Récolte → leur fiche ; Piège-lame → l'Atout qui la porte). Restent les Flows AUTHORÉS des documents
 *  de scène, entrés dans la couverture avec `src/scenes` — leur enjeu s'authore DANS le document
 *  (`FlowTest.stake` est pur-donnée, sérialisable), il ne se code pas ici. */
const BASELINE_FLOW: Record<string, number> = {
  'scenes/test-scenarios/opera.ts': 2, // Perception (repérer les pétards / le voleur) : enjeu à authorer avec la scène
  'scenes/test-scenarios/piege-caveau.ts': 1, // Athlétisme (esquiver les piques de la dalle) : idem
};

/** Baseline NOMINATIVE (fichier → étapes qui lancent, encore sans enjeu). ZÉRO ailleurs.
 *  Stock RE-MESURÉ le 2026-08-06 (#1117 L2) à la FORME : l'ancienne mesure filtrait sur
 *  `interactive: true` + `result: null`, deux champs qui ne gouvernent pas le rendu d'une étape mono
 *  (cf. en-tête) — 11 sites vus, 27 réels, puis 33 quand les étapes à TABLE sont entrées dans la
 *  mesure. 20 dotés à ce jour. */
const BASELINE: Record<string, number> = {
  // VOYAGE (fluvial + maritime) = 0 : le périmètre soldé par #1117.
  // Une ACTIVITÉ en mer (MDG 15 l.266-306) est un CHOIX du joueur : ce qu'elle met en jeu EST
  // l'activité choisie, énoncée par son panneau de sélection — l'étape ne redit pas le choix.
  'state/seaActivities.ts': 2,
  // HORS périmètre déjà soldé — stock gelé et décroissant : chaque famille dotera ses enjeux avec le
  // lot qui la traite (le catalogue `voyage-stakes.json` est déjà le gabarit à suivre).
  'state/travelFlow.ts': 4, // voyage TERRESTRE : périls de route (Survie/Perception), attelage forcé ×2
  'state/travelPostes.ts': 1, // Exposition de fin d'Étape terrestre
  'state/shipwreck.ts': 1, // Natation du naufrage
  'state/embrigadementFlow.ts': 2, // Ragot + Discrétion de l'embrigadement
  // FAUX POSITIF de FORME, entré dans la mesure le 2026-08-10 (#1262) : `revealToStep` rapporte un
  // tirage DÉJÀ RÉSOLU (`table.result` posé par son producteur, qui a lui-même fait descendre l'enjeu
  // à la ligne jouée via `tableStepResolved`) — `stepInteraction` la classe `'affichage'`, elle ne
  // lance rien. Le scan est TEXTUEL : il voit le champ `table`, pas son résultat. Le site n'est pas
  // neuf, il était INVISIBLE : le scan matche `table:` mais pas le raccourci `table,`, la forme qu'il
  // portait jusqu'ici. Angle mort à lever (couvrir `table,` comme `target,` l'est déjà), ce qui
  // demande de re-mesurer TOUT le stock — le geste porte son ticket : #1271.
  'state/revealStep.ts': 1,
  // COMBAT — reste du stock mesuré, chacun avec le VERROU qui l'empêche d'être doté aujourd'hui :
  // (`combat/triggeredTest.ts` est SOLDÉ : ses deux fabriques d'étape TRANSMETTENT `FlowTest.stake` —
  //  la dette est remontée chez les PRODUCTEURS de Flow, mesurés par `BASELINE_FLOW` ci-dessus.)
  // (gate d'Action SOLDÉ : `CATEGORY_BY_SOURCE_KIND` est descendue en couche neutre — `engine/types.ts`,
  //  consommée par `gameIso` ET `state` — et l'étape renvoie à l'ENTITÉ qui exige le jet.)
  // ÉTAPES À TABLE : SOLDÉES (vague 4b). L'enjeu se pose à la construction PUIS DESCEND à la ligne
  // jouée après le dé — `stakeAtTableRow` (`state/cascade.ts`) verse l'`entryId` tiré et la catégorie
  // Codex déclarée par la table (`TableStepDef.entryCategory`), sur les quatre pilotes de tirage.
};

describe('cliquet — une étape de cascade qui LANCE dit son ENJEU (#1117)', () => {
  it('aucun site NEUF sans enjeu, et toute baseline assainie est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const f of scanned()) {
      const found = stepsWithoutStake(readFileSync(f, 'utf8'));
      if (found.length) counts[keyOf(f)] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['Étape de cascade qui LANCE sans enjeu — le joueur doit savoir ce que le jet met en jeu (`stake`, résolu par `resolveStake`) :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  it('aucune `RollRequest` NEUVE sans enjeu, et toute baseline soldée est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const f of scanned()) {
      const found = rollRequestsWithoutStake(readFileSync(f, 'utf8'));
      if (found.length) counts[keyOf(f)] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE_REQ[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['Jet DÉCRIT au seam sans enjeu (`RollRequest.stake`) :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE_REQ)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  it('4ᵉ FORME : aucun DESCRIPTEUR de jet littéral neuf sans enjeu, et toute baseline soldée est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const f of scanned()) {
      const found = literalTestsWithoutStake(readFileSync(f, 'utf8'));
      if (found.length) counts[keyOf(f)] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE_LITERAL[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['`FlowTest` monté À LA MAIN sans enjeu (hors `testFlow`) :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE_LITERAL)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  /**
   * REJEU DE L'ANCIEN PÉRIMÈTRE — la 4ᵉ forme ne se croit pas sur parole : restreinte aux littéraux
   * que le scan de `testFlow(` voyait DÉJÀ, la mesure par la FORME doit rendre EXACTEMENT les mêmes
   * lignes. Un sur-ensemble qui perdrait un ancien site serait une régression déguisée en élargissement.
   *
   * Deux corpus, parce que l'arbre MAIGRIT : un CORPUS FIGÉ (les quatre formes réellement rencontrées
   * dans ce chantier, recopiées telles quelles) qui mord même le jour où tout site réel est doté, et
   * l'arbre COURANT — dont le compte reste égal à la somme de `BASELINE_FLOW`.
   */
  const CORPUS_FIGE = [
    // Test SIMPLE à difficulté fixe (Focalisation interrompue, `combatFlow`).
    `const flow = testFlow({ skill: 'calme', difficulty: 'difficile', label: 'Focalisation interrompue' }, EMPTY_FLOW, brise);`,
    // Test OPPOSÉ sans difficulté propre (Piège-lame, `combatFlow`).
    `const flow = testFlow({ characteristic: 'force', label: 'Piège-lame', opposed: { attacker: 'force', attackerLabel: 'Force', bonusSL: pbt.defSL } }, gagne, EMPTY_FLOW);`,
    // Difficulté portée par une EXPRESSION (Escalade, `climbMove`).
    `flow: testFlow({ skill: 'Escalade', difficulty: c.difficulty ?? 'intermediaire', label: 'Escalade' }, EMPTY_FLOW, chute),`,
    // Descripteur multi-lignes avec opposition (Surprise d'embuscade, `combatFlow`).
    `const flow = testFlow(\n  { skill: 'perception', difficulty: 'intermediaire', label: 'Surprise',\n    opposed: { attacker: 'agilite', attackerSkill: 'discretion' } },\n  EMPTY_FLOW,\n  onLose,\n);`,
  ];

  it('REJEU : sur l’ancien périmètre (`testFlow`), la mesure par la FORME rend les MÊMES lignes', () => {
    // (a) CORPUS FIGÉ — indépendant de l'état de l'arbre : chaque forme vue par `testFlow` l'est aussi
    // par la FORME, et l'enjeu posé les éteint toutes les deux.
    for (const [i, src] of CORPUS_FIGE.entries()) {
      expect(flowTestsWithoutStake(src), `corpus ${i} : l’ancien scan ne le voit plus`).toHaveLength(1);
      expect(literalTestsWithoutStake(src), `corpus ${i} : la FORME PERD un site que testFlow voyait`).toHaveLength(1);
      const dote = src.replace(/label: '([^']+)'/, `label: '$1', stake: combatStakeRef('k')`);
      expect(flowTestsWithoutStake(dote), `corpus ${i} : enjeu posé, encore vu muet`).toHaveLength(0);
      expect(literalTestsWithoutStake(dote), `corpus ${i} : enjeu posé, encore vu muet`).toHaveLength(0);
    }
    // (b) ARBRE COURANT — le sur-ensemble ne perd aucun site réel.
    const manquants: string[] = [];
    let ancien = 0;
    for (const f of scanned()) {
      const src = readFileSync(f, 'utf8');
      const old = flowTestsWithoutStake(src);
      if (!old.length) continue;
      ancien += old.length;
      const neuf = new Set(literalTestsWithoutStake(src));
      const perdus = old.filter((l) => !neuf.has(l));
      if (perdus.length) manquants.push(`${keyOf(f)} : lignes ${perdus.join(', ')} vues par testFlow, PERDUES par la forme`);
    }
    expect(manquants, ['Sites de l’ancien périmètre non retrouvés :', ...manquants].join('\n')).toEqual([]);
    // Compte EXACT de l'ancien périmètre (somme de `BASELINE_FLOW`) — s'il bouge, la comparaison
    // ci-dessus porterait sur un autre stock que celui mesuré.
    expect(ancien).toBe(Object.values(BASELINE_FLOW).reduce((a, b) => a + b, 0));
  });

  it('FAIL-CLOSED (4ᵉ forme) : les DEUX formes propres sont détectées, et l’enjeu les éteint', () => {
    const noeud = `const n = { kind: 'test', test: { skill: 'escalade', difficulty: 'intermediaire' }, success: EMPTY_FLOW, fail: f };`;
    const noeudAvec = `const n = { kind: 'test', test: { skill: 'escalade', difficulty: 'intermediaire', stake: flowStakeRef('climb', 'roll') }, success: EMPTY_FLOW, fail: f };`;
    const direct = `openSkillTest(get, set, { characteristic: 'force-mentale', difficulty: 'difficile' }, EMPTY_FLOW, fail);`;
    const directAvec = `openSkillTest(get, set, { characteristic: 'force-mentale', difficulty: 'difficile', stake: combatStakeRef('actGate') }, EMPTY_FLOW, fail);`;
    const dynamique = `const t = { skill: 'calme', difficultyBy: [{ cond: c, difficulty: 'accessible' }] };`;
    const pasUnTest = `const a = { skill: 'artisanat', label: 'Fabriquer' };`; // aucune difficulté : pas un FlowTest
    expect(literalTestsWithoutStake(noeud)).toHaveLength(1);
    expect(literalTestsWithoutStake(noeudAvec)).toHaveLength(0);
    expect(literalTestsWithoutStake(direct)).toHaveLength(1);
    expect(literalTestsWithoutStake(directAvec)).toHaveLength(0);
    expect(literalTestsWithoutStake(dynamique), 'la difficulté DYNAMIQUE compte autant que la fixe').toHaveLength(1);
    expect(literalTestsWithoutStake(pasUnTest)).toHaveLength(0);
  });

  it('aucun `FlowTest` NEUF sans enjeu, et toute baseline soldée est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const f of scanned()) {
      const found = flowTestsWithoutStake(readFileSync(f, 'utf8'));
      if (found.length) counts[keyOf(f)] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE_FLOW[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['`FlowTest` joué par le seam sans enjeu (`FlowTest.stake`) :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE_FLOW)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : un `FlowTest` synthétique sans enjeu est DÉTECTÉ, avec enjeu il ne l’est pas', () => {
    const sans = `const f = testFlow({ skill: 'calme', difficulty: 'intermediaire', label: 'Approche' }, EMPTY_FLOW, brise);`;
    const avec = `const f = testFlow({ skill: 'calme', difficulty: 'intermediaire', label: 'Approche', stake: combatStakeRef('combatPsych', { entryId: 'peur' }) }, EMPTY_FLOW, brise);`;
    expect(flowTestsWithoutStake(sans)).toHaveLength(1);
    expect(flowTestsWithoutStake(avec)).toHaveLength(0);
  });

  it('FAIL-CLOSED : une `RollRequest` synthétique sans enjeu est DÉTECTÉE, avec enjeu elle ne l’est pas', () => {
    const sans = `openRoll(get, set, { side: { actorId: h.id }, actionLabel: 'Prier', test: { skill: 'priere' }, difficulty: 'intermediaire', klass: 'hero-test' }, K);`;
    const avec = `openRoll(get, set, { side: { actorId: h.id }, actionLabel: 'Prier', test: { skill: 'priere' }, difficulty: 'intermediaire', klass: 'hero-test', stake: combatStakeRef('k') }, K);`;
    const autreKlass = `const cfg = { klass: 'rowdy', label: 'x' };`;
    expect(rollRequestsWithoutStake(sans)).toHaveLength(1);
    expect(rollRequestsWithoutStake(avec)).toHaveLength(0);
    expect(rollRequestsWithoutStake(autreKlass), 'un `klass` hors RollRequest (aucun actionLabel)').toHaveLength(0);
  });

  it('FAIL-CLOSED : une étape synthétique qui LANCE sans enjeu est DÉTECTÉE, avec enjeu elle ne l’est pas', () => {
    const sans = `const s = { id: \`x-\${a}\`, kind: 'k', actorId: h.id, base: 40, target: 40, result: null };`;
    // Forme RÉELLE d'un enjeu depuis #1117 : une RÉFÉRENCE de donnée produite par la porte unique —
    // un texte au call-site ne compile plus (`stake?: StakeRef`), le scanner voit l'appel.
    const avec = `const s = { id: 'x', kind: 'k', actorId: h.id, base: 40, target: 40, stake: voyageStakeRef('k') };`;
    const raccourci = `const s = { id: 'x', kind: 'k', actorId: h.id, base: 40, target: 40, stake };`;
    const temoin = `const s = { id: 'x', kind: 'k', actorId: h.id, base: 40, target: 40, interactive: false };`;
    const sansJet = `const s = { id: 'x', kind: 'reveal', actorId: h.id, result: null };`;
    const cibleTexte = `const e = { type: 'exposureNight', kind: 'froid', count: 2, target: 'party' };`;
    const contributeur = `const p = { id: h.id, base: 40, target: 40, result: null, interactive: true };`;
    const corpsDeFonction = `function f(): boolean { const kind = 'k'; const actorId = h.id; return { target } != null; }`;
    const tableSans = `const s = { id: 'x', kind: 'critSeverity', actorId: t.id, table: critSeverityDecl(t, loc) };`;
    const tableAvec = `const s = { id: 'x', kind: 'critSeverity', actorId: t.id, table: critSeverityDecl(t, loc), stake: combatStakeRef('critSeverity') };`;
    expect(stepsWithoutStake(sans)).toHaveLength(1);
    expect(stepsWithoutStake(avec)).toHaveLength(0);
    expect(stepsWithoutStake(raccourci)).toHaveLength(0);
    expect(stepsWithoutStake(temoin), '`interactive` ne gouverne pas le rendu d’une étape mono : elle lance quand même').toHaveLength(1);
    expect(stepsWithoutStake(sansJet), 'une étape d’affichage ne met rien en jeu').toHaveLength(0);
    expect(stepsWithoutStake(cibleTexte), 'la cible d’un EFFET (`target: \'party\'`) n’est pas une cible de jet').toHaveLength(0);
    expect(stepsWithoutStake(contributeur), 'CONTRIBUTEUR d’une étape batch : l’enjeu est porté par l’ÉTAPE').toHaveLength(0);
    expect(stepsWithoutStake(corpsDeFonction), 'un corps de fonction n’est pas un littéral d’étape').toHaveLength(0);
    expect(stepsWithoutStake(tableSans), 'un TIRAGE sur tableau met en jeu autant qu’un Test').toHaveLength(1);
    expect(stepsWithoutStake(tableAvec)).toHaveLength(0);
  });

  /**
   * FAIL-CLOSED du volet `actor:` (#1262 V2 lot 2) — depuis que les flux passent par les MINTS, la cible
   * n'est plus montée au site : ce que le scan voit d'une étape mono, c'est la DÉCLARATION (`actor` +
   * `kind`). Sans ce volet, migrer un fichier rendait le cliquet VERT à zéro sans qu'un seul enjeu ait
   * été doté — c'est exactement ce qui s'est produit au lot 2 (baselines travelFlow/travelPostes/
   * embrigadement tombées à 0 avant l'extension, ré-alignées après).
   *
   * DEUX TROUS MESURÉS, dits ici plutôt que tus (ticket #1271, qui porte déjà l'angle mort jumeau
   * `table,`) :
   *  - le RACCOURCI `actor,` (propriété abrégée) n'est pas vu — le scan exige `actor: <expr>` ;
   *  - un `kind` apporté par SPREAD (`{ ...commun, actor }`) n'est pas vu — `hasTopLevelKey` lit les
   *    propriétés littérales, pas ce qu'un spread apporte.
   * Les deux se lèvent avec la re-mesure complète du stock, pas à la pièce.
   */
  it('FAIL-CLOSED : un MINT mono sans enjeu est DÉTECTÉ, avec enjeu il ne l’est pas', () => {
    const sans = `const st = monoStep({ id: 'expo-1', kind: 'stageExposure', actor: h, label: 'Exposition', difficulty: diff, ligne: { test: { skill: 'resistance' } } });`;
    const avec = `const st = monoStep({ id: 'expo-1', kind: 'stageExposure', actor: h, label: 'Exposition', difficulty: diff, ligne: { test: { skill: 'resistance' } }, stake: voyageStakeRef('exposure') });`;
    const porteur = `const p = { actor: h, ligne: { test: { skill: 'ramer' } } };`;
    const raccourci = `const st = monoStep({ id: 'x', kind: 'k', actor, label: 'L', difficulty: diff });`;
    const parSpread = `const st = monoStep({ ...commun, actor: h, ligne: { valeur: 40 } });`;
    expect(stepsWithoutStake(sans)).toHaveLength(1);
    expect(stepsWithoutStake(avec)).toHaveLength(0);
    expect(stepsWithoutStake(porteur), 'un PORTEUR de bande (aucun `kind`) : l’enjeu est porté par la bande').toHaveLength(0);
    expect(stepsWithoutStake(raccourci), 'TROU CONNU (#1271) : le raccourci `actor,` échappe au scan').toHaveLength(0);
    expect(stepsWithoutStake(parSpread), 'TROU CONNU (#1271) : un `kind` apporté par spread échappe au scan').toHaveLength(0);
  });
});

/**
 * #1117 (arbitrage user, recette 4 : « Échec : vitesse ×0.8 » côté enjeu vs « vitesse −20 % » côté
 * conséquence — MÊME fait, DEUX notations). La langue du JOUEUR est celle de la Source : MSRC 7 l.17
 * dit « la vitesse … est réduite ce jour-là de 20% » et « divisée par deux ». Le FACTEUR multiplicatif
 * (×0.8, ×0.5) est la langue du MOTEUR : il ne sort jamais à l'écran.
 */
describe('« un signe, un sens » — les enjeux et leurs conséquences parlent la même langue (#1117)', () => {
  const FACTEUR = /×\s*0[.,]\d/; // ×0.8 / ×0,5 — jamais côté joueur

  it('aucun gabarit d’enjeu n’exprime une réduction en FACTEUR', () => {
    const stakes = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'voyage-stakes.json'), 'utf8')) as { kind: string; template: string }[];
    const fautifs = stakes.filter((e) => FACTEUR.test(e.template)).map((e) => `${e.kind} — ${e.template}`);
    expect(fautifs, ['Enjeu exprimé en facteur (langue du moteur) — dire le % ou la division, comme la Source :', ...fautifs].join('\n')).toEqual([]);
  });

  it('aucune ligne de conséquence des flux de voyage n’en exprime non plus', () => {
    const fautifs: string[] = [];
    for (const f of ['riverVoyageFlow.ts', 'seaVoyageFlow.ts']) {
      const src = stripLiterals(readFileSync(join(SRC, 'state', f), 'utf8'));
      // On lit le fichier ENTIER hors commentaires : une ligne de journal est du texte de gabarit.
      if (FACTEUR.test(src)) fautifs.push(f);
    }
    expect(fautifs, ['Ligne de voyage exprimée en facteur :', ...fautifs].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : le motif reconnaît bien un facteur, et laisse passer % et ÷', () => {
    expect(FACTEUR.test('vitesse ×0.8 aujourd’hui')).toBe(true);
    expect(FACTEUR.test('vitesse −20 % aujourd’hui')).toBe(false);
    expect(FACTEUR.test('vitesse ÷2 aujourd’hui')).toBe(false);
    expect(FACTEUR.test('Survitesse M+5 — 2 Dégât(s)')).toBe(false); // un multiplicateur ENTIER n'est pas visé
  });
});
