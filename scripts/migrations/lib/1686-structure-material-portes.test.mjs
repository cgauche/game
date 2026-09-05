/**
 * MORSURE des PORTES de `2026-09-05-1686-structure-material-mort.mjs` (#1686 lot 3a-2).
 *
 * La migration retire la clé morte `material` des apparences de structure. Elle DÉCLARE quatre
 * verdicts avant toute écriture (formatage non canonique, racine non-tableau, cardinal d'entrées,
 * cardinal de porteuses) et un verdict APRÈS écriture (une clé restante). Une déclaration n'est pas
 * une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration sur un dépôt JETABLE
 * (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un message NOMINATIF, et —
 * pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET horodatage antidaté).
 *
 * L'état d'AVANT n'existe plus dans l'arbre et AUCUNE révision ne sert de fixture (un banc qui
 * lirait `git show <rev>:` mourrait au commit suivant) : il est reconstruit par projection INVERSE
 * du `structureAppearance.json` VIVANT — une clé `material` réinjectée sur chaque entrée. La valeur
 * réinjectée est arbitraire : la migration ne lit que la PRÉSENCE de la clé, jamais sa valeur. La
 * position de la clé l'est aussi — la retirer rend l'ordre des autres clés, d'où l'aller-retour
 * BYTE-IDENTIQUE de la porte (a). Aucun cardinal n'est récité : ils se lisent sur le dataset.
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
const MIGRATION = '2026-09-05-1686-structure-material-mort.mjs';
const CIBLE = 'src/data/structureAppearance.json';
const CLE = 'material';

/** Formatage canonique de `src/data/*.json`, EXIGÉ par la migration en entrée comme en sortie. */
const serialise = (doc) => JSON.stringify(doc, null, 2);

const TEXTE_CIBLE = fs.readFileSync(path.join(RACINE, CIBLE), 'utf8');
const CIBLE_DOC = JSON.parse(TEXTE_CIBLE);
const TEXTE_MIGRATION = fs.readFileSync(path.join(RACINE, 'scripts/migrations', MIGRATION), 'utf8');

/** Cardinal LU sur le dataset — jamais récité. */
const CARDINAL = CIBLE_DOC.length;
assert.ok(CARDINAL > 0, `${CIBLE} : dataset VIDE — la fixture ne mesure rien`);

/** PROJECTION INVERSE : l'état d'AVANT, chaque apparence reportant la clé morte. */
const avantDoc = () => CIBLE_DOC.map((e, i) => ({ ...e, [CLE]: i % 2 === 0 ? 'bois' : 'pierre' }));
const TEXTE_AVANT = serialise(avantDoc());
assert.notEqual(TEXTE_AVANT, TEXTE_CIBLE, 'la projection inverse ne réinjecte rien — la fixture ne mesure rien');

/** Horodatage ANTIDATÉ : toute écriture, même à contenu égal, le remonte — le rejeu est mesurable. */
const ANTIDATE = new Date('2000-01-01T00:00:00Z');

/**
 * Dépôt jetable portant EXACTEMENT les fichiers demandés (`{ <rel>: texte }`), plus la migration
 * (texte `migration` si fourni — sinon celle de l'arbre). REND `{ racine, avant }`, `avant` étant la
 * table des textes posés.
 */
function depot(fichiers, migration = TEXTE_MIGRATION) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-1686-struct-'));
  fs.mkdirSync(path.join(racine, 'src/data'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'scripts/migrations'), { recursive: true });

  const avant = new Map();
  for (const [rel, texte] of Object.entries(fichiers)) {
    const cible = path.join(racine, rel);
    fs.writeFileSync(cible, texte, 'utf8');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    avant.set(rel, texte);
  }
  fs.writeFileSync(path.join(racine, 'scripts/migrations', MIGRATION), migration, 'utf8');
  return { racine, avant };
}

const efface = (racine) => fs.rmSync(racine, { recursive: true, force: true });

/** La migration jouée dans le dépôt jetable. REND `{ code, sortie }`. */
function joue(racine) {
  const r = spawnSync(process.execPath, [path.join(racine, 'scripts/migrations', MIGRATION)], { encoding: 'utf8' });
  return { code: r.status, sortie: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** Les fichiers posés sont INTACTS (octet + horodatage), et aucun autre `src/data/*.json` n'existe. */
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

test('(a) ALLER-RETOUR : l’état d’avant projeté → `structureAppearance.json` BYTE-IDENTIQUE à celui de l’arbre', (t) => {
  const { racine } = depot({ [CIBLE]: TEXTE_AVANT });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 0, `sortie ${code} — la purge doit passer : ${sortie.slice(0, 800)}`);
  assert.ok(
    sortie.includes(`retirée de ${CARDINAL} apparence(s)`),
    `la purge ne DIT pas son compte : ${sortie.slice(0, 800)}`,
  );
  assert.equal(
    fs.readFileSync(path.join(racine, CIBLE), 'utf8'),
    TEXTE_CIBLE,
    'le `structureAppearance.json` produit diffère à l’octet de celui de l’arbre',
  );
});

test('(b) REJEU sur arbre migré : sortie 0, rien d’écrit (octet ET horodatage)', (t) => {
  const { racine, avant } = depot({ [CIBLE]: TEXTE_CIBLE });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 0, `sortie ${code} — un rejeu doit être un no-op vert : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /déjà migrée/, `le no-op ne se DIT pas : ${sortie.slice(0, 800)}`);
  assert.deepEqual(rienTouche(racine, avant), [], 'le rejeu a écrit');
});

test('(c) CARDINAL cassé (une apparence retirée) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const ampute = avantDoc();
  ampute.pop();
  const { racine, avant } = depot({ [CIBLE]: serialise(ampute) });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — un cardinal inattendu doit ARRÊTER la migration : ${sortie.slice(0, 800)}`);
  assert.ok(
    sortie.includes(`${CARDINAL - 1} entrée(s) ≠ ${CARDINAL} attendue(s)`),
    `arrêt sans CHIFFRER l’écart : ${sortie.slice(0, 800)}`,
  );
  assert.deepEqual(rienTouche(racine, avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(c bis) CARDINAL des PORTEUSES cassé (une apparence sans la clé) → sortie 1 NOMMANT la clé, rien d’écrit', (t) => {
  const partiel = avantDoc();
  delete partiel[0][CLE];
  const { racine, avant } = depot({ [CIBLE]: serialise(partiel) });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — un périmètre partiel doit ARRÊTER la migration : ${sortie.slice(0, 800)}`);
  assert.ok(
    sortie.includes(`${CARDINAL - 1} entrée(s) portant \`${CLE}\` ≠ ${CARDINAL} attendue(s)`),
    `arrêt sans NOMMER la clé ni CHIFFRER l’écart : ${sortie.slice(0, 800)}`,
  );
  assert.deepEqual(rienTouche(racine, avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(d1) RACINE non-TABLEAU (document canoniquement formaté) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const { racine, avant } = depot({ [CIBLE]: serialise({ entries: avantDoc() }) });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — une racine non-tableau doit ARRÊTER la migration : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /racine non-TABLEAU/, `arrêt sans NOMMER la faute : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /structureAppearance\.json/, `arrêt sans NOMMER le document : ${sortie.slice(0, 800)}`);
  assert.deepEqual(rienTouche(racine, avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(d2) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const { racine, avant } = depot({ [CIBLE]: JSON.stringify(avantDoc(), null, 4) });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — un formatage non canonique doit ARRÊTER la migration : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /formatage non canonique/, `arrêt sans NOMMER la faute : ${sortie.slice(0, 800)}`);
  assert.deepEqual(rienTouche(racine, avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

/**
 * La porte POST-ÉCRITURE ne peut pas être atteinte par une ENTRÉE : la suppression réussit sur toute
 * porteuse issue d'un `JSON.parse`. Ce qu'elle garde, c'est une ÉCRITURE défectueuse — elle se mesure
 * donc sur un MUTANT de la migration, joué dans le dépôt jetable : suppression neutralisée, tout le
 * reste identique. C'est le seul scénario du banc où la migration de l'arbre n'est pas jouée telle
 * quelle, et l'assertion sur la substitution garantit que le mutant est bien celui annoncé.
 */
test('(e) CLÉ RESTANTE après écriture (mutant : suppression neutralisée) → sortie 1 NOMMANT les porteuses', (t) => {
  const original = `for (const e of porteuses) delete e[CLE];`;
  assert.ok(TEXTE_MIGRATION.includes(original), 'la ligne de suppression a changé de forme — le mutant ne mesure rien');
  const mutant = TEXTE_MIGRATION.replace(original, `for (const e of porteuses) void e;`);
  const { racine } = depot({ [CIBLE]: TEXTE_AVANT }, mutant);
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine);
  assert.equal(code, 1, `sortie ${code} — une clé restante doit être REFUSÉE : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /ÉCHEC POST-ÉCRITURE/, `le refus ne se DIT pas : ${sortie.slice(0, 800)}`);
  assert.match(sortie, new RegExp(`\`${CLE}\` encore présent sur `), `refus sans NOMMER la clé : ${sortie.slice(0, 800)}`);
  assert.match(sortie, new RegExp(CIBLE_DOC[0].id), `refus sans NOMMER les apparences porteuses : ${sortie.slice(0, 800)}`);
});
