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

  it('#1064 — Soutien (LDB 12) : chip NOMMÉE et base rebasée, avant comme après le jet', () => {
    const pa: PendingAppraise = { ...base, skillValue: 65, target: 65, support: { count: 2, bonus: 20, ids: ['h2', 'h3'] } };
    const pre = renderToStaticMarkup(
      <AppraiseModalView pa={pa} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(pre).toContain('Soutien');
    expect(pre).toContain('+20 Soutien');
    expect(pre).toContain('45'); // base RÉELLE du meneur (65 − 20), plus une valeur qui tombe du ciel
    const post = renderToStaticMarkup(
      <AppraiseModalView pa={{ ...pa, roll: 20, success: true, sl: 2 }} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(post).toContain('+20 Soutien'); // le détail SURVIT au jet (pile le moment où on lit son résultat)
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
