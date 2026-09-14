/**
 * Régénère `scripts/guards/lib/horsStrateStock.mjs` (signatures HORS STRATE des documents authorés,
 * #1463 L0 / #1727 T0d) depuis la MESURE réelle.
 *   npx tsx scripts/data/regen-hors-strate-stock.mts [--check]
 *
 * Sert le SOLDE : on pose la structure à la forme CIBLE de son concept (`structures-lexique.mts`),
 * on relance ceci, et le stock perd son entrée.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, SITE PAR
 * SITE et jamais sur un total (`refusDeCroissance`, `guards/lib/stock.mjs`).
 *
 * La MESURE vit dans `scripts/guards/lib/horsStrateAudit.ts` (traduction en sites de
 * `scan.invisibles`, `scripts/docs/lib/structures-scan.mts`), partagée avec la garde
 * `src/data/structures-contrat.test.ts`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditHorsStrate, MOTIF_HORS_STRATE, sitesHorsStrate } from '../guards/lib/horsStrateAudit';
import { HORS_STRATE_RATCHET } from '../guards/lib/horsStrateStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const mesure = auditHorsStrate(ROOT);

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/horsStrateStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/data/regen-hors-strate-stock.mts',
  collections: [
    {
      nom: 'HORS_STRATE_RATCHET',
      mesurees: sitesEnEntrees(sitesHorsStrate(mesure.invisibles, mesure.documents)),
      stock: HORS_STRATE_RATCHET,
      motif: MOTIF_HORS_STRATE,
    },
  ],
}));
