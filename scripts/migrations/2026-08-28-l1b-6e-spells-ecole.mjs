/**
 * Migration #1467 L1b V-P5 — `spells.json` : le champ `type` devient `ecole`.
 *
 * MOTIF MESURÉ : sur 576 sorts, le champ porte 18 valeurs de PROSE (« Béni », « Magie des Arcanes »,
 * « du Domaine des Ombres »… avec la casse double « Magie mineure » / « Magie Mineure ») — un
 * libellé d'école hérité, pas un discriminant : la logique branche sur `family` et `domainId`.
 * Le nom change, AUCUNE valeur ne bouge (casse comprise) ; la dette est nommée au champ (#1517).
 *
 * POSITION PRÉSERVÉE : `ecole` prend la place exacte qu'occupait `type` dans l'entrée.
 *
 * ENTRÉES : `src/data/spells.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `ecole` (et plus de `type`) est
 * reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : entrée portant `type` ET `ecole`, entrée sans ni l'un ni l'autre, valeur non-chaîne ou
 * vide, cardinal ≠ 576 → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/spells.json');
const ATTENDU = 576;

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/spells.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
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
      const aEcole = e?.ecole !== undefined;
      if (aType && aEcole) { echecs.push(`entrée #${i} (${e.id}) : porte À LA FOIS \`type\` et \`ecole\` — arbitrage requis`); return e; }
      if (!aType && !aEcole) { echecs.push(`entrée #${i} (${e?.id}) : ni \`type\` ni \`ecole\` — école PERDUE`); return e; }
      const valeur = aEcole ? e.ecole : e.type;
      if (typeof valeur !== 'string' || !valeur) { echecs.push(`entrée #${i} (${e.id}) : école ${JSON.stringify(valeur)} (chaîne non vide attendue)`); return e; }
      if (aEcole) { dejaMigres++; return e; }
      migres++;
      return Object.fromEntries(Object.entries(e).map(([k, v]) => [k === 'type' ? 'ecole' : k, v]));
    })
  : data;

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucun `type`, les 18 valeurs sont conservées À L'IDENTIQUE (casse comprise).
const apres = JSON.parse(out);
const residus = apres.filter((e) => e.type !== undefined).length;
const avant = data.map((e) => e.type ?? e.ecole).join('');
const rendu = apres.map((e) => e.ecole).join('');
if (residus || avant !== rendu || apres.length !== ATTENDU) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residus} \`type\` résiduel(s), ${apres.length} entrée(s), valeurs ${avant === rendu ? 'conservées' : 'ALTÉRÉES'}`);
  process.exit(1);
}

const distinctes = [...new Set(apres.map((e) => e.ecole))];
console.log(`spells.json — \`type\` → \`ecole\` : ${migres} migrée(s), ${dejaMigres} déjà migrée(s)`);
console.log(`Entrées : ${apres.length} ; \`type\` restant : 0 ; valeurs distinctes : ${distinctes.length}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/spells.json`);
