import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BodyToken } from './BodyToken';
import { tileCenter, LEVEL_H, type Dims } from './iso';

const dims: Dims = { w: 5, h: 5, view: 'top' };

describe('BodyToken — mode flat (disque)', () => {
  it('rend un disque clippé (cercle) au lieu du corps ancré aux pieds', () => {
    const html = renderToStaticMarkup(
      <svg>
        <BodyToken x={2} y={2} dims={dims} scale={0.6} flat portraitBox="42 28 38 38" discR={24} ring="#4f8fe0">
          <g data-bone="tete" />
        </BodyToken>
      </svg>,
    );
    expect(html).toContain('<clipPath');
    expect(html).toContain('<circle');
    expect(html).toContain('viewBox="42 28 38 38"');
    expect(html).not.toContain('rotate(78)'); // pas de bascule de mort en flat
  });

  it('en iso (non-flat) garde l’ancrage pieds (translate -150)', () => {
    const html = renderToStaticMarkup(
      <svg>
        <BodyToken x={2} y={2} dims={{ w: 5, h: 5 }} scale={0.6}>
          <g data-bone="tete" />
        </BodyToken>
      </svg>,
    );
    expect(html).toContain('translate(-36,-90)'); // -60*0.6 , -150*0.6
    expect(html).not.toContain('<clipPath');
  });
});

describe('BodyToken — étage (z)', () => {
  const isod: Dims = { w: 5, h: 5 }; // iso
  const transOf = (html: string) => {
    const m = html.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    if (!m) throw new Error('pas de transform translate(...px): ' + html.slice(0, 120));
    return { cx: parseFloat(m[1]), cy: parseFloat(m[2]) };
  };

  it('soulève le token de z·LEVEL_H (cy plus petit, cx inchangé)', () => {
    const h0 = renderToStaticMarkup(<svg><BodyToken x={2} y={2} dims={isod} scale={0.6}><g /></BodyToken></svg>);
    const h1 = renderToStaticMarkup(<svg><BodyToken x={2} y={2} dims={isod} scale={0.6} z={1}><g /></BodyToken></svg>);
    const t0 = transOf(h0), t1 = transOf(h1);
    expect(t1.cx).toBe(t0.cx);
    expect(t0.cy - t1.cy).toBe(LEVEL_H);
  });

  it('z=1 positionne le token via tileCenter(...,1)', () => {
    const html = renderToStaticMarkup(<svg><BodyToken x={1} y={3} dims={isod} scale={0.6} z={1}><g /></BodyToken></svg>);
    const { cx, cy } = tileCenter(1, 3, isod, 1);
    expect(transOf(html)).toEqual({ cx, cy });
  });
});
