/**
 * Régénère les deux collections de `scripts/guards/lib/folioLineAlignStock.mjs` (désalignements
 * folio ↔ ligne, #1318 E8) depuis la MESURE réelle.
 *   npx tsx scripts/data/regen-folio-line-align-stock.mts [--check]
 *
 * Sert le SOLDE : on RELÈVE le passage au `Source/` (marqueur `data-folio`), on corrige celle des
 * deux citations qui ment dans `src/data/*.json`, on relance ceci, et le stock perd son entrée. Une
 * extraction qui regagne ses ancres fait de même sortir une entrée NON JUGEABLE.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, SITE PAR
 * SITE et jamais sur un total (`refusDeCroissance`, `guards/lib/stock.mjs`).
 *
 * La MESURE vit dans `scripts/guards/lib/folioLineAlignAudit.ts` (traduction en sites de
 * `folioLineAlign.mjs`), partagée avec la garde `src/data/folio-line-align.test.ts`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  auditFolioLineAlign,
  MOTIF_FOLIO_DESALIGNE,
  MOTIF_FOLIO_NON_JUGEABLE,
  sitesDesNonJugeables,
  sitesDesViolations,
} from '../guards/lib/folioLineAlignAudit';
import {
  FOLIO_LINE_ALIGN_NON_JUGEABLE,
  FOLIO_LINE_ALIGN_RATCHET,
} from '../guards/lib/folioLineAlignStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// UNE lecture du disque pour les deux collections : elles sont les deux sorties du MÊME audit.
const rapport = auditFolioLineAlign();

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/folioLineAlignStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/data/regen-folio-line-align-stock.mts',
  collections: [
    {
      nom: 'FOLIO_LINE_ALIGN_RATCHET',
      mesurees: sitesEnEntrees(sitesDesViolations(rapport.violations)),
      stock: FOLIO_LINE_ALIGN_RATCHET,
      motif: MOTIF_FOLIO_DESALIGNE,
    },
    {
      nom: 'FOLIO_LINE_ALIGN_NON_JUGEABLE',
      mesurees: sitesEnEntrees(sitesDesNonJugeables(rapport.ignored)),
      stock: FOLIO_LINE_ALIGN_NON_JUGEABLE,
      motif: MOTIF_FOLIO_NON_JUGEABLE,
    },
  ],
}));
