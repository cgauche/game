/**
 * Régénère `PALETTE_LITERAL_RATCHET` (stock du littéral == jeton, #583) depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-palette-literal-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste remplace un littéral par son jeton `@<clé>`, relance ceci, et le
 * stock perd l'entrée si le slot:vue n'en recopie plus aucun.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, site
 * par site et jamais sur un total (`refusDeCroissance`, guards/lib/stock.mjs) ; l'écriture elle-même
 * est celle de `regenererStock`, commune aux six régénérateurs de stock nominatif du dépôt — ordre
 * d'écriture compris (`ordreDeStock`, unités de code).
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MOTIF_PALETTE_LITERAL, sitesPaletteLiteral } from '../guards/lib/paletteLiteralAudit';
import { PALETTE_LITERAL_RATCHET } from '../guards/lib/paletteLiteralStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/paletteLiteralStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/rig/regen-palette-literal-stock.mts',
  collections: [{
    nom: 'PALETTE_LITERAL_RATCHET',
    mesurees: sitesEnEntrees(sitesPaletteLiteral()),
    stock: PALETTE_LITERAL_RATCHET,
    motif: MOTIF_PALETTE_LITERAL,
  }],
}));
