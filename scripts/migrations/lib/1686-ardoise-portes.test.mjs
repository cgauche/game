/**
 * MORSURE des PORTES de `2026-09-05-1686-ardoise-ids-composes.mjs` (#1686 lot 1).
 *
 * La migration DÉCLARE deux fail-fast qui précèdent toute écriture : un porteur de l'id nu hors
 * masse de toit / primitive de recette, et un cardinal qui s'écarte de celui mesuré au moment de
 * l'écriture. Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la
 * migration sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige à chaque fois la
 * sortie 1, un message NOMINATIF, et ZÉRO fichier touché (octet ET horodatage antidaté).
 *
 * Le TÉMOIN ouvre le banc : sur la copie FIDÈLE de l'arbre (déjà migré), la migration sort 0 sans
 * rien écrire — sans lui, les deux rouges ne prouveraient pas que le dépôt jetable est jouable.
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
const MIGRATION = '2026-09-05-1686-ardoise-ids-composes.mjs';

/** Formatage canonique EXIGÉ par la migration, par famille de document. */
const DATA = { indent: 2, nl: false };
const PROJET = { indent: 1, nl: true };

const serialise = (doc, f) => JSON.stringify(doc, null, f.indent) + (f.nl ? '\n' : '');

/** Les documents de projet du dépôt, tels que la migration les découvre. */
const PROJETS = fs
  .readdirSync(path.join(RACINE, 'src/scenes'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `src/scenes/${d.name}/${d.name}-projet.json`)
  .filter((rel) => fs.existsSync(path.join(RACINE, rel)));

const DATASETS = ['src/data/materials.json', 'src/data/props.json'];

/** Horodatage ANTIDATÉ : toute écriture, même à contenu égal, le remonte — le témoin est déterministe. */
const ANTIDATE = new Date('2000-01-01T00:00:00Z');

/**
 * Dépôt jetable portant EXACTEMENT ce que la migration lit, plus la migration elle-même.
 * `mute` reçoit `{ docs }` (documents parsés, keyés par chemin relatif) et les modifie en place.
 * REND `{ racine, avant }` — `avant` étant le texte posé, référence de la comparaison.
 */
function depot(mute) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-1686-'));
  fs.mkdirSync(path.join(racine, 'src/data'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'scripts/migrations'), { recursive: true });

  const docs = {};
  for (const rel of [...DATASETS, ...PROJETS]) docs[rel] = JSON.parse(fs.readFileSync(path.join(RACINE, rel), 'utf8'));
  mute(docs);

  const avant = new Map();
  for (const rel of [...DATASETS, ...PROJETS]) {
    const cible = path.join(racine, rel);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    const texte = serialise(docs[rel], DATASETS.includes(rel) ? DATA : PROJET);
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

/** Aucun des fichiers lus n'a été touché — ni à l'octet, ni à l'horodatage. */
function rienEcrit(racine, avant) {
  const fautes = [];
  for (const [rel, texte] of avant) {
    const cible = path.join(racine, rel);
    if (fs.readFileSync(cible, 'utf8') !== texte) fautes.push(`${rel} : octet DIVERGENT`);
    if (fs.statSync(cible).mtimeMs !== ANTIDATE.getTime()) fautes.push(`${rel} : horodatage remonté (écriture)`);
  }
  return fautes;
}

test('TÉMOIN : sur la copie fidèle de l’arbre (déjà migré), la migration sort 0 sans rien écrire', (t) => {
  const { racine, avant } = depot(() => {});
  t.after(() => efface(racine));
  const { code, sortie } = joue(racine);
  assert.equal(code, 0, `sortie ${code} — le dépôt jetable n’est pas jouable : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /déjà migrée/, `le no-op ne se DIT pas : ${sortie.slice(0, 600)}`);
  assert.deepEqual(rienEcrit(racine, avant), []);
});

test('PORTE 1 : un porteur `ardoise` HORS masse de toit / primitive → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  let pose = null;
  const { racine, avant } = depot((docs) => {
    for (const rel of PROJETS)
      for (const s of docs[rel].scenes ?? [])
        for (const b of s.architecture ?? [])
          for (const f of b.facades ?? [])
            for (const ft of f.features ?? []) {
              if (!pose) {
                ft.material = 'ardoise';
                pose = `${rel} ${b.id}/${f.id}/${ft.id}`;
              }
            }
  });
  t.after(() => efface(racine));
  assert.ok(pose, 'aucune ouverture de façade dans les documents de projet — la morsure ne mesure rien');

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — un porteur hors périmètre doit ARRÊTER la migration : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /hors masse de toit/, `arrêt sans NOMMER la classe du porteur : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /features/, `arrêt sans NOMMER le chemin du porteur : ${sortie.slice(0, 600)}`);
  assert.deepEqual(rienEcrit(racine, avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('PORTE 2 : un cardinal CASSÉ (une seule entrée revenue à l’id nu) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const { racine, avant } = depot((docs) => {
    const toit = docs['src/data/materials.json'].find((e) => e.id === 'toit-ardoise');
    assert.ok(toit, '`toit-ardoise` absent du catalogue de matières — la fixture ne mesure rien');
    toit.id = 'ardoise';
  });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — un cardinal inattendu doit ARRÊTER la migration : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /catalogueDecor/, `arrêt sans NOMMER le cardinal fautif : ${sortie.slice(0, 600)}`);
  assert.deepEqual(rienEcrit(racine, avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});
