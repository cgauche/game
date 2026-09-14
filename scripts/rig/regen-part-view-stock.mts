/**
 * Régénère les deux stocks de `scripts/guards/lib/rigPartViewStock.mjs` (format de part, #551)
 * depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-part-view-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste dessine les 3 vues d'un slot, relance ceci, et le stock perd son
 * entrée — plus de retrait à la main sur 171 lignes.
 *
 * DÉCROISSANT-SEULEMENT — la seule propriété qui rende cet outil sûr : il REFUSE d'écrire dès qu'un
 * site MESURÉ n'est pas déjà au stock, SITE PAR SITE et jamais sur un total (`refusDeCroissance`,
 * guards/lib/stock.mjs). Un refus par longueur entérine en silence un ÉCHANGE à taille constante.
 * Croître n'est pas un geste d'outil : c'est un aveu, il se fait à la main, sous revue, et la porte
 * de plage (`croissanceDesStocks`) le voit parce que chaque entrée NOMME son fichier.
 *
 * La MESURE n'est pas ici : `scripts/guards/lib/partViewAudit.ts`, partagée avec la garde
 * `src/gameIso/rig/parts/tenues/part-view-format.test.ts`. Deux lectures du pipeline divergeraient.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditPartViews } from '../guards/lib/partViewAudit';
import { PART_VIEW_RATCHET, PART_VIEW_ALIAS_RATCHET } from '../guards/lib/rigPartViewStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { format, alias } = auditPartViews();

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/rigPartViewStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/rig/regen-part-view-stock.mts',
  collections: [
    {
      nom: 'PART_VIEW_RATCHET',
      mesurees: sitesEnEntrees(format),
      stock: PART_VIEW_RATCHET,
      motif: 'Dessine les 3 vues de ces slots (cf. src/gameIso/rig/PART-CONTRACT.md) ; un slot neuf ne s’entérine pas ici.',
    },
    {
      nom: 'PART_VIEW_ALIAS_RATCHET',
      mesurees: sitesEnEntrees(alias),
      stock: PART_VIEW_ALIAS_RATCHET,
      motif: 'Une vue déclarée qui redessine le front se corrige (dessiner la vue), elle ne s’entérine pas ici.',
    },
  ],
}));
