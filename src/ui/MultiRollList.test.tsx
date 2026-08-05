import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MultiRollList } from './MultiRollList';
import type { NightEntry } from '../state/restFlow';

/**
 * PROCÈS-VERBAL multi-jets (`MultiRollList`) — surface de LECTURE : chaque ligne porte l'anatomie
 * canonique du jet, et les lignes CONSÉCUTIVES d'une même rubrique (`group` : les contributeurs d'un
 * même Test d'équipage) se rendent sous UNE bande titrée (`Band`) au lieu de répéter l'en-tête
 * (#1112 G5). Ce test décrit ce qui EST rendu (l'influence d'une ligne de PV après coup n'existe pas
 * aujourd'hui : c'est le périmètre de #1106).
 */
function d(over: Partial<import('../engine/combat').RollBreakdown>): import('../engine/combat').RollBreakdown {
  return { label: 'Voile', base: 55, modifier: 0, target: 55, roll: 95, success: false, sl: -4, ...over };
}

const entries: NightEntry[] = [
  { id: 'e1', label: 'Capitaine', group: 'Progression', icon: 'travel/anchor', d: d({}), tone: 'bad' },
  { id: 'e2', label: 'Timonier', group: 'Progression', icon: 'travel/anchor', d: d({ roll: 12, success: true, sl: 4 }), tone: 'ok' },
  { id: 'e3', label: 'Navigateur', group: 'Orientation', icon: 'travel/anchor', d: d({ label: 'Navigation', roll: 30, success: true, sl: 2 }), tone: 'ok' },
  { label: 'Note', text: 'jour 3/3' },
];

describe('MultiRollList — PV du jour : une bande par rubrique, une rangée par jet', () => {
  it('les lignes d’une MÊME rubrique se rendent sous UNE bande titrée (en-tête non répété)', () => {
    const html = renderToStaticMarkup(<MultiRollList entries={entries} />);
    expect(html.match(/creator-band-head/g) ?? []).toHaveLength(2); // 2 rubriques → 2 bandes
    expect(html.match(/Progression/g) ?? []).toHaveLength(1); // l'en-tête ne se répète pas
    expect(html).toContain('Orientation');
  });

  it('chaque contributeur garde SA rangée, nommée par sa provenance (rôle tenu)', () => {
    const html = renderToStaticMarkup(<MultiRollList entries={entries} />);
    expect(html.match(/mrl-row/g) ?? []).toHaveLength(4);
    for (const role of ['Capitaine', 'Timonier', 'Navigateur']) expect(html).toContain(role);
  });

  it('une ligne SANS rubrique reste rendue hors bande (note du jour)', () => {
    const html = renderToStaticMarkup(<MultiRollList entries={[{ label: 'Note', text: 'jour 3/3' }]} />);
    expect(html).not.toContain('creator-band-head');
    expect(html).toContain('jour 3/3');
  });

  it('un PV vide le dit', () => {
    expect(renderToStaticMarkup(<MultiRollList entries={[]} />)).toContain('Une nuit sans histoire.');
  });
});
