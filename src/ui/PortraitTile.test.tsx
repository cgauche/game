import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortraitTile } from './PortraitTile';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

const base = () => createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Gunnar', rng: makeRNG(3) });

describe('PortraitTile', () => {
  it('jauge verticale : pleine et verte à PV max', () => {
    const c = base();
    c.wounds = { current: 12, max: 12 };
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain('ptile-gauge');
    expect(html).toContain('height:100%');
    expect(html).toContain('#2ecc71'); // hpColor(1) — vert sain
  });

  it('jauge rouge en zone critique (≤34 %)', () => {
    const c = base();
    c.wounds = { current: 3, max: 12 }; // ratio 0.25
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain('height:25%');
    expect(html).toContain('#e74c3c'); // hpColor critique
  });

  it('PV chiffrés DANS le portrait seulement si showPv', () => {
    const c = base();
    c.wounds = { current: 11, max: 11 };
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" showPv />)).toContain('11/11');
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />)).not.toContain('11/11');
  });

  it('≤ 4 états visibles puis chevron ▾', () => {
    const c = base();
    c.conditions = [
      { name: 'Sonné', value: 1 }, { name: 'À Terre', value: 1 }, { name: 'Aveuglé', value: 1 },
      { name: 'Empoisonné', value: 2 }, { name: 'Hémorragique', value: 1 },
    ] as Combatant['conditions'];
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain('💫'); // Sonné (sévérité max → 1er)
    expect(html).toContain('▾'); // 5 états → 4 + débordement
    expect(html).not.toContain('🩸'); // Hémorragique (sévérité min) débordé
    // 2 états → pas de chevron
    c.conditions = [{ name: 'Sonné', value: 1 }, { name: 'À Terre', value: 1 }] as Combatant['conditions'];
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />)).not.toContain('▾');
  });

  it('KO : croix + classe ko ; actif : classe active + caret', () => {
    const c = base();
    c.wounds = { current: 0, max: 12 };
    const ko = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(ko).toContain('ko-cross');
    expect(ko).toContain('✕');
    const c2 = base();
    const act = renderToStaticMarkup(<PortraitTile c={c2} ring="#4f8fe0" active />);
    expect(act).toContain('active');
    expect(act).toContain('▼');
  });
});
