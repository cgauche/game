/**
 * MESURE des sorts NARRATIFS — ceux que `spellSupportOf` (`src/engine/spellspec.ts`) classe
 * `narratif`. Module PUR, consommé par le recensement (`scripts/qc/spell-support-census.mts`), par la
 * garde (`src/data/spell-narratifs.test.ts`) et par le régénérateur de son stock
 * (`scripts/data/regen-spell-narratif-stock.mts`).
 */
import { spells } from '../../../src/data/index';
import { spellSupportOf } from '../../../src/engine/spellspec';

/** Dataset qui DÉCLARE les sorts — le `fichier` de chaque entrée du stock. */
export const FICHIER_DES_SORTS = 'src/data/spells.json';

/** Les sorts narratifs, dans l'ordre de `spells.json`. */
export const sortsNarratifs = () => spells.filter((s) => spellSupportOf(s) === 'narratif');

/** Les sorts narratifs en SITES (`{ file, ref }`, `scripts/guards/lib/stock.d.mts`) : `ref` = l'id. */
export const sitesNarratifs = () => sortsNarratifs().map((s) => ({ file: FICHIER_DES_SORTS, ref: s.id }));
