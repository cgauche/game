/**
 * MapCanvas (#343-C) — la primitive de carte SVG rend les MARQUEURS et les TRACÉS fournis en DONNÉE,
 * et route les clics via des cibles FIABLES : chaque tracé cliquable porte une zone de clic invisible
 * large (`pointer-events:stroke`), le fond n'intercepte jamais le pointeur (`pointer-events:none`).
 * Environnement `node` (vite.config) → rendu SSR statique.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapCanvas, type MapMarker, type MapPath } from './MapCanvas';

const fit = () => ({ z: 1, panX: 0, panY: 0 });
const noop = () => {};

describe('MapCanvas — rendu data-driven des marqueurs/tracés et routage des clics', () => {
  it('rend chaque MARQUEUR à sa position, avec son contenu fourni', () => {
    const markers: MapMarker[] = [
      { id: 'grunburg', x: 20, y: 30, onClick: noop, cursor: 'pointer', children: <text>Grünburg</text> },
      { id: 'eilhart', x: 60, y: 40, children: <text>Eilhart</text> },
    ];
    const html = renderToStaticMarkup(<MapCanvas computeFit={fit} markers={markers} />);
    expect(html).toContain('Grünburg');
    expect(html).toContain('Eilhart');
    expect(html).toContain('translate(20 30)'); // position portée par le marqueur
  });

  it('rend chaque TRACÉ ; un tracé cliquable a une zone de clic invisible LARGE, pas les autres', () => {
    const paths: MapPath[] = [
      { id: 'route', d: 'M 0 0 L 10 10', onClick: noop, children: <path d="M 0 0 L 10 10" pointerEvents="none" /> },
      { id: 'decor', d: 'M 5 5 L 9 9', children: <path d="M 5 5 L 9 9" pointerEvents="none" /> },
    ];
    const html = renderToStaticMarkup(<MapCanvas computeFit={fit} paths={paths} />);
    // Cible de clic FIABLE : le tracé cliquable double son trait d'une zone invisible épaisse
    // (stroke=transparent + pointer-events=stroke), sans couleur codée en dur.
    expect(html).toContain('stroke="transparent"');
    expect(html).toContain('pointer-events="stroke"');
    // Exactement UNE zone de clic invisible (le décor non cliquable n'en a pas).
    expect((html.match(/pointer-events="stroke"/g) ?? []).length).toBe(1);
  });

  it('le FOND n\'intercepte jamais le pointeur (décor transparent tué)', () => {
    const html = renderToStaticMarkup(<MapCanvas computeFit={fit} background="bg.png" />);
    expect(html).toContain('bg.png');
    expect(html).toContain('pointer-events:none');
  });

  it('expose les commandes de zoom (zoom, dézoom, recentrer)', () => {
    const html = renderToStaticMarkup(<MapCanvas computeFit={fit} />);
    expect(html).toContain('aria-label="Zoomer"');
    expect(html).toContain('aria-label="Dézoomer"');
    expect(html).toContain('aria-label="Recentrer"');
  });

  it('un marqueur CLIQUABLE porte role="button" + aria-label + tabIndex ; un marqueur non cliquable, aucun de ces attributs', () => {
    const markers: MapMarker[] = [
      { id: 'grunburg', x: 20, y: 30, onClick: noop, label: 'Grünburg', children: <text>Grünburg</text> },
      { id: 'eilhart', x: 60, y: 40, children: <text>Eilhart</text> },
    ];
    const html = renderToStaticMarkup(<MapCanvas computeFit={fit} markers={markers} />);
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Grünburg"');
    expect(html).toContain('tabindex="0"');
    expect((html.match(/role="button"/g) ?? []).length).toBe(1);
  });

  it('un marqueur CLIQUABLE porte son anneau de focus maison (opacité pilotée par :focus-visible, jamais l\'outline UA) ; un marqueur non cliquable n\'en a pas', () => {
    const markers: MapMarker[] = [
      { id: 'grunburg', x: 20, y: 30, onClick: noop, label: 'Grünburg', children: <text>Grünburg</text> },
      { id: 'eilhart', x: 60, y: 40, children: <text>Eilhart</text> },
    ];
    const html = renderToStaticMarkup(<MapCanvas computeFit={fit} markers={markers} />);
    expect(html).toContain('class="map-marker-focus-ring"');
    expect((html.match(/map-marker-focus-ring/g) ?? []).length).toBe(1);
    // Pas d'outline UA écrit inline — la suppression vit dans la CSS scopée au composant.
    expect(html).not.toMatch(/style="[^"]*outline/);
  });
});
