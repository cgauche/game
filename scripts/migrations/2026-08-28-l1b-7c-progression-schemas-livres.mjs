/**
 * Migration #1467 L1b V-FLIP-CONFIG — `progression-schemas.derived.json` : les trois méta-clés
 * soulignées quittent la donnée.
 *
 * `__genere` et `__lecture` sont de la PROSE d'outillage (ce que le générateur est, comment il lit) :
 * elles décrivent le def, pas le document — elles vivent désormais au JSDoc de
 * `src/data/schemas/defs/progression-schemas-derived.ts`. `__livres` est un vrai CHAMP (la provenance
 * du dérivé) : il perd son soulignement et devient `livres`, libellé comme tout champ de document.
 *
 * L'artefact étant GÉNÉRÉ, `scripts/data/gen-progression-schemas.py` écrit désormais exactement cette
 * forme — la migration et le générateur convergent, ce que `--check` mesure à l'OCTET.
 *
 * ENTRÉES : `src/data/progression-schemas.derived.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : un document sans `__genere`/`__lecture` et portant déjà
 * `livres` est reconnu migré ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : `__livres` ET `livres` présents ensemble (arbitrage requis), `__livres` non-tableau,
 * document sans ni l'un ni l'autre → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute
 * écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/progression-schemas.derived.json');

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/progression-schemas.derived.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
if (data.__livres !== undefined && data.livres !== undefined) echecs.push('`__livres` ET `livres` présents — arbitrage requis');
if (data.__livres === undefined && data.livres === undefined) echecs.push('ni `__livres` ni `livres` — la provenance du dérivé est PERDUE');
const livres = data.livres ?? data.__livres;
if (!Array.isArray(livres) || !livres.every((v) => typeof v === 'string' && v)) echecs.push(`\`livres\` de forme inattendue : ${JSON.stringify(livres)}`);

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

// Renommage EN PLACE : `livres` occupe la position exacte de `__livres` ; `__genere`/`__lecture`
// sortent sans décaler quoi que ce soit d'autre.
const sortie = Object.fromEntries(
  Object.entries(data)
    .filter(([k]) => k !== '__genere' && k !== '__lecture')
    .map(([k, v]) => [k === '__livres' ? 'livres' : k, v]),
);

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : aucune clé soulignée, `livres` intacte en VALEUR, `schemas` inchangée.
const apres = JSON.parse(out);
const soulignees = Object.keys(apres).filter((k) => k.startsWith('__'));
const memeLivres = JSON.stringify(apres.livres) === JSON.stringify(livres);
const memesSchemas = JSON.stringify(apres.schemas) === JSON.stringify(data.schemas);
if (soulignees.length || !memeLivres || !memesSchemas) {
  console.error(
    `VÉRIFICATION POST-ÉCRITURE ROUGE : clés soulignées restantes ${JSON.stringify(soulignees)}, livres ${memeLivres ? 'intacts' : 'ALTÉRÉS'}, schemas ${memesSchemas ? 'intacts' : 'ALTÉRÉS'}`,
  );
  process.exit(1);
}

console.log(`progression-schemas.derived.json — \`__genere\`/\`__lecture\` retirées, \`__livres\` → \`livres\` (${apres.livres.join(', ')})`);
console.log(`Clés : ${Object.keys(apres).join(', ')} ; schémas : ${apres.schemas.length}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/progression-schemas.derived.json`);
