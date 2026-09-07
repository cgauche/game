// @vitest-environment jsdom
/**
 * Smoke-test (#412, bug utilisateur 2026-07-14 verbatim : « Une erreur d'affichage est survenue »)
 * — complément de la garde d'exhaustivité `gallery-exhaustive.test.ts` : EXISTER dans le registre ne
 * suffit pas, RENDRE est le contrat. Monte `DesignGallery` ET chaque spécimen de `GALLERY_SPECIMENS`
 * ISOLÉMENT (render + unmount, jsdom) — toute entrée dont le rendu THROW échoue nominativement, sans
 * attendre un rapport utilisateur en pleine partie (tsc/vitest ne montent jamais l'écran : la garde
 * de types ne voit pas un crash de rendu réel).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DesignGallery } from './DesignGallery';
import { GALLERY_SPECIMENS } from './registry';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function mount(node: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(node); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

describe('#412 — galerie design system : rendu réel (jsdom), zéro throw', () => {
  it('DesignGallery se monte sans exception', () => {
    expect(() => mount(<DesignGallery />)).not.toThrow();
    expect(container.textContent).toContain("Design system");
  });

  for (const spec of GALLERY_SPECIMENS) {
    it(`spécimen « ${spec.label} » (${spec.file}) se monte sans exception`, async () => {
      const Render = spec.render;
      expect(() => mount(<Render />)).not.toThrow();
      // Un spécimen peut charger sa matière par PROMESSE (`DescRefField` : un chapitre du `Source/` par
      // son adresse-URL). Sans ce vidage, sa pose d'état retombe HORS `act` et la sentinelle du harnais
      // (`act hors act`) la compte, sur ce spécimen comme sur tout spécimen asynchrone à venir.
      await act(async () => {});
    });
  }
});
