/**
 * Régénère `PALETTE_LITERAL_RATCHET` (stock du littéral == jeton, #583) depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-palette-literal-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste remplace un littéral par son jeton `@<clé>`, relance ceci, et le
 * stock perd la clé si le slot:vue n'en recopie plus aucun.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, site
 * par site et jamais sur un total (`refusDeCroissance`, guards/lib/paletteLiteralAudit.ts) ; même
 * contrat que `regen-flesh-gradient-stock.mts`, #583 / `regen-part-view-stock.mts`, #551.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { refusDeCroissance, sitesPaletteLiteral } from '../guards/lib/paletteLiteralAudit';
import { PALETTE_LITERAL_RATCHET } from '../guards/lib/paletteLiteralStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const STOCK = resolve(ROOT, 'scripts/guards/lib/paletteLiteralStock.mjs');
const CHECK = process.argv.includes('--check');

/** Les entrées MESURÉES, dans l'ordre d'écriture du stock (fichier, puis réf, puis occurrence) :
 *  un stock se relit par fichier, et l'ordre stable est ce qui rend son diff lisible. */
const mesurees = sitesEnEntrees(sitesPaletteLiteral()).sort((a, b) =>
  a.fichier.localeCompare(b.fichier, 'fr') || a.ref.localeCompare(b.ref, 'fr') || a.occurrence - b.occurrence);

const refus = refusDeCroissance(mesurees, PALETTE_LITERAL_RATCHET);
if (refus) {
  console.error(refus);
  process.exit(1);
}

const ligne = (e: { fichier: string; ref: string; occurrence: number }) =>
  `  { fichier: '${e.fichier}', ref: '${e.ref}', occurrence: ${e.occurrence} },`;

const src = readFileSync(STOCK, 'utf8');
const OPEN = 'export const PALETTE_LITERAL_RATCHET = [';
const head = src.indexOf(OPEN);
const tail = src.indexOf('\n]', head);
if (head < 0 || tail < 0) throw new Error(`bornes de PALETTE_LITERAL_RATCHET introuvables dans ${STOCK}`);
const next = src.slice(0, head + OPEN.length) + '\n' + mesurees.map(ligne).join('\n') + src.slice(tail);

if (CHECK) {
  if (next !== src) {
    console.error(`Stock PÉRIMÉ : ${PALETTE_LITERAL_RATCHET.length} entrées en place, ${mesurees.length} mesurées`
      + ` (comptes égaux = ordre ou format à régénérer).\n`
      + `Relancer : npx tsx scripts/rig/regen-palette-literal-stock.mts`);
    process.exit(1);
  }
  console.log(`Stock à jour (${mesurees.length} entrées).`);
} else if (next !== src) {
  writeFileSync(STOCK, next);
  console.log(`Stock régénéré : ${PALETTE_LITERAL_RATCHET.length} -> ${mesurees.length} entrées ` +
    `(${PALETTE_LITERAL_RATCHET.length - mesurees.length} soldée(s)).`);
} else {
  console.log(`Stock inchangé (${mesurees.length} entrées).`);
}
