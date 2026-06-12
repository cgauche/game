/**
 * Récapitulatif de voyage (audit M4/M5) : la modale raconte le segment (jours, péripéties) et
 * relance la carte (« Continuer le voyage »). Rendu statique via seam (store SSR = état initial).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TravelRecapModal } from './TravelRecapModal';
import type { TravelRecap } from '../state/travelFlow';

const base: TravelRecap = {
  fromLabel: 'Weiler', toLabel: 'Federholz', mode: 'pied', status: 'arrived',
  km: 24, kmDone: 24,
  days: [
    { kmFrom: 0, kmTo: 24, hours: 6, lines: ['Péripétie : Un colporteur partage la route.'] },
  ],
};

describe('TravelRecapModal', () => {
  it('arrivée : itinéraire, journées numérotées, péripéties, « Continuer le voyage »', () => {
    const html = renderToStaticMarkup(<TravelRecapModal seam={base} />);
    expect(html).toContain('Arrivée à Federholz');
    expect(html).toContain('24 km en 6 h de route');
    expect(html).toContain('colporteur');
    expect(html).toContain('Continuer le voyage');
  });

  it('interruption : km restants + reprise par la carte', () => {
    const html = renderToStaticMarkup(<TravelRecapModal seam={{ ...base, status: 'interrupted', kmDone: 10, days: [{ kmFrom: 0, kmTo: 10, hours: 2.5, lines: ['Péripétie : Brigands !'] }] }} />);
    expect(html).toContain('Voyage interrompu');
    expect(html).toContain('14 km restants');
    expect(html).toContain('reprendre depuis la carte');
    expect(html).toContain('Ouvrir la carte');
  });

  it('surcharge : « stalled » explique comment repartir', () => {
    const html = renderToStaticMarkup(<TravelRecapModal seam={{ ...base, status: 'stalled', kmDone: 0, days: [] }} />);
    expect(html).toContain('convoi s&#x27;arrête');
    expect(html).toContain('allégez les sacs');
  });
});
