/**
 * Migration #1467 L1b V-P5 — `qualities.json` : le discriminant `type` devient `polarite`.
 *
 * MOTIF MESURÉ : le champ `type` porte CINQ concepts différents sur cinq datasets (epic #1463 :
 * « un CONCEPT = UNE structure … jamais un champ homonyme de forme différente »). Ici il départage
 * l'Atout du Défaut (LDB 62-63) — mesuré 40 `atout` / 19 `defaut` sur 59 entrées : une POLARITÉ.
 * Le nom change, les VALEURS ne changent pas.
 *
 * POSITION PRÉSERVÉE : `polarite` prend la place exacte qu'occupait `type` dans l'entrée.
 *
 * ENTRÉES : `src/data/qualities.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `polarite` (et plus de `type`)
 * est reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : entrée portant `type` ET `polarite`, entrée sans ni l'un ni l'autre, valeur hors
 * `atout`/`defaut`, cardinal ≠ 59 → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/qualities.json');
const ATTENDU = 59;
const VALEURS = new Set(['atout', 'defaut']);

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/qualities.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
if (!Array.isArray(data)) echecs.push('racine non tableau');
else if (data.length !== ATTENDU) echecs.push(`cardinal ${data.length} ≠ ${ATTENDU} attendu`);

let migres = 0;
let dejaMigres = 0;

const sortie = Array.isArray(data)
  ? data.map((e, i) => {
      const aType = e?.type !== undefined;
      const aPol = e?.polarite !== undefined;
      if (aType && aPol) { echecs.push(`entrée #${i} (${e.id}) : porte À LA FOIS \`type\` et \`polarite\` — arbitrage requis`); return e; }
      if (!aType && !aPol) { echecs.push(`entrée #${i} (${e?.id}) : ni \`type\` ni \`polarite\` — polarité PERDUE`); return e; }
      const valeur = aPol ? e.polarite : e.type;
      if (!VALEURS.has(valeur)) { echecs.push(`entrée #${i} (${e.id}) : polarité ${JSON.stringify(valeur)} hors {atout, defaut}`); return e; }
      if (aPol) { dejaMigres++; return e; }
      migres++;
      return Object.fromEntries(Object.entries(e).map(([k, v]) => [k === 'type' ? 'polarite' : k, v]));
    })
  : data;

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucun `type`, chaque entrée porte sa polarité, valeurs conservées.
const apres = JSON.parse(out);
const residus = apres.filter((e) => e.type !== undefined).length;
const avant = data.map((e) => e.type ?? e.polarite).join(',');
const rendu = apres.map((e) => e.polarite).join(',');
if (residus || avant !== rendu || apres.length !== ATTENDU) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residus} \`type\` résiduel(s), ${apres.length} entrée(s), valeurs ${avant === rendu ? 'conservées' : 'ALTÉRÉES'}`);
  process.exit(1);
}

const parPolarite = apres.reduce((m, e) => ({ ...m, [e.polarite]: (m[e.polarite] ?? 0) + 1 }), {});
console.log(`qualities.json — \`type\` → \`polarite\` : ${migres} migrée(s), ${dejaMigres} déjà migrée(s)`);
console.log(`Entrées : ${apres.length} ; \`type\` restant : 0 ; répartition ${JSON.stringify(parPolarite)}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/qualities.json`);
