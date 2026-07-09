/**
 * ChanceButtons — le bouton « Relancer » (LDB 12 l.56 : UNE relance par Test) n'affiche PAS de
 * compteur (la relance n'est pas une réserve). Les répétables +1 DR gardent leur `×N`.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChanceButtons } from './ChanceButtons';

const noop = () => {};

describe('ChanceButtons — « Relancer » sans compteur (#211)', () => {
  it('Relancer payant : libellé « Relancer » nu, sans ×N', () => {
    const html = renderToStaticMarkup(
      <ChanceButtons fortune={3} rerollable onReroll={noop} onBonusSL={noop} />,
    );
    expect(html).toContain('Relancer');
    expect(html).not.toContain('Relancer ×');
    // Le répétable +1 DR conserve, lui, sa réserve.
    expect(html).toContain('+1 DR ×3');
  });

  it('Relance GRATUITE (Bénédiction) : « Relancer » nu également', () => {
    const html = renderToStaticMarkup(
      <ChanceButtons fortune={0} rerollable freeReroll onReroll={noop} />,
    );
    expect(html).toContain('Relancer');
    expect(html).not.toContain('Relancer ×');
  });
});
