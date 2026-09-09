/**
 * MORSURE des PORTES de la migration #1715 — la TOITURE PAR DÉFAUT passe en DONNÉE.
 *
 *  - `2026-09-09-1715-roof-defaults-scenes.mjs` (racine `src/scenes`) : pose `roofDefaults` sur
 *    chaque Scène embarquée et bump le document en `schema: 9`.
 *
 * Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration
 * sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un
 * message NOMINATIF, et — pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET
 * horodatage antidaté).
 *
 * L'état d'AVANT n'existe plus dans l'arbre et AUCUNE révision ne sert de fixture : il est
 * reconstruit par projection INVERSE des documents VIVANTS (`roofDefaults` retiré, `schema` rendu à
 * 8). Les cardinaux se LISENT sur les documents, jamais récités ici.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATION = '2026-09-09-1715-roof-defaults-scenes.mjs';

const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');
/** Formatage canonique d'un document de projet de scène. */
const serialise = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

const ANTIDATE = new Date('2000-01-01T00:00:00Z');

/** Dépôt jetable portant EXACTEMENT les fichiers demandés, plus la migration. */
function depot(fichiers) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-1715-'));
  const avant = new Map();
  for (const [rel, texte] of Object.entries(fichiers)) {
    const cible = path.join(racine, rel);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, texte, 'utf8');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    avant.set(rel, texte);
  }
  fs.mkdirSync(path.join(racine, 'scripts/migrations'), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'scripts/migrations', MIGRATION), path.join(racine, 'scripts/migrations', MIGRATION));
  return { racine, avant };
}

const efface = (racine) => fs.rmSync(racine, { recursive: true, force: true });

function joue({ racine }) {
  const r = spawnSync(process.execPath, [path.join(racine, 'scripts/migrations', MIGRATION)], { encoding: 'utf8' });
  return { code: r.status, sortie: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** Les fichiers posés sont INTACTS (octet + horodatage). */
function rienTouche(racine, avant) {
  const fautes = [];
  for (const [rel, texte] of avant) {
    const cible = path.join(racine, rel);
    if (!fs.existsSync(cible)) { fautes.push(`${rel} : SUPPRIMÉ`); continue; }
    if (fs.readFileSync(cible, 'utf8') !== texte) fautes.push(`${rel} : octet DIVERGENT`);
    if (fs.statSync(cible).mtimeMs !== ANTIDATE.getTime()) fautes.push(`${rel} : horodatage remonté (écriture)`);
  }
  return fautes;
}

/** Les projets de scène de l'arbre. */
const PROJETS = fs
  .readdirSync(path.join(RACINE, 'src/scenes'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `src/scenes/${d.name}/${d.name}-projet.json`)
  .filter((rel) => fs.existsSync(path.join(RACINE, rel)));
assert.ok(PROJETS.length > 0, 'aucun projet de scène — la fixture ne mesure rien');

/** Cardinaux LUS sur les documents migrés — jamais récités. */
const SCENES_PAR_PROJET = Object.fromEntries(PROJETS.map((rel) => [rel, JSON.parse(lire(rel)).scenes.length]));
for (const rel of PROJETS)
  assert.ok(
    JSON.parse(lire(rel)).scenes.every((s) => s.roofDefaults),
    `${rel} : une Scène sans \`roofDefaults\` — l’arbre n’est pas migré`,
  );

/** Forme du document avant et après le bump porté par cette migration — borne haute CLOSE. */
const SCHEMA_AVANT = 8;
const SCHEMA_APRES = 9;
for (const rel of PROJETS)
  assert.equal(JSON.parse(lire(rel)).schema, SCHEMA_APRES, `${rel} : \`schema\` ≠ ${SCHEMA_APRES} — l’arbre n’est pas migré`);

/** PROJECTION INVERSE d'un projet : `roofDefaults` retiré de chaque Scène, `schema` rendu à 8. */
function projetAvant(rel) {
  const doc = JSON.parse(lire(rel));
  return { ...doc, schema: SCHEMA_AVANT, scenes: doc.scenes.map(({ roofDefaults: _pose, ...reste }) => reste) };
}

const depotScenes = (fabrique) => depot(Object.fromEntries(PROJETS.map((rel) => [rel, fabrique(rel)])));

test('(a) ALLER-RETOUR : l’état d’avant projeté → chaque projet BYTE-IDENTIQUE à l’arbre', (t) => {
  const d = depotScenes((rel) => serialise(projetAvant(rel)));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  for (const rel of PROJETS) {
    assert.ok(
      sortie.includes(`${rel} — schema ${SCHEMA_AVANT} → ${SCHEMA_APRES}, roofDefaults posés : ${SCENES_PAR_PROJET[rel]}`),
      `${rel} : le bump ou la pose ne DIT pas son compte : ${sortie.slice(0, 1200)}`,
    );
    assert.equal(fs.readFileSync(path.join(d.racine, rel), 'utf8'), lire(rel), `${rel} produit ≠ arbre`);
  }
});

test('(b) REJEU sur arbre migré : sortie 0, rien d’écrit', (t) => {
  const d = depotScenes((rel) => lire(rel));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /roofDefaults posés : 0/, `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) `roofDefaults` INCOMPLET (la couverture manquante) → sortie 1 NOMMANT le champ, rien d’écrit', (t) => {
  const d = depotScenes((rel) => {
    const doc = JSON.parse(lire(rel));
    const scenes = doc.scenes.map((s, i) => {
      if (i > 0) return s;
      const { material: _absent, ...reste } = s.roofDefaults;
      return { ...s, roofDefaults: reste };
    });
    return serialise({ ...doc, scenes });
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d);
  assert.equal(code, 1, `sortie ${code} — un \`roofDefaults\` incomplet doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /`roofDefaults` sans material/, `arrêt sans NOMMER le champ manquant : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(c bis) `roofDefaults` de TYPE inattendu (pente en chaîne) → sortie 1 NOMMANT le champ, rien d’écrit', (t) => {
  const d = depotScenes((rel) => {
    const doc = JSON.parse(lire(rel));
    const scenes = doc.scenes.map((s, i) => (i > 0 ? s : { ...s, roofDefaults: { ...s.roofDefaults, pitchDeg: '45' } }));
    return serialise({ ...doc, scenes });
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d);
  assert.equal(code, 1, `sortie ${code} — une pente non numérique doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /`roofDefaults` sans pitchDeg/, `arrêt sans NOMMER le champ : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(d) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const d = depotScenes((rel) => `${JSON.stringify(projetAvant(rel), null, 4)}\n`);
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d);
  assert.equal(code, 1, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /FORME NON CANONIQUE/, `arrêt sans NOMMER la faute : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(e) CARDINAL des Scènes cassé (une Scène retirée) → sortie 1 CHIFFRANT l’écart, rien d’écrit', (t) => {
  const total = Object.values(SCENES_PAR_PROJET).reduce((n, v) => n + v, 0);
  const d = depotScenes((rel) => {
    const doc = projetAvant(rel);
    return serialise(rel === PROJETS[0] ? { ...doc, scenes: doc.scenes.slice(1) } : doc);
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d);
  assert.equal(code, 1, `sortie ${code} — un cardinal inattendu doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.ok(sortie.includes(`${total - 1} Scène(s) embarquée(s) ≠ ${total}`), `arrêt sans CHIFFRER l’écart : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(f) `schema` FUTUR → sortie 1 NOMMANT le numéro : la borne haute de la DERNIÈRE de la chaîne est CLOSE', (t) => {
  // Les migrations amont ont toutes une borne ouverte (`≥ N = déjà migré`) et avalent l'inconnu ;
  // celle-ci, dernière dans l'ordre lexical, est la seule à savoir ce qui existe après elle.
  const futur = SCHEMA_APRES + 1;
  const d = depotScenes((rel) => serialise({ ...JSON.parse(lire(rel)), schema: futur }));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d);
  assert.equal(code, 1, `sortie ${code} — un schema futur doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`\`schema\` inattendu ${futur} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`),
    `arrêt sans NOMMER le numéro : ${sortie.slice(0, 1200)}`,
  );
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

/** Les champs que porte `Scene.roofDefaults` (`src/state/scene.ts` › `DEFAULT_ROOF_DEFAULTS`,
 *  `src/data/schemas/defs-scenes/scene.ts` › `sceneRoofDefaultsSchema`). */
const CHAMPS_TOITURE = ['material', 'pitchDeg', 'riseMaxStoreys'];

test('(g) PARITÉ au RÉEL : sur les projets LIVRÉS, chaque Scène porte `roofDefaults` complet, à la position d’`emptyScene`', () => {
  // Les tests (a)–(f) mesurent la migration sur un dépôt jetable ; celui-ci mesure L'ARBRE. La
  // POSITION est porteuse : une Scène écrite à la main (ou par un outil) place la clé où elle veut,
  // et le fichier cesse d'être byte-identique à ce que `emptyScene` produit (`state/scene.ts` —
  // `reliefDefaults`, `roofDefaults`, puis `layers`), donc à ce que la migration reposerait au rejeu.
  const fautes = [];
  for (const rel of PROJETS) {
    const scenes = JSON.parse(lire(rel)).scenes;
    assert.ok(scenes.length > 0, `${rel} : aucune Scène — la parité ne mesure rien`);
    for (const s of scenes) {
      const k = Object.keys(s);
      const i = k.indexOf('roofDefaults');
      const l = k.indexOf('layers');
      if (i < 0) { fautes.push(`${rel} › ${s.id} : AUCUN \`roofDefaults\``); continue; }
      if (l < 0) { fautes.push(`${rel} › ${s.id} : AUCUN \`layers\``); continue; }
      if (i + 1 !== l) fautes.push(`${rel} › ${s.id} : \`roofDefaults\` en position ${i}, \`layers\` en ${l} — non ADJACENTS`);
      const manquants = CHAMPS_TOITURE.filter((c) => s.roofDefaults[c] === undefined);
      if (manquants.length) fautes.push(`${rel} › ${s.id} : \`roofDefaults\` sans ${manquants.join(', ')}`);
      const enTrop = Object.keys(s.roofDefaults).filter((c) => !CHAMPS_TOITURE.includes(c));
      if (enTrop.length) fautes.push(`${rel} › ${s.id} : \`roofDefaults\` porte ${enTrop.join(', ')} — hors vocabulaire`);
    }
  }
  assert.deepEqual(fautes, [], `Scène(s) divergente(s) de la forme d’arrivée :\n${fautes.join('\n')}`);
});
