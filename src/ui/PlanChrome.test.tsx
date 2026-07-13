import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { planChrome } from './PlanChrome';

/**
 * Habillage du plan de lieu (#371) — le plan cesse d'être « un parchemin vide » : cadre à double filet,
 * cartouche de titre portant le NOM du lieu, rose des vents. On verrouille que le titre s'affiche et
 * qu'il reste OPTIONNEL (aperçus d'éditeur au niveau monde : pas de cartouche).
 */
describe('planChrome — cartouche de titre + rose des vents (#371)', () => {
  it('avec un titre : le NOM du lieu est rendu dans le cartouche', () => {
    const html = renderToStaticMarkup(<svg>{planChrome('Salzenmund')}</svg>);
    expect(html).toContain('Salzenmund');
  });
  it('la rose des vents (N) est toujours présente', () => {
    const html = renderToStaticMarkup(<svg>{planChrome('Salzenmund')}</svg>);
    expect(html).toContain('>N<');
  });
  it('sans titre : aucun cartouche de nom (aperçu monde sobre)', () => {
    const html = renderToStaticMarkup(<svg>{planChrome()}</svg>);
    expect(html).not.toContain('Salzenmund');
    // Le cartouche de titre (fond `--wm-cartouche-bg`) n'est pas émis sans titre.
    expect(html).not.toContain('--wm-cartouche-bg');
  });
  it('couleurs en tokens uniquement : aucun littéral hex dans le chrome', () => {
    const html = renderToStaticMarkup(<svg>{planChrome('Salzenmund')}</svg>);
    expect(html).not.toMatch(/(?:fill|stroke)="#/);
  });
});
