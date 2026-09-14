/**
 * Régénère `FLESH_GRADIENT_RATCHET` (stock de la chair gravée, #583) depuis la MESURE réelle.
 *   npx tsx scripts/rig/regen-flesh-gradient-stock.mts [--check]
 *
 * Sert le SOLDE : un artiste migre un slot vers `@peau*`, relance ceci, et le stock perd son entrée.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, SITE PAR
 * SITE et jamais sur un total (`refusDeCroissance`, guards/lib/stock.mjs) : un refus par longueur
 * entérine en silence un ÉCHANGE à taille constante.
 *
 * La MESURE vit dans `scripts/guards/lib/fleshGradientAudit.ts`, partagée avec la garde
 * `src/gameIso/rig/parts/tenues/flesh-gradient.test.ts`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditFleshGradient } from '../guards/lib/fleshGradientAudit';
import { FLESH_GRADIENT_RATCHET } from '../guards/lib/fleshGradientStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/fleshGradientStock.mjs'),
  check: process.argv.includes('--check'),
  outil: 'npx tsx scripts/rig/regen-flesh-gradient-stock.mts',
  collections: [{
    nom: 'FLESH_GRADIENT_RATCHET',
    mesurees: sitesEnEntrees(auditFleshGradient()),
    stock: FLESH_GRADIENT_RATCHET,
    motif: "Un nouveau def qui grave g_flesh se corrige (@peau*), il ne s'entérine pas ici.",
  }],
}));
