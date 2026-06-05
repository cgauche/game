import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PendingReload } from '../state/store';
import { ReloadModalView } from './ReloadModal';

const noop = () => {};
const pr = (o: Partial<PendingReload>): PendingReload => ({
  actorId: 'h1', actorName: 'Archère', weaponName: 'Arbalète', reload: 1, progressBefore: 0,
  skillValue: 45, difficulty: 'intermediaire', roll: null, target: 45, sl: 0, success: false, ...o,
});

function render(p: PendingReload, fortune = 1) {
  return renderToStaticMarkup(
    <ReloadModalView pr={p} fortune={fortune} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
  );
}

describe('ReloadModalView — « si y’a un jet, y’a la modale »', () => {
  it('avant le jet : affiche l’arme, la cible et « Lancer » (pas « Appliquer »)', () => {
    const html = render(pr({ roll: null }));
    expect(html).toContain('Arbalète');
    expect(html).toContain('45'); // cible (Projectiles)
    expect(html).toContain('Lancer');
    expect(html).not.toContain('Appliquer');
  });

  it('après un jet réussi (DR ≥ Indice) : montre le DR, « rechargé ✓ » et « Appliquer »', () => {
    const html = render(pr({ roll: 22, target: 45, sl: 2, success: true }));
    expect(html).toContain('22'); // d100
    expect(html).toContain('DR');
    expect(html).toContain('rechargé');
    expect(html).toContain('Appliquer');
  });

  it('après un jet partiel (Recharge 2, DR 1) : montre la progression 1/2 DR', () => {
    const html = render(pr({ weaponName: 'Arbalète lourde', reload: 2, progressBefore: 0, roll: 40, target: 45, sl: 1, success: true }));
    expect(html).toContain('1/2 DR');
  });

  it('progrès partiel cumulé (1 déjà + DR 0) reste 1/2 DR', () => {
    const html = render(pr({ reload: 2, progressBefore: 1, roll: 44, target: 45, sl: 0, success: true }));
    expect(html).toContain('1/2 DR');
  });
});
