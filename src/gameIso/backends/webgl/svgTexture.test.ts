import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { clearBillboardTextures, getBillboardTexture } from './svgTexture';

/** Fabrique SIMULÉE : `getBillboardTexture` ne fait que mémoïser — il n'a jamais besoin d'un vrai
 *  canevas pour être jugé (la rasterisation, elle, se juge à l'écran du spike). */
const fausseTexture = (): THREE.CanvasTexture => ({ dispose: () => undefined }) as unknown as THREE.CanvasTexture;

describe('getBillboardTexture — mémoïsation par clé', () => {
  it('hit : deux demandes de la même clé ne fabriquent qu’une fois, et rendent la MÊME promesse', async () => {
    const make = vi.fn(async () => fausseTexture());
    const a = getBillboardTexture('hit:1', make);
    const b = getBillboardTexture('hit:1', make);
    expect(b).toBe(a);
    expect(make).toHaveBeenCalledTimes(1);
    await expect(a).resolves.toBe(await b);
  });

  it('miss : une clé différente fabrique sa propre texture', async () => {
    const make = vi.fn(async () => fausseTexture());
    const a = await getBillboardTexture('miss:1', make);
    const b = await getBillboardTexture('miss:2', make);
    expect(make).toHaveBeenCalledTimes(2);
    expect(b).not.toBe(a);
  });

  it('rejet NON mémoïsé : un SVG illisible une fois ne condamne pas la clé — le 2ᵉ appel re-tente', async () => {
    const make = vi
      .fn<() => Promise<THREE.CanvasTexture>>()
      .mockRejectedValueOnce(new Error('SVG illisible'))
      .mockResolvedValueOnce(fausseTexture());
    await expect(getBillboardTexture('rejet:1', make)).rejects.toThrow('SVG illisible');
    await expect(getBillboardTexture('rejet:1', make)).resolves.toBeDefined();
    expect(make).toHaveBeenCalledTimes(2);
  });

  it('après un rejet ré-tenté avec succès, la clé redevient mémoïsée', async () => {
    const make = vi
      .fn<() => Promise<THREE.CanvasTexture>>()
      .mockRejectedValueOnce(new Error('boum'))
      .mockResolvedValue(fausseTexture());
    await expect(getBillboardTexture('rejet:2', make)).rejects.toThrow('boum');
    const ok = await getBillboardTexture('rejet:2', make);
    expect(await getBillboardTexture('rejet:2', make)).toBe(ok);
    expect(make).toHaveBeenCalledTimes(2);
  });

  it('clearBillboardTextures vide le cache : la clé re-fabrique', async () => {
    const make = vi.fn(async () => fausseTexture());
    await getBillboardTexture('clear:1', make);
    clearBillboardTextures();
    await getBillboardTexture('clear:1', make);
    expect(make).toHaveBeenCalledTimes(2);
  });
});
