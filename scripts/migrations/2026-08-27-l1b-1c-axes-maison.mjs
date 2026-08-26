/**
 * Migration #1467 L1b V-Src — `axes.json` : `source: 'maison'` (une CHAÎNE) devient le champ
 * d'enveloppe `maison: '<raison>'`.
 *
 * MOTIF MESURÉ : `source` est la réf de source `{book, page}` du dépôt (`sourceRefSchema`,
 * `src/data/schemas/grammaire/valeurs.ts:38`). `defs/axes.ts:39` y posait un `z.literal('maison')` —
 * même NOM de champ, type incompatible : les 9 entrées d'`axes.json` sont les SEULES du dépôt dont
 * `source` est une chaîne (mesuré à toute profondeur sur `src/data/*.json`, 9/9). Tout lecteur
 * générique de provenance (`citedEntriesOf`, `citedEntries`, `isCitedItem`) attend un objet : la
 * chaîne passe au travers sans erreur ET sans être comptée. Le champ d'enveloppe `maison` porte
 * cette classe de provenance (`citationCoverage.mjs:27` la compte comme citation). `axes` reste
 * HORS `SANS_LIVRE` : chaque entrée y déclare sa provenance, elle n'en est pas dispensée.
 *
 * RAISON POSÉE — recopiée VERBATIM du def qui la portait déjà (`src/data/schemas/defs/axes.ts:38`,
 * commentaire du champ `source`) ; aucune raison n'est rédigée ici.
 *
 * ENTRÉES : `src/data/axes.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée déjà sans `source` et porteuse de `maison` est
 * reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : `source` d'une autre forme que la chaîne `'maison'`, `maison` déjà présent AVEC un
 * `source`, ou compte textuel divergent du compte structurel → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : réécriture TEXTUELLE ancrée sur le couple `"id"` → `"source": "maison"` de
 * l'entrée — aucun `JSON.stringify` du document.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/axes.json');

/** VERBATIM de `src/data/schemas/defs/axes.ts:38`. */
const RAISON = 'Mécanique maison — aucune page RAW à citer (le RAW ne connaît pas cet axe). #409';

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

const echecs = [];
const migres = [];
const dejaMigres = [];

let out = brut;
for (const e of data) {
  if (e.source === undefined) {
    if (typeof e.maison === 'string' && e.maison.length > 0) dejaMigres.push(e.id);
    else echecs.push(`${e.id} : ni \`source\` ni \`maison\` — provenance PERDUE`);
    continue;
  }
  if (e.source !== 'maison') {
    echecs.push(`${e.id} : \`source\` de forme inattendue ${JSON.stringify(e.source)} (chaîne 'maison' attendue)`);
    continue;
  }
  if (e.maison !== undefined) {
    echecs.push(`${e.id} : porte DÉJÀ \`maison\` en plus de \`source: 'maison'\` — arbitrage requis`);
    continue;
  }

  const ancreId = `"id": ${JSON.stringify(e.id)}`;
  if (out.split(ancreId).length - 1 !== 1) {
    echecs.push(`${e.id} : ancre \`${ancreId}\` non unique`);
    continue;
  }
  const ancreSource = '"source": "maison"';
  const at = out.indexOf(ancreSource, out.indexOf(ancreId));
  if (at === -1) {
    echecs.push(`${e.id} : ancre textuelle \`${ancreSource}\` introuvable après l'id`);
    continue;
  }
  out = out.slice(0, at) + `"maison": ${JSON.stringify(RAISON)}` + out.slice(at + ancreSource.length);
  migres.push(e.id);
}

// Compte TEXTUEL confronté au compte STRUCTUREL : aucune occurrence résiduelle ne doit subsister.
const residus = (out.match(/"source"\s*:\s*"maison"/g) ?? []).length;
if (residus !== 0) echecs.push(`${residus} occurrence(s) textuelle(s) de "source": "maison" non migrée(s)`);

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE : plus aucune `source` chaîne, et chaque entrée porte une provenance.
const apres = JSON.parse(out);
const nonConformes = apres.filter((e) => typeof e.source === 'string' || !(e.maison || e.source));
if (nonConformes.length) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${nonConformes.map((e) => e.id).join(', ')}`);
  process.exit(1);
}

console.log(`axes.json — migrées \`source: 'maison'\` → \`maison\` : ${migres.length}`);
for (const id of migres) console.log(`  ${id}`);
console.log(`Déjà migrées (no-op) : ${dejaMigres.length}`);
console.log(`Entrées portant une provenance : ${apres.length}/${apres.length} ; \`source\` chaîne restante : 0`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/axes.json`);
