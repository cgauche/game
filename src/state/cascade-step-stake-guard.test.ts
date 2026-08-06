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

const STATE = join(process.cwd(), 'src', 'state');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { out.push(...sourceFiles(p)); continue; }
    if (e.endsWith('.ts') && !e.includes('.test.')) out.push(p);
  }
  return out;
}

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
  // Les DEUX formes qui LANCENT, telles que `stepInteraction` les reconnaît (`state/cascade.ts`) :
  //  - `'jet'`   = une CIBLE en position de PROPRIÉTÉ (`target: <expr>` ou le raccourci `target,`) ;
  //    une valeur de chaîne est blanchie par `stripLiterals` → `target: 'party'` (cible d'un EFFET)
  //    ne matche pas ;
  //  - `'table'` = un TIRAGE SUR TABLEAU (`table: <expr>`), qui met tout autant en jeu (Blessure
  //    critique, Oups, Colère des dieux, mutation) et n'a PAS de `target` — angle mort jumeau de
  //    celui d'`interactive`, levé ici.
  for (const m of s.matchAll(/(?<=[{,]\s*)(?:target\s*(?::\s*[^\s,}]|[,}])|table\s*:\s*[^\s,}])/g)) {
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

    if (!/\b(actorId|worldOwner|rollLabel)\s*[:,}]/.test(lit)) continue; // aucun lanceur nommé : pas une étape
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
  'rollSeam.ts': 1,
  'tavernFlow.ts': 1, // jeux de taverne (NADJ) : fiche de règle à curer
  'seaActivities.ts': 1, // Commerce d'opportunité (MDG 15) — même arbitrage que ses étapes : le CHOIX porte l'enjeu
  'seaVoyageFlow.ts': 3, // jets de bord passant par le seam : à doter avec le lot maritime
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

/** Baseline NOMINATIVE des `FlowTest` muets — même contrat que les deux précédentes. */
const BASELINE_FLOW: Record<string, number> = {
  'climbMove.ts': 1, // Escalade (LDB 15) : fiche de règle à curer
  'combatEffects.ts': 1, // Test de scène authoré : l'enjeu vient du document, pas du site
  'combatFlow.ts': 4, // Vigilance d'embuscade ×2, désarmement/reprise d'arme, contraction de fin de combat
  'jumpMove.ts': 1, // Saut (LDB 15) : fiche de règle à curer
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
  'seaActivities.ts': 2,
  // HORS périmètre déjà soldé — stock gelé et décroissant : chaque famille dotera ses enjeux avec le
  // lot qui la traite (le catalogue `voyage-stakes.json` est déjà le gabarit à suivre).
  'travelFlow.ts': 4, // voyage TERRESTRE : périls de route (Survie/Perception), attelage forcé ×2
  'travelPostes.ts': 1, // Exposition de fin d'Étape terrestre
  'shipwreck.ts': 1, // Natation du naufrage
  'embrigadementFlow.ts': 2, // Ragot + Discrétion de l'embrigadement
  // COMBAT — reste du stock mesuré, chacun avec le VERROU qui l'empêche d'être doté aujourd'hui :
  // (`combat/triggeredTest.ts` est SOLDÉ : ses deux fabriques d'étape TRANSMETTENT `FlowTest.stake` —
  //  la dette est remontée chez les PRODUCTEURS de Flow, mesurés par `BASELINE_FLOW` ci-dessus.)
  // gate d'Action : `ActiveEffect.source` EXISTE et est estampillée génériquement par `applyOps`
  // (post-passe `ctx.source`) — la source est donc atteignable. Le verrou est de COUCHE : la table
  // `EffectSourceKind` → catégorie Codex vit dans `gameIso/effectIcons.ts` (`CATEGORY_BY_SOURCE_KIND`),
  // dont `src/state` ne peut pas dépendre ; elle doit descendre en couche neutre d'abord.
  'combat/turnHooks.ts': 1,
  // ÉTAPES À TABLE — le `stake` se pose à la CONSTRUCTION, or la LIGNE (`table.result.id`) n'existe
  // qu'APRÈS le tirage : la descente à l'entrée jouée y demande une RE-POSE post-tirage, et aucune de
  // ces tables n'a encore de fiche de règle. Mesurées et gelées ici plutôt que muettes.
  'combatFlow.ts': 3, // Critique de Structure, sévérité de Blessure critique, Imparfaite/Colère
  'corruptionFlow.ts': 2, // nature de la mutation, table des mutations
  'interludeFlow.ts': 1, // table d'événement d'interlude
};

describe('cliquet — une étape de cascade qui LANCE dit son ENJEU (#1117)', () => {
  it('aucun site NEUF sans enjeu, et toute baseline assainie est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const f of sourceFiles(STATE)) {
      const found = stepsWithoutStake(readFileSync(f, 'utf8'));
      if (found.length) counts[f.slice(STATE.length + 1).split(sep).join('/')] = found;
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
    for (const f of sourceFiles(STATE)) {
      const found = rollRequestsWithoutStake(readFileSync(f, 'utf8'));
      if (found.length) counts[f.slice(STATE.length + 1).split(sep).join('/')] = found;
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

  it('aucun `FlowTest` NEUF sans enjeu, et toute baseline soldée est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const f of sourceFiles(STATE)) {
      const found = flowTestsWithoutStake(readFileSync(f, 'utf8'));
      if (found.length) counts[f.slice(STATE.length + 1).split(sep).join('/')] = found;
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
      const src = stripLiterals(readFileSync(join(STATE, f), 'utf8'));
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
