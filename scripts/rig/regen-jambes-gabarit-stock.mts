/**
 * Régénère `JAMBE_INLINE_RATCHET` (stock de la jambe encore inline, #633 Lot 0) depuis la MESURE
 * réelle.
 *   npx tsx scripts/rig/regen-jambes-gabarit-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste migre la jambe d'un def au gabarit (`jambeVetue(` / `BODIES.`), relance
 * ceci, et le stock perd son entrée.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, SITE PAR
 * SITE et jamais sur un total (`refusDeCroissance`, guards/lib/stock.mjs).
 *
 * `JAMBE_SILHOUETTE_OVERRIDES` n'est PAS régénérée : la mesure rend le même fait pour une silhouette
 * ASSUMÉE et pour une jambe INLINE du stock (dans les deux cas, la jambe est hors gabarit) ; c'est la
 * REVUE qui tranche laquelle des deux — une DÉCISION, donc cette collection s'écrit à la main.
 *
 * La MESURE vit dans `scripts/guards/lib/jambesGabaritAudit.ts`, partagée avec la garde
 * `src/gameIso/rig/parts/tenues/jambes-gabarit-ratchet.test.ts`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MOTIF_JAMBE_INLINE, sitesJambeInline } from '../guards/lib/jambesGabaritAudit';
import { JAMBE_INLINE_RATCHET } from '../guards/lib/jambesGabaritStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/jambesGabaritStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/rig/regen-jambes-gabarit-stock.mts',
  collections: [{
    nom: 'JAMBE_INLINE_RATCHET',
    mesurees: sitesEnEntrees(sitesJambeInline()),
    stock: JAMBE_INLINE_RATCHET,
    motif: MOTIF_JAMBE_INLINE,
  }],
}));
