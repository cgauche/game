// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CodexRef } from './CodexRef';

const mount = (node: React.ReactElement) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
};

describe('CodexRef — Rules of Hooks (régression crash "Rendered fewer hooks than expected")', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('entrée ABSENTE du catalogue : rend le repli sans crash', () => {
    ({ container, root } = mount(
      <CodexRef category="creatures" id="id-bidon-absent-xyz" label="Bidon" />,
    ));
    expect(container.textContent).toContain('Bidon');
  });

  it('re-rendu TROUVÉ → ABSENT sur le même arbre : le nombre de Hooks ne varie pas', () => {
    ({ container, root } = mount(
      <CodexRef category="creatures" id="cheval" label="Cheval" />,
    ));
    expect(container.textContent).toContain('Cheval');

    expect(() => {
      act(() => {
        root.render(<CodexRef category="creatures" id="id-bidon-absent-xyz" label="Bidon" />);
      });
    }).not.toThrow();
    expect(container.textContent).toContain('Bidon');
  });
});

/**
 * #1117 (recette 2026-08-05, vécu 3 fois) — un popover de chip AFFICHÉ (survol/focus sous `wrap`,
 * fermeture différée par le pont de survol) restait à l'écran par-dessus le CTA de la modale de jet et
 * INTERCEPTAIT le clic sur « Continuer » ; Échap ne le fermait pas. La couverture d'origine (#1078 B3a
 * « Échap en couches ») ne visait que le popover ÉPINGLÉ — cas jamais couvert, pas régression.
 */
describe('CodexRef — Échap ferme le popover AFFICHÉ, pas seulement l’épinglé (#1117)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  /** Chip de RESSOURCE : `wrap` (le popover porte la seule porte vers la fiche, il est actionnable). */
  const chip = (
    <CodexRef category="talents" id="affable" label="Affable" wrap>
      <button type="button">Affable ×2</button>
    </CodexRef>
  );

  const pop = () => document.querySelector('.codex-pop');

  it('le popover affiché au survol se ferme sur Échap', () => {
    ({ container, root } = mount(chip));
    const trigger = container.querySelector('.codex-ref') as HTMLElement;
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(pop(), 'le survol affiche le popover').toBeTruthy();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(pop(), 'Échap le ferme — il ne peut plus recouvrir le CTA').toBeNull();
  });

  it('sans popover affiché, Échap ne fait rien ici (la modale garde sa couche)', () => {
    ({ container, root } = mount(chip));
    expect(pop()).toBeNull();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(pop()).toBeNull();
  });
});

/**
 * #1117 — les deux CHEMINS distincts du popover, chacun sa preuve :
 *  - ÉPINGLÉ (le focus est parti DANS le popover) : Échap doit RENDRE le focus au contrôle englobé ;
 *  - NON épinglé : le popover ne doit JAMAIS voler le clic d'un bouton situé sous lui — c'est le
 *    symptôme vécu 3 fois en recette (« Continuer » injoignable).
 */
describe('CodexRef — chemin ÉPINGLÉ et interception de clic (#1117)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  const chip = (
    <CodexRef category="talents" id="affable" label="Affable" wrap>
      <button type="button">Affable ×2</button>
    </CodexRef>
  );

  it('ÉPINGLÉ (↓ depuis le contrôle) : Échap referme ET rend le focus au contrôle englobé', () => {
    ({ container, root } = mount(chip));
    const trigger = container.querySelector('.codex-ref') as HTMLElement;
    const inner = container.querySelector('.codex-ref button') as HTMLButtonElement;
    act(() => { trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.querySelector('.codex-pop'), 'le popover est épinglé').toBeTruthy();
    expect(document.activeElement, 'le focus est ENTRÉ dans le popover (sa porte)').not.toBe(inner);
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.querySelector('.codex-pop'), 'Échap referme l’épinglé').toBeNull();
    expect(document.activeElement, 'le focus REVIENT au contrôle, jamais dans le vide').toBe(inner);
  });

  it('NON épinglé : un bouton SOUS le popover reçoit bien le clic (plus d’interception)', () => {
    ({ container, root } = mount(
      <>
        {chip}
        <button type="button" id="continuer">Continuer</button>
      </>,
    ));
    const trigger = container.querySelector('.codex-ref') as HTMLElement;
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const pop = document.querySelector('.codex-pop') as HTMLElement;
    expect(pop, 'le popover est affiché (survol)').toBeTruthy();
    // Le clic part sur le CTA : il ne doit pas être capté par la surface du popover restée ouverte.
    let clicked = 0;
    const cta = container.querySelector('#continuer') as HTMLButtonElement;
    cta.addEventListener('click', () => { clicked++; });
    act(() => { cta.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    act(() => { cta.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(clicked, 'le CTA a reçu son clic').toBe(1);
    // Et le `mousedown` hors popover l'a refermé : la surface ne reste pas au-dessus du CTA.
    expect(document.querySelector('.codex-pop')).toBeNull();
  });
});

/**
 * RAISON D'UN REFUS (arbitrage user 2026-08-24) — l'infobulle partagée la porte, donc elle doit être
 * ATTEIGNABLE par les trois entrées : souris (survol), clavier/manette (focus RÉEL du contrôle, pas un
 * événement forgé), et DOIGT (un tap MONTRE la raison — le contrôle refusé n'agit pas). Et la boîte de
 * SECOURS (`fallback` sans entrée au catalogue) reste, elle, atteignable au pointeur : sans quoi son
 * contenu serait affiché mais inaccessible.
 */
describe('CodexRef — la raison d’un refus s’atteint au survol, au FOCUS et au TAP', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  /** Un contrôle REFUSÉ tel que `GatedAction` le rend : `aria-disabled` (pas `disabled`), donc
   *  focalisable — enveloppé de l'infobulle qui porte sa raison. */
  const refuse = (
    <CodexRef label="Charger" refus="Vous êtes Engagé." wrap>
      <button type="button" aria-disabled="true">Charger</button>
    </CodexRef>
  );
  const raison = () => document.querySelector('.codex-pop [data-refus]')?.textContent ?? null;

  it('FOCUS RÉEL du contrôle (clavier, manette) : la raison s’ouvre, le blur la referme', () => {
    ({ container, root } = mount(refuse));
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled, 'un contrôle `disabled` ne prendrait JAMAIS le focus').toBe(false);
    act(() => { btn.focus(); });
    expect(document.activeElement, 'le contrôle refusé doit prendre le focus').toBe(btn);
    expect(raison(), 'le focus n’ouvre pas la raison').toBe('Vous êtes Engagé.');
    act(() => { btn.blur(); });
    expect(document.querySelector('.codex-pop'), 'le blur doit refermer').toBeNull();
  });

  it('TAP (aucun survol, aucun focus préalable) : le clic MONTRE la raison au lieu d’agir', () => {
    let agi = 0;
    ({ container, root } = mount(
      <CodexRef label="Charger" refus="Vous êtes Engagé." wrap>
        <button type="button" aria-disabled="true" onClick={() => { agi += 1; }}>Charger</button>
      </CodexRef>,
    ));
    const btn = container.querySelector('button') as HTMLButtonElement;
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(raison(), 'au doigt, rien n’ouvrait la raison').toBe('Vous êtes Engagé.');
    // Le tap reste ÉPINGLÉ (il n'y a pas de survol au doigt pour la maintenir), et un 2ᵉ tap referme.
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.querySelector('.codex-pop')).toBeNull();
    expect(agi, 'le contrôle refusé n’a agi (son propre `onClick` est le no-op de l’appelant)').toBe(2);
  });

  it('boîte de SECOURS (`fallback` sous `wrap`) : elle reste atteignable au pointeur', () => {
    ({ container, root } = mount(
      <CodexRef category="trappings" id="arme-invoquee-xyz" label="Lame invoquée" wrap
        fallback={{ sub: 'invoquée', body: 'Profil temporaire.' }}>
        <button type="button">Lame invoquée</button>
      </CodexRef>,
    ));
    const trigger = container.querySelector('.codex-ref') as HTMLElement;
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const pop = document.querySelector('.codex-pop') as HTMLElement;
    expect(pop, 'le repli doit s’afficher').toBeTruthy();
    expect(pop.style.pointerEvents, 'une boîte affichée mais inatteignable au pointeur').toBe('auto');
    // … et le pont de survol la maintient le temps que le pointeur y arrive.
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); });
    expect(document.querySelector('.codex-pop'), 'le pont de survol ne tient pas').toBeTruthy();
  });
});
