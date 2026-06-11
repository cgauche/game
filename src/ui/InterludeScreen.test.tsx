/**
 * Écran « Entre deux aventures » refondu (audit POC→produit 2026-06-11) : phase Événements,
 * Activités à SÉLECTEURS catalogue (fini la saisie du libellé exact — défauts B1/B2/B3),
 * clôture récapitulative confirmée (M3). Rendu statique : le store SSR sert l'état initial,
 * d'où le seam (même pattern que WorldMapView).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { fromBrass } from '../engine/money';
import { testScene } from '../scenes/test-fixture';
import { InterludeScreen, type InterludeSeam } from './InterludeScreen';

function buildSeam(weeks = 3): InterludeSeam {
  const a = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Vétéran', rng: makeRNG(1601) });
  a.xp = 300;
  const b = createHero({ speciesLabel: 'Nains', careerLabel: 'Artisan', name: 'Forgeron', rng: makeRNG(1602) });
  if (!b.skills.some((s) => /^métier/i.test(s.name))) b.skills.push({ name: 'Métier (Forgeron)', characteristic: 'Dex', advances: 10 });
  useGame.setState({ party: [a, b], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [], money: fromBrass(5000) });
  useGame.getState().startScene(testScene);
  vi.clearAllTimers();
  useGame.setState({ money: fromBrass(5000), screen: 'interlude' });
  useGame.getState().seedRng(7);
  useGame.getState().startInterlude(weeks);
  const s = useGame.getState();
  return { interlude: s.interlude!, party: s.party, money: s.money, bank: s.bank, pendingOrders: s.pendingOrders };
}

describe('InterludeScreen — refonte produit', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('ouvre sur la phase Événements : d100 raconté par héros + CTA vers les Activités', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={seam} />);
    expect(html).toContain('Entre deux aventures');
    expect(html).toContain('Vétéran');
    expect(html).toContain('Événement'); // hint de phase
    expect(html).toContain('Passer aux Activités');
    expect(html).not.toContain('Clore'); // pas de clôture sur la phase d'intro
  });

  it('Activités : sélecteurs catalogue (B1/B2/B3) — Revenus avec formule, volets par héros', () => {
    const seam = buildSeam();
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'activities' }} />);
    // plus AUCUNE saisie de libellé exact héritée du POC
    expect(html).not.toContain('nom exact');
    // les 4 volets d'Activité et la formule de Revenus (« N × 2d10 sous »…) sont affichés
    expect(html).toContain('Artisanat…');
    expect(html).toContain('Apprentissage…');
    expect(html).toContain('Commande…');
    expect(html).toContain('Banque…');
    expect(html).toMatch(/Revenus.*\d ×/);
    // pips d'Activités restantes
    expect(html).toContain('●');
    expect(html).toContain('Clore l&#x27;interlude…');
  });

  it('clôture : récapitulatif confirmé (argent gaspillé annoncé, temps qui passe)', () => {
    const seam = buildSeam(2);
    const html = renderToStaticMarkup(<InterludeScreen seam={{ ...seam, phase: 'closing' }} />);
    expect(html).toContain('Clore l&#x27;interlude ?');
    expect(html).toContain('Argent à gaspiller');
    expect(html).toContain('14 jours');
    expect(html).toContain('Pas encore'); // annulable
  });
});
