/**
 * Régénère les TROIS stocks des couches CSS (#1800) depuis la MESURE réelle — ou VENTILE leur décrue.
 *   npx tsx scripts/ui/regen-css-couches-stock.mts [--check] [--amorce]
 *   npx tsx scripts/ui/regen-css-couches-stock.mts --ventiler <ref> [--tete <ref>]
 *
 * Sert le SOLDE : un écran porte son identité dans le module de sa primitive, pose ses espacements
 * sur l'échelle `--sp-*`, remplace son `style=` par une variable CSS — puis relance ceci, et les
 * entrées correspondantes quittent le stock.
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un site MESURÉ n'est pas déjà au stock, site par
 * site et jamais sur un total (`refusDeCroissance`, guards/lib/stock.mjs). `--amorce` saute cette
 * barrière : LÉGAL au seul commit qui CRÉE le stock (un stock vide face à ses ~2 400 sites est un
 * refus), tout usage ultérieur est un contournement visible au diff.
 *
 * `--ventiler <ref>` n'écrit rien : il rend, de `<ref>` à l'arbre de travail (ou à `--tete <ref>`,
 * lue sans disque), par volet, la part de la baisse ENTRÉE en zone exempte — RECLASSÉE par une
 * revendication armée, ou PRIMITIVISÉE — et la part DISPARUE (ou APPARUE), puis les revendications
 * armées avec les sites que chacune retire (`ventilerDecrue`, guards/lib/cssCouches.mjs).
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  composantsDuDisque,
  imageCss,
  imageDuDisque,
  mesureCssCouches,
  MOTIF_ESPACEMENT,
  MOTIF_IDENTITE,
  MOTIF_INLINE,
  sourceDeRef,
} from '../guards/lib/cssCouchesAudit';
import { ligneDeVentilation, ventilerDecrue } from '../guards/lib/cssCouches.mjs';
import {
  CSS_ESPACEMENT_RATCHET,
  CSS_IDENTITE_ECRAN_RATCHET,
  STYLE_INLINE_RATCHET,
} from '../guards/lib/cssCouchesStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** La valeur qui suit un drapeau, ou `null`. */
const valeurDe = (drapeau: string): string | null => {
  const at = process.argv.indexOf(drapeau);
  return at >= 0 ? process.argv[at + 1] ?? null : null;
};

if (process.argv.includes('--ventiler')) {
  const base = valeurDe('--ventiler');
  if (!base) {
    process.stderr.write('--ventiler exige une ref de base\n');
    process.exit(2);
  }
  const tete = valeurDe('--tete');
  const v = ventilerDecrue(imageCss(sourceDeRef(base, ROOT)), tete ? imageCss(sourceDeRef(tete, ROOT)) : imageDuDisque());
  const lignes = [
    `ventilation ${base} → ${tete ?? 'arbre de travail'}`,
    ligneDeVentilation('identité', v.identite),
    ligneDeVentilation('espacement', v.espacement),
    `revendications armées : ${v.revendications.length}`,
    ...v.revendications.map((r) => `  ${r.module} +${r.n} (identité ${r.identite}, espacement ${r.espacement})`),
  ];
  process.stdout.write(`${lignes.join('\n')}\n`);
  process.exit(0);
}

const mesure = mesureCssCouches(imageDuDisque(), composantsDuDisque());

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
