/**
 * Migration #1797 — le « minimum de 1 Round » vit dans la FORMULE de l'entrée, jamais au moteur.
 *
 * La durée du Choc au bras était résolue nue (`1d10 − (Bonus d'Endurance)`, qui vaut ≤ 0 dès BE ≥ 10)
 * et le plancher était posé par le SITE D'APPEL de `durationFromOp` (`src/engine/ops.ts`) : le moteur
 * portait une clause qui appartient à DEUX entrées de table. La borne basse est désormais un terme de
 * la grammaire `Formula` (`{minimum, of}`) : la clause est LUE là où le livre l'écrit.
 *
 * MOTIF AU SOURCE — la prose des deux entrées, mot pour mot :
 *  - `Source/WH - V4 - Aux Armes/07 - MISES A JOUR DE L'ETAT HEMORRAGIQUE.md` l.113 (« Choc au bras »,
 *    `aa-bras-11`) : « Vous lâchez ce que vous teniez dans cette main et cette dernière devient
 *    inutilisable pour 1d10 – (Bonus d'Endurance) Rounds (minimum de 1). » ;
 *  - `Source/Warhammer v4 - Livre de base version corrigee/18 - Traumatisme.md` l.88 (« Choc violent au
 *    bras », `choc-violent-au-bras`) : « Vous lâchez ce que vous teniez en main, et cette dernière
 *    devient inutilisable pour 1d10 - (Bonus d'Endurance) Rounds (minimum de 1). »
 *
 * ENTRÉE : `src/data/criticals.json`, aux SEULES entrées nommées ci-dessous, sur leur op
 * `maxWeaponHands`. Cardinal ASSERTÉ : 2 durées.
 * IDEMPOTENT : rejouée sur l'état final, les deux durées sont déjà bornées et elle sort 0 sans écrire.
 * FAIL-FAST GROUPÉ : une entrée absente, une op `maxWeaponHands` absente ou multiple, une formule
 * autre que `1d10 + (Bonus d'Endurance) × -1` → sortie 1, AUCUNE écriture.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF, newline final constaté), vérifié
 * AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/criticals.json';

/** Entrées PORTEUSES de la clause — LISTE CLOSE (les deux tables Bras du corpus). */
const PORTEUSES = ['choc-violent-au-bras', 'aa-bras-11'];
/** Durée attendue AVANT migration : « 1d10 – (Bonus d'Endurance) ». */
const DUREE_ATTENDUE = { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] };
/** Borne basse d'arrivée : « (minimum de 1) ». */
const MINIMUM = 1;
const CARDINAL = 2;

const abs = path.join(ROOT, FICHIER);
const brut = fs.readFileSync(abs, 'utf8');
const data = JSON.parse(brut);
const suffixe = brut.endsWith('\n') ? '\n' : '';
if (JSON.stringify(data, null, 2) + suffixe !== brut) {
  console.error(`FORME NON CANONIQUE — ${FICHIER} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error(`FORME INATTENDUE — ${FICHIER} n'est pas une liste de tables ; AUCUNE écriture.`);
  process.exit(1);
}

/** L'entrée `id`, où qu'elle vive dans les tables du fichier. */
const entree = (doc, id) => doc.flatMap((table) => table.entries ?? []).find((e) => e && e.id === id);

const anomalies = [];
const sites = []; // { id, op } — op `maxWeaponHands` dont la durée doit être bornée
let dejaBornees = 0;

for (const id of PORTEUSES) {
  const e = entree(data, id);
  if (!e) { anomalies.push(`${id} : entrée ABSENTE de ${FICHIER}`); continue; }
  const mains = (e.ops ?? []).filter((o) => o && o.op === 'maxWeaponHands');
  if (mains.length !== 1) { anomalies.push(`${id} : ${mains.length} op \`maxWeaponHands\`, 1 attendue`); continue; }
  const [op] = mains;
  if (JSON.stringify(op.durationRounds) === JSON.stringify({ minimum: MINIMUM, of: DUREE_ATTENDUE })) { dejaBornees++; continue; }
  if (JSON.stringify(op.durationRounds) !== JSON.stringify(DUREE_ATTENDUE)) {
    anomalies.push(`${id} : durée ${JSON.stringify(op.durationRounds)} inattendue (${JSON.stringify(DUREE_ATTENDUE)} attendue)`);
    continue;
  }
  sites.push({ id, op });
}

if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}

if (sites.length === 0) {
  assert.equal(dejaBornees, CARDINAL, `état final attendu : ${CARDINAL} durées bornées, vu ${dejaBornees}`);
  console.log(`RIEN À FAIRE — les ${CARDINAL} durées « Choc au bras » portent déjà « minimum de ${MINIMUM} ».`);
  process.exit(0);
}

assert.equal(sites.length + dejaBornees, CARDINAL, `cardinal attendu ${CARDINAL} durées, vu ${sites.length + dejaBornees}`);

for (const { op } of sites) op.durationRounds = { minimum: MINIMUM, of: op.durationRounds };

// SEULES les op relevées ont changé : le document d'entrée, aux SEULS sites relevés réécrits, est
// deep-equal au document écrit.
const temoin = JSON.parse(brut);
for (const id of PORTEUSES) {
  const op = (entree(temoin, id).ops ?? []).find((o) => o.op === 'maxWeaponHands');
  if (JSON.stringify(op.durationRounds) === JSON.stringify(DUREE_ATTENDUE)) op.durationRounds = { minimum: MINIMUM, of: DUREE_ATTENDUE };
}
assert.deepEqual(data, temoin, `${FICHIER} : la migration a changé autre chose que les durées relevées`);

// L'ARRIVÉE se PROUVE : les deux durées portent la borne, sur la formule EXACTE du livre.
for (const id of PORTEUSES) {
  const op = entree(data, id).ops.find((o) => o.op === 'maxWeaponHands');
  assert.deepEqual(op.durationRounds, { minimum: MINIMUM, of: DUREE_ATTENDUE }, `${id} : durée d'arrivée inattendue`);
}

fs.writeFileSync(abs, JSON.stringify(data, null, 2) + suffixe);
console.log(`${sites.length} durée(s) « Choc au bras » bornées à « minimum de ${MINIMUM} » (AA 07 l.113, LDB 18 l.88) :`);
for (const s of sites) console.log(`  ${s.id}.maxWeaponHands`);
