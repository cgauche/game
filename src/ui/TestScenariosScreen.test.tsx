import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestScenariosScreen } from './TestScenariosScreen';
import { testScenarios } from '../scenes/test-scenarios';

/** Échappement HTML identique à React (renderToStaticMarkup) — pour comparer les titres tels que rendus
 *  (apostrophe → &#x27;, & → &amp;…). Le test DÉRIVE du registre `testScenarios` (source de vérité) au
 *  lieu de figer des titres : tout ajout/fusion/renommage de scénario reste couvert sans le casser. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

describe('TestScenariosScreen (rendu)', () => {
  const html = renderToStaticMarkup(<TestScenariosScreen />);

  it('liste CHAQUE scénario du registre (titre rendu)', () => {
    expect(testScenarios.length).toBeGreaterThan(0);
    for (const sc of testScenarios) expect(html).toContain(esc(sc.title));
  });

  it('un bouton « Lancer » par scénario', () => {
    const launches = html.match(/>Lancer</g)?.length ?? 0;
    expect(launches).toBe(testScenarios.length);
  });

  it('chaque bouton Lancer porte son ancrage de recette data-testid="scenario-launch-{id}" (#1335)', () => {
    for (const sc of testScenarios) expect(html).toContain(`data-testid="scenario-launch-${sc.id}"`);
  });

  it('expose le bouton Retour', () => {
    expect(html).toContain('Retour');
  });
});
