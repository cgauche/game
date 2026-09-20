import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { sitesValeurCss } from '../../scripts/guards/lib/cssValeurEnTest.mjs';
import { estSuiteVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * CLIQUET — « un test unitaire ne cite jamais À LA FOIS un sélecteur d'écran et une VALEUR »
 * (#1806 ; `docs/charte-ui.md` § « Où se garde un contrat CSS »). Question utilisateur du
 * 2026-09-20, verbatim : « Alors on fait quoi de ces tests unitaires qui rends l'édition de
 * l'interface un enfer ? » — la réponse ne vaut que si une garde l'empêche de revenir.
 *
 * ABSOLUE : aucun stock, aucune baseline, aucune liste de fichiers. L'unique porte de sortie est
 * l'EXEMPTION AU SITE, sur la ligne : `// norme: <la norme, nommée>` — une norme d'accessibilité ou
 * de lisibilité se NOMME là où elle s'applique, et sa valeur vient de sa source (WCAG, cible
 * tactile), pas de la maquette.
 *
 * Ce qui reste légitime, et que la mesure ne voit pas : les RELATIONS (une grandeur comparée à une
 * autre, un calcul ÉVALUÉ par `evalLen`/`pxCalc`), la présence/absence, les bornes dégénérées
 * (`0`, `1`, `100%`). Un contrat de RENDU se mesure au navigateur (`scripts/recette/*.mjs`).
 *
 * La MÉCANIQUE et sa spécification vivent hors de `src/` : `scripts/guards/lib/cssValeurEnTest.mjs`
 * et son test à fixtures (elles porteraient sinon le motif qu'elles traquent).
 */
describe('cliquet — valeur de design épinglée sur une lecture de CSS, en test unitaire', () => {
  it('aucun test de `src/**` ne compare une déclaration CSS à une valeur de design', () => {
    const tests = readCorpus(['src'], { exts: ['.ts', '.tsx'], tests: true }).filter((f) => estSuiteVitest(f.rel));
    expect(tests.length, 'aucun test lu : la mesure serait vide').toBeGreaterThan(100);
    const sites = sitesValeurCss(tests).map((s) => `${s.file}:${s.line} — valeur « ${s.valeur} » : ${s.texte}`);
    expect(
      sites,
      'Valeur de DESIGN épinglée sur du CSS lu — jsdom ne met rien en page : ce contrat ne garde aucun'
        + ' rendu, il gèle l\'interface. Le réécrire en RELATION (`evalLen`/`pxCalc`, comparaison à une'
        + ' autre grandeur), le confier à une sonde de recette, ou — si c\'est une NORME — la NOMMER au'
        + ` site : \`// norme: <laquelle>\`.\n${sites.join('\n')}`,
    ).toEqual([]);
  });

  it('la mesure VOIT le motif qu’elle interdit (témoin, hors du corpus réel)', () => {
    // NON-VACUITÉ : sans témoin, « zéro site » ne prouverait rien — ni que la garde lit, ni qu'elle
    // juge. Le témoin est un texte fabriqué ici, jamais un fichier du dépôt.
    const temoin = sitesValeurCss([{ rel: 'src/ui/temoin.test.ts', text: ['const a = 1;', TEMOIN].join('\n') }]);
    expect(temoin.map((s) => s.line)).toEqual([2]);
    expect(temoin[0].valeur).toBe('265px');
  });
});

/** Le témoin, assemblé sur DEUX lignes : écrit d'un bloc, il se dénoncerait lui-même (la mesure est
 *  par ligne — c'est exactement ce que sa spécification énonce). */
const TEMOIN = [
  'expect(',
  'decl(regle, \'bottom\')).toBe(\'265px\');',
].join('');
