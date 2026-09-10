// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dims } from '../../geometry/iso';
import { emptyScene } from '../../state/scene';
import type { RoomPortal } from '../../state/roomPortals';
import { aretesUtilisables } from '../../state/aretes';
import { projeterAretes, type AreteProjetee } from './aretesProjetees';
import { DoorOverlays } from './DoorOverlays';

/**
 * CONTRAT DU PEINTRE (#1687, lot 1b-2). `DoorOverlays` ne prend plus le pointeur : la chaîne de picking
 * résout l'arête (`stage/pickResolve.ts:areteSousLePixel`) et lui tend son verdict. Lui restent SON
 * tracé — dont la parité avec la géométrie que le picking résout, tenue parce que le segment lui est
 * DONNÉ et jamais reprojeté — et l'activation AU CLAVIER, seule chose que la chaîne ne rend pas.
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dims: Dims = { w: 5, h: 4, rot: 0, view: 'iso' };
const interior: RoomPortal = {
  id: '0:1,1:E:room-a:room-b',
  z: 0,
  edge: { x: 1, y: 1, side: 'E' },
  fromZoneId: 'room-a',
  toZoneId: 'room-b',
  kind: 'passage',
  exterior: false,
  from: { x: 1, y: 1 },
  to: { x: 2, y: 1 },
};
const exterior: RoomPortal = {
  ...interior,
  id: '0:1,1:N:room-a:exterior',
  edge: { x: 1, y: 1, side: 'N' },
  toZoneId: null,
  kind: 'door-open',
  exterior: true,
  to: { x: 1, y: 0 },
};
const closed: RoomPortal = {
  ...interior,
  id: '0:2,1:E:room-b:room-c',
  edge: { x: 2, y: 1, side: 'E' },
  fromZoneId: 'room-b',
  toZoneId: 'room-c',
  kind: 'door-closed',
  from: { x: 2, y: 1 },
  to: { x: 3, y: 1 },
};

/** Ce que l'hôte tend au peintre : les arêtes du DÉRIVEUR, projetées par la MÊME fonction que le
 *  picking consulte — aucune géométrie n'est fabriquée pour le banc. */
const projete = (portails: RoomPortal[], visible: string[]): readonly AreteProjetee[] => projeterAretes(
  aretesUtilisables({ scene: emptyScene(dims.w, dims.h), visible: new Set(visible), controleur: null, activeZ: 0, portails }),
  dims,
  () => 0,
);

const lineLength = (line: Element): number => Math.hypot(
  Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
  Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
);

describe('DoorOverlays — peintre des seuils', () => {
  let root: Root | null = null;
  /** Conteneur ATTACHÉ au document (le focus n'existe que dans un arbre connecté) — détaché quoi
   *  qu'il arrive, y compris quand une assertion rompt le test. */
  let attache: HTMLElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    attache?.remove();
    attache = null;
  });

  it('distingue passage, porte et sortie sans peindre les labels de zones', () => {
    const html = renderToStaticMarkup(
      <svg>
        <DoorOverlays
          aretes={projete([interior, exterior], ['1,1,0', '2,1,0', '1,0,0'])}
          hoveredPortalId={null}
          activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined}
        />
      </svg>,
    );

    expect(html).toContain('portal-passage');
    expect(html).toContain('portal-exterior');
    expect(html).toContain('<title>Passage vers une autre pièce</title>');
    expect(html).toContain('<title>Sortie extérieure</title>');
    expect(html).not.toContain('room-a');
    expect(html).not.toContain('room-b');
  });

  it('n’expose AUCUNE cible de pointeur : le pixel du seuil est résolu par la chaîne', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <svg>
        <DoorOverlays
          aretes={projete([interior], ['1,1,0'])}
          hoveredPortalId={null}
          activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined}
        />
      </svg>,
    );

    const peints = [...container.querySelectorAll('line, path')];
    expect(peints.length).toBeGreaterThan(0);
    expect(peints.every((el) => el.getAttribute('pointer-events') === 'none')).toBe(true);
  });

  it('expose un bouton nommé et activable au clavier, qui appelle LE geste de l’arête', () => {
    const activerArete = vi.fn();
    const aretes = projete([interior], ['1,1,0']);
    const container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(
      <svg>
        <DoorOverlays aretes={aretes} hoveredPortalId={null} activerArete={activerArete} onFocusArete={() => undefined} onBlurArete={() => undefined} />
      </svg>,
    ));
    const target = container.querySelector('[data-portal-arete]')!;

    expect(target.getAttribute('role')).toBe('button');
    expect(target.getAttribute('aria-label')).toBe('Passage vers une autre pièce');
    expect(target.getAttribute('tabindex')).toBe('0');
    act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })));

    expect(activerArete.mock.calls).toEqual([[aretes[0].arete], [aretes[0].arete]]);
  });

  it('au FOCUS clavier, le seuil atteint porte l’accent — et le perd au blur', () => {
    // Le seuil est un trait TRANSPARENT sans contour de navigateur : son rendu de focus EST l'accent
    // du survol, posé par le même état que le pointeur (`hoveredPortalId`). Sans ce canal, le Tab
    // n'affiche rien et le geste n'est pas armé (deux Entrée sur un appareil sans survol).
    const aretes = projete([interior, exterior], ['1,1,0', '1,0,0']);
    function Harnais() {
      const [survole, setSurvole] = useState<string | null>(null);
      return (
        <svg>
          <DoorOverlays
            aretes={aretes}
            hoveredPortalId={survole}
            activerArete={() => undefined}
            onFocusArete={(arete) => setSurvole(arete.portail?.id ?? null)}
            onBlurArete={() => setSurvole(null)}
          />
        </svg>
      );
    }
    const container = document.createElement('div');
    attache = container;
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Harnais />));
    const cibles = [...container.querySelectorAll('[data-portal-arete]')] as SVGElement[];
    const accents = () => [...container.querySelectorAll('[data-portal-visual="accent"]')];
    const nomAccentué = () => container.querySelector('.portal-highlight [data-portal-arete]')?.getAttribute('aria-label') ?? null;

    expect(cibles).toHaveLength(2);
    expect(accents(), 'rien n’est accentué tant que rien n’est atteint').toHaveLength(0);

    act(() => cibles[1].focus());
    expect(accents(), 'le seuil focalisé porte l’accent').toHaveLength(1);
    expect(nomAccentué()).toBe(aretes[1].arete.libelle);

    act(() => cibles[1].blur());
    expect(accents(), 'quitté, il le perd').toHaveLength(0);
  });

  it('trace l’arête à la LARGEUR DE PRISE du dériveur, et sur le segment qu’il a reçu', () => {
    const aretes = projete([interior], ['1,1,0']);
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <svg>
        <DoorOverlays aretes={aretes} hoveredPortalId={null} activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined} />
      </svg>,
    );
    const target = container.querySelector('[data-portal-arete]')!;

    expect(Number(target.getAttribute('stroke-width'))).toBe(aretes[0].arete.largeurPrise);
    expect([
      Number(target.getAttribute('x1')), Number(target.getAttribute('y1')),
      Number(target.getAttribute('x2')), Number(target.getAttribute('y2')),
    ]).toEqual([aretes[0].a.cx, aretes[0].a.cy, aretes[0].b.cx, aretes[0].b.cy]);
  });

  it('limite les marqueurs passifs au milieu du seuil sans ligne visible pleine arête', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <svg>
        <DoorOverlays
          aretes={projete([interior, exterior, closed], ['1,1,0', '2,1,0', '3,1,0'])}
          hoveredPortalId={null}
          activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined}
        />
      </svg>,
    );
    const targets = [...container.querySelectorAll('[data-portal-arete]')];
    const passiveLines = [...container.querySelectorAll('[data-portal-visual="passive"]')];

    expect(targets).toHaveLength(3);
    expect(targets.every((target) => target.getAttribute('stroke') === 'transparent')).toBe(true);
    expect(passiveLines.length).toBeGreaterThanOrEqual(3);
    expect(passiveLines.every((line) => lineLength(line) <= 12)).toBe(true);
    expect(passiveLines.every((line) => Number(line.getAttribute('stroke-width')) <= 2)).toBe(true);
    expect(passiveLines.every((line) => Number(line.getAttribute('opacity')) <= 0.38)).toBe(true);
    expect(container.querySelector('[data-portal-symbol="closed"]')).not.toBeNull();
    const exteriorSymbol = container.querySelector('[data-portal-symbol="exterior"]');
    expect(exteriorSymbol).not.toBeNull();
    expect(exteriorSymbol?.getAttribute('fill')).toBe('none');
  });

  it('ajoute au seul seuil survolé un accent local et modeste', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <svg>
        <DoorOverlays
          aretes={projete([interior, exterior], ['1,1,0'])}
          hoveredPortalId={exterior.id}
          activerArete={() => undefined} onFocusArete={() => undefined} onBlurArete={() => undefined}
        />
      </svg>,
    );
    const accents = [...container.querySelectorAll('[data-portal-visual="accent"]')];

    expect(container.querySelectorAll('.portal-highlight')).toHaveLength(1);
    expect(accents).toHaveLength(1);
    expect(lineLength(accents[0])).toBeLessThanOrEqual(18);
    expect(Number(accents[0].getAttribute('stroke-width'))).toBeLessThanOrEqual(3.5);
    expect(Number(accents[0].getAttribute('opacity'))).toBeLessThanOrEqual(0.95);
  });
});
