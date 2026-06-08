import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppraiseModalView } from './AppraiseModal';
import type { PendingAppraise } from '../state/store';

const base: PendingAppraise = {
  actorId: 'h',
  actorName: 'H',
  itemUid: 'x',
  itemName: 'Épée mystérieuse',
  truePriceBrass: 240,
  availability: 'Rare',
  skillValue: 45,
  difficulty: 'intermediaire',
  target: 45,
  roll: null,
  success: false,
  sl: 0,
};
const noop = () => {};

describe('AppraiseModal (#2e)', () => {
  it('avant le jet : bouton Lancer + nom de l’objet', () => {
    const html = renderToStaticMarkup(
      <AppraiseModalView pa={base} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toMatch(/Lancer/);
    expect(html).toContain('Épée mystérieuse');
  });

  it('après une réussite : « révélé » + bouton Appliquer', () => {
    const pa: PendingAppraise = { ...base, roll: 20, success: true, sl: 2 };
    const html = renderToStaticMarkup(
      <AppraiseModalView pa={pa} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toContain('révélé');
    expect(html).toMatch(/Appliquer/);
  });
});
