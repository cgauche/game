// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dims } from '../../geometry/iso';
import type { RoomPortal } from '../../state/roomPortals';
import { DoorOverlays } from './DoorOverlays';

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

const lineLength = (line: Element): number => Math.hypot(
  Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
  Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
);

describe('DoorOverlays — affordances de portails', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
  });

  it('distingue passage, porte et sortie sans peindre les labels de zones', () => {
    const html = renderToStaticMarkup(
      <svg>
        <DoorOverlays
          portals={[interior, exterior]}
          dims={dims}
          activeZ={0}
          visible={new Set(['1,1,0', '2,1,0', '1,0,0'])}
          hoveredPortalId={null}
          lift={() => 0}
          onPortalHover={() => undefined}
          onPortalClick={() => undefined}
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

  it('fournit directement le portail ciblé au survol et au clic', () => {
    const onPortalHover = vi.fn();
    const onPortalClick = vi.fn();
    const container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(
      <svg>
        <DoorOverlays
          portals={[interior]}
          dims={dims}
          activeZ={0}
          visible={new Set(['1,1,0'])}
          hoveredPortalId={null}
          lift={() => 0}
          onPortalHover={onPortalHover}
          onPortalClick={onPortalClick}
        />
      </svg>,
    ));
    const target = container.querySelector('[data-portal-target]')!;

    act(() => target.dispatchEvent(new Event('pointerover', { bubbles: true })));
    act(() => target.dispatchEvent(new Event('pointerdown', { bubbles: true })));

    expect(onPortalHover).toHaveBeenCalledWith(interior);
    expect(onPortalClick).toHaveBeenCalledWith(interior);
  });

  it('expose un bouton nommé et activable au clavier', () => {
    const onPortalClick = vi.fn();
    const container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(
      <svg>
        <DoorOverlays
          portals={[interior]}
          dims={dims}
          activeZ={0}
          visible={new Set(['1,1,0'])}
          hoveredPortalId={null}
          lift={() => 0}
          onPortalHover={() => undefined}
          onPortalClick={onPortalClick}
        />
      </svg>,
    ));
    const target = container.querySelector('[data-portal-target]')!;

    expect(target.getAttribute('role')).toBe('button');
    expect(target.getAttribute('aria-label')).toBe('Passage vers une autre pièce');
    act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onPortalClick).toHaveBeenCalledWith(interior);
  });

  it('limite les marqueurs passifs au milieu du seuil sans ligne visible pleine arête', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <svg>
        <DoorOverlays
          portals={[interior, exterior, closed]}
          dims={dims}
          activeZ={0}
          visible={new Set(['1,1,0', '2,1,0', '3,1,0'])}
          hoveredPortalId={null}
          lift={() => 0}
          onPortalHover={() => undefined}
          onPortalClick={() => undefined}
        />
      </svg>,
    );
    const targets = [...container.querySelectorAll('[data-portal-target]')];
    const passiveLines = [...container.querySelectorAll('[data-portal-visual="passive"]')];

    expect(targets).toHaveLength(3);
    expect(targets.every((target) => target.getAttribute('stroke') === 'transparent')).toBe(true);
    expect(targets.every((target) => target.getAttribute('stroke-width') === '28')).toBe(true);
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
          portals={[interior, exterior]}
          dims={dims}
          activeZ={0}
          visible={new Set(['1,1,0'])}
          hoveredPortalId={exterior.id}
          lift={() => 0}
          onPortalHover={() => undefined}
          onPortalClick={() => undefined}
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
