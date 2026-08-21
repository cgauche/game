import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TargetReticle } from './TargetReticle';
import { ENEMY_CUE_TINT } from './highlightTints';
import { teintesJeu } from '../data';

/**
 * CÂBLAGE de la ligne du réticule au catalogue de teintes. Le défaut de `lineColor` était un hexa
 * recopié ; il vient de la façade — un artiste qui retouche `signal-ennemi` en donnée déplace le
 * trait du télégraphe avec lui.
 */
describe('réticule de ciblage — teinte de la ligne', () => {
  const dessiner = (props: { lineColor?: string } = {}) =>
    renderToStaticMarkup(<TargetReticle from={{ cx: 0, cy: 0 }} to={{ cx: 10, cy: 10 }} line="dashed" {...props} />);

  const traits = (markup: string) => [...markup.matchAll(/<line[^>]*stroke="([^"]+)"/g)].map((m) => m[1]);

  it('sans consigne, la ligne porte le repère ENNEMI du catalogue (donnée, pas hexa recopié)', () => {
    expect(traits(dessiner())[0]).toBe(teintesJeu['signal-ennemi']);
    expect(ENEMY_CUE_TINT).toBe(teintesJeu['signal-ennemi']);
  });

  it('une couleur explicite de l’appelant prime toujours', () => {
    expect(traits(dessiner({ lineColor: '#123456' }))[0]).toBe('#123456');
  });
});
