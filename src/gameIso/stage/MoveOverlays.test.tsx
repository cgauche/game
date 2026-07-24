import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Dims } from '../../geometry/iso';
import { ExplorePathPreview } from './MoveOverlays';

const dims: Dims = { w: 8, h: 8, rot: 0, view: 'iso' };
const path = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 4, y: 0 },
  { x: 5, y: 0 },
];

describe('ExplorePathPreview', () => {
  it('borne le tracé aux trois premiers pas et conserve le losange sur la destination réelle', () => {
    const html = renderToStaticMarkup(<ExplorePathPreview path={path} dims={dims} lift={() => 0} />);
    const points = html.match(/<polyline[^>]*points="([^"]+)"/)?.[1].split(' ');

    expect(points).toHaveLength(4);
    expect(html).toContain('M416,224 L448,240 L416,256 L384,240 Z');
  });

  it('ne rend aucun SVG pendant une marche', () => {
    expect(renderToStaticMarkup(<ExplorePathPreview path={path} dims={dims} lift={() => 0} walking />)).toBe('');
  });
});
