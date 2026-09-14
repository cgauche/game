/**
 * Régénère `TABLE_ORPHAN_RATCHET` (stock des tables d'effets sans consommateur, #734) depuis la
 * MESURE réelle.
 *   npx tsx scripts/data/regen-table-orphan-stock.mts [--check]
 *
 * Sert le SOLDE : une table est câblée (op `rollTable`, `tableId` d'une autre table, appel code), on
 * relance ceci, et le stock perd son entrée.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'une orpheline MESURÉE n'est pas déjà au stock,
 * SITE PAR SITE et jamais sur un total (`refusDeCroissance`, guards/lib/stock.mjs) : un refus par
 * longueur entérine en silence un ÉCHANGE à taille constante (une table câblée, une autre créée).
 *
 * La MESURE vit dans `scripts/guards/lib/tableConsumerAudit.ts`, partagée avec la garde
 * `src/data/tables.test.ts`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MOTIF_TABLE_ORPHAN, sitesTableOrpheline } from '../guards/lib/tableConsumerAudit';
import { TABLE_ORPHAN_RATCHET } from '../guards/lib/tableConsumerStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/tableConsumerStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/data/regen-table-orphan-stock.mts',
  collections: [{
    nom: 'TABLE_ORPHAN_RATCHET',
    mesurees: sitesEnEntrees(sitesTableOrpheline()),
    stock: TABLE_ORPHAN_RATCHET,
    motif: MOTIF_TABLE_ORPHAN,
  }],
}));
