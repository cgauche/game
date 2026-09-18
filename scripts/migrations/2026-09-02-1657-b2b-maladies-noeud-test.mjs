/**
 * Migration #1657 B2b — le cycle quotidien des MALADIES rejoint le nœud `test` du Flow.
 *
 * CE QUI BOUGE, en deux gestes :
 *  1. `symptoms.json › onTick` — `{difficulty, onFail}` devient `test` : le nœud
 *     `noeudTest(flowSchema, { difficulteRequise: true })` (`grammaire/mecanique.ts`), soit
 *     `{kind:'test', test:{difficulty}, success:{kind:'seq',steps:[]}, fail:{kind:'do',
 *     effect:{type:'ops', ops:<onFail>, on:'target'}}}`. Un `onTick` SANS `difficulty` n'est pas une
 *     épreuve : son `onFail` (nom menteur — aucun jet à rater) devient `ops`, la liste de `GameOp`
 *     CERTAINS, même graphie que `passive`/`severePassive`/`visiblePassive` du même document.
 *     `afterDays`/`once` (ORDONNANCEMENT) et `difficultyBySeverity` restent sur le PORTEUR.
 *  2. `maladies.json › dailyTest` — `{difficulty, symptomId, onFail}` devient `{test, symptomId}` :
 *     même nœud ; `symptomId` (le symptôme que le jet MET EN JEU) reste sur le porteur.
 *
 * ENTRÉES : `src/data/symptoms.json` et `src/data/maladies.json` (seules données lues/écrites).
 *
 * PORTE DE FIDÉLITÉ (lecture SEULE, avant toute écriture) : les cardinaux ci-dessous sont exigés sur
 * l'état LU, et la partition « avec / sans `difficulty` » est RE-MESURÉE plutôt que supposée — un
 * `onTick` sans `onFail`, une clé inattendue, un `difficultyBySeverity` sans difficulté de base à
 * indexer : la migration sort 1 sans rien écrire.
 *
 * IDEMPOTENT : rejouée sur l'état final (aucun `onTick.difficulty`, aucun `onTick.onFail`, aucun
 * `dailyTest.difficulty`), la migration reconnaît « déjà migré », n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : chaque fichier lu est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture ; la sortie l'est aussi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SYMPTOMS = path.join(ROOT, 'src/data/symptoms.json');
const MALADIES = path.join(ROOT, 'src/data/maladies.json');

const CLES_ONTICK = ['difficulty', 'difficultyBySeverity', 'onFail', 'afterDays', 'once'];
const CLES_DAILY = ['difficulty', 'symptomId', 'onFail'];

const echecs = [];

const lire = (cible, nom) => {
  const brut = fs.readFileSync(cible, 'utf8');
  const doc = JSON.parse(brut);
  if (JSON.stringify(doc, null, 2) !== brut) {
    echecs.push(`${nom} : FORME NON CANONIQUE (pas JSON.stringify(doc, null, 2))`);
    return null;
  }
  if (!Array.isArray(doc)) {
    echecs.push(`${nom} : la racine n'est pas une LISTE`);
    return null;
  }
  return doc;
};

const symptomes = lire(SYMPTOMS, 'symptoms.json');
const maladies = lire(MALADIES, 'maladies.json');
if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

// ---- REJEU : plus aucun porteur ne décrit son jet en propre.
const dejaMigre =
  symptomes.every((s) => !s.onTick || (s.onTick.difficulty === undefined && s.onTick.onFail === undefined)) &&
  maladies.every((m) => !m.dailyTest || m.dailyTest.difficulty === undefined);
if (dejaMigre) {
  const noeuds = symptomes.filter((s) => s.onTick?.test).length + maladies.filter((m) => m.dailyTest?.test).length;
  const certains = symptomes.filter((s) => s.onTick?.ops).length;
  // PORTE DE FORME, jamais un COMPTE (#1812) : le catalogue des maladies GRANDIT (EDOC 08 en a déjà
  // ajouté deux). Ce qui dit l'état migré, c'est que CHAQUE porteur de jet décrit son jet par un NŒUD
  // — jamais leur nombre, qui ferait payer un recalage à chaque maladie ajoutée.
  const sansNoeud = [
    ...symptomes.filter((s) => s.onTick && !s.onTick.test && !s.onTick.ops).map((s) => `symptoms.json ${s.id}`),
    ...maladies.filter((m) => m.dailyTest && !m.dailyTest.test).map((m) => `maladies.json ${m.id}`),
  ];
  if (!noeuds || sansNoeud.length) {
    console.error(
      `ARBITRAGE REQUIS — état migré inattendu : ${sansNoeud.length} porteur(s) de jet SANS nœud test` +
        `${noeuds ? '' : ' ; AUCUN nœud test — périmètre déplacé'}, rien n’est écrit :`,
    );
    for (const m of sansNoeud) console.error(`  ${m}`);
    process.exit(1);
  }
  console.log(`symptoms.json + maladies.json : no-op (déjà migré — ${noeuds} nœuds test, ${certains} effet certain)`);
  process.exit(0);
}

// ---- PORTE DE FIDÉLITÉ : lecture SEULE.
{
  const ecarts = [];
  const mesure = { onTick: 0, epreuves: 0, certains: 0, afterDays: 0, once: 0, difficultyBySeverity: 0, dailyTest: 0, ops: 0 };
  for (const s of symptomes) {
    const t = s.onTick;
    if (!t) continue;
    mesure.onTick++;
    if (t.difficulty === undefined) mesure.certains++;
    else mesure.epreuves++;
    if (t.afterDays !== undefined) mesure.afterDays++;
    if (t.once !== undefined) mesure.once++;
    if (t.difficultyBySeverity !== undefined) mesure.difficultyBySeverity++;
    if (Array.isArray(t.onFail) && t.onFail.length) mesure.ops += t.onFail.length;
    else ecarts.push(`symptoms/${s.id} : onTick.onFail absent ou vide`);
    if (t.difficultyBySeverity !== undefined && t.difficulty === undefined) {
      ecarts.push(`symptoms/${s.id} : difficultyBySeverity SANS difficulty de base — l'indexation n'aurait rien a indexer`);
    }
    for (const k of Object.keys(t)) {
      if (!CLES_ONTICK.includes(k)) ecarts.push(`symptoms/${s.id} : cle INATTENDUE sur onTick « ${k} »`);
    }
  }
  for (const m of maladies) {
    const d = m.dailyTest;
    if (!d) continue;
    mesure.dailyTest++;
    if (d.difficulty === undefined) ecarts.push(`maladies/${m.id} : dailyTest SANS difficulty`);
    if (typeof d.symptomId !== 'string' || !d.symptomId) ecarts.push(`maladies/${m.id} : dailyTest sans symptomId`);
    if (Array.isArray(d.onFail) && d.onFail.length) mesure.ops += d.onFail.length;
    else ecarts.push(`maladies/${m.id} : dailyTest.onFail absent ou vide`);
    for (const k of Object.keys(d)) {
      if (!CLES_DAILY.includes(k)) ecarts.push(`maladies/${m.id} : cle INATTENDUE sur dailyTest « ${k} »`);
    }
  }
  // FORME, jamais cardinal (#1812) : les catalogues de Symptômes et de Maladies GRANDISSENT livre
  // après livre (EDOC 08 en a ajouté deux) — un périmètre VIDE arrête, un périmètre qui a grandi non.
  if (!symptomes.length) ecarts.push('symptomes : catalogue VIDE — périmètre déplacé');
  if (!maladies.length) ecarts.push('maladies : catalogue VIDE — périmètre déplacé');
  if (!mesure.onTick) ecarts.push('symptomes : AUCUN `onTick` — périmètre déplacé');
  if (!mesure.dailyTest) ecarts.push('maladies : AUCUN `dailyTest` — périmètre déplacé');
  if (mesure.epreuves + mesure.certains !== mesure.onTick)
    ecarts.push(`onTick : ${mesure.onTick} porteur(s) pour ${mesure.epreuves} épreuve(s) + ${mesure.certains} effet(s) certain(s)`);
  if (ecarts.length) {
    console.error(`FIDELITE ROMPUE — rien n'est ecrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

/** Nœud `test` du Flow — branche `success` VIDE explicite (le socle `Flow` l'exige des deux côtés). */
const noeud = (difficulty, onFail) => ({
  kind: 'test',
  test: { difficulty },
  success: { kind: 'seq', steps: [] },
  fail: { kind: 'do', effect: { type: 'ops', ops: onFail, on: 'target' } },
});

/**
 * Réécrit un porteur en PRÉSERVANT l'ordre de ses clés : la clé pivot (`difficulty`) cède sa place au
 * remplacement ; à défaut de pivot, c'est `onFail` qui la cède (le porteur sans jet).
 */
const reecrire = (porteur, remplacer) => {
  const out = {};
  const pivot = 'difficulty' in porteur ? 'difficulty' : 'onFail';
  for (const [k, v] of Object.entries(porteur)) {
    if (k === pivot) Object.assign(out, remplacer());
    else if (k !== 'onFail') out[k] = v;
  }
  return out;
};

for (const s of symptomes) {
  if (!s.onTick) continue;
  const t = s.onTick;
  s.onTick = reecrire(t, () => (t.difficulty === undefined ? { ops: t.onFail } : { test: noeud(t.difficulty, t.onFail) }));
}
for (const m of maladies) {
  if (!m.dailyTest) continue;
  const d = m.dailyTest;
  m.dailyTest = reecrire(d, () => ({ test: noeud(d.difficulty, d.onFail) }));
}

fs.writeFileSync(SYMPTOMS, JSON.stringify(symptomes, null, 2), 'utf8');
fs.writeFileSync(MALADIES, JSON.stringify(maladies, null, 2), 'utf8');

// ---- PREUVE post-écriture, sur le RÉSULTAT relu.
/** Ce que le passage a fait, MESURÉ sur le résultat — le rapport ne récite aucun compte gelé. */
const rapport = [];
{
  const sy = JSON.parse(fs.readFileSync(SYMPTOMS, 'utf8'));
  const ma = JSON.parse(fs.readFileSync(MALADIES, 'utf8'));
  const ticks = sy.map((s) => s.onTick).filter(Boolean);
  const dailies = ma.map((m) => m.dailyTest).filter(Boolean);
  const noeuds = [...ticks.map((t) => t.test), ...dailies.map((d) => d.test)].filter(Boolean);
  const horsForme = (n) =>
    n.kind !== 'test' ||
    n.success?.kind !== 'seq' ||
    n.success.steps.length !== 0 ||
    n.fail?.kind !== 'do' ||
    n.fail.effect?.type !== 'ops' ||
    n.fail.effect.on !== 'target' ||
    !Array.isArray(n.fail.effect.ops) ||
    n.fail.effect.ops.length === 0;
  const mesure = {
    symptomes: sy.length,
    maladies: ma.length,
    onTick: ticks.length,
    epreuves: ticks.filter((t) => t.test).length,
    certains: ticks.filter((t) => t.ops).length,
    porteursDesDeux: ticks.filter((t) => t.test && t.ops).length,
    porteursDAucun: ticks.filter((t) => !t.test && !t.ops).length,
    dailyTest: dailies.length,
    dailyTestNommant: dailies.filter((d) => typeof d.symptomId === 'string' && d.symptomId).length,
    noeuds: noeuds.length,
    noeudsSansDifficulty: noeuds.filter((n) => n.test.difficulty === undefined).length,
    noeudsHorsForme: noeuds.filter(horsForme).length,
    difficultyResiduelle: ticks.filter((t) => 'difficulty' in t).length + dailies.filter((d) => 'difficulty' in d).length,
    onFailResiduel: ticks.filter((t) => 'onFail' in t).length + dailies.filter((d) => 'onFail' in d).length,
    afterDays: ticks.filter((t) => t.afterDays !== undefined).length,
    once: ticks.filter((t) => t.once !== undefined).length,
    difficultyBySeverity: ticks.filter((t) => t.difficultyBySeverity !== undefined).length,
    ops:
      ticks.reduce((n, t) => n + (t.ops?.length ?? 0) + (t.test?.fail.effect.ops.length ?? 0), 0) +
      dailies.reduce((n, d) => n + d.test.fail.effect.ops.length, 0),
  };
  const exige = (cle, valeur) => {
    if (mesure[cle] !== valeur) echecs.push(`POST ${cle} : ${mesure[cle]} != ${valeur}`);
  };
  // AUCUN compte GELÉ (#1812) : ces catalogues grandissent livre après livre. Ce que la preuve
  // post-écriture exige, ce sont des RELATIONS entre grandeurs MESURÉES — chaque épreuve est devenue
  // un nœud, chaque `dailyTest` nomme son symptôme, et il ne reste aucun résidu de l'ancienne forme.
  exige('porteursDesDeux', 0);
  exige('porteursDAucun', 0);
  exige('dailyTestNommant', mesure.dailyTest);
  exige('noeuds', mesure.epreuves + mesure.dailyTest);
  if (!mesure.noeuds) echecs.push('POST noeuds : AUCUN nœud test — périmètre déplacé');
  rapport.push(
    `symptoms.json : ${mesure.onTick} onTick · ${mesure.epreuves} noeud(s) test · ${mesure.certains} effet(s) certain(s) (ops) · ` +
      `${mesure.afterDays} afterDays / ${mesure.once} once / ${mesure.difficultyBySeverity} difficultyBySeverity preserves au porteur`,
    `maladies.json : ${mesure.dailyTest} dailyTest -> noeud test, symptomId preserve au porteur`,
  );
  exige('noeudsSansDifficulty', 0);
  exige('noeudsHorsForme', 0);
  exige('difficultyResiduelle', 0);
  exige('onFailResiduel', 0);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(rapport.join('\n'));
