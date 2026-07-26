import { describe, it, expect } from 'vitest';
import { effectiveCastingNumber, castingNumberScopeMatches, type CastingNumberMod } from './castingNumber';

const src = { book: 'vents-de-la-magie', page: 152 };
const mod = (m: Omit<CastingNumberMod, 'source' | 'desc'>): CastingNumberMod => ({ ...m, source: src, desc: 'x' });

describe('NI effectif — les porteurs du RAW', () => {
  it('bâton enchanté : −1 sur le Domaine associé, plancher 0 (VDM 12 l.48)', () => {
    const m = mod({ delta: -1, min: 0, scope: { domains: ['feu'] } });
    expect(effectiveCastingNumber(6, { domainId: 'feu', kind: 'sort' }, [m])).toBe(5);
    expect(effectiveCastingNumber(0, { domainId: 'feu', kind: 'sort' }, [m])).toBe(0);
    expect(effectiveCastingNumber(6, { domainId: 'ombres', kind: 'sort' }, [m])).toBe(6);
  });

  it('Concentré de pouvoir : moitié ARRONDIE AU SUPÉRIEUR, Sorts ET Rituels (VDM 12 folio 162)', () => {
    const m = mod({ divide: 2, round: 'superieur' });
    expect(effectiveCastingNumber(7, { kind: 'sort' }, [m])).toBe(4);
    expect(effectiveCastingNumber(45, { kind: 'rituel' }, [m])).toBe(23);
  });

  it('grimoire : Sort ×2, Rituel ×4 (VDM 12 l.646-647)', () => {
    const sort = mod({ multiply: 2, scope: { kinds: ['sort'] } });
    const rituel = mod({ multiply: 4, scope: { kinds: ['rituel'] } });
    expect(effectiveCastingNumber(8, { kind: 'sort' }, [sort, rituel])).toBe(16);
    expect(effectiveCastingNumber(50, { kind: 'rituel' }, [sort, rituel])).toBe(200);
  });

  it('Caverne de l’Attache : moitié ARRONDIE À L’INFÉRIEUR, Sorts de la Bête (VDM 14 l.437)', () => {
    const m = mod({ divide: 2, round: 'inferieur', scope: { domains: ['bete'], kinds: ['sort'] } });
    expect(effectiveCastingNumber(7, { domainId: 'bete', kind: 'sort' }, [m])).toBe(3);
    expect(effectiveCastingNumber(7, { domainId: 'vie', kind: 'sort' }, [m])).toBe(7);
  });

  it('complexe Cairnapan : les RITUELS de Ghyran seulement — un Sort de Vie n’est pas touché (VDM 14 l.489)', () => {
    const m = mod({ divide: 2, round: 'inferieur', scope: { domains: ['vie'], kinds: ['rituel'] } });
    expect(effectiveCastingNumber(41, { domainId: 'vie', kind: 'rituel' }, [m])).toBe(20);
    expect(effectiveCastingNumber(41, { domainId: 'vie', kind: 'sort' }, [m])).toBe(41);
    expect(effectiveCastingNumber(41, { domainId: 'bete', kind: 'rituel' }, [m])).toBe(41);
  });

  it('Arène des Débats : −2 sur un Sort NOMMÉ (VDM 14 l.353)', () => {
    const m = mod({ delta: -2, scope: { spellIds: ['l-epee-ardente-de-rhuin'] } });
    expect(effectiveCastingNumber(8, { id: 'l-epee-ardente-de-rhuin', domainId: 'feu', kind: 'sort' }, [m])).toBe(6);
    expect(effectiveCastingNumber(8, { id: 'boule-de-feu', domainId: 'feu', kind: 'sort' }, [m])).toBe(8);
  });

  it('parchemin de Rituel : NI doublé (VDM 12 l.102)', () => {
    const m = mod({ multiply: 2, scope: { kinds: ['rituel'] } });
    expect(effectiveCastingNumber(50, { kind: 'rituel' }, [m])).toBe(100);
  });
});

describe('NI effectif — lois du calcul', () => {
  it('un modificateur sans portée touche tout NI ; une portée qui ne tient pas est ignorée', () => {
    expect(castingNumberScopeMatches(undefined, { kind: 'sort' })).toBe(true);
    expect(castingNumberScopeMatches({ kinds: ['rituel'] }, { kind: 'sort' })).toBe(false);
    expect(castingNumberScopeMatches({ domainsExcept: ['feu'] }, { domainId: 'vie', kind: 'sort' })).toBe(true);
    expect(castingNumberScopeMatches({ chaosMagic: true }, { kind: 'sort', chaosMagic: true })).toBe(true);
    expect(castingNumberScopeMatches({ chaosMagic: true }, { kind: 'sort' })).toBe(false);
  });

  it('une division SANS sens d’arrondi ne s’applique pas — le RAW l’imprime, on ne devine pas', () => {
    expect(effectiveCastingNumber(7, { kind: 'sort' }, [mod({ divide: 2 })])).toBe(7);
  });

  it('ordre FIXE : facteur, puis delta, puis plancher du modificateur', () => {
    expect(effectiveCastingNumber(9, { kind: 'sort' }, [mod({ multiply: 2, delta: -1 })])).toBe(17);
    expect(effectiveCastingNumber(1, { kind: 'sort' }, [mod({ divide: 2, round: 'inferieur', delta: -3, min: 0 })])).toBe(0);
  });

  it('les modificateurs se composent dans l’ordre de la liste, NI planché à 0', () => {
    const grimoire = mod({ multiply: 2, scope: { kinds: ['sort'] } });
    const baton = mod({ delta: -1, min: 0, scope: { domains: ['feu'] } });
    expect(effectiveCastingNumber(8, { domainId: 'feu', kind: 'sort' }, [grimoire, baton])).toBe(15);
    expect(effectiveCastingNumber(2, { kind: 'sort' }, [mod({ delta: -10 })])).toBe(0);
  });

  it('un 8ᵉ porteur ne coûte AUCUNE ligne de moteur : sa donnée suffit', () => {
    // Activité « Accomplir un Rituel » (`VDM 02 l.777`) — jamais nommée dans le moteur.
    const activite = mod({ divide: 2, round: 'superieur', scope: { kinds: ['rituel'] } });
    expect(effectiveCastingNumber(85, { kind: 'rituel' }, [activite])).toBe(43);
    expect(effectiveCastingNumber(85, { kind: 'sort' }, [activite])).toBe(85);
  });
});
