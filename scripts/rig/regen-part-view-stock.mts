/**
 * Régénère `PART_VIEW_RATCHET` (stock du format de part, #551) depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-part-view-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste dessine les 3 vues d'un slot, relance ceci, et le stock perd sa clé —
 * plus de retrait à la main sur 171 lignes, plus de plafond oublié (`MAX_FORMAT` est rabaissé ici
 * même, dans la garde).
 *
 * DÉCROISSANT-SEULEMENT — la seule propriété qui rende cet outil sûr : il REFUSE d'écrire un stock
 * plus grand que celui en place. Un régénérateur libre serait le trou qu'on vient de fermer (on
 * solderait un slot cassé en « régénérant »). Croître n'est pas un geste d'outil : c'est un aveu,
 * il se fait à la main, sous revue, avec le plafond de la garde relevé sciemment.
 *
 * La MESURE n'est pas ici : `scripts/guards/lib/partViewAudit.ts`, partagée avec la garde
 * `src/gameIso/rig/parts/tenues/part-view-format.test.ts`. Deux lectures du pipeline divergeraient.
 *
 * `PART_VIEW_ALIAS_RATCHET` n'est PAS régénéré : ses 3 clés portent chacune un commentaire d'enquête
 * (ce qui a été vérifié, ce qui reste à dessiner) qu'aucune génération ne saurait réécrire. Il se
 * tient à la main ; la garde le cliquette pareil.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditPartViews } from '../guards/lib/partViewAudit';
import { PART_VIEW_RATCHET } from '../guards/lib/rigPartViewStock.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const STOCK = resolve(ROOT, 'scripts/guards/lib/rigPartViewStock.mjs');
const GUARD = resolve(ROOT, 'src/gameIso/rig/parts/tenues/part-view-format.test.ts');
const CHECK = process.argv.includes('--check');

const { format, labels } = auditPartViews();

// --- Barrière DÉCROISSANTE : mesuré > en place = on n'écrit rien. ---
if (format.size > PART_VIEW_RATCHET.size) {
  const neuves = [...format].filter((k) => !PART_VIEW_RATCHET.has(k)).sort();
  console.error(
    `REFUS : la mesure (${format.size}) dépasse le stock en place (${PART_VIEW_RATCHET.size}).\n` +
    `Cet outil ne peut qu'écrire un stock PLUS PETIT — il ne sert pas à entériner des violations neuves :\n  ` +
    neuves.join('\n  ') +
    `\n\nDessine les 3 vues de ces slots (cf. src/gameIso/rig/PART-CONTRACT.md). Si la croissance est\n` +
    `délibérée, elle s'assume à la main : éditer le stock ET relever MAX_FORMAT dans la garde.`,
  );
  process.exit(1);
}

/** Le dégât MESURÉ par slot, tel que le sert `resolve.ts` — `bras` n'a aucune substitution. */
const servi = (slot: string) => (slot === 'bras' ? 'FRONT PLAQUE' : 'silhouette generique');
/** Ordre STABLE : tenues (par id) puis armures — un diff de solde ne montre que la ligne partie. */
const ordered = [...format].sort((a, b) => {
  const [ax, bx] = [a.startsWith('armure:'), b.startsWith('armure:')];
  return ax === bx ? a.localeCompare(b, 'fr') : (ax ? 1 : -1);
});
const line = (key: string) => {
  const slot = key.slice(key.lastIndexOf(':') + 1);
  const label = labels.get(key.slice(0, key.lastIndexOf(':'))) ?? '?';
  return `  '${key}', // ${label} — manque profile+back ; servi : ${servi(slot)}`;
};

const src = readFileSync(STOCK, 'utf8');
const OPEN = 'export const PART_VIEW_RATCHET = new Set([';
const head = src.indexOf(OPEN);
const tail = src.indexOf('])', head);
if (head < 0 || tail < 0) throw new Error(`bornes de PART_VIEW_RATCHET introuvables dans ${STOCK}`);
const next = src.slice(0, head + OPEN.length) + '\n' + ordered.map(line).join('\n') + '\n' + src.slice(tail);

// Le plafond de la garde suit la mesure : un solde qui laisse MAX_FORMAT en l'air rouvre le trou.
const guardSrc = readFileSync(GUARD, 'utf8');
const guardNext = guardSrc.replace(/^const MAX_FORMAT = \d+;$/m, `const MAX_FORMAT = ${format.size};`);
if (guardNext === guardSrc && !/^const MAX_FORMAT = \d+;$/m.test(guardSrc))
  throw new Error(`MAX_FORMAT introuvable dans ${GUARD}`);

const dirty = next !== src || guardNext !== guardSrc;
if (CHECK) {
  if (dirty) {
    console.error(`Stock PÉRIMÉ : ${PART_VIEW_RATCHET.size} clés en place, ${format.size} mesurées.\n` +
      `Relancer : npx tsx scripts/rig/regen-part-view-stock.mts`);
    process.exit(1);
  }
  console.log(`Stock à jour (${format.size} clés).`);
} else if (dirty) {
  writeFileSync(STOCK, next);
  writeFileSync(GUARD, guardNext);
  console.log(`Stock régénéré : ${PART_VIEW_RATCHET.size} -> ${format.size} clés ` +
    `(${PART_VIEW_RATCHET.size - format.size} soldée(s)). MAX_FORMAT rabaissé à ${format.size}.`);
} else {
  console.log(`Stock inchangé (${format.size} clés).`);
}
