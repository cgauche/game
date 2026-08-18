import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import {
  TEXTURE_STATIQUE_BUDGET_BYTES_DEFAUT,
  clearBillboardTextures,
  getBillboardTexture,
  setStaticTextureBudgetBytes,
  setStaticTexturePins,
  staticTextureStats,
} from './svgTexture';

/** Fabrique SIMULÉE : `getBillboardTexture` ne fait que mémoïser — il n'a jamais besoin d'un vrai
 *  canevas pour être jugé (la rasterisation, elle, se juge à l'écran du spike). */
const fausseTexture = (): THREE.CanvasTexture => ({ dispose: () => undefined }) as unknown as THREE.CanvasTexture;

/** Texture SIMULÉE qui PORTE son canevas : c'est lui que le stock pèse (4 octets par texel). */
const textureDe = (w: number, h: number): { texture: THREE.CanvasTexture; libre: () => boolean; octets: number } => {
  let librée = false;
  const texture = { image: { width: w, height: h }, dispose: () => { librée = true; } } as unknown as THREE.CanvasTexture;
  return { texture, libre: () => librée, octets: w * h * 4 };
};

afterEach(() => {
  clearBillboardTextures();
  setStaticTexturePins([]);
  setStaticTextureBudgetBytes(TEXTURE_STATIQUE_BUDGET_BYTES_DEFAUT);
});

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

/**
 * STOCK BORNÉ (#1374) : le cache des textures statiques a un budget d'OCTETS. Sans lui, chaque décor
 * en retenait jusqu'à quatre (un par cran d'art) jusqu'au changement de scène — ~200 canevas sur une
 * scène-hub, jamais libérés.
 */
describe('getBillboardTexture — stock borné au budget d’octets', () => {
  it('budget dépassé : la plus ancienne NON épinglée est libérée, et sa clé se recuit à la demande', async () => {
    const a = textureDe(64, 64);
    const b = textureDe(64, 64);
    const c = textureDe(64, 64);
    setStaticTextureBudgetBytes(2 * a.octets);
    const faireA = vi.fn(async () => a.texture);
    await getBillboardTexture('borné:a', faireA);
    await getBillboardTexture('borné:b', async () => b.texture);
    await getBillboardTexture('borné:c', async () => c.texture);

    expect(a.libre(), 'la plus ancienne doit être LIBÉRÉE, pas seulement oubliée').toBe(true);
    expect([b.libre(), c.libre()]).toEqual([false, false]);
    expect(staticTextureStats()).toEqual({ entries: 2, bytes: 2 * a.octets });

    // RECUISSON : la clé évincée n'est plus mémoïsée — la demande suivante repasse par la fabrique.
    const bis = textureDe(64, 64);
    await getBillboardTexture('borné:a', async () => bis.texture);
    expect(faireA, 'la fabrique d’origine ne doit pas être rappelée : c’est la NOUVELLE demande qui cuit').toHaveBeenCalledTimes(1);
    expect(staticTextureStats().entries).toBe(2);
  });

  it('une clé ÉPINGLÉE (texture posée à l’écran) survit à la pression, même la plus ancienne', async () => {
    const posée = textureDe(64, 64);
    const suivante = textureDe(64, 64);
    setStaticTextureBudgetBytes(2 * posée.octets);
    setStaticTexturePins(['borné:posée']);
    await getBillboardTexture('borné:posée', async () => posée.texture);
    await getBillboardTexture('borné:suivante', async () => suivante.texture);
    await getBillboardTexture('borné:tierce', async () => textureDe(64, 64).texture);

    expect(posée.libre(), 'la texture à l’écran a été libérée : son quad resterait sans art').toBe(false);
    expect(suivante.libre(), 'PRÉMISSE : la pression doit bien avoir mordu sur une NON épinglée').toBe(true);
  });
});
