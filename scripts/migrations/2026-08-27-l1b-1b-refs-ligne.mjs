/**
 * Migration #1467 L1b V-Src — `reglesOptionnelles.json` : un `ref` au CHAPITRE SEUL s'enrichit de la
 * LIGNE que son PROPRE `hint` porte déjà.
 *
 * MOTIF MESURÉ : la forme citable du dépôt est `<ABRÉV> <chapitre> l.<ligne>` — c'est elle que
 * `parseLineCitation` (`scripts/guards/lib/folioLineAlign.mjs:20`) sait lire, et donc la seule qui
 * puisse un jour être confrontée à l'ancre `data-folio`. Un `ref: "LDB 18"` ne désigne rien de
 * vérifiable, alors que le `hint` de la MÊME entrée écrit « LDB 18 l.328 » : l'information est déjà
 * là, mal rangée.
 *
 * RÈGLE APPLIQUÉE, littérale et bornée : une entrée est éligible si (1) son `ref` est de la forme
 * `<LIVRE> <chapitre>` SANS `l.`, ET (2) son `hint` porte au moins une citation
 * `<LIVRE> <chapitre> l.<N>` au MÊME livre et au MÊME chapitre. Le `ref` prend alors la forme du
 * hint. Quand le hint porte PLUSIEURS lignes du même chapitre, la PREMIÈRE est retenue et toutes
 * sont journalisées (l'arbitrage reste lisible au rendu).
 *
 * FAIL-FAST : un hint dont la citation diverge du livre ou du chapitre du `ref` → rien n'est écrit,
 * sortie 1. AUCUNE autre entrée ne bouge : la partition `source` ⊕ `maison` (54 + 27, mesurée) est
 * un invariant SOLDÉ, cette migration ne touche que le champ `ref`.
 *
 * PÉRIMÈTRE MESURÉ (2026-08-27) : 10 entrées portent un `ref` sans `l.` ; 4 seulement ont un hint
 * qui porte la ligne au même livre+chapitre — les 6 autres (`travel-sleep-forced`,
 * `exposure-expire-hours`, `landRobberyFleePct`, `landRobberyLossPct`, `piratePillagePct`,
 * `boardingWaveSize`) n'ont AUCUNE ligne dans leur hint et restent telles quelles : cette migration
 * n'invente pas une ligne qu'aucun champ de l'entrée ne porte.
 *
 * ENTRÉES : `src/data/reglesOptionnelles.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : un `ref` portant déjà `l.` n'est jamais éligible ;
 * rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : réécriture TEXTUELLE ancrée sur le couple `"ref": "<valeur exacte>"` qui suit
 * l'`"id"` de l'entrée — aucun `JSON.stringify` du document.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/reglesOptionnelles.json');

/** Citation à la ligne, même forme que `parseLineCitation` (`folioLineAlign.mjs:20`). */
const CITATION = /([A-Za-zÀ-ÿ]+(?:\s+I{1,3})?)\s+(\d{1,2})\s+l\.(\d+)/g;
/** `ref` au chapitre SEUL : `<LIVRE> <chapitre>`, rien d'autre. */
const CHAPITRE_SEUL = /^([A-Za-zÀ-ÿ]+(?:\s+I{1,3})?)\s+(\d{1,2})$/;

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

const echecs = [];
const migres = [];
const inertes = [];

let out = brut;
for (const e of data) {
  if (typeof e.ref !== 'string' || typeof e.hint !== 'string') continue;
  const m = CHAPITRE_SEUL.exec(e.ref.trim());
  if (!m) continue; // `ref` déjà à la ligne, ou porteur d'un folio (`MDG 15 p.131`) : hors règle.
  const [, livre, chapitre] = m;

  CITATION.lastIndex = 0;
  const citations = [...e.hint.matchAll(CITATION)];
  const memeChapitre = citations.filter((c) => c[1].toUpperCase() === livre.toUpperCase() && c[2] === chapitre);
  if (citations.length && !memeChapitre.length) {
    echecs.push(
      `${e.id} : ref « ${e.ref} » mais le hint ne cite que ${citations.map((c) => `« ${c[1]} ${c[2]} l.${c[3]} »`).join(', ')} — livre/chapitre DIVERGENT`,
    );
    continue;
  }
  if (!memeChapitre.length) {
    inertes.push(`${e.id} (hint sans citation à la ligne)`);
    continue;
  }

  const retenue = `${livre} ${chapitre} l.${memeChapitre[0][3]}`;
  const toutes = memeChapitre.map((c) => `l.${c[3]}`);

  const ancreId = `"id": ${JSON.stringify(e.id)}`;
  if (out.split(ancreId).length - 1 !== 1) {
    echecs.push(`${e.id} : ancre \`${ancreId}\` non unique`);
    continue;
  }
  const ancreRef = `"ref": ${JSON.stringify(e.ref)}`;
  const at = out.indexOf(ancreRef, out.indexOf(ancreId));
  if (at === -1) {
    echecs.push(`${e.id} : ancre textuelle \`${ancreRef}\` introuvable après l'id`);
    continue;
  }
  out = out.slice(0, at) + `"ref": ${JSON.stringify(retenue)}` + out.slice(at + ancreRef.length);
  migres.push({ id: e.id, avant: e.ref, apres: retenue, candidates: toutes });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

console.log(`reglesOptionnelles.json — refs enrichis de leur ligne : ${migres.length}`);
for (const m of migres) {
  const multi = m.candidates.length > 1 ? `  [hint multi-lignes : ${m.candidates.join(', ')} — première retenue]` : '';
  console.log(`  ${m.id}  « ${m.avant} » → « ${m.apres} »${multi}`);
}
console.log(`Chapitre seul SANS ligne dans le hint (laissés intacts) : ${inertes.length}`);
for (const i of inertes) console.log(`  ${i}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/reglesOptionnelles.json`);
