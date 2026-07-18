/**
 * Régénère `FLESH_GRADIENT_RATCHET` (stock de la chair gravée, #583) depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-flesh-gradient-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste migre un slot vers `@peau*`, relance ceci, et le stock perd sa clé.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire un stock plus grand que celui en place (même contrat
 * que `regen-part-view-stock.mts`, #551).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditFleshGradient } from '../guards/lib/fleshGradientAudit';
import { FLESH_GRADIENT_RATCHET } from '../guards/lib/fleshGradientStock.mjs';
import { TENUE_DEFS } from '../../src/gameIso/rig/parts/tenues/_registry.generated';
import { slugId } from '../../src/data/slug';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const STOCK = resolve(ROOT, 'scripts/guards/lib/fleshGradientStock.mjs');
const GUARD = resolve(ROOT, 'src/gameIso/rig/parts/tenues/flesh-gradient.test.ts');
const CHECK = process.argv.includes('--check');

const found = auditFleshGradient();

if (found.size > FLESH_GRADIENT_RATCHET.size) {
  const neuves = [...found].filter((k) => !FLESH_GRADIENT_RATCHET.has(k)).sort();
  console.error(
    `REFUS : la mesure (${found.size}) dépasse le stock en place (${FLESH_GRADIENT_RATCHET.size}).\n` +
    `Cet outil ne peut qu'écrire un stock PLUS PETIT :\n  ` + neuves.join('\n  ') +
    `\n\nUn nouveau def qui grave g_flesh se corrige (@peau*), il ne s'entérine pas ici.`,
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
const OPEN = 'export const FLESH_GRADIENT_RATCHET = new Set([';
const head = src.indexOf(OPEN);
const tail = src.indexOf('])', head);
if (head < 0 || tail < 0) throw new Error(`bornes de FLESH_GRADIENT_RATCHET introuvables dans ${STOCK}`);
const next = src.slice(0, head + OPEN.length) + '\n' + ordered.map(line).join('\n') + '\n' + src.slice(tail);

const guardSrc = readFileSync(GUARD, 'utf8');
const guardNext = guardSrc.replace(/^const MAX_FLESH_GRADIENT = \d+;$/m, `const MAX_FLESH_GRADIENT = ${found.size};`);
if (guardNext === guardSrc && !/^const MAX_FLESH_GRADIENT = \d+;$/m.test(guardSrc))
  throw new Error(`MAX_FLESH_GRADIENT introuvable dans ${GUARD}`);

const dirty = next !== src || guardNext !== guardSrc;
if (CHECK) {
  if (dirty) {
    console.error(`Stock PÉRIMÉ : ${FLESH_GRADIENT_RATCHET.size} clés en place, ${found.size} mesurées.\n` +
      `Relancer : npx tsx scripts/rig/regen-flesh-gradient-stock.mts`);
    process.exit(1);
  }
  console.log(`Stock à jour (${found.size} clés).`);
} else if (dirty) {
  writeFileSync(STOCK, next);
  writeFileSync(GUARD, guardNext);
  console.log(`Stock régénéré : ${FLESH_GRADIENT_RATCHET.size} -> ${found.size} clés ` +
    `(${FLESH_GRADIENT_RATCHET.size - found.size} soldée(s)). MAX_FLESH_GRADIENT rabaissé à ${found.size}.`);
} else {
  console.log(`Stock inchangé (${found.size} clés).`);
}
