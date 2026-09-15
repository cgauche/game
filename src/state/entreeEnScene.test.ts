import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signalerEntreeEnScene, entreeEnScene, attendreEntreeEnScene, EntreeEnSceneNonAtteinte } from './entreeEnScene';

/** Le refus est une DONNÉE : on juge l'INSTANCE et ses champs, jamais une phrase (la prose de
 *  `__wfrp.ready` vit dans `devtools.ts`, seule surface FR de ce refus). */
async function refus(p: Promise<unknown>): Promise<EntreeEnSceneNonAtteinte | 'résolu'> {
  return p.then(() => 'résolu' as const, (e: unknown) => {
    expect(e).toBeInstanceOf(EntreeEnSceneNonAtteinte);
    return e as EntreeEnSceneNonAtteinte;
  });
}

describe('entreeEnScene (#1478) — le rendez-vous « monde prêt » de la recette', () => {
  beforeEach(() => {
    signalerEntreeEnScene(null, false); // état de module : remis à neuf entre deux cas
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    signalerEntreeEnScene(null, false);
  });

  it('résout dès que la scène ATTENDUE est montée et son voile tombé', async () => {
    const p = attendreEntreeEnScene(() => 'opera-plan', 5000);
    await vi.advanceTimersByTimeAsync(0); // le tour de boucle initial
    signalerEntreeEnScene('opera-plan', true);
    signalerEntreeEnScene('opera-plan', false);
    await expect(p).resolves.toMatchObject({ sceneId: 'opera-plan' });
    expect(entreeEnScene()).toEqual({ sceneId: 'opera-plan', voile: false });
  });

  it('un signal SYNCHRONE juste après l\'appel est vu (le `setTimeout(0)` initial laisse React commettre)', async () => {
    const p = attendreEntreeEnScene(() => 'opera-plan', 5000);
    signalerEntreeEnScene('opera-plan', false); // posé AVANT le premier tour de boucle
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toMatchObject({ sceneId: 'opera-plan' });
  });

  it('ne résout PAS sur une AUTRE scène — et le refus porte les deux ids', async () => {
    const verdict = refus(attendreEntreeEnScene(() => 'opera-plan', 1000));
    await vi.advanceTimersByTimeAsync(0);
    signalerEntreeEnScene('arene-zone1', false);
    await vi.advanceTimersByTimeAsync(1200);
    expect(await verdict).toMatchObject({ cause: 'scene-differente', attendu: 'opera-plan', montee: 'arene-zone1', timeoutMs: 1000 });
  });

  it('rejette au timeout quand AUCUN monde n\'a signalé', async () => {
    const verdict = refus(attendreEntreeEnScene(() => 'opera-plan', 800));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await verdict).toMatchObject({ cause: 'aucun-monde', attendu: 'opera-plan', montee: null, timeoutMs: 800 });
  });

  it('rejette au timeout quand le VOILE reste levé sur la bonne scène', async () => {
    const verdict = refus(attendreEntreeEnScene(() => 'opera-plan', 800));
    await vi.advanceTimersByTimeAsync(0);
    signalerEntreeEnScene('opera-plan', true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await verdict).toMatchObject({ cause: 'voile-leve', attendu: 'opera-plan', montee: 'opera-plan', timeoutMs: 800 });
  });
});
