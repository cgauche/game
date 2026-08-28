// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect } from 'vitest';
import { Dice } from './Dice';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('un tick qui survit à la disparition du document ne pose RIEN', async () => {
  const captees: string[] = [];
  const onUncaught = (e: Error) => captees.push(String(e?.message));
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<Dice roll={71} />));
  // CONTRÔLE POSITIF : sans minuterie ARMÉE, le contrat ci-dessous ne mesurerait rien.
  expect(host.querySelector('.d100-rolling'), "la minuterie n'est pas armée").not.toBeNull();
  const w = globalThis.window;
  process.on('uncaughtException', onUncaught); // le throw naît HORS pile : seul ce canal le voit
  try {
    delete (globalThis as Record<string, unknown>).window;
    await new Promise((r) => setTimeout(r, 200)); // > 4 × TICK_MS (45) : plusieurs ticks tirent sans window
  } finally {
    (globalThis as Record<string, unknown>).window = w; // isolate:false — jamais laisser l'env mutilé
    process.off('uncaughtException', onUncaught);
  }
  expect(captees, 'un tick a posé un setState alors que window avait disparu').toEqual([]);
  act(() => root.unmount());
  host.remove();
});
