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

  it('« feeding » est accroupi penché (jambes pliées, torse en avant)', () => {
    const p = AMBIENT_CLIPS.feeding.steps[0].pose as Record<string, number>;
    expect(p.cuisseG!).toBeGreaterThan(0); // jambe repliée
    expect(p.tibiaG!).toBeLessThan(0); // genou plié (accroupi)
    expect(p.torse!).toBeGreaterThan(20); // penché vers la proie au sol
    expect(p.tete!).toBeGreaterThan(20); // tête baissée
  });

  it('« praying » agenouillé (une jambe pliée) tête baissée', () => {
    const p = AMBIENT_CLIPS.praying.steps[0].pose as Record<string, number>;
    expect(p.tibiaG!).toBeLessThan(0);
    expect(p.tete!).toBeGreaterThan(0);
  });
});
