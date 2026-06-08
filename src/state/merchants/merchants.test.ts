import { describe, it, expect } from 'vitest';
import { MERCHANTS } from './index';

describe('registre archétypes marchands (#2)', () => {
  it('charge les archétypes depuis defs/ (clé = name)', () => {
    expect(MERCHANTS.armurier).toMatchObject({ label: 'Armurier', settlement: 'ville', resaleRate: 0.5, bargainSkill: 45 });
    expect(MERCHANTS.armurier.category.types).toContain('armor');
    expect(MERCHANTS.herboriste.category.subTypes).toContain('Herbes et potions');
  });
});
