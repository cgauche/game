import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipPreview } from './ShipPreview';

const render = (vehicleId: string, sunk = false) =>
  renderToStaticMarkup(<ShipPreview vehicleId={vehicleId} sunk={sunk} label="Le Cormoran" />);

describe('ShipPreview — silhouette rendue de coque (dossier de navire)', () => {
  it('coque connue → SVG non vide, os `coque` rendu par le gabarit navire', () => {
    const html = render('cogue');
    expect(html).toContain('<svg');
    expect(html).toContain('data-bone="coque"');
    expect(html).toContain('<path'); // art de coque effectivement peint
  });

  it('a11y : role img + libellé portant le nom d’instance', () => {
    expect(render('cogue')).toContain('Silhouette — Le Cormoran');
  });

  it('épave (sunk) → gîte de fin ⇒ transform de coque distinct de la pose de repos', () => {
    const afloat = render('cogue', false);
    const wrecked = render('cogue', true);
    expect(wrecked).not.toBe(afloat); // deathPose (gîte 22°) ≠ restPose
  });

  it('id de coque sans art dédié → repli VISIBLE (pas de rendu vide)', () => {
    // un id inconnu tombe sur le repli partagé `orientedArtOr` (#223), jamais un SVG vide.
    expect(render('coque-inexistante')).toContain('data-bone="coque"');
  });
});
