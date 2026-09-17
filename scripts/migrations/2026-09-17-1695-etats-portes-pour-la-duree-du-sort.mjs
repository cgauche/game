/**
 * Migration #1695 — un État « pour la durée du Sort » est PORTÉ par l'effet actif du sort.
 *
 * L'op `condition` de ces Sorts copiait la durée sur le PION (`durationRounds` → `ConditionInstance.
 * roundsLeft`) : le pion vivait alors sa vie propre, hors de portée de la Dissipation et de la
 * Surincantation de Durée. Elle porte désormais `carried: true` (`src/engine/ops.ts`) : l'État est posé
 * en op PASSIVE sur l'`ActiveEffect` du Sort, à `durationFromCtx`, et réconcilié en pion DÉRIVÉ.
 *
 * MOTIF AU SOURCE — la PROSE de chaque Sort, mot pour mot :
 *  - `transmutation-de-chamon` (`Source/Warhammer v4 - Livre de base version corrigee/48 - Magie des
 *    Couleurs.md` l.495) : « le Sort ignore le Bonus d'Endurance et inflige +1 États *Aveuglé*,
 *    *Assourdi* et *Sonné*, qui persistent tous pour la durée du Sort. » ;
 *  - `miasme-mystifiant` (même chapitre, Domaine des Ombres) : « gagnant +1 État Aveuglé, +1 État
 *    Assourdi et +1 État Exténué, qui persistent pour la durée du Sort. » ;
 *  - `brume-mystique-magie-du-marais` (VDM p.217) : « Brume mystique a le même effet que le Sort du
 *    Domaine des *Ombres Miasme mystifiant* (page 112) » — il HÉRITE donc de la phrase ci-dessus.
 * `sommeil` NE BOUGE PAS : sa prose (LDB 47 l.269-277) noue l'Inconscient à des réveils sur ÉVÉNEMENT
 * (bruit fort, cible déplacée ou bousculée), un régime distinct de la seule durée — il reste à
 * `durationRounds` (#1695 lot 2), et la migration l'ASSERTE.
 *
 * GESTE 2 — l'op `narrative` de Chamon PARAPHRASAIT la clause de fin du Sort et la renvoyait au MJ
 * (« — arbitrage MJ »). La clause EXISTE au livre et reste non modélisée : elle doit donc rester
 * JOURNALISÉE, mais VERBATIM (règle 5, aucune reformulation) — `48 - Magie des Couleurs.md` l.495 :
 * « Si les cibles meurent pendant que le Sort est actif, elles sont enfermées de façon permanente dans
 * une carapace de métaux communs, un macabre rappel des risques de la sorcellerie. »
 * L'op est donc RÉÉCRITE à ce texte — ni supprimée (la clause disparaîtrait du jeu et le tableau
 * `docs/sorts-implementation.md` afficherait un ✅ qui ment), ni laissée paraphrasée.
 *
 * ENTRÉE : `src/data/spells.json`, aux SEULES entrées nommées ci-dessous. Cardinal ASSERTÉ : 9 op
 * `condition` (3 par Sort) + 1 op `narrative` VERBATIM chez Chamon.
 * IDEMPOTENT : rejouée sur l'état final, elle ne trouve plus aucun porteur et sort 0.
 * FAIL-FAST : un Sort absent, un jeu d'États différent de celui déclaré, une durée autre que celle du
 * Bonus de Force Mentale, un `sommeil` déjà migré → sortie 1, AUCUNE écriture.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF, sans newline final), constaté AVANT
 * toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/spells.json';

/** Sorts PORTEURS et le jeu d'États que leur prose dit « pour la durée du Sort » — LISTE CLOSE. */
const PORTEURS = {
  'transmutation-de-chamon': ['aveugle', 'assourdi', 'sonne'],
  'miasme-mystifiant': ['aveugle', 'assourdi', 'extenue'],
  'brume-mystique-magie-du-marais': ['aveugle', 'assourdi', 'extenue'],
};
/** Durée attendue sur CHAQUE op porteuse avant migration (la Durée du Sort, déjà déclarée à `duration`). */
const DUREE_ATTENDUE = { bonusOf: 'force-mentale' };
/** Texte MAISON à remplacer (EXACT, jamais un motif) et texte VERBATIM d'arrivée (LDB 48 l.495). */
const NARRATIVE_MAISON = 'Transmutation de Chamon : une cible qui meurt pendant le Sort est enfermée dans une carapace de métal — arbitrage MJ.';
const NARRATIVE_VERBATIM = 'Si les cibles meurent pendant que le Sort est actif, elles sont enfermées de façon permanente dans une carapace de métaux communs, un macabre rappel des risques de la sorcellerie.';
const CARDINAL_CONDITIONS = 9;

const abs = path.join(ROOT, FICHIER);
const brut = fs.readFileSync(abs, 'utf8');
const data = JSON.parse(brut);
if (JSON.stringify(data, null, 2) !== brut) {
  console.error(`FORME NON CANONIQUE — ${FICHIER} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error(`FORME INATTENDUE — ${FICHIER} n'est pas une liste d'entrées ; AUCUNE écriture.`);
  process.exit(1);
}

/** Tous les nœuds d'op `condition` d'une entrée, où qu'ils vivent dans son arbre d'effets. */
function* opsCondition(noeud) {
  if (Array.isArray(noeud)) { for (const e of noeud) yield* opsCondition(e); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  if (noeud.op === 'condition') yield noeud;
  for (const v of Object.values(noeud)) yield* opsCondition(v);
}

/** Le tableau `ops` d'une feuille `do`/`ops` qui porte les op `condition` de l'entrée — c'est LÀ que
 *  vit la clause narrative du Sort (même feuille, même cible). */
function listeDesConditions(noeud) {
  if (Array.isArray(noeud)) {
    if (noeud.some((o) => o && o.op === 'condition')) return noeud;
    for (const e of noeud) { const t = listeDesConditions(e); if (t) return t; }
    return null;
  }
  if (noeud == null || typeof noeud !== 'object') return null;
  for (const v of Object.values(noeud)) { const t = listeDesConditions(v); if (t) return t; }
  return null;
}

/** Porte l'op `narrative` de `liste` au texte VERBATIM — remplace la paraphrase maison, ou l'insère si
 *  aucune ne la porte. Rend l'étiquette du geste, ou `null` s'il n'y avait RIEN à faire. */
function poseNarrativeVerbatim(liste) {
  const deja = liste.findIndex((o) => o && o.op === 'narrative' && o.text === NARRATIVE_VERBATIM);
  if (deja >= 0) return null;
  const maison = liste.findIndex((o) => o && o.op === 'narrative' && o.text === NARRATIVE_MAISON);
  if (maison >= 0) { liste[maison].text = NARRATIVE_VERBATIM; return 'paraphrase maison → VERBATIM'; }
  liste.push({ op: 'narrative', text: NARRATIVE_VERBATIM });
  return 'clause VERBATIM insérée';
}

const anomalies = [];
const sites = []; // { id, op } — op `condition` à migrer
let dejaPortes = 0;

for (const [id, etats] of Object.entries(PORTEURS)) {
  const spell = data.find((s) => s && s.id === id);
  if (!spell) { anomalies.push(`${id} : Sort ABSENT de ${FICHIER}`); continue; }
  const ops = [...opsCondition(spell)];
  const vus = ops.map((o) => o.id);
  if (vus.join('|') !== etats.join('|')) {
    anomalies.push(`${id} : États vus « ${vus.join(', ')} », déclarés « ${etats.join(', ')} »`);
    continue;
  }
  for (const op of ops) {
    if (op.carried === true && op.durationRounds === undefined) { dejaPortes++; continue; }
    if (JSON.stringify(op.durationRounds) !== JSON.stringify(DUREE_ATTENDUE)) {
      anomalies.push(`${id}.${op.id} : durée ${JSON.stringify(op.durationRounds)} inattendue (${JSON.stringify(DUREE_ATTENDUE)} attendue)`);
      continue;
    }
    if (op.carried !== undefined) { anomalies.push(`${id}.${op.id} : forme HYBRIDE (durée ET « carried »)`); continue; }
    sites.push({ id, op });
  }
}

// `sommeil` reste à `durationRounds` (lot 2) : la migration le VÉRIFIE, elle ne le touche pas.
const sommeil = data.find((s) => s && s.id === 'sommeil');
if (!sommeil) anomalies.push('sommeil : Sort ABSENT — la garde « il ne bouge pas » ne peut plus se mesurer');
else if ([...opsCondition(sommeil)].some((o) => o.carried)) anomalies.push('sommeil : une op `condition` porte DÉJÀ « carried » — hors périmètre de ce lot');

const chamon = data.find((s) => s && s.id === 'transmutation-de-chamon');
const listeChamon = chamon ? listeDesConditions(chamon.effects) : null;
if (chamon && !listeChamon) anomalies.push('transmutation-de-chamon : aucune feuille `ops` porteuse d’États — la clause narrative n’a pas de foyer');

if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}

const geste2 = poseNarrativeVerbatim(listeChamon);

if (sites.length === 0 && geste2 === null) {
  assert.equal(dejaPortes, CARDINAL_CONDITIONS, `état final attendu : ${CARDINAL_CONDITIONS} op « carried », vu ${dejaPortes}`);
  console.log(`RIEN À FAIRE — les ${CARDINAL_CONDITIONS} États « pour la durée du Sort » sont déjà PORTÉS, et la clause de Chamon est VERBATIM.`);
  process.exit(0);
}

assert.equal(sites.length + dejaPortes, CARDINAL_CONDITIONS, `cardinal attendu ${CARDINAL_CONDITIONS} op condition, vu ${sites.length + dejaPortes}`);

for (const { op } of sites) {
  delete op.durationRounds; // la durée du pion EST celle de l'effet porteur (`durationFromCtx`)
  op.carried = true;
}

// SEULES les op relevées ont changé : le document d'entrée, aux SEULS sites relevés réécrits, est
// deep-equal au document écrit.
const temoin = JSON.parse(brut);
for (const [id, etats] of Object.entries(PORTEURS)) {
  const spell = temoin.find((s) => s.id === id);
  for (const op of opsCondition(spell)) {
    if (!etats.includes(op.id) || op.carried) continue;
    delete op.durationRounds;
    op.carried = true;
  }
}
poseNarrativeVerbatim(listeDesConditions(temoin.find((s) => s.id === 'transmutation-de-chamon').effects));
assert.deepEqual(data, temoin, `${FICHIER} : la migration a changé autre chose que les op relevées`);

// L'ARRIVÉE se PROUVE, elle ne se suppose pas : une seule op `narrative` chez Chamon, au VERBATIM.
const narratives = listeDesConditions(data.find((s) => s.id === 'transmutation-de-chamon').effects).filter((o) => o.op === 'narrative');
assert.equal(narratives.length, 1, `transmutation-de-chamon : ${narratives.length} op \`narrative\`, 1 attendue`);
assert.equal(narratives[0].text, NARRATIVE_VERBATIM, 'transmutation-de-chamon : la clause narrative n’est pas le VERBATIM du livre');

fs.writeFileSync(abs, JSON.stringify(data, null, 2));
console.log(`${sites.length} op \`condition\` → « carried: true » :`);
for (const s of sites) console.log(`  ${s.id}.${s.op.id}`);
console.log(`transmutation-de-chamon, clause de fin de Sort (LDB 48 l.495) : ${geste2 ?? 'déjà VERBATIM'}.`);
