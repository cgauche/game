import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signalerEntreeEnScene, entreeEnScene, attendreEntreeEnScene } from './entreeEnScene';

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

  it('ne résout PAS sur une AUTRE scène — et le refus nomme les deux ids', async () => {
    const p = attendreEntreeEnScene(() => 'opera-plan', 1000);
    const verdict = p.then(() => 'résolu', (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(0);
    signalerEntreeEnScene('arene-zone1', false);
    await vi.advanceTimersByTimeAsync(1200);
    const msg = await verdict;
    expect(msg).toContain('scène attendue « opera-plan »');
    expect(msg).toContain('montée « arene-zone1 »');
  });

  it('rejette au timeout quand AUCUN monde n\'a signalé', async () => {
    const p = attendreEntreeEnScene(() => 'opera-plan', 800);
    const verdict = p.then(() => 'résolu', (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await verdict).toContain('aucun monde monté après 800 ms');
  });

  it('rejette au timeout quand le VOILE reste levé sur la bonne scène', async () => {
    const p = attendreEntreeEnScene(() => 'opera-plan', 800);
    const verdict = p.then(() => 'résolu', (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(0);
    signalerEntreeEnScene('opera-plan', true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await verdict).toContain('voile encore levé sur « opera-plan » après 800 ms');
  });
});
