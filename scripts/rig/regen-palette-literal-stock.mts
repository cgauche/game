/**
 * Régénère `PALETTE_LITERAL_RATCHET` (stock du littéral == jeton, #583) depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-palette-literal-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste remplace un littéral par son jeton `@<clé>`, relance ceci, et le
 * stock perd la clé si le slot:vue n'en recopie plus aucun.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire un stock plus grand que celui en place (même contrat
 * que `regen-flesh-gradient-stock.mts`, #583 / `regen-part-view-stock.mts`, #551).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditPaletteLiteral } from '../guards/lib/paletteLiteralAudit';
import { PALETTE_LITERAL_RATCHET } from '../guards/lib/paletteLiteralStock.mjs';
import { TENUE_DEFS } from '../../src/gameIso/rig/parts/tenues/_registry.generated';
import { slugId } from '../../src/data/slug';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const STOCK = resolve(ROOT, 'scripts/guards/lib/paletteLiteralStock.mjs');
const GUARD = resolve(ROOT, 'src/gameIso/rig/parts/tenues/palette-literal.test.ts');
const CHECK = process.argv.includes('--check');

const found = auditPaletteLiteral();

if (found.size > PALETTE_LITERAL_RATCHET.size) {
  const neuves = [...found].filter((k) => !PALETTE_LITERAL_RATCHET.has(k)).sort();
  console.error(
    `REFUS : la mesure (${found.size}) dépasse le stock en place (${PALETTE_LITERAL_RATCHET.size}).\n` +
    `Cet outil ne peut qu'écrire un stock PLUS PETIT :\n  ` + neuves.join('\n  ') +
    `\n\nUn nouveau def qui recopie un littéral == jeton se corrige (le jeton), il ne s'entérine pas ici.`,
  );
  process.exit(1);
}

const labelById = new Map(TENUE_DEFS.map((d) => [slugId(d.name), d.name]));
const ordered = [...found].sort((a, b) => a.localeCompare(b, 'fr'));
const line = (key: string) => {
  const id = key.slice(0, key.indexOf(':'));
  return `  '${key}', // ${labelById.get(id) ?? id}`;
};

const src = readFileSync(STOCK, 'utf8');
const OPEN = 'export const PALETTE_LITERAL_RATCHET = new Set([';
const head = src.indexOf(OPEN);
const tail = src.indexOf('])', head);
if (head < 0 || tail < 0) throw new Error(`bornes de PALETTE_LITERAL_RATCHET introuvables dans ${STOCK}`);
const next = src.slice(0, head + OPEN.length) + '\n' + ordered.map(line).join('\n') + '\n' + src.slice(tail);

const guardSrc = readFileSync(GUARD, 'utf8');
const guardNext = guardSrc.replace(/^const MAX_PALETTE_LITERAL = \d+;$/m, `const MAX_PALETTE_LITERAL = ${found.size};`);
if (guardNext === guardSrc && !/^const MAX_PALETTE_LITERAL = \d+;$/m.test(guardSrc))
  throw new Error(`MAX_PALETTE_LITERAL introuvable dans ${GUARD}`);

const dirty = next !== src || guardNext !== guardSrc;
if (CHECK) {
  if (dirty) {
    console.error(`Stock PÉRIMÉ : ${PALETTE_LITERAL_RATCHET.size} clés en place, ${found.size} mesurées.\n` +
      `Relancer : npx tsx scripts/rig/regen-palette-literal-stock.mts`);
    process.exit(1);
  }
  console.log(`Stock à jour (${found.size} clés).`);
} else if (dirty) {
  writeFileSync(STOCK, next);
  writeFileSync(GUARD, guardNext);
  console.log(`Stock régénéré : ${PALETTE_LITERAL_RATCHET.size} -> ${found.size} clés ` +
    `(${PALETTE_LITERAL_RATCHET.size - found.size} soldée(s)). MAX_PALETTE_LITERAL rabaissé à ${found.size}.`);
} else {
  console.log(`Stock inchangé (${found.size} clés).`);
}
