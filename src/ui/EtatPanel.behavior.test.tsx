// @vitest-environment jsdom
/**
 * Comportement RÉEL (clic) du registre État, en complément des tests SSR (`EtatPanel.test.tsx`,
 * `renderToStaticMarkup` — aucun clic). LOT L pt.3(b) : le clic-épingle du popover `CodexRef`
 * (`tooltipOnly`, geste D) fonctionne-t-il TOUJOURS sur les lignes du registre après la refonte
 * LOT K ? Patron réel du repo pour les tests clic/clavier interactifs (`createRoot`/`act`/
 * `dispatchEvent` — `@testing-library` n'est PAS une dépendance, cf. `career-talent-roving.test.tsx`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Combatant } from '../engine/types';
import { EtatPanel } from './EtatPanel';
import { ETAT_ANCHOR_CRITIQUES } from './sheetAlarms';
import { useGame } from '../state/store';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const mkHero = (mut?: (c: Combatant) => void): Combatant => {
  const c = {
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'humains-reiklander',
    career: 'soldat',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    conditions: [{ name: 'assourdi', value: 1 } as never],
    skills: [],
    talents: [],
    movement: 4,
    items: [],
  } as unknown as Combatant;
  mut?.(c);
  return c;
};

describe('EtatPanel — comportement clic (LOT L pt.3)', () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount() {
    useGame.setState({ codexOverlay: null, screen: 'menu' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<EtatPanel hero={mkHero()} />); });
  }

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    useGame.setState({ codexOverlay: null, screen: 'menu' });
  });

  it('3(a) — les ids etat-* du DOM existent (absence de la rubrique Critiques, présence de la rubrique États actives) : ne vérifie QUE l’existence, pas le comportement de clic (couvert par 3(b)/2 ci-dessous)', () => {
    mount();
    // `ETAT_ANCHOR_CRITIQUES` = MÊME constante que consomme `sheetAlarms()` — l'ancre cliquée par
    // la bande d'alarmes doit exister sur CETTE bande de section (pas de dérive post-refonte LOT K).
    expect(document.getElementById(ETAT_ANCHOR_CRITIQUES)).toBeNull(); // pas de critique ici (héros sain de critiques)
    expect(document.getElementById('etat-etats')).not.toBeNull();
  });

  it('3(b) — clic-épingle du popover CodexRef (tooltipOnly) sur une ligne du registre : bascule aria-expanded + montre le popover', () => {
    mount();
    const trigger = container.querySelector('#etat-etats .codex-ref') as HTMLElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => { trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.codex-pop')).not.toBeNull();
    // Un 2e clic (toggle) referme.
    act(() => { trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('2 — bande cliquable : le titre de section (États actifs) ouvre RÉELLEMENT le Codex sur SA catégorie', () => {
    mount();
    const titleBtn = container.querySelector('#etat-etats .creator-band-title-link') as HTMLButtonElement;
    expect(titleBtn).not.toBeNull();
    expect(titleBtn.tagName).toBe('BUTTON');
    expect(useGame.getState().codexOverlay).toBeNull();
    act(() => { titleBtn.click(); });
    // Store OBSERVÉ (pas seulement l'affordance) : le clic pose bien `codexOverlay` sur la catégorie
    // « etats », id vide (liste de catégorie, pas d'entrée présélectionnée).
    expect(useGame.getState().codexOverlay).toEqual({ category: 'etats', id: '' });
  });
});
