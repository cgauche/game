// @vitest-environment jsdom
/**
 * PIÈGE À FOCUS d'une modale de jet, monté pour de VRAI (`RollShell` → `Modal` → `RollRow`) : un
 * contrôle focalisé que la transition d'état DÉMONTE (« Résilience ×N » cède la place au sélecteur de
 * dé, « Lancer » cède la place au résultat) laissait le focus sur `<body>` — la tabulation suivante
 * s'échappait de la boîte vers l'arrière-plan (bug de recette navigateur). Le focus doit rester DANS
 * la boîte, sur le groupe révélé.
 * Patron réel du repo pour les tests interactifs : `createRoot`/`act` (pas de `@testing-library`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RollShell } from './RollShell';
import { testPending } from './breakdown';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

// jsdom n'a AUCUN moteur de layout : `getClientRects()` y rend une liste vide pour tout élément, ce
// qui rendrait invisible chaque focusable au filtre de `Modal`. On rend une boîte non nulle aux
// éléments attachés au document — la seule chose que le filtre mesure vraiment en navigateur.
const realRects = HTMLElement.prototype.getClientRects;
beforeAll(() => {
  HTMLElement.prototype.getClientRects = function () {
    const rect = { x: 0, y: 0, width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, toJSON: () => ({}) } as DOMRect;
    return (this.isConnected ? [rect] : []) as unknown as DOMRectList;
  };
});
afterAll(() => { HTMLElement.prototype.getClientRects = realRects; });

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** Le PORTRAIT d'arrière-plan (HUD) : la cible qu'attrapait la tabulation évadée. */
function backgroundButton(): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = 'Portrait HUD';
  document.body.appendChild(b);
  return b;
}

/**
 * Modale de jet MINIMALE mais réelle : la rangée pré-jet porte « Résilience ×2 » et « Lancer »
 * (hissé par la coquille), et la transition (`forced`) révèle le sélecteur de dé + la barre post-jet
 * — exactement le basculement du store en jeu.
 */
function Harness({ picker }: { picker: boolean }) {
  const [rolled, setRolled] = useState(false);
  return (
    <RollShell
      title="Jet"
      rolled={rolled}
      rows={[{
        row: { pending: testPending('Corps à corps', 45) },
        rolled,
        interactive: true,
        resilience: 2,
        rollFrisson: false,
        onRoll: () => setRolled(true),
        onForce: () => setRolled(true),
        preRollForce: () => setRolled(true),
        forcedRoll: picker && rolled ? { roll: 5, target: 45, onSet: () => {} } : undefined,
      }]}
      actions={[
        { key: 'cancel', label: 'Annuler', when: 'pre', onClick: () => {} },
        { key: 'apply', label: 'Appliquer', when: 'post', onClick: () => {} },
      ]}
    />
  );
}

const box = () => host.querySelector('[role="dialog"]') as HTMLElement;
const byText = (txt: string) =>
  [...host.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(txt))!;

async function render(picker: boolean) {
  await act(async () => { root.render(<Harness picker={picker} />); });
}

describe('modale de jet — le focus ne tombe jamais sur <body> quand un contrôle est démonté', () => {
  it('« Résilience ×N » activé : le focus passe DANS le groupe de choix révélé (sélecteur de dé)', async () => {
    const bg = backgroundButton();
    await render(true);
    const resil = byText('Résilience ×2');
    act(() => { resil.focus(); });
    expect(document.activeElement).toBe(resil);

    await act(async () => { resil.click(); });

    const group = host.querySelector('.rm-die-pick') as HTMLElement;
    expect(group, 'le groupe de choix du dé doit être révélé').not.toBeNull();
    expect(document.activeElement, 'focus tombé sur <body> : le piège Tab est rompu').not.toBe(document.body);
    expect(group.contains(document.activeElement)).toBe(true);
    expect(bg.contains(document.activeElement)).toBe(false);
    bg.remove();
  });

  it('« Lancer » activé (sans Résilience) : le focus reste dans la boîte, sur l’action primaire révélée', async () => {
    await render(false);
    const lancer = byText('Lancer');
    act(() => { lancer.focus(); });
    expect(document.activeElement).toBe(lancer);

    await act(async () => { lancer.click(); });

    expect(document.activeElement).not.toBe(document.body);
    expect(box().contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLElement).textContent).toContain('Appliquer');
  });
});
