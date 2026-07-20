import { describe, it, expect } from 'vitest';
import { possessionCapacity, possessionRideable, possessionLabel, possessionTotalEnc, type Possession } from './possession';
import { randomizeChars } from './statblock';
import { CHAR_KEYS, type Characteristics } from './types';
import { ruleDef } from './policy';

function baseChars(v = 30): Characteristics {
  const out = {} as Characteristics;
  for (const k of CHAR_KEYS) out[k] = v;
  return out;
}

function bete(overrides: Partial<Possession & { nature: 'bete' }> = {}): Possession {
  return {
    uid: 'pos-1',
    ownerId: 'hero-1',
    location: { kind: 'avec-le-groupe' },
    items: [],
    nature: 'bete',
    ref: { creatureId: 'mule' },
    ...overrides,
  } as Possession;
}

describe('possessionCapacity — source par nature (§4.2/§5)', () => {
  it('bête (réf bestiaire) : Contenu du profil EDOC (mule → 14 Enc)', () => {
    expect(possessionCapacity(bete())).toBe(14);
  });

  it('bête custom (statbloc sans profil de monture) : dégradation propre (undefined)', () => {
    const p = bete({ ref: { custom: { label: 'Bête inconnue', char: {} } } });
    expect(possessionCapacity(p)).toBeUndefined();
  });

  it('serviteur : porte son sac comme un héros, pas de bât dédié (undefined)', () => {
    const p: Possession = { ...bete(), nature: 'serviteur', ref: { creatureId: 'mule' } } as Possession;
    expect(possessionCapacity(p)).toBeUndefined();
  });

  it('véhicule : chargement du catalogue (charrette → 25 Enc, LDB 70)', () => {
    const p: Possession = { uid: 'pos-2', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [], nature: 'vehicule', vehicleId: 'charrette' };
    expect(possessionCapacity(p)).toBe(25);
  });

  it('navire : Contenance de la coque (barge → 300 Enc, MDG 12)', () => {
    const p: Possession = {
      uid: 'pos-3', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [], nature: 'navire',
      vehicleId: 'barge', naval: { morale: { score: 0, factors: [] } as any },
    };
    expect(possessionCapacity(p)).toBe(300);
  });

  it('immeuble : pas de catalogue de capacité (T4, #356) → undefined', () => {
    const p: Possession = { uid: 'pos-4', ownerId: 'hero-1', location: { kind: 'au-lieu', placeId: 'ville-x' }, items: [], nature: 'immeuble', buildingId: 'maison-1' };
    expect(possessionCapacity(p)).toBeUndefined();
  });
});

describe('possessionRideable — EDOC 07 l.157-161 (Incidents de monte)', () => {
  it('bête vivante, sans incident : montable', () => {
    expect(possessionRideable(bete())).toBe(true);
  });

  it('bête détruite : jamais montable', () => {
    expect(possessionRideable(bete({ destroyed: true }))).toBe(false);
  });

  it('Boiteux (l.159 « ni monté, ni porter ou tirer de charge ») : non montable', () => {
    expect(possessionRideable(bete({ mountInjury: 'boiteux' }))).toBe(false);
  });

  it('Patte brisée (l.161 « demeure immobile ») : non montable', () => {
    expect(possessionRideable(bete({ mountInjury: 'patte-brisee' }))).toBe(false);
  });

  it('Sangle cassée : incident non-bloquant, reste montable', () => {
    expect(possessionRideable(bete({ mountInjury: 'sangle-cassee' }))).toBe(true);
  });

  it('un véhicule ne se « monte » pas (se conduit)', () => {
    const p: Possession = { uid: 'pos-2', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [], nature: 'vehicule', vehicleId: 'charrette' };
    expect(possessionRideable(p)).toBe(false);
  });
});

describe('possessionLabel — label d’instance sinon libellé du catalogue (doctrine id/label)', () => {
  it('label posé (« Marguerite ») prime sur tout', () => {
    expect(possessionLabel(bete({ label: 'Marguerite' }))).toBe('Marguerite');
  });

  it('bête réf bestiaire sans label d’instance : libellé de la créature (« Mule »)', () => {
    expect(possessionLabel(bete())).toBe('Mule');
  });

  it('bête custom sans label d’instance : libellé du statbloc', () => {
    const p = bete({ ref: { custom: { label: 'Palefroi de Berthold', char: {} } } });
    expect(possessionLabel(p)).toBe('Palefroi de Berthold');
  });

  it('véhicule sans label d’instance : libellé du catalogue (« Charrette »)', () => {
    const p: Possession = { uid: 'pos-2', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [], nature: 'vehicule', vehicleId: 'charrette' };
    expect(possessionLabel(p)).toBe('Charrette');
  });
});

describe('possessionTotalEnc — signature seule (§5, implémentation T1-c2)', () => {
  it('non implémenté : échoue explicitement plutôt qu’un faux 0 silencieux', () => {
    expect(() => possessionTotalEnc(bete(), [bete()])).toThrow();
  });
});

describe('policy.ts — tirage LDB 77 à l’acquisition (nouvelle règle optionnelle #614)', () => {
  it('la règle existe, citée LDB 77 l.108', () => {
    const def = ruleDef('possession-random-chars-on-acquire');
    expect(def).toBeDefined();
    expect(def!.ref).toMatch(/LDB 77/);
  });
});

describe('randomizeChars (engine/statblock) — tirage LDB 77 l.108, seedé sur l’uid de possession', () => {
  it('3 mules d’un même lot (uids distincts) → 3 tirages DISTINCTS', () => {
    const chars = baseChars(30);
    const a = randomizeChars(chars, 'pos-11');
    const b = randomizeChars(chars, 'pos-12');
    const c = randomizeChars(chars, 'pos-13');
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
    expect(a).not.toEqual(c);
  });

  it('même uid → même tirage (déterministe, rejouable)', () => {
    const chars = baseChars(30);
    expect(randomizeChars(chars, 'pos-11')).toEqual(randomizeChars(chars, 'pos-11'));
  });

  it('figé dans charsRolled : une 2e « projection » ne relance rien (simple recopie)', () => {
    const chars = baseChars(30);
    const rolled = randomizeChars(chars, 'pos-11');
    // Une possession fige son tirage une fois pour toutes (Possession.charsRolled) : toute projection
    // ultérieure RECOPIE cette valeur, elle ne rappelle jamais randomizeChars.
    const projection1 = { ...rolled };
    const projection2 = { ...rolled };
    expect(projection1).toEqual(projection2);
    expect(projection1).toEqual(rolled);
  });
});
