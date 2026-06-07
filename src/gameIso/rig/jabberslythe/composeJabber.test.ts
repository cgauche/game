import { describe, it, expect } from 'vitest';
import {
  resolveJabberFromProps, jabberHover, jabberWhip, jabberDart, JABBER_REST, JABBER_DEATH, JABBER_DEFAULT,
} from './composeJabber';

describe('gabarit jabberslythe', () => {
  it('résout corps + 2 ailes + cou + tête (z), avec langue-fouet + yeux fous', () => {
    const bones = resolveJabberFromProps(JABBER_DEFAULT, 'front', {});
    expect(bones.map((b) => b.id).sort()).toEqual(['aileD', 'aileG', 'corps', 'cou', 'tete']);
    const tete = bones.find((b) => b.id === 'tete')!.parts[0].svg;
    expect(tete).toContain('#c0303a'); // langue-fouet rouge
    expect(tete).toContain('#f2e84a'); // yeux jaunes fous
  });

  it('les bois n’apparaissent qu’avec antlers', () => {
    const withA = resolveJabberFromProps({ ...JABBER_DEFAULT, antlers: true }, 'front', {}).find((b) => b.id === 'tete')!.parts[0].svg;
    const without = resolveJabberFromProps({ ...JABBER_DEFAULT, antlers: false }, 'front', {}).find((b) => b.id === 'tete')!.parts[0].svg;
    expect(withA.length).toBeGreaterThan(without.length);
  });

  it('recolor : colors.corps change le markup', () => {
    const a = JSON.stringify(resolveJabberFromProps(JABBER_DEFAULT, 'front', {}));
    const b = JSON.stringify(resolveJabberFromProps(JABBER_DEFAULT, 'front', {}, { corps: '#b0322a' }));
    expect(a).not.toEqual(b);
  });

  it('les poses diffèrent (vrombissement ≠ repos, fouet projette le cou, bond, mort)', () => {
    expect(jabberHover(0.1)).not.toEqual(JABBER_REST);
    expect(jabberWhip(0.5).cou).toBeGreaterThan(20);
    expect(jabberDart(0.25).corps).not.toBe(0);
    expect(JABBER_DEATH.cou).toBeGreaterThan(40);
  });
});
