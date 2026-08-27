/**
 * Migration #1467 L1b V-P1 — `raw.manifest.json` : la clé d'identité `topic` devient `id`.
 *
 * MOTIF MESURÉ : les 8 entrées du manifeste éditorial de l'Atlas RAW (#487) portent une identité
 * stable — le topic composite `domaine#sujet` (`magie#malepierre`) — mais sous le nom `topic`, ce que
 * `scripts/gen-registry.mjs` inscrivait au défaut `DEFAUTS_IDS['raw.manifest.json']` (« identité
 * portée par `topic` … jamais par `id` »). Le nom du CHAMP change, les VALEURS ne changent pas.
 *
 * FRONTIÈRE : seul le champ d'ENTRÉE DE MANIFESTE est renommé. Les topics EXTRAITS DES FICHES RAW
 * (`scripts/raw/build-implemente.mjs`, champs `Implémente` parsés) restent `topic` : ce sont des
 * objets d'un autre concept. L'id du manifeste et le topic d'une fiche partagent leur ESPACE DE
 * VALEURS — c'est ce qui permet à `build-implemente.mjs` de confronter l'un à l'autre —, jamais leur
 * porteur.
 *
 * ENTRÉES : `src/data/raw.manifest.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `id` (et plus de `topic`) est
 * reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : entrée portant `topic` ET `id`, entrée sans ni l'un ni l'autre, `topic` non-chaîne ou
 * vide, ids en collision → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/raw.manifest.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/raw.manifest.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
const migres = [];
const dejaMigres = [];

const sortie = data.map((e, i) => {
  const aTopic = e?.topic !== undefined;
  const aId = e?.id !== undefined;
  if (aTopic && aId) {
    echecs.push(`entrée #${i} : porte À LA FOIS \`topic\` (${JSON.stringify(e.topic)}) et \`id\` (${JSON.stringify(e.id)}) — arbitrage requis`);
    return e;
  }
  if (!aTopic && !aId) {
    echecs.push(`entrée #${i} : ni \`topic\` ni \`id\` — identité PERDUE`);
    return e;
  }
  if (aId) {
    dejaMigres.push(e.id);
    return e;
  }
  if (typeof e.topic !== 'string' || !e.topic) {
    echecs.push(`entrée #${i} : \`topic\` de forme inattendue ${JSON.stringify(e.topic)} (chaîne non vide attendue)`);
    return e;
  }
  migres.push(e.topic);
  // Renommage EN PLACE : `id` occupe la position exacte de `topic`, la valeur est inchangée.
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [k === 'topic' ? 'id' : k, v]));
});

const ids = sortie.map((e) => e.id).filter((v) => typeof v === 'string');
if (new Set(ids).size !== ids.length) echecs.push(`ids en collision : ${ids.join(', ')}`);

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucun `topic`, chaque entrée porte un `id`, les valeurs sont conservées.
const apres = JSON.parse(out);
const residus = apres.filter((e) => e.topic !== undefined).length;
const sansId = apres.filter((e) => typeof e.id !== 'string' || !e.id).length;
const valeursAvant = data.map((e) => e.topic ?? e.id).join(',');
const valeursApres = apres.map((e) => e.id).join(',');
if (residus || sansId || valeursAvant !== valeursApres) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residus} \`topic\` résiduel(s), ${sansId} sans \`id\`, valeurs ${valeursAvant === valeursApres ? 'conservées' : `ALTÉRÉES (${valeursAvant} → ${valeursApres})`}`);
  process.exit(1);
}

console.log(`raw.manifest.json — \`topic\` → \`id\` : ${migres.length}`);
for (const id of migres) console.log(`  ${id}`);
console.log(`Déjà migrées (no-op) : ${dejaMigres.length}`);
console.log(`Entrées : ${apres.length} ; \`topic\` restant : 0 ; valeurs d’identité inchangées`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/raw.manifest.json`);
