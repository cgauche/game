import { describe, it, expect } from 'vitest';
import {
  resolveHulkFromProps, hulkWobble, hulkSlam, hulkLurch, HULK_REST, HULK_DEATH, HULK_DEFAULT,
} from './composeHulk';

describe('gabarit amorphe / hulk', () => {
  it('résout corps + 2 moignons, avec visage (yeux + gueule)', () => {
    const bones = resolveHulkFromProps(HULK_DEFAULT, 'front', {});
    expect(bones.map((b) => b.id).sort()).toEqual(['brasD', 'brasG', 'corps']);
    const corps = bones.find((b) => b.id === 'corps')!.parts[0].svg;
    expect(corps).toContain('#e8e0c8'); // yeux/dents clairs
  });

  it('de dos : pas de visage', () => {
    const back = resolveHulkFromProps(HULK_DEFAULT, 'back', {}).find((b) => b.id === 'corps')!.parts[0].svg;
    expect(back).not.toContain('#e8e0c8');
  });

  it('recolor : colors.corps change le markup (boue → ooze/golem)', () => {
    const a = JSON.stringify(resolveHulkFromProps(HULK_DEFAULT, 'front', {}));
    const b = JSON.stringify(resolveHulkFromProps(HULK_DEFAULT, 'front', {}, { corps: '#3a6a2a' }));
    expect(a).not.toEqual(b);
  });

  it('les poses diffèrent (tremblote ≠ repos, abattage projette les moignons, embardée, mort)', () => {
    expect(hulkWobble(0.25)).not.toEqual(HULK_REST);
    expect(hulkSlam(0.5).brasG).toBeGreaterThan(10);
    expect(hulkLurch(0.25).corps).not.toBe(0);
    expect(HULK_DEATH.brasG).toBeGreaterThan(20);
  });
});
