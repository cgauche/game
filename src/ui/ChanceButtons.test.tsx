/**
 * ChanceButtons — forme des boutons de POOL (#945) : « ressource ×N restants », comme Résilience et
 * Détermination. La relance GRATUITE (Bénédiction de Chance, LDB 41) ne débite aucun point : elle
 * n'annonce donc aucune réserve.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChanceButtons } from './ChanceButtons';

const noop = () => {};

describe('ChanceButtons — compteur de pool sur « Relancer » (#945)', () => {
  it('Relancer payant : « Relancer ×N », N = Points de Chance restants', () => {
    const html = renderToStaticMarkup(
      <ChanceButtons fortune={3} rerollable onReroll={noop} onBonusSL={noop} />,
    );
    expect(html).toContain('Relancer ×3');
    // Le répétable +1 DR porte la même réserve, sous la même forme.
    expect(html).toContain('+1 DR ×3');
    // Forme n/m RÉSERVÉE à la progression (DrBar) — jamais sur un pool.
    expect(html).not.toContain('3/3');
  });

  it('Relance GRATUITE (Bénédiction) : « Relancer » nu — rien n’est débité', () => {
    const html = renderToStaticMarkup(
      <ChanceButtons fortune={0} rerollable freeReroll onReroll={noop} />,
    );
    expect(html).toContain('Relancer');
    expect(html).not.toContain('Relancer ×');
  });

  it('le title de « Relancer » porte l’unicité de la relance (LDB 12 l.40), payante comme gratuite', () => {
    for (const props of [
      { fortune: 3, freeReroll: false },
      { fortune: 0, freeReroll: true },
    ]) {
      const html = renderToStaticMarkup(
        <ChanceButtons fortune={props.fortune} rerollable freeReroll={props.freeReroll} onReroll={noop} />,
      );
      expect(html).toContain('une seule relance par Test');
    }
  });
});
