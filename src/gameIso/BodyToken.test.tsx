import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BodyToken } from './BodyToken';
import type { Dims } from './iso';

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
