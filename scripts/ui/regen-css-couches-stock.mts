/**
 * Régénère les TROIS stocks des couches CSS (#1800) depuis la MESURE réelle.
 *   npx tsx scripts/ui/regen-css-couches-stock.mts [--check] [--amorce]
 *
 * Sert le SOLDE : un écran porte son identité dans le module de sa primitive, pose ses espacements
 * sur l'échelle `--sp-*`, remplace son `style=` par une variable CSS — puis relance ceci, et les
 * entrées correspondantes quittent le stock.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, site par
 * site et jamais sur un total (`refusDeCroissance`, guards/lib/stock.mjs). `--amorce` saute cette
 * barrière : LÉGAL au seul commit qui CRÉE le stock (un stock vide face à ses ~2 400 sites est un
 * refus), tout usage ultérieur est un contournement visible au diff.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  mesureCssCouches,
  MOTIF_ESPACEMENT,
  MOTIF_IDENTITE,
  MOTIF_INLINE,
} from '../guards/lib/cssCouchesAudit';
import {
  CSS_ESPACEMENT_RATCHET,
  CSS_IDENTITE_ECRAN_RATCHET,
  STYLE_INLINE_RATCHET,
} from '../guards/lib/cssCouchesStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mesure = mesureCssCouches();

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/cssCouchesStock.mjs'),
  check: process.argv.includes('--check'),
  amorce: process.argv.includes('--amorce'),
  outil: 'npx tsx scripts/ui/regen-css-couches-stock.mts',
  collections: [
    { nom: 'CSS_IDENTITE_ECRAN_RATCHET', mesurees: sitesEnEntrees(mesure.identite), stock: CSS_IDENTITE_ECRAN_RATCHET, motif: MOTIF_IDENTITE },
    { nom: 'CSS_ESPACEMENT_RATCHET', mesurees: sitesEnEntrees(mesure.espacement), stock: CSS_ESPACEMENT_RATCHET, motif: MOTIF_ESPACEMENT },
    { nom: 'STYLE_INLINE_RATCHET', mesurees: sitesEnEntrees(mesure.inline), stock: STYLE_INLINE_RATCHET, motif: MOTIF_INLINE },
  ],
}));
