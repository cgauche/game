/**
 * Régénère les trois stocks de `scripts/guards/lib/rigViewStock.mjs` (vues des familles
 * `parts/monster/defs/` et `parts/elements/defs/`, #1082) depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-rig-view-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste dessine la vue d'une part, relance ceci, et le stock perd son entrée.
 *
 * DÉCROISSANT-SEULEMENT, par la barrière PARTAGÉE `refusDeCroissance` (guards/lib/stock.mjs) : il
 * REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, SITE PAR SITE et jamais sur un
 * total. Croître n'est pas un geste d'outil : c'est un aveu, il se fait à la main, sous revue — et
 * la porte de plage (`croissanceDesStocks`) le voit, chaque entrée nommant son fichier de def.
 *
 * La MESURE vit dans `scripts/guards/lib/partViewAudit.ts` (`auditRigPartViews`), partagée avec la
 * garde `src/gameIso/rig/parts/monster/rig-part-views.test.ts`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditRigPartViews } from '../guards/lib/partViewAudit';
import {
  RIG_VIEW_FORMAT_RATCHET,
  RIG_VIEW_ALIAS_RATCHET,
  RIG_VIEW_TRANSFORM_RATCHET,
} from '../guards/lib/rigViewStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { format, alias, transform } = auditRigPartViews();
const MOTIF = 'Dessine ces vues ; une vue neuve non dessinée ne s’entérine pas ici.';

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/rigViewStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/rig/regen-rig-view-stock.mts',
  collections: [
    { nom: 'RIG_VIEW_FORMAT_RATCHET', mesurees: sitesEnEntrees(format), stock: RIG_VIEW_FORMAT_RATCHET, motif: MOTIF },
    { nom: 'RIG_VIEW_ALIAS_RATCHET', mesurees: sitesEnEntrees(alias), stock: RIG_VIEW_ALIAS_RATCHET, motif: MOTIF },
    { nom: 'RIG_VIEW_TRANSFORM_RATCHET', mesurees: sitesEnEntrees(transform), stock: RIG_VIEW_TRANSFORM_RATCHET, motif: MOTIF },
  ],
}));
