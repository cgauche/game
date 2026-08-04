// @vitest-environment jsdom
/**
 * ResilienceButton — forme de bouton de POOL (#945) : « Résilience ×N restants » + affordance Codex,
 * comme Chance et Détermination. L'affordance ouvre la RÈGLE dépensée, « Je ne faillirai pas ! »
 * (LDB 17 l.68), entrée `regles`/`je-ne-faillirai-pas` — pas la caractéristique Résilience.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { regles } from '../data';
import { ResilienceButton } from './ResilienceButton';

const noop = () => {};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useGame.setState({ screen: 'party', codexOverlay: null, compendiumFocus: null });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('ResilienceButton — pool + affordance Codex (#945)', () => {
  it('libellé « Résilience ×N » ET affordance Codex cliquable à côté', () => {
    const html = renderToStaticMarkup(<ResilienceButton resilience={2} show onForce={noop} />);
    expect(html).toContain('Résilience ×2');
    // L'affordance est une VRAIE porte : elle ouvre la fiche (déclencheur cliquable/focusable).
    expect(html).toContain('ab-codex-info');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    // Forme n/m RÉSERVÉE à la progression (DrBar) — jamais sur un pool.
    expect(html).not.toContain('2/2');
  });

  it('sans Résilience ou hors condition d’échec : rien à l’écran (ni bouton ni affordance)', () => {
    expect(renderToStaticMarkup(<ResilienceButton resilience={0} show onForce={noop} />)).toBe('');
    expect(renderToStaticMarkup(<ResilienceButton resilience={2} show={false} onForce={noop} />)).toBe('');
  });

  it('cliquer l’affordance ouvre la RÈGLE « Je ne faillirai pas ! », pas la caractéristique', () => {
    act(() => root.render(<ResilienceButton resilience={2} show onForce={noop} />));
    const codex = host.querySelector<HTMLElement>('.ab-codex-info');
    expect(codex, 'affordance Codex absente').toBeTruthy();
    act(() => codex!.click());
    expect(useGame.getState().codexOverlay).toMatchObject({ category: 'regles', id: 'je-ne-faillirai-pas' });
  });

  it('les DEUX choix de Résilience sont au catalogue, un par entrée, texte VERBATIM du Source', () => {
    const faillir = regles.find((x) => x.id === 'je-ne-faillirai-pas');
    const renie = regles.find((x) => x.id === 'je-te-renie');
    expect(faillir, 'entrée regles/je-ne-faillirai-pas absente').toBeTruthy();
    expect(renie, 'entrée regles/je-te-renie absente').toBeTruthy();
    // LDB 17 l.68 — le bullet SEUL, recollable tel quel dans le Source.
    expect(faillir!.desc).toBe(
      "- **Je ne faillirai pas ! :** au lieu de lancer les dés pour un Test, vous choisissez le résultat, ce qui vous permet de réussir, même dans les pires conditions. Si vous infligez un Coup Critique, vous pouvez choisir la Localisation atteinte, plutôt que de la laisser au hasard. S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1. Vous pouvez même faire ce choix après un Test qui a échoué.",
    );
    // LDB 17 l.67 — l'autre choix, sa PROPRE entrée (`resolveRenounce` le joue).
    expect(renie!.desc).toBe(
      '- **Je te renie ! :** vous pouvez choisir de ne pas développer la mutation obtenue. Et comme vous ne mutez pas, vous ne perdez aucun Point de Corruption. Voir Corruption à la page 182 pour en savoir plus.',
    );
    for (const r of [faillir!, renie!]) {
      expect(r.source).toMatchObject({ book: 'livre-de-base', page: 171 });
    }
  });
});
