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

describe('ResilienceButton — pool, le BOUTON porte sa règle (#945, #1078)', () => {
  it('libellé « Résilience ×N », et AUCUN ⓘ voisin : c’est le bouton qui porte la règle', () => {
    const html = renderToStaticMarkup(<ResilienceButton resilience={2} show onForce={noop} />);
    expect(html).toContain('Résilience ×2');
    // L'affordance parallèle est MORTE (#1078) : plus d'icône info à côté du bouton.
    expect(html).not.toContain('ab-codex-info');
    expect(html).not.toContain('journal/info');
    // Le `CodexRef` englobant (`wrap`) ne prend AUCUNE interaction : un seul contrôle cliquable,
    // le bouton de dépense — jamais deux actions sur le même clic.
    expect(html).toContain('codex-ref');
    expect(html).not.toContain('role="button"');
    // Forme n/m RÉSERVÉE à la progression (DrBar) — jamais sur un pool.
    expect(html).not.toContain('2/2');
  });

  it('sans Résilience ou hors condition d’échec : rien à l’écran (ni bouton ni affordance)', () => {
    expect(renderToStaticMarkup(<ResilienceButton resilience={0} show onForce={noop} />)).toBe('');
    expect(renderToStaticMarkup(<ResilienceButton resilience={2} show={false} onForce={noop} />)).toBe('');
  });

  it('survoler le bouton donne la RÈGLE « Je ne faillirai pas ! » ; le clic DÉPENSE, il n’ouvre rien', () => {
    let spent = 0;
    act(() => root.render(<ResilienceButton resilience={2} show onForce={() => { spent += 1; }} />));
    const btn = host.querySelector<HTMLElement>('button')!;
    act(() => { btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const pop = document.querySelector('.codex-pop');
    expect(pop, 'le survol du bouton doit rendre la règle').toBeTruthy();
    expect(pop!.textContent).toContain('Je ne faillirai pas');
    // UN SEUL effet au clic : la dépense. Le Codex ne s'ouvre pas par-dessus la modale de jet.
    act(() => btn.click());
    expect(spent).toBe(1);
    expect(useGame.getState().codexOverlay).toBeNull();
    act(() => { btn.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); }); // referme (React démonte le portal)
  });

  it('CLAVIER : focus bouton → ↓ → « Ouvrir la fiche » activée → le Codex s’ouvre sur la RÈGLE', () => {
    act(() => root.render(<ResilienceButton resilience={2} show onForce={noop} />));
    const btn = host.querySelector<HTMLButtonElement>('button')!;
    // 1. Le focus du contrôle rend la règle (aucun survol requis — chemin clavier pur).
    act(() => { btn.focus(); btn.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
    expect(document.querySelector('.codex-pop'), 'le focus doit rendre la règle').toBeTruthy();
    // 2. ↓ épingle le popover et y porte le focus : la PORTE est atteignable au clavier bien que le
    //    portal vive en fin de <body> (hors ordre de Tab).
    act(() => { btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    const porte = document.querySelector<HTMLButtonElement>('.codex-pop .codex-pop-open')!;
    expect(porte, '« Ouvrir la fiche » doit être un contrôle réel').toBeTruthy();
    expect(porte.tagName).toBe('BUTTON');
    expect(document.activeElement).toBe(porte);
    // 3. L'activer ouvre la fiche de la RÈGLE dépensée (pas la caractéristique Résilience).
    act(() => porte.click());
    expect(useGame.getState().codexOverlay).toMatchObject({ category: 'regles', id: 'je-ne-faillirai-pas' });
    // …et le popover s'est refermé derrière elle.
    expect(document.querySelector('.codex-pop')).toBeNull();
  });

  it('la PORTE est dans le popover, JAMAIS sur le contrôle : le déclencheur n’est pas cliquable', () => {
    act(() => root.render(<ResilienceButton resilience={2} show onForce={noop} />));
    const wrapper = host.querySelector('.codex-ref')!;
    expect(wrapper.getAttribute('role')).toBeNull();
    expect(wrapper.getAttribute('tabindex')).toBeNull();
    // Cliquer la surface englobante n'ouvre rien (elle n'intercepte aucune interaction).
    act(() => (wrapper as HTMLElement).click());
    expect(useGame.getState().codexOverlay).toBeNull();
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
