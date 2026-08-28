/**
 * Migration #1467 L1b V-FLIP-CONFIG — `aa-criticals.json` : la PROVENANCE descend à l'ENTRÉE, la note
 * libre `_source` meurt.
 *
 * FOLIOS relevés au Source (`Source/WH - V4 - Aux Armes/07 - MISES À JOUR DE L'ÉTAT HÉMORRAGIQUE.md`) :
 * chaque table est précédée de son ancre `data-folio` — 83 « TABLEAU DES BLESSURES CRITIQUES À LA
 * TÊTE », 84 « … AU BRAS », 85 « … AU TORSE », 86 « … À LA JAMBE ». La note `_source` annonçait
 * « p.≈118-124 » : ce sont des pages PDF, pas des folios imprimés — elle est RÉFUTÉE, pas recopiée.
 *
 * Chaque entrée des 4 familles reçoit `source: {book:'aux-armes', page:<folio de sa famille>}`, posée
 * en DERNIÈRE clé (place de `source` dans les entrées voisines de `criticals.json`). Le contenu NON
 * -provenance de `_source` (notes de modélisation) part au JSDoc du def ; le fichier n'en garde rien.
 *
 * ENTRÉES : `src/data/aa-criticals.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà la bonne `source` est reconnue
 * migrée, `_source` déjà absente est un no-op ; rejouée sur l'état final, la migration n'écrit rien.
 * FAIL-FAST : `source` présente et DIVERGENTE (arbitrage requis), famille absente ou non-tableau,
 * entrée sans `id` → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute
 * écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/aa-criticals.json');

/** Famille de Localisation → folio IMPRIMÉ de sa table (ancres `data-folio` d'AA 07). */
const FOLIO = { tete: 83, bras: 84, corps: 85, jambe: 86 };
const BOOK = 'aux-armes';

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/aa-criticals.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
let migrees = 0;
let dejaMigrees = 0;

const sortie = {};
for (const [k, v] of Object.entries(data)) {
  if (k === '_source') continue; // la note libre MEURT — son contenu de modélisation vit au JSDoc du def
  if (!(k in FOLIO)) {
    sortie[k] = v;
    continue;
  }
  if (!Array.isArray(v)) {
    echecs.push(`famille \`${k}\` : tableau attendu, ${typeof v} reçu`);
    sortie[k] = v;
    continue;
  }
  const page = FOLIO[k];
  sortie[k] = v.map((e, i) => {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string') {
      echecs.push(`${k}[${i}] : entrée sans \`id\` — identité PERDUE`);
      return e;
    }
    if (e.source !== undefined) {
      if (e.source?.book !== BOOK || e.source?.page !== page) {
        echecs.push(`${k}/${e.id} : \`source\` = ${JSON.stringify(e.source)} ≠ {book:'${BOOK}',page:${page}} — arbitrage requis`);
        return e;
      }
      dejaMigrees++;
      return e;
    }
    migrees++;
    return { ...e, source: { book: BOOK, page } };
  });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : `_source` absente, 80/80 entrées sourcées au folio de LEUR famille, et
// aucune valeur non-provenance altérée.
const apres = JSON.parse(out);
if (apres._source !== undefined) echecs.push('POST — `_source` survit');
let total = 0;
for (const [k, page] of Object.entries(FOLIO)) {
  for (const e of apres[k]) {
    total++;
    if (e.source?.book !== BOOK || e.source?.page !== page) echecs.push(`POST — ${k}/${e.id} : source ${JSON.stringify(e.source)}`);
    const avant = data[k].find((a) => a.id === e.id);
    const nu = { ...e };
    delete nu.source;
    const nuAvant = { ...avant };
    delete nuAvant.source;
    if (JSON.stringify(nu) !== JSON.stringify(nuAvant)) echecs.push(`POST — ${k}/${e.id} : charge utile ALTÉRÉE`);
  }
}
if (total !== 80) echecs.push(`POST — ${total} entrées mesurées, 80 attendues`);

if (echecs.length) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE — ${echecs.length} :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`aa-criticals.json — source par entrée : ${migrees} posée(s), ${dejaMigrees} déjà migrée(s)`);
for (const [k, page] of Object.entries(FOLIO)) console.log(`  ${k} → ${BOOK} folio ${page} (${apres[k].length} entrées)`);
console.log(`\`_source\` : ${data._source === undefined ? 'déjà absente' : 'SUPPRIMÉE'} ; entrées sourcées ${total}/80`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/aa-criticals.json`);
