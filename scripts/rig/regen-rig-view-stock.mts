/**
 * Régénère les trois stocks de `scripts/guards/lib/rigViewStock.mjs` (vues des familles
 * `parts/monster/defs/` et `parts/elements/defs/`, #1082) depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-rig-view-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste dessine la vue d'une part, relance ceci, et le stock perd sa clé —
 * les plafonds de la garde (`MAX_RIG_FORMAT`/`MAX_RIG_ALIAS`/`MAX_RIG_TRANSFORM`) sont rabaissés ici même.
 *
 * DÉCROISSANT-SEULEMENT, comme son aîné `regen-part-view-stock.mts` : il REFUSE d'écrire un stock
 * plus grand que celui en place. Croître n'est pas un geste d'outil : c'est un aveu, il se fait à la
 * main, sous revue, avec le plafond de la garde relevé sciemment.
 *
 * La MESURE vit dans `scripts/guards/lib/partViewAudit.ts` (`auditRigPartViews`), partagée avec la
 * garde `src/gameIso/rig/parts/monster/rig-part-views.test.ts`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditRigPartViews, clesNeuves } from '../guards/lib/partViewAudit';
import {
  RIG_VIEW_FORMAT_RATCHET,
  RIG_VIEW_ALIAS_RATCHET,
  RIG_VIEW_TRANSFORM_RATCHET,
} from '../guards/lib/rigViewStock.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const STOCK = resolve(ROOT, 'scripts/guards/lib/rigViewStock.mjs');
const GUARD = resolve(ROOT, 'src/gameIso/rig/parts/monster/rig-part-views.test.ts');
const CHECK = process.argv.includes('--check');

const { format, alias, transform, labels } = auditRigPartViews();

const SETS = [
  { name: 'RIG_VIEW_FORMAT_RATCHET', max: 'MAX_RIG_FORMAT', found: format, stock: RIG_VIEW_FORMAT_RATCHET },
  { name: 'RIG_VIEW_ALIAS_RATCHET', max: 'MAX_RIG_ALIAS', found: alias, stock: RIG_VIEW_ALIAS_RATCHET },
  { name: 'RIG_VIEW_TRANSFORM_RATCHET', max: 'MAX_RIG_TRANSFORM', found: transform, stock: RIG_VIEW_TRANSFORM_RATCHET },
] as const;

// --- Barrière du SOLDE : une seule clé MESURÉE absente du stock en place = on n'écrit rien.
// Le critère est l'APPARTENANCE, jamais le compte : un échange à somme nulle (une vue dessinée, une
// vue cassée dans le même geste) laisse la taille intacte, et ferait entrer la violation neuve dans
// le stock réécrit, sous un plafond immobile.
for (const { name, found, stock } of SETS) {
  const neuves = clesNeuves(found, stock);
  if (neuves.length === 0) continue;
  console.error(
    `REFUS : ${name} porte ${neuves.length} clé(s) ABSENTE(S) du stock en place ` +
    `(mesure ${found.size}, stock ${stock.size}).\n` +
    `Cet outil ne peut qu'écrire un stock PLUS PETIT — il ne sert pas à entériner des violations neuves :\n  ` +
    neuves.join('\n  ') +
    `\n\nDessine ces vues. Si la croissance est délibérée, elle s'écrit à la main : éditer le stock\n` +
    `ET relever le plafond dans la garde.`,
  );
  process.exit(1);
}

/** Ordre STABLE : monstre d'abord, puis éléments — un diff de solde ne montre que la ligne partie. */
const ordered = (s: ReadonlySet<string>) => [...s].sort((a, b) => {
  const [ax, bx] = [a.startsWith('monstre:'), b.startsWith('monstre:')];
  return ax === bx ? a.localeCompare(b, 'fr') : (ax ? -1 : 1);
});
const line = (key: string) => `  '${key}', // ${labels.get(key.slice(0, key.lastIndexOf(':'))) ?? '?'}`;

let src = readFileSync(STOCK, 'utf8');
for (const { name, found } of SETS) {
  const OPEN = `export const ${name} = new Set([`;
  const head = src.indexOf(OPEN);
  const tail = src.indexOf('])', head);
  if (head < 0 || tail < 0) throw new Error(`bornes de ${name} introuvables dans ${STOCK}`);
  src = src.slice(0, head + OPEN.length) + '\n' + ordered(found).map(line).join('\n') + '\n' + src.slice(tail);
}

// Les plafonds de la garde suivent la mesure : un solde qui les laisse en l'air rouvre le trou.
let guardNext = readFileSync(GUARD, 'utf8');
const guardSrc = guardNext;
for (const { max, found } of SETS) {
  const re = new RegExp(`^const ${max} = \\d+;$`, 'm');
  if (!re.test(guardNext)) throw new Error(`${max} introuvable dans ${GUARD}`);
  guardNext = guardNext.replace(re, `const ${max} = ${found.size};`);
}

const before = readFileSync(STOCK, 'utf8');
const dirty = src !== before || guardNext !== guardSrc;
const sizes = SETS.map(({ name, found }) => `${name}=${found.size}`).join(', ');
if (CHECK) {
  if (dirty) {
    console.error(`Stock PÉRIMÉ (${sizes}). Relancer : npx tsx scripts/rig/regen-rig-view-stock.mts`);
    process.exit(1);
  }
  console.log(`Stock à jour (${sizes}).`);
} else if (dirty) {
  writeFileSync(STOCK, src);
  writeFileSync(GUARD, guardNext);
  console.log(`Stock régénéré (${sizes}) ; plafonds rabaissés dans la garde.`);
} else {
  console.log(`Stock inchangé (${sizes}).`);
}
