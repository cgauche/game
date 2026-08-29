/**
 * Migration #1467 L1b V-formeProjet — l'enveloppe du document de PROJET devient PLATE.
 *
 * Deux gestes, sur les 4 documents committés :
 *  - la poche `meta` est APLATIE : ses champs remontent à la RACINE, À LA PLACE qu'occupait `meta`
 *    (l'ordre des clés est préservé — l'artefact généré doit rester byte-identique à `build()`) ;
 *  - `meta.version` devient `versionContenu` à la racine. Le renommage est STRUCTUREL, pas
 *    cosmétique, et le risque MESURÉ n'est pas un refus : `parseProject` (`src/state/worldMap.ts`)
 *    pose `version: obj.schema` EN DERNIER dans le spread, écrasant tout `version` du document, puis
 *    purge cette clé de travail avant de rendre. Resté nommé `version` à la racine, le numéro de
 *    CONTENU de l'auteur serait donc écrasé puis perdu à CHAQUE chargement, sans une seule erreur —
 *    perte SILENCIEUSE. Le nom distinct le met hors de portée de cet écrasement.
 * Le `schema` passe de 4 à 5 : la forme change, elle se bumpe (pendant committé de
 * `PROJECT_MIGRATIONS[4]`, qui porte le même geste au CHARGEMENT pour les projets de bibliothèque).
 *
 * ENTRÉES : les 4 `src/scenes/<campagne>/<campagne>-projet.json`.
 *
 * ORDRE : ce script se rejoue APRÈS `…-3i-…` (ordre lexical), qui porte le bump 3 → 4.
 * IDEMPOTENT : un document en `schema` ≥ 5 est reconnu migré ; rejouée, la migration n'écrit rien. La
 * borne est OUVERTE VERS LE HAUT parce que les vagues suivantes bumpent le même document (la 15b le
 * porte à 6) : c'est la DERNIÈRE migration de la chaîne, en aval dans l'ordre lexical, qui NOMME un
 * `schema` inconnu — elle seule sait ce qui existe après elle.
 * FAIL-FAST : `schema` absent, non numérique, ou d'une valeur autre que 4 ou ≥ 5 → sortie 1 ; un
 * document en `schema: 4` qui porterait DÉJÀ un `versionContenu` ou un `id` racine → sortie 1 (forme
 * hybride, la migration refuse de deviner).
 * FORMATAGE PRÉSERVÉ : sérialiseur des scènes `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT
 * toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RACINE = path.join(ROOT, 'src/scenes');
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/** Champs d'identité posés à la racine, dans l'ordre où la poche `meta` les portait. */
const aplati = (doc) => {
  const sortie = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k !== 'meta') { sortie[k] = v; continue; }
    for (const [mk, mv] of Object.entries(v)) sortie[mk === 'version' ? 'versionContenu' : mk] = mv;
  }
  return { ...sortie, schema: 5 };
};

const echecs = [];
const ecritures = [];

for (const d of fs.readdirSync(RACINE, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const abs = path.join(RACINE, d.name, `${d.name}-projet.json`);
  if (!fs.existsSync(abs)) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (typeof doc.schema === 'number' && doc.schema >= 5) { ecritures.push({ rel, abs, brut, out: brut, deja: true }); continue; }
  if (doc.schema !== 4) { echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (4 ou ≥ 5 attendus)`); continue; }
  if ('versionContenu' in doc || 'id' in doc) {
    echecs.push(`${rel} : \`schema: 4\` mais l'identité est DÉJÀ à plat (\`id\`/\`versionContenu\` racine) — forme hybride`);
    continue;
  }
  if (doc.meta !== undefined && (doc.meta === null || typeof doc.meta !== 'object' || Array.isArray(doc.meta))) {
    echecs.push(`${rel} : \`meta\` présent mais n'est pas un objet (${JSON.stringify(doc.meta)})`);
    continue;
  }
  ecritures.push({ rel, abs, brut, out: canonique(aplati(doc)), deja: false });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

let migres = 0;
for (const e of ecritures) {
  if (e.out !== e.brut) { fs.writeFileSync(e.abs, e.out, 'utf8'); migres++; }
  const apres = JSON.parse(e.out);
  if (e.deja) {
    // Rejeu sur l'état final : rien n'a été écrit. La PREUVE est que la forme est bien celle d'arrivée.
    if (!(apres.schema >= 5) || 'meta' in apres) {
      console.error(`VÉRIFICATION ROUGE — ${e.rel} : reconnu « déjà migré » mais schema=${apres.schema}${'meta' in apres ? ', poche `meta` encore présente' : ''}`);
      process.exit(1);
    }
    console.log(`${e.rel} — schema ${apres.schema} (déjà migré, no-op)`);
    continue;
  }
  // PREUVE post-écriture : deep-equal de la charge utile MOINS les renommages DÉCLARÉS — le document
  // d'après, reconstitué avec sa poche `meta` et son `schema` d'origine, doit rendre l'octet d'avant.
  const avant = JSON.parse(e.brut);
  const { schema: _s, id, label, icon, versionContenu, desc, auteur, ...charge } = apres;
  const identite = {};
  for (const [k, v] of [['id', id], ['label', label], ['icon', icon], ['version', versionContenu], ['desc', desc], ['auteur', auteur]]) {
    if (v !== undefined) identite[k] = v;
  }
  const reconstitue = {};
  for (const k of Object.keys(avant)) reconstitue[k] = k === 'schema' ? avant.schema : k === 'meta' ? identite : charge[k];
  if (apres.schema !== 5 || JSON.stringify(reconstitue) !== JSON.stringify(avant)) {
    console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE — ${e.rel} : schema=${apres.schema}, charge utile ${JSON.stringify(reconstitue) === JSON.stringify(avant) ? 'intacte' : 'ALTÉRÉE'}`);
    process.exit(1);
  }
  console.log(`${e.rel} — schema 4 → 5, meta aplatie (${Object.keys(identite).join(', ')})`);
}
console.log(`TOTAL : ${migres} document(s) migré(s) sur ${ecritures.length}.`);
