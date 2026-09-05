#!/usr/bin/env node
// Imprime la mesure de la PROSE INLINE recopiée d'un livre EXTRAIT, par `type` de document.
// C'est avec CETTE sortie que le stock `PROSE_INLINE_TOLEREE`
// (`src/data/schemas/grammaire/prose-inline.ts`) se peuple et se re-mesure — jamais un chiffre
// recopié d'un rendu. La garde qui compare les deux vit dans `src/data/prose-inline-contrat.test.ts`.
//
// Usage : node scripts/source/mesurer-prose-inline.mjs [--noeuds]
//   --noeuds : imprime aussi le chemin de chaque nœud compté (diagnostic d'une dérive).
import { mesurerProseInline, livresExtraits } from '../guards/lib/proseInline.mjs';

const detail = process.argv.includes('--noeuds');
const mesure = mesurerProseInline();
const lignes = Object.entries(mesure).sort((a, b) => b[1].entrees - a[1].entrees || a[0].localeCompare(b[0]));
const total = lignes.reduce((n, [, v]) => n + v.entrees, 0);

console.log(`LIVRES EXTRAITS (dir) : ${livresExtraits().size}`);
console.log(`TOTAL : ${total} nœuds sur ${lignes.length} types`);
for (const [type, v] of lignes) {
  console.log(`  ${type.padEnd(28)} ${String(v.entrees).padStart(5)}`);
  if (detail) for (const n of v.noeuds) console.log(`      ${n}`);
}
