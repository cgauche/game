/**
 * Migration #1467 L1b V-P3 — `actions.json` : le couple `maison: true` + `costNote: '<texte>'`
 * devient LE champ d'enveloppe `maison: '<texte>'`.
 *
 * MOTIF MESURÉ : l'enveloppe de `document()` (`src/data/schemas/grammaire/document.ts`) porte
 * `maison` comme la RAISON EN CLAIR d'un arbitrage — jamais un booléen. `actions.json` en tenait la
 * forme dédoublée : un drapeau + une note à côté, liés par un `superRefine` bidirectionnel
 * (`defs/actions.ts`, « coût maison sans costNote » / « costNote sans maison »). Le texte de
 * `costNote` EST la raison ; il est déplacé VERBATIM dans `maison`, le drapeau et la note meurent, et
 * le contrat que le refine gardait est désormais porté par le TYPE seul (`z.string().min(1)`).
 *
 * ENTRÉES : `src/data/actions.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée dont `maison` est déjà une chaîne non vide et
 * qui ne porte plus de `costNote` est reconnue migrée ; rejouée sur l'état final, la migration
 * n'écrit rien et sort 0.
 * FAIL-FAST : `maison: true` sans `costNote`, `costNote` sans `maison`, `maison` d'une autre forme,
 * ou compte textuel divergent du compte structurel → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : réécriture TEXTUELLE du couple de lignes — aucun `JSON.stringify` du
 * document.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/actions.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

const echecs = [];
const aMigrer = [];
const dejaMigres = [];

for (const a of data) {
  const aNote = a.costNote !== undefined;
  if (a.maison === undefined) {
    if (aNote) echecs.push(`${a.id} : \`costNote\` sans \`maison\` — l'arbitrage n'a pas de porteur`);
    continue;
  }
  if (typeof a.maison === 'string') {
    if (a.maison.length === 0) echecs.push(`${a.id} : \`maison\` chaîne VIDE — une raison ne se déclare pas vide`);
    else if (aNote) echecs.push(`${a.id} : \`maison\` déjà migrée MAIS \`costNote\` survit — demi-migration`);
    else dejaMigres.push(a.id);
    continue;
  }
  if (a.maison !== true) {
    echecs.push(`${a.id} : \`maison\` de forme inattendue ${JSON.stringify(a.maison)} (true ou chaîne attendus)`);
    continue;
  }
  if (!aNote) {
    echecs.push(`${a.id} : \`maison: true\` SANS \`costNote\` — aucune raison à reprendre, arbitrage requis`);
    continue;
  }
  if (typeof a.costNote !== 'string' || a.costNote.length === 0) {
    echecs.push(`${a.id} : \`costNote\` non-chaîne ou vide ${JSON.stringify(a.costNote)}`);
    continue;
  }
  aMigrer.push(a.id);
}

// Le couple de lignes, dans l'ordre où le document le pose : `"maison": true,` puis `"costNote": …`.
const COUPLE = /^([ \t]*)"maison": true,\r?\n[ \t]*"costNote": ("(?:[^"\\]|\\.)*")(,?)\r?$/gm;
const occurrences = brut.match(COUPLE) ?? [];
if (occurrences.length !== aMigrer.length) {
  echecs.push(`compte TEXTUEL ${occurrences.length} ≠ compte STRUCTUREL ${aMigrer.length} — une forme échappe à l'ancre`);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = brut.replace(COUPLE, (_m, indent, note, virgule) => `${indent}"maison": ${note}${virgule}`);

// PREUVE : la charge utile est celle attendue, entrée par entrée — `maison` porte le texte EXACT de
// `costNote`, qui a disparu ; aucun autre champ n'a bougé.
// L'ORDRE des clés est conservé (`maison` reste à sa place, `costNote` disparaît) : la comparaison
// par `JSON.stringify` est ordonnée, un attendu reconstruit par spread la ferait mentir.
const attendu = data.map((a) => {
  if (a.maison !== true) return a;
  const o = {};
  for (const [k, v] of Object.entries(a)) {
    if (k === 'costNote') continue;
    o[k] = k === 'maison' ? a.costNote : v;
  }
  return o;
});
const apres = JSON.parse(out);
if (JSON.stringify(apres) !== JSON.stringify(attendu)) {
  console.error('VÉRIFICATION POST-RÉÉCRITURE ROUGE : la charge utile diverge de l’attendu, AUCUNE écriture.');
  process.exit(1);
}
const residus = apres.filter((a) => a.costNote !== undefined || typeof a.maison === 'boolean');
if (residus.length) {
  console.error(`VÉRIFICATION POST-RÉÉCRITURE ROUGE : ${residus.map((a) => a.id).join(', ')}`);
  process.exit(1);
}

if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

console.log(`actions.json — couples \`maison: true\` + \`costNote\` fondus en \`maison: '<raison>'\` : ${aMigrer.length}`);
for (const id of aMigrer) console.log(`  ${id}`);
console.log(`Déjà migrées (no-op) : ${dejaMigres.length}`);
console.log(`\`costNote\` restants : 0 ; \`maison\` booléens restants : 0`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/actions.json`);
