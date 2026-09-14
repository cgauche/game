/**
 * Régénère `ENTITY_ORPHAN_RATCHET` (stock des entités de catalogue sans consommateur) depuis la
 * MESURE réelle.
 *   npx tsx scripts/data/regen-entity-orphan-stock.mts [--check]
 *
 * Sert le SOLDE : une entité est câblée (citée par une donnée ou par le code de prod), on relance
 * ceci, et le stock perd son entrée.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'une orpheline MESURÉE n'est pas déjà au stock,
 * SITE PAR SITE et jamais sur un total (`refusDeCroissance`, guards/lib/stock.mjs) : un refus par
 * longueur entérine en silence un ÉCHANGE à taille constante (une orpheline câblée, une autre créée).
 *
 * La MESURE n'est pas ici : `orphelinesMesurees` (`scripts/guards/lib/entityConsumers.mjs`), la même
 * que celle de la garde `src/data/entity-orphans.test.ts` et du rapport `docs/orphelines-donnees.md`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { orphelinesMesurees } from '../guards/lib/entityConsumers.mjs';
import { ENTITY_ORPHAN_RATCHET } from '../guards/lib/entityOrphanStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/entityOrphanStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/data/regen-entity-orphan-stock.mts',
  collections: [{
    nom: 'ENTITY_ORPHAN_RATCHET',
    mesurees: sitesEnEntrees(orphelinesMesurees(resolve(ROOT, 'src/data'), resolve(ROOT, 'src'))),
    stock: ENTITY_ORPHAN_RATCHET,
    motif: "Une entité neuve sans consommateur se CÂBLE (une donnée qui la référence, ou du code de prod), elle ne s'entérine pas ici.",
  }],
}));
