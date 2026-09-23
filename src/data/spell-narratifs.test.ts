import { describe, it, expect } from 'vitest';
import { sitesNarratifs, FICHIER_DES_SORTS } from '../../scripts/data/lib/sortsNarratifs';
import { SPELL_NARRATIF_STOCK } from '../../scripts/guards/lib/spellNarratifStock.mjs';
import { ecartDuVolet } from '../../scripts/guards/lib/stock.mjs';

/**
 * Cliquet décroissant des sorts NARRATIFS (DoD de #838) : l'écart NOMINATIF au stock
 * (`ecartDuVolet`, `scripts/guards/lib/stock.mjs`), dans les DEUX sens. Aucun plafond, aucun cardinal
 * en assertion : le compte s'imprime en diagnostic.
 */
const STOCK = 'scripts/guards/lib/spellNarratifStock.mjs';

/** Une ligne de remède CONTIENT-elle cette clé ? (le remède décore la clé d'une phrase) */
const porte = (lignes: readonly string[], cle: string) => lignes.some((l) => l.includes(cle));

describe('cliquet — tout sort NARRATIF est au stock, toute entrée du stock est narrative', () => {
  const sites = sitesNarratifs();
  const { neuves, perimees } = ecartDuVolet({ sites, stock: SPELL_NARRATIF_STOCK, ou: STOCK });
  console.info(`sorts narratifs mesurés : ${sites.length} · stock : ${SPELL_NARRATIF_STOCK.length}`);

  it('aucun sort narratif NEUF hors du stock — le mécaniser, jamais le stocker', () => {
    expect(neuves, `sort(s) NARRATIF(S) hors stock — mécaniser ses \`effects\` :\n${neuves.join('\n')}`).toEqual([]);
  });

  it('le stock ne peut que DÉCROÎTRE — toute entrée qui n’est plus narrative en sort', () => {
    expect(perimees, `entrée(s) du stock qui ne sont plus narratives — retirer leur ligne (ou :\n` +
      `npx tsx scripts/data/regen-spell-narratif-stock.mts) :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('chaque entrée NOMME le dataset des sorts — c’est ce que la porte de plage voit', () => {
    const muettes = SPELL_NARRATIF_STOCK.filter((e) => e.fichier !== FICHIER_DES_SORTS);
    expect(muettes, `Entrées dont le \`fichier\` n'est pas ${FICHIER_DES_SORTS} :\n  ${JSON.stringify(muettes)}`).toEqual([]);
  });

  /** SUBSTITUTION à compte constant — forgée EN MÉMOIRE, le stock du disque n'est jamais touché. */
  it('une SUBSTITUTION à compte CONSTANT rougit : la découverte est neuve, la bidon est périmée', () => {
    const substitue = [
      ...SPELL_NARRATIF_STOCK.slice(1),
      { fichier: FICHIER_DES_SORTS, ref: 'sort-qui-n-existe-pas', occurrence: 1 },
    ];
    expect(substitue, 'la forge doit rester à taille CONSTANTE, sinon elle ne prouve rien')
      .toHaveLength(SPELL_NARRATIF_STOCK.length);
    const ecart = ecartDuVolet({ sites, stock: substitue, ou: STOCK });
    expect(porte(ecart.neuves, ` :: ${SPELL_NARRATIF_STOCK[0].ref} :: `), 'la découverte doit ressortir NEUVE').toBe(true);
    expect(porte(ecart.perimees, ' :: sort-qui-n-existe-pas :: 1'), "l'entrée bidon doit ressortir SOLDÉE").toBe(true);
  });
});
