import { describe, it, expect } from 'vitest';
import { AMBIENT_CLIPS, AMBIENT_LIST, ambientClip } from './ambientClips';

describe('ambientClips (brin I)', () => {
  it('toutes les entrées de la liste éditeur résolvent vers un clip', () => {
    for (const a of AMBIENT_LIST) expect(ambientClip(a.key), a.key).toBeTruthy();
  });

  it('les clips d’ambiance bouclent', () => {
    for (const key of Object.keys(AMBIENT_CLIPS)) expect(AMBIENT_CLIPS[key].loop, key).toBe(true);
  });

  it('clé inconnue / vide → null', () => {
    expect(ambientClip('zzz')).toBeNull();
    expect(ambientClip(undefined)).toBeNull();
    expect(ambientClip('')).toBeNull();
  });

  it('« feeding » : bras plongés bas-devant + bob (déchiquète), corps debout', () => {
    const s0 = AMBIENT_CLIPS.feeding.steps[0].pose as Record<string, number>;
    const s1 = AMBIENT_CLIPS.feeding.steps[1].pose as Record<string, number>;
    expect(s0.epauleD!).toBeGreaterThan(30); // bras plongent vers la proie au sol
    expect(s0.avantBrasD!).toBeGreaterThan(20);
    expect(s1.epauleD!).toBeLessThan(s0.epauleD!); // remonte (arrache) → bob
    expect(Math.abs(s0.torse ?? 0)).toBeLessThan(15); // pas de bascule (rig 2D)
  });

  it('« praying » : mains jointes levées (épaules très négatives), debout', () => {
    const p = AMBIENT_CLIPS.praying.steps[0].pose as Record<string, number>;
    expect(p.epauleG!).toBeLessThan(-20);
    expect(p.avantBrasG!).toBeLessThan(-30);
  });
});
