/**
 * ÉCRITURE d'un fichier de stock NOMINATIF depuis sa mesure — le geste commun aux régénérateurs
 * `scripts/rig/regen-*-stock.mts` : refuser la croissance SITE PAR SITE (`refusDeCroissance`,
 * `stock.mjs`), puis réécrire les tableaux `export const <NOM> = [ … ]` du fichier.
 *
 * Ce qui reste au régénérateur appelant : SA mesure, le NOM de ses collections et leur MOTIF de
 * refus. Convertir un stock de plus n'écrit donc aucune mécanique : une description et un appel.
 *
 * FRONTIÈRE : ici on ÉCRIT et on rend un code de sortie ; le VERDICT de garde reste au test, et le
 * calcul d'écart à `stock.mjs`. Aucun plafond n'est touché — il n'y en a plus.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { refusDeCroissance, type EntreeNominative } from './stock.mjs';
import { parUnitesDeCode } from './lister.mjs';

export interface CollectionAReecrire {
  /** Le nom exporté par le fichier de stock (`export const <nom> = [`). */
  nom: string;
  /** Les sites MESURÉS aujourd'hui, en entrées nominatives. */
  mesurees: readonly EntreeNominative[];
  /** Le stock EN PLACE, importé du fichier. */
  stock: Iterable<EntreeNominative>;
  /** Dernière phrase du refus — ce que le lecteur doit faire d'un site neuf. */
  motif: string;
}

/** Ordre d'écriture STABLE : fichier, puis réf, puis occurrence — un stock se relit par fichier, et
 *  c'est ce qui rend son diff lisible (un solde ne montre que la ligne partie). Comparaison par
 *  UNITÉS DE CODE (#1679 L3b) : un ordre qui suit la locale du processus ferait diverger le stock
 *  généré d'une machine à l'autre, et `--check` rougirait sans qu'une dette ait bougé. */
export const ordreDeStock = (entrees: readonly EntreeNominative[]): EntreeNominative[] =>
  [...entrees].sort((a, b) =>
    parUnitesDeCode(a.fichier, b.fichier) || parUnitesDeCode(a.ref, b.ref) || a.occurrence - b.occurrence);

/** Une réf peut porter les guillemets de son propre langage — un sélecteur CSS d'attribut
 *  (`.grid[data-min='sm']`) casserait le littéral qui l'accueille. */
const litteral = (v: string) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const ligne = (e: EntreeNominative) =>
  `  { fichier: ${litteral(e.fichier)}, ref: ${litteral(e.ref)}, occurrence: ${e.occurrence} },`;

/**
 * Refuse toute croissance, puis écrit (ou vérifie, sous `--check`) le fichier de stock.
 * @returns le code de sortie du régénérateur (0 = rien à dire, 1 = refus ou stock périmé).
 */
export function regenererStock(p: {
  chemin: string;
  collections: readonly CollectionAReecrire[];
  check: boolean;
  outil: string;
  /** AMORÇAGE : saute la barrière décroissante et écrit le stock depuis la MESURE. Un stock VIDE
   *  face à N sites mesurés est un refus — sans cette porte, un stock nominatif ne pourrait jamais
   *  naître. LÉGALE au seul commit qui CRÉE le stock : tout usage ultérieur est un contournement,
   *  visible au diff, et la porte de plage le compte. */
  amorce?: boolean;
}): number {
  if (p.amorce) {
    console.warn(`AMORÇAGE : la barrière décroissante est SAUTÉE pour ${p.chemin} — légal au seul commit qui CRÉE ce stock.`);
  }
  for (const c of p.collections) {
    const refus = p.amorce ? null : refusDeCroissance(c.mesurees, c.stock, { nom: c.nom, motif: c.motif });
    if (refus) { console.error(refus); return 1; }
  }

  const src = readFileSync(p.chemin, 'utf8');
  let next = src;
  for (const c of p.collections) {
    const OPEN = `export const ${c.nom} = [`;
    const head = next.indexOf(OPEN);
    if (head < 0) throw new Error(`borne d'ouverture de ${c.nom} introuvable dans ${p.chemin}`);
    const tail = next.indexOf('\n]', head);
    if (tail < 0) throw new Error(`borne de fermeture de ${c.nom} introuvable dans ${p.chemin}`);
    const corps = ordreDeStock(c.mesurees).map(ligne).join('\n');
    next = next.slice(0, head + OPEN.length) + (corps ? `\n${corps}` : '') + next.slice(tail);
  }

  const tailles = p.collections.map((c) => `${c.nom}=${c.mesurees.length}`).join(', ');
  if (p.check) {
    if (next !== src) {
      console.error(`Stock PÉRIMÉ (${tailles}). Relancer : ${p.outil}`);
      return 1;
    }
    console.log(`Stock à jour (${tailles}).`);
    return 0;
  }
  if (next !== src) {
    writeFileSync(p.chemin, next);
    console.log(`Stock régénéré (${tailles}).`);
  } else {
    console.log(`Stock inchangé (${tailles}).`);
  }
  return 0;
}
