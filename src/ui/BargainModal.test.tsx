import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BargainModalView } from './BargainModal';
import type { PendingBargain } from '../state/store';

const base: PendingBargain = {
  playerId: 'h',
  playerName: 'H',
  merchantName: 'Armurier',
  merchantValue: 45,
  playerSkill: 50,
  mode: 'buy',
  negotiator: false,
  roll: null,
  merchantRoll: null,
  result: null,
};

const noop = () => {};

describe('BargainModal (#2c)', () => {
  it('avant le jet : bouton Lancer + le marchand nommé', () => {
    const html = renderToStaticMarkup(
      <BargainModalView pb={base} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toMatch(/Lancer/);
    expect(html).toContain('Armurier'); // le marchand est nommé
    expect(html).not.toContain('45'); // … mais son Marchandage reste caché à l'ouverture
  });

  it('après un jet gagné : verdict « Gagné » + bouton Conclure', () => {
    const pb: PendingBargain = {
      ...base,
      roll: { roll: 20, target: 50, success: true, sl: 3, isDouble: false },
      merchantRoll: { roll: 60, target: 45, success: false, sl: -1, isDouble: false },
      result: {
        attacker: { roll: 20, target: 50, success: true, sl: 3, isDouble: false },
        defender: { roll: 60, target: 45, success: false, sl: -1, isDouble: false },
        winner: 'attacker',
        attackerWins: true,
        netSL: 4,
      },
    };
    const html = renderToStaticMarkup(
      <BargainModalView pb={pb} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toMatch(/Conclure/);
    expect(html).toContain('Gagné');
  });
});
