import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RollLine } from './RollLine';

describe('RollLine — détail d’un jet pour la modale', () => {
  it('réussite : base + modificateur = cible, le d100, et le DR', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Corps à corps', base: 45, modifier: 10, target: 55, roll: 32, success: true, sl: 2 }} />,
    );
    expect(html).toContain('Corps à corps');
    expect(html).toContain('45'); // base
    expect(html).toContain('55'); // cible
    expect(html).toContain('32'); // d100
    expect(html).toContain('DR');
    expect(html).toContain('✓'); // réussite
  });

  it('échec : marque l’échec (✗) et la cible réduite par un malus', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Parade', base: 40, modifier: -10, target: 30, roll: 67, success: false, sl: -3 }} />,
    );
    expect(html).toContain('Parade');
    expect(html).toContain('30'); // cible après malus
    expect(html).toContain('67'); // d100
    expect(html).toContain('✗'); // échec
  });

  it('détaille les modificateurs étiquetés quand ils reconcilient le total', () => {
    const html = renderToStaticMarkup(
      <RollLine
        d={{ label: 'Projectiles', base: 38, modifier: 60, target: 98, roll: 50, success: true, sl: 4, mods: [{ label: 'Courte portée', value: 40 }, { label: 'Viser', value: 20 }] }}
      />,
    );
    expect(html).toContain('Courte portée');
    expect(html).toContain('Viser');
    expect(html).toContain('+40');
    expect(html).toContain('+20');
  });

  it('n’affiche PAS le détail si les mods ne reconcilient pas le total (ex. rederive partiel)', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Projectiles', base: 38, modifier: 40, target: 78, roll: 50, success: true, sl: 3, mods: [{ label: 'Viser', value: 20 }] }} />,
    );
    expect(html).not.toContain('Viser'); // 20 ≠ 40 → repli sur l'affichage groupé
  });
});
