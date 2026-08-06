import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementIntent } from './MovementIntent';

describe('MovementIntent', () => {
  it('rend la nature, le coût et le Mouvement restant avant et après', () => {
    const html = renderToStaticMarkup(
      <MovementIntent
        resolution={{ status: 'ok', kind: 'move', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], cost: 2 }}
        remainingBefore={4}
        remainingAfter={2}
      />,
    );
    expect(html).toContain('Marcher');
    expect(html).toContain('2 cases');
    expect(html).toContain('4');
    expect(html).toContain('2');
  });

  it('rend la raison canonique d’un déplacement refusé', () => {
    const html = renderToStaticMarkup(
      <MovementIntent
        resolution={{ status: 'blocked', reason: 'engaged' }}
        remainingBefore={4}
        remainingAfter={4}
      />,
    );
    expect(html).toContain('Se désengager d’abord');
    expect(html).toContain('Mouvement');
    expect((html.match(/>4</g) ?? [])).toHaveLength(2);
  });
});
