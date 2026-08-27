/**
 * Migration #1467 L1b V-P1 — `calendarPhases.json` : la clé d'identité `key` devient `id`.
 *
 * MOTIF MESURÉ : les 7 phases de la journée portent bien une identité stable (`aube`…`nuit`,
 * consommée par `engine/clock.ts` et l'op `setTime`), mais sous le nom `key` — ce que
 * `scripts/gen-registry.mjs` inscrivait au défaut `DEFAUTS_IDS['calendarPhases.json']` (« identité
 * portée par `key`, jamais par `id` »). Le nom change, les VALEURS ne changent pas : aucun id de
 * phase n'est réécrit, aucune donnée de jeu ne bouge.
 *
 * POSITION PRÉSERVÉE : `id` prend la place exacte qu'occupait `key` dans l'entrée (première clé).
 *
 * ENTRÉES : `src/data/calendarPhases.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `id` (et plus de `key`) est
 * reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : entrée portant `key` ET `id` (arbitrage requis), entrée sans ni l'un ni l'autre,
 * `key` non-chaîne ou vide, ids en collision → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/calendarPhases.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/calendarPhases.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
const migres = [];
const dejaMigres = [];

const sortie = data.map((e, i) => {
  const aKey = e?.key !== undefined;
  const aId = e?.id !== undefined;
  if (aKey && aId) {
    echecs.push(`entrée #${i} : porte À LA FOIS \`key\` (${JSON.stringify(e.key)}) et \`id\` (${JSON.stringify(e.id)}) — arbitrage requis`);
    return e;
  }
  if (!aKey && !aId) {
    echecs.push(`entrée #${i} : ni \`key\` ni \`id\` — identité PERDUE`);
    return e;
  }
  if (aId) {
    dejaMigres.push(e.id);
    return e;
  }
  if (typeof e.key !== 'string' || !e.key) {
    echecs.push(`entrée #${i} : \`key\` de forme inattendue ${JSON.stringify(e.key)} (chaîne non vide attendue)`);
    return e;
  }
  migres.push(e.key);
  // Renommage EN PLACE : `id` occupe la position exacte de `key`, la valeur est inchangée.
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [k === 'key' ? 'id' : k, v]));
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

// PREUVE post-écriture : plus aucune `key`, chaque entrée porte un `id`, les valeurs sont conservées.
const apres = JSON.parse(out);
const residus = apres.filter((e) => e.key !== undefined).length;
const sansId = apres.filter((e) => typeof e.id !== 'string' || !e.id).length;
const valeursAvant = data.map((e) => e.key ?? e.id).join(',');
const valeursApres = apres.map((e) => e.id).join(',');
if (residus || sansId || valeursAvant !== valeursApres) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residus} \`key\` résiduelle(s), ${sansId} sans \`id\`, valeurs ${valeursAvant === valeursApres ? 'conservées' : `ALTÉRÉES (${valeursAvant} → ${valeursApres})`}`);
  process.exit(1);
}

console.log(`calendarPhases.json — \`key\` → \`id\` : ${migres.length}`);
for (const id of migres) console.log(`  ${id}`);
console.log(`Déjà migrées (no-op) : ${dejaMigres.length}`);
console.log(`Entrées : ${apres.length} ; \`key\` restante : 0 ; valeurs d’identité inchangées (${valeursApres})`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/calendarPhases.json`);
