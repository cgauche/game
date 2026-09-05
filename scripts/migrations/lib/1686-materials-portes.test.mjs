/**
 * MORSURE des PORTES de `2026-09-05-1686-materials.mjs` (#1686 lot 2).
 *
 * La migration fusionne `propMaterials.json` + `roofMaterials.json` + `reliefMaterials.json` en
 * `materials.json` et pose le `domain` de chaque entrée. Elle DÉCLARE quatre verdicts : le rejeu
 * silencieux, l'état MIXTE, le cardinal par domaine, et la clé de charge ÉTRANGÈRE à son domaine.
 * Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration
 * sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un
 * message NOMINATIF, et — pour les rouges — ZÉRO fichier touché (octet, horodatage antidaté, aucun
 * fichier créé ni supprimé).
 *
 * Les trois SOURCES n'existent plus dans l'arbre (la migration les a supprimées) et AUCUNE révision
 * ne sert de fixture — un banc qui lirait `git show <rev>:` mourrait au commit suivant. Le banc les
 * RECONSTRUIT par projection INVERSE du `src/data/materials.json` VIVANT : partition par `domain`
 * dans l'ordre prop/roof/relief, chaque entrée rendue `{ id, type: <ancien type>, label, ...reste }`
 * sans `domain`, sérialisée sous la forme canonique. La porte (a) est donc un ALLER-RETOUR : la
 * migration rejouée sur ces sources doit reproduire à l'octet le dataset de l'arbre.
 * Aucun cardinal n'est récité ici : les comptes attendus se lisent sur le dataset.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ — un `.test.mjs` posé à côté des migrations y serait rejoué ou refusé.
 */
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATION = '2026-09-05-1686-materials.mjs';

const SOURCES = [
  { rel: 'src/data/propMaterials.json', domain: 'prop', type: 'propMaterials' },
  { rel: 'src/data/roofMaterials.json', domain: 'roof', type: 'roofMaterials' },
  { rel: 'src/data/reliefMaterials.json', domain: 'relief', type: 'reliefMaterials' },
];
const CIBLE = 'src/data/materials.json';

/** Formatage canonique de `src/data/*.json`, EXIGÉ par la migration en entrée comme en sortie. */
const serialise = (doc) => JSON.stringify(doc, null, 2);

const TEXTE_CIBLE = fs.readFileSync(path.join(RACINE, CIBLE), 'utf8');
const CIBLE_DOC = JSON.parse(TEXTE_CIBLE);

/**
 * PROJECTION INVERSE : le document source d'un domaine, tel que la migration l'exige en entrée —
 * ses entrées dans l'ordre du dataset, `domain` retiré, `type` rendu à l'enveloppe d'origine.
 */
const sourceDepuisCible = ({ domain, type }) =>
  CIBLE_DOC.filter((e) => e.domain === domain).map(({ id, type: _type, label, domain: _domain, ...reste }) => ({
    id,
    type,
    label,
    ...reste,
  }));

const DOC_SOURCE = Object.fromEntries(SOURCES.map((s) => [s.rel, sourceDepuisCible(s)]));
const TEXTE_SOURCE = Object.fromEntries(Object.entries(DOC_SOURCE).map(([rel, doc]) => [rel, serialise(doc)]));

/** Cardinal LU sur le dataset — jamais récité. */
const CARDINAL = Object.fromEntries(Object.entries(DOC_SOURCE).map(([rel, doc]) => [rel, doc.length]));
for (const s of SOURCES) assert.ok(CARDINAL[s.rel] > 0, `${s.rel} : projection VIDE — la fixture ne mesure rien`);

/** Horodatage ANTIDATÉ : toute écriture, même à contenu égal, le remonte — le rejeu est mesurable. */
const ANTIDATE = new Date('2000-01-01T00:00:00Z');

/**
 * Dépôt jetable portant EXACTEMENT les fichiers demandés (`{ <rel>: texte }`), plus la migration.
 * REND `{ racine, avant }`, `avant` étant la table des textes posés.
 */
function depot(fichiers) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-1686-mat-'));
  fs.mkdirSync(path.join(racine, 'src/data'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'scripts/migrations'), { recursive: true });

  const avant = new Map();
  for (const [rel, texte] of Object.entries(fichiers)) {
    const cible = path.join(racine, rel);
    fs.writeFileSync(cible, texte, 'utf8');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    avant.set(rel, texte);
  }
  fs.copyFileSync(path.join(RACINE, 'scripts/migrations', MIGRATION), path.join(racine, 'scripts/migrations', MIGRATION));
  return { racine, avant };
}

const efface = (racine) => fs.rmSync(racine, { recursive: true, force: true });

/** La migration jouée dans le dépôt jetable. REND `{ code, sortie }`. */
function joue(racine) {
  const r = spawnSync(process.execPath, [path.join(racine, 'scripts/migrations', MIGRATION)], { encoding: 'utf8' });
  return { code: r.status, sortie: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** Les fichiers posés sont INTACTS (octet + horodatage), et AUCUN autre `src/data/*.json` n'existe. */
function rienTouche(racine, avant) {
  const fautes = [];
  for (const [rel, texte] of avant) {
    const cible = path.join(racine, rel);
    if (!fs.existsSync(cible)) {
      fautes.push(`${rel} : SUPPRIMÉ`);
      continue;
    }
    if (fs.readFileSync(cible, 'utf8') !== texte) fautes.push(`${rel} : octet DIVERGENT`);
    if (fs.statSync(cible).mtimeMs !== ANTIDATE.getTime()) fautes.push(`${rel} : horodatage remonté (écriture)`);
  }
  const poses = new Set([...avant.keys()].map((rel) => path.basename(rel)));
  for (const f of fs.readdirSync(path.join(racine, 'src/data'))) if (!poses.has(f)) fautes.push(`src/data/${f} : fichier CRÉÉ`);
  return fautes;
}

/** Les trois sources projetées, en copies fraîches — `mute` les modifie en place avant sérialisation. */
function sourcesMutees(mute) {
  const docs = Object.fromEntries(SOURCES.map((s) => [s.rel, JSON.parse(TEXTE_SOURCE[s.rel])]));
  mute(docs);
  return Object.fromEntries(Object.entries(docs).map(([rel, doc]) => [rel, serialise(doc)]));
}

test('(a) ALLER-RETOUR : les 3 sources projetées → `materials.json` BYTE-IDENTIQUE à celui de l’arbre', (t) => {
  const { racine } = depot({ ...TEXTE_SOURCE });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 0, `sortie ${code} — la fusion doit passer : ${sortie.slice(0, 800)}`);
  assert.ok(
    sortie.includes(`migré — ${CIBLE_DOC.length} matière(s)`),
    `la fusion ne DIT pas son compte : ${sortie.slice(0, 800)}`,
  );

  const produit = fs.readFileSync(path.join(racine, CIBLE), 'utf8');
  assert.equal(produit, TEXTE_CIBLE, 'le `materials.json` produit diffère à l’octet de celui de l’arbre');
  for (const s of SOURCES) assert.equal(fs.existsSync(path.join(racine, s.rel)), false, `${s.rel} survit à la fusion`);
});

test('(b) REJEU sur arbre migré : sortie 0, taille et horodatage INCHANGÉS', (t) => {
  const { racine, avant } = depot({ [CIBLE]: TEXTE_CIBLE });
  t.after(() => efface(racine));
  const tailleAvant = fs.statSync(path.join(racine, CIBLE)).size;

  const { code, sortie } = joue(racine);
  assert.equal(code, 0, `sortie ${code} — un rejeu doit être un no-op vert : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /déjà migrée/, `le no-op ne se DIT pas : ${sortie.slice(0, 800)}`);
  assert.equal(fs.statSync(path.join(racine, CIBLE)).size, tailleAvant, 'la taille de la cible a bougé au rejeu');
  assert.deepEqual(rienTouche(racine, avant), [], 'le rejeu a écrit');
});

test('(c) état MIXTE (une source recréée à côté de la cible) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const { racine, avant } = depot({ [CIBLE]: TEXTE_CIBLE, 'src/data/roofMaterials.json': TEXTE_SOURCE['src/data/roofMaterials.json'] });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — un état mixte doit ARRÊTER la migration : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /état MIXTE/, `arrêt sans NOMMER l’état : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /roofMaterials\.json/, `arrêt sans NOMMER la source survivante : ${sortie.slice(0, 800)}`);
  assert.deepEqual(rienTouche(racine, avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(d) CARDINAL cassé (une entrée retirée d’une source) → sortie 1 NOMINATIVE, rien d’écrit ni de supprimé', (t) => {
  let retiree = null;
  const fichiers = sourcesMutees((docs) => {
    retiree = docs['src/data/propMaterials.json'].pop();
  });
  assert.ok(retiree, 'aucune entrée à retirer de `propMaterials.json` — la fixture ne mesure rien');
  const { racine, avant } = depot(fichiers);
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — un cardinal inattendu doit ARRÊTER la migration : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /propMaterials\.json/, `arrêt sans NOMMER le document fautif : ${sortie.slice(0, 800)}`);
  const attendu = CARDINAL['src/data/propMaterials.json'];
  assert.ok(
    sortie.includes(`${attendu - 1} entrée(s) ≠ ${attendu} attendue(s)`),
    `arrêt sans CHIFFRER l’écart : ${sortie.slice(0, 800)}`,
  );
  assert.deepEqual(rienTouche(racine, avant), [], 'la migration a écrit ou supprimé alors que l’arrêt précède toute écriture');
});

test('(e) CLÉ ÉTRANGÈRE (une clé `N` de toit injectée dans une entrée prop) → sortie 1 NOMINATIVE, AUCUN état mixte laissé', (t) => {
  let porteuse = null;
  const fichiers = sourcesMutees((docs) => {
    const e = docs['src/data/propMaterials.json'][0];
    e.N = '#123456';
    porteuse = e.id;
  });
  assert.ok(porteuse, 'aucune entrée prop à contaminer — la fixture ne mesure rien');
  const { racine, avant } = depot(fichiers);
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — une clé étrangère doit ARRÊTER la migration : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /la clé `N`/, `arrêt sans NOMMER la clé fautive : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /« prop » ET « roof »/, `arrêt sans NOMMER les deux domaines : ${sortie.slice(0, 800)}`);
  assert.match(sortie, new RegExp(`prop/${porteuse}`), `arrêt sans NOMMER l’entrée porteuse : ${sortie.slice(0, 800)}`);
  // Le verdict PRÉCÈDE l'écriture — un `POST` ici voudrait dire fichiers écrits puis rouge.
  assert.doesNotMatch(sortie, /POST/, `le verdict est rendu APRÈS écriture : ${sortie.slice(0, 800)}`);
  // Les trois sources vivent encore, la cible n'existe pas.
  assert.deepEqual(rienTouche(racine, avant), [], 'la migration a laissé un ÉTAT MIXTE derrière un rouge');
});
