/**
 * Migration #1467 L1b V-P5 — `characteristics.json` : le discriminant `type` devient `nature`, et
 * la valeur VIDE devient `compteur`.
 *
 * MOTIF MESURÉ : le champ dit ce QU'EST la ligne du registre — 10 caracs à jet (`roll`), les
 * Blessures (`wounds`), les deux réserves `extra`, le Mouvement (`mv`), les Points supplémentaires
 * (`points`) — et QUATRE entrées portaient la chaîne VIDE (Chance, Détermination, Corruption,
 * Péché), c'est-à-dire un discriminant qui ne discrimine rien. Ces quatre-là sont des COMPTEURS :
 * la valeur `compteur` les nomme, et `''` meurt du schéma.
 *
 * POSITION PRÉSERVÉE : `nature` prend la place exacte qu'occupait `type` dans l'entrée.
 *
 * ENTRÉES : `src/data/characteristics.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `nature` (et plus de `type`) est
 * reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : entrée portant `type` ET `nature`, entrée sans ni l'un ni l'autre, valeur hors du
 * vocabulaire, cardinal ≠ 19 → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/characteristics.json');
const ATTENDU = 19;
/** Ancienne valeur → nature. Seule `''` bouge ; les cinq autres sont reconduites à l'identique. */
const NORMALISE = { roll: 'roll', wounds: 'wounds', extra: 'extra', mv: 'mv', points: 'points', '': 'compteur', compteur: 'compteur' };

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/characteristics.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
if (!Array.isArray(data)) echecs.push('racine non tableau');
else if (data.length !== ATTENDU) echecs.push(`cardinal ${data.length} ≠ ${ATTENDU} attendu`);

let migres = 0;
let dejaMigres = 0;
const promus = [];

const sortie = Array.isArray(data)
  ? data.map((e, i) => {
      const aType = e?.type !== undefined;
      const aNature = e?.nature !== undefined;
      if (aType && aNature) { echecs.push(`entrée #${i} (${e.id}) : porte À LA FOIS \`type\` et \`nature\` — arbitrage requis`); return e; }
      if (!aType && !aNature) { echecs.push(`entrée #${i} (${e?.id}) : ni \`type\` ni \`nature\` — nature PERDUE`); return e; }
      const brute = aNature ? e.nature : e.type;
      const norm = NORMALISE[brute];
      if (norm === undefined) { echecs.push(`entrée #${i} (${e.id}) : nature ${JSON.stringify(brute)} hors {roll, wounds, extra, mv, points, '', compteur}`); return e; }
      if (aNature) {
        if (e.nature !== norm) { echecs.push(`entrée #${i} (${e.id}) : \`nature\` déjà posée mais VIDE (${JSON.stringify(e.nature)})`); return e; }
        dejaMigres++;
        return e;
      }
      if (brute === '') promus.push(e.id);
      migres++;
      return Object.fromEntries(Object.entries(e).map(([k, v]) => (k === 'type' ? ['nature', norm] : [k, v])));
    })
  : data;

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucun `type`, plus aucune nature vide, partition conservée entrée par entrée.
const apres = JSON.parse(out);
const residus = apres.filter((e) => e.type !== undefined).length;
const vides = apres.filter((e) => e.nature === '').length;
const avant = data.map((e) => NORMALISE[e.type ?? e.nature]).join(',');
const rendu = apres.map((e) => e.nature).join(',');
if (residus || vides || avant !== rendu || apres.length !== ATTENDU) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residus} \`type\` résiduel(s), ${vides} nature(s) vide(s), ${apres.length} entrée(s), partition ${avant === rendu ? 'conservée' : 'ALTÉRÉE'}`);
  process.exit(1);
}

const parNature = apres.reduce((m, e) => ({ ...m, [e.nature]: (m[e.nature] ?? 0) + 1 }), {});
console.log(`characteristics.json — \`type\` → \`nature\` : ${migres} migrée(s), ${dejaMigres} déjà migrée(s)`);
console.log(`Vide → \`compteur\` : ${promus.length} (${promus.join(', ') || '—'})`);
console.log(`Entrées : ${apres.length} ; \`type\` restant : 0 ; répartition ${JSON.stringify(parNature)}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/characteristics.json`);
