/**
 * Régénère les TROIS stocks de dettes d'ART quadrupède (#1082) depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-quad-deco-stock.mts [--check]
 *
 * Sert le SOLDE : un art réécrit dans le repère de l'os, un décor câblé sur un os émis, un `plan`
 * déclaré — on relance ceci, et le stock perd son entrée.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, SITE PAR
 * SITE et jamais sur un total (`refusDeCroissance`, guards/lib/stock.mjs) : un refus par longueur
 * entérine en silence un ÉCHANGE à taille constante (un art soldé, un autre créé).
 *
 * La MESURE vit dans `scripts/guards/lib/quadDecoAudit.ts`, partagée avec les gardes
 * `src/gameIso/rig/quadruped/quad-anchor-contract.test.ts` et `quad-vues-ratchet.test.ts`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  MOTIF_DECO_MORT, MOTIF_DECO_SANS_PLAN, MOTIF_REPERE_ART_PROPRE,
  sitesDecosMorts, sitesDecosSansPlan, sitesReperesArtPropres,
} from '../guards/lib/quadDecoAudit';
import {
  DECOS_MORTS_RATCHET, DECOS_SANS_PLAN_RATCHET, REPERES_ART_PROPRES_RATCHET,
} from '../guards/lib/quadDecoStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/quadDecoStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/rig/regen-quad-deco-stock.mts',
  collections: [
    {
      nom: 'REPERES_ART_PROPRES_RATCHET',
      mesurees: sitesEnEntrees(sitesReperesArtPropres()),
      stock: REPERES_ART_PROPRES_RATCHET,
      motif: MOTIF_REPERE_ART_PROPRE,
    },
    {
      nom: 'DECOS_MORTS_RATCHET',
      mesurees: sitesEnEntrees(sitesDecosMorts()),
      stock: DECOS_MORTS_RATCHET,
      motif: MOTIF_DECO_MORT,
    },
    {
      nom: 'DECOS_SANS_PLAN_RATCHET',
      mesurees: sitesEnEntrees(sitesDecosSansPlan()),
      stock: DECOS_SANS_PLAN_RATCHET,
      motif: MOTIF_DECO_SANS_PLAN,
    },
  ],
}));
