/**
 * Migration #1825 — l'id d'une dette de l'Atlas PORTE son cœur : `<coeur>/<stem>#<slug>`.
 *
 * L'Atlas se partitionne par CŒUR de règles (`docs/raw/<coeur>/<domaine>.md`) : le stem d'une fiche
 * est son chemin RELATIF à `docs/raw/` (`stemDeFiche`, `scripts/raw/build-implemente.mjs`),
 * sans quoi deux cœurs collisionneraient sur le même id de topic (`docs/raw/4e/combat` et son
 * homonyme d'un autre cœur rendraient tous deux `combat#…`). Les ids éditoriaux de
 * `src/data/raw.manifest.json` suivent la même dérivation — `validerDette` les résout contre les
 * topics RÉELS des fiches et LÈVE sur un id inconnu.
 *
 * ENTRÉE : `src/data/raw.manifest.json`, TOUTES ses entrées. Le cœur de chaque id est RÉSOLU depuis
 * l'Atlas sur disque (la fiche dont le nom est `<stem>.md`) — jamais écrit ici : aucun nom de cœur
 * ne vit dans ce fichier.
 * IDEMPOTENT : rejouée sur l'état final, chaque id porte déjà son cœur et elle sort 0 sans écrire.
 * FAIL-FAST GROUPÉ : un stem qu'aucune fiche de l'Atlas ne porte, un stem porté par DEUX cœurs
 * (l'entrée ne dirait plus lequel), une forme d'id inattendue → sortie 1, AUCUNE écriture.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact, vérifié AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { coeursDuRegistre, pagesDeLAtlas } from '../raw/_lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/raw.manifest.json';
const RAWDIR = 'docs/raw';

const abs = path.join(ROOT, FICHIER);
const brut = fs.readFileSync(abs, 'utf8');
const data = JSON.parse(brut);
const suffixe = brut.endsWith('\n') ? '\n' : '';
if (JSON.stringify(data, null, 2) + suffixe !== brut) {
  console.error(`FORME NON CANONIQUE — ${FICHIER} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error(`FORME INATTENDUE — ${FICHIER} n'est pas une liste d'entrées ; AUCUNE écriture.`);
  process.exit(1);
}

/** Les fiches de l'Atlas, par NOM de fichier — la SOURCE du cœur d'un stem. */
const fichesParNom = new Map();
for (const page of pagesDeLAtlas(path.join(ROOT, RAWDIR), { classes: ['fiche'] })) {
  if (!fichesParNom.has(page.nom)) fichesParNom.set(page.nom, []);
  fichesParNom.get(page.nom).push(page.relatif.replace(/\.md$/, ''));
}

const anomalies = [];
const sites = []; // { entree, avant, apres }
let dejaPortees = 0;

for (const entree of data) {
  const id = entree?.id;
  if (typeof id !== 'string' || !id) { anomalies.push(`entrée sans \`id\` : ${JSON.stringify(entree)}`); continue; }
  const [stem, ...reste] = id.split('#');
  if (reste.length > 1) { anomalies.push(`${id} : deux « # » dans l'id`); continue; }
  if (stem.includes('/')) { dejaPortees++; continue; }
  const candidats = fichesParNom.get(`${stem}.md`) ?? [];
  if (candidats.length === 0) {
    anomalies.push(`${id} : aucune fiche « ${stem}.md » dans ${RAWDIR}/<coeur>/`);
    continue;
  }
  if (candidats.length > 1) {
    anomalies.push(`${id} : « ${stem}.md » vit sous ${candidats.length} cœurs (${candidats.join(', ')}) — l'entrée ne dit pas lequel`);
    continue;
  }
  sites.push({ entree, avant: id, apres: [candidats[0], ...reste].join('#') });
}

if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}

if (sites.length === 0) {
  assert.equal(dejaPortees, data.length, `état final attendu : ${data.length} ids à cœur, vu ${dejaPortees}`);
  console.log(`RIEN À FAIRE — les ${data.length} id(s) de ${FICHIER} portent déjà leur cœur.`);
  process.exit(0);
}

assert.equal(sites.length + dejaPortees, data.length, `cardinal attendu ${data.length} entrées, vu ${sites.length + dejaPortees}`);

for (const s of sites) s.entree.id = s.apres;

// TÉMOIN NON TAUTOLOGIQUE : l'arrivée, RAMENÉE À PLAT, égale le départ À L'OCTET. Le ramenage ne
// connaît que le préfixe de cœur d'un `id` et le tient du REGISTRE, jamais de la table de la
// migration : un témoin reconstruit par cette même table ne dirait que « la table égale la table ».
const COEURS = coeursDuRegistre();
/** Le texte, préfixe de cœur retiré des SEULS `id`. */
const aPlat = (texte) => COEURS.reduce((t, coeur) => t.replaceAll(`"id": "${coeur}/`, '"id": "'), texte);
const apres = JSON.stringify(data, null, 2) + suffixe;
assert.equal(aPlat(apres), aPlat(brut), `${FICHIER} : la migration a changé autre chose qu'un préfixe de cœur d'\`id\``);

// L'ARRIVÉE se PROUVE : tout id porte un cœur, et ce cœur est celui d'une fiche RÉELLE de l'Atlas.
const relatifs = new Set([...fichesParNom.values()].flat());
for (const e of data) {
  const stem = String(e.id).split('#')[0];
  assert.ok(stem.includes('/'), `${e.id} : id sans cœur après migration`);
  assert.ok(relatifs.has(stem), `${e.id} : le stem « ${stem} » ne désigne aucune fiche de l'Atlas`);
}

fs.writeFileSync(abs, apres);
console.log(`${sites.length} id(s) de ${FICHIER} portent leur cœur :`);
for (const s of sites) console.log(`  ${s.avant} → ${s.apres}`);
