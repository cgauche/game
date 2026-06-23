import { describe, it, expect } from 'vitest';
import { buildTokenMap, applyTokenMap, resolveTokens, DEFAULT_PALETTE } from './palette';

describe('palette — buildTokenMap', () => {
  it('slot non surchargé : rend les ombres/reflets EXACTS stockés (rendu par défaut sans perte)', () => {
    const stored = { vet1: '#82724f', vet1O: '#112233', vet1H: '#ffeedd' };
    const m = buildTokenMap(stored, {});
    expect(m.vet1).toBe('#82724f');
    expect(m.vet1O).toBe('#112233'); // ombre exacte stockée, PAS dérivée
    expect(m.vet1H).toBe('#ffeedd');
  });

  it('slot sans ombre stockée : dérive O/H du base stocké', () => {
    const m = buildTokenMap({ vet1: '#646464' }, {}); // 100,100,100
    expect(m.vet1).toBe('#646464');
    expect(m.vet1O).toBe('#4e4e4e'); // 100*0.78 = 78 = 0x4e
    expect(m.vet1H).toBe('#767676'); // 100*1.18 = 118 = 0x76
  });

  it('slot surchargé par l\'utilisateur : TOUTE la famille dérive du choix (ignore les ombres stockées)', () => {
    const stored = { vet1: '#82724f', vet1O: '#112233', vet1H: '#ffeedd' };
    const m = buildTokenMap(stored, { vet1: '#646464' });
    expect(m.vet1).toBe('#646464');
    expect(m.vet1O).toBe('#4e4e4e'); // dérivé du rouge choisi, pas l'ombre stockée
    expect(m.vet1H).toBe('#767676');
  });

  it('slot absent partout : retombe sur DEFAULT_PALETTE', () => {
    const m = buildTokenMap({}, {});
    expect(m.peau).toBe(DEFAULT_PALETTE.peau);
    expect(m.metal).toBe(DEFAULT_PALETTE.metal);
  });

  it('applyTokenMap : substitue les tokens connus, laisse les inconnus', () => {
    const m = buildTokenMap({ vet1: '#abcdef' }, {});
    expect(applyTokenMap('<path fill="@vet1"/>', m)).toBe('<path fill="#abcdef"/>');
    expect(applyTokenMap('<path fill="@inconnu"/>', m)).toBe('<path fill="@inconnu"/>');
    expect(applyTokenMap('<path fill="#123456"/>', m)).toBe('<path fill="#123456"/>'); // hex en dur intact
  });

  it('resolveTokens : no-op si pas de token', () => {
    expect(resolveTokens('<path fill="#123456"/>', { peau: '#fff' })).toBe('<path fill="#123456"/>');
  });

  it('jetons CUSTOM hors slots créature (ex. navire) : base + ombre/reflet dérivés, slots intacts', () => {
    const m = buildTokenMap({ coque: '#6b4a2b', voile: '#e8e0cc' }, {});
    expect(m.coque).toBe('#6b4a2b'); // base custom passe
    expect(m.coqueO).toBeDefined(); // ombre dérivée (×0.78)
    expect(m.coqueH).toBeDefined(); // reflet dérivé (×1.18)
    expect(m.voile).toBe('#e8e0cc');
    expect(m.peau).toBeDefined(); // les slots créature restent fournis (DEFAULT_PALETTE)
    expect(applyTokenMap('<path fill="@coque" stroke="@coqueO"/><rect fill="@voile"/>', m)).not.toContain('@');
  });
});
