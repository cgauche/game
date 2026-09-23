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
 * refus), tout usage ultérieur est un contournement visible au diff. Seule croissance admise hors
 * amorçage : le RETOURNÉ de la ventilation `HEAD` → arbre (`admisAuRetour`, #1806 C) — par fichier
 * hors zone exempte, les sites que `HEAD` portait et que son stock ne comptait pas, jamais un site
 * neuf. Le commit les déclare par une ligne `CLIQUET:` du porteur.
 *
 * `--ventiler <ref>` n'écrit rien : il rend, de `<ref>` à l'arbre de travail (ou à `--tete <ref>`,
 * lue sans disque), par volet, SORTI = RECLASSÉ + PRIMITIVISÉ + DISPARU, APPARU et RETOURNÉ, puis
 * les modules franchis avec leur prix (`ventilationDeGit`, guards/lib/cssImages.mjs, #1806 D6″).
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  composantsDuDisque,
  imageDuDisque,
  mesureCssCouches,
  MOTIF_ESPACEMENT,
  MOTIF_IDENTITE,
  MOTIF_INLINE,
} from '../guards/lib/cssCouchesAudit';
import { admisAuRetour, ligneDeVentilation } from '../guards/lib/cssCouches.mjs';
import { CHEMIN_STOCK_CSS, ventilationDeGit } from '../guards/lib/cssImages.mjs';
import { TRAVAIL } from '../guards/lib/gitPorte.mjs';
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
  const v = ventilationDeGit({ cwd: ROOT, base, tete: tete ?? TRAVAIL });
  const lignes = [
    `ventilation ${base} → ${tete ?? 'arbre de travail'}`,
    ligneDeVentilation('identité', v.identite),
    ligneDeVentilation('espacement', v.espacement),
    `modules franchis : ${v.franchis.length}`,
    ...v.franchis.map((f) => `  RECLASSEMENT: ${f.module} +${f.n} (identité ${f.identite}, espacement ${f.espacement})`),
  ];
  process.stdout.write(`${lignes.join('\n')}\n`);
  process.exit(0);
}

const image = imageDuDisque();
const mesure = mesureCssCouches(image, composantsDuDisque());
/** Le RETOURNÉ de `HEAD` à l'arbre, borné au stock ÉCRIT à `HEAD` (#1806 C). */
const retour = ventilationDeGit({ cwd: ROOT, base: 'HEAD' });
const identite = sitesEnEntrees(mesure.identite);
const espacement = sitesEnEntrees(mesure.espacement);

process.exit(regenererStock({
  chemin: resolve(ROOT, CHEMIN_STOCK_CSS),
  check: process.argv.includes('--check'),
  amorce: process.argv.includes('--amorce'),
  outil: 'npx tsx scripts/ui/regen-css-couches-stock.mts',
  collections: [
    { nom: 'CSS_IDENTITE_ECRAN_RATCHET', mesurees: identite, stock: [...CSS_IDENTITE_ECRAN_RATCHET, ...admisAuRetour(identite, retour.stockAvant.identite, retour.identite.retournes)], motif: MOTIF_IDENTITE },
    { nom: 'CSS_ESPACEMENT_RATCHET', mesurees: espacement, stock: [...CSS_ESPACEMENT_RATCHET, ...admisAuRetour(espacement, retour.stockAvant.espacement, retour.espacement.retournes)], motif: MOTIF_ESPACEMENT },
    { nom: 'STYLE_INLINE_RATCHET', mesurees: sitesEnEntrees(mesure.inline), stock: STYLE_INLINE_RATCHET, motif: MOTIF_INLINE },
  ],
}));
