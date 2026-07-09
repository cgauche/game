import { describe, it, expect } from 'vitest';
import { Characteristics, Combatant, ItemInstance } from './types';
import { makeRNG, RNG } from './dice';
import { dailyFoodUpkeep, applyFaimTest, isStarving, hungerCharPenalties, rationCount, isRation, dailyWaterUpkeep, applySoifTest, isThirsty, isDeprived, thirstCharPenalties, provisioningManifest } from './provisions';
import { effectiveChar } from './characteristics';
import { restRecovery, needsRecoveryRoll } from './rest';
import { addCondition, stacks } from './conditions';

const chars = (E = 30): Characteristics => ({
  CC: 30, CT: 30, F: 30, E, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30,
});

const ration = (uid: string): ItemInstance => ({ uid, name: 'Ration', trappingId: 'ration', kind: 'misc', qualities: [], enc: 0, equipped: false });

function hero(opts: { E?: number; rations?: number; brouet?: boolean } = {}): Combatant {
  return {
    id: 'h', name: 'Gunnar', kind: 'hero',
    characteristics: chars(opts.E),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: Array.from({ length: opts.rations ?? 0 }, (_, i) => ration(`r${i}`)),
    skills: [], talents: opts.brouet ? [{ talentId: 'brouet', times: 1 }] : [], movement: 4,
  };
}

/** RNG forcé : d100 → toujours `roll` (échec/réussite déterministe), d10 → 10. */
const fixed = (roll: number): RNG => ({ int: (min, max) => (max === 100 ? roll : max) });

describe('dailyFoodUpkeep — rations (LDB p.302) et faim (LDB 18 l.422)', () => {
  it('consomme 1 ration/jour ; nourri = pas de faim', () => {
    const c = hero({ rations: 2 });
    const r = dailyFoodUpkeep(c, 30, 3, makeRNG(1));
    expect(r.ate).toBe(true);
    expect(r.rationConsumed).toBe(true);
    expect(rationCount(c)).toBe(1);
    expect(isStarving(c)).toBe(false);
  });

  it('Graisse de la terre (noHunger) : exempte de la Faim — aucune ration consommée, faim purgée', () => {
    const c = hero({ rations: 0 });
    c.hunger = { days: 3, tests: 2, failures: 1 }; // affamé avant le Sort
    c.activeEffects = [{ label: 'Graisse de la terre', bonus: 0, duration: { scale: 'permanent' }, noHunger: true }];
    const r = dailyFoodUpkeep(c, 30, 3, fixed(95));
    expect(r.ate).toBe(true);
    expect(r.rationConsumed).toBe(false); // rien à consommer (sustentation magique)
    expect(r.damage).toBe(0);
    expect(isStarving(c)).toBe(false); // compteurs de faim purgés
  });

  it('sans nourriture : Test de Résistance tous les 2 jours seulement', () => {
    const c = hero({ rations: 0 });
    const d1 = dailyFoodUpkeep(c, 30, 3, fixed(95));
    expect(d1.log).toEqual([]); // jour 1 : pas encore de Test
    expect(isStarving(c)).toBe(true);
    const d2 = dailyFoodUpkeep(c, 30, 3, fixed(95));
    expect(d2.log.join(' ')).toContain('Test de Résistance');
  });

  it('1ᵉʳ échec → −10 F et E (effectiveChar) ; 2ᵉ échec → dégâts ignorant les PA (min 1) + −10 ailleurs', () => {
    const c = hero({ rations: 0, E: 30 });
    dailyFoodUpkeep(c, 30, 3, fixed(95)); // j1
    dailyFoodUpkeep(c, 30, 3, fixed(95)); // j2 : Test raté → 1ᵉʳ échec
    expect(c.hunger?.failures).toBe(1);
    expect(effectiveChar(c, 'F')).toBe(20);
    expect(effectiveChar(c, 'E')).toBe(20);
    expect(effectiveChar(c, 'Ag')).toBe(30); // pas encore
    dailyFoodUpkeep(c, 30, 3, fixed(95)); // j3
    const d4 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // j4 : 2ᵉ échec
    expect(c.hunger?.failures).toBe(2);
    expect(d4.damage).toBe(7); // d10 forcé à 10 − BE 3 = 7
    expect(effectiveChar(c, 'Ag')).toBe(20);
    expect(hungerCharPenalties(c, 'Int')).toEqual([-10]);
  });

  it('les Tests sont de plus en plus difficiles : −10 par Test déjà tenté (l.418)', () => {
    const c = hero({ rations: 0 });
    dailyFoodUpkeep(c, 30, 3, fixed(95));
    const d2 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // 1ᵉʳ Test : cible 30
    expect(d2.log[0]).toContain('30');
    dailyFoodUpkeep(c, 30, 3, fixed(95));
    const d4 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // 2ᵉ Test : cible 30 − 10 = 20
    expect(d4.log[0]).toContain('(−10)');
    expect(d4.log[0]).toContain('20');
  });

  it('manger à nouveau efface compteurs et malus (choix documenté)', () => {
    const c = hero({ rations: 0 });
    dailyFoodUpkeep(c, 30, 3, fixed(95));
    dailyFoodUpkeep(c, 30, 3, fixed(95));
    expect(effectiveChar(c, 'F')).toBe(20);
    c.items!.push(ration('r9'));
    const r = dailyFoodUpkeep(c, 30, 3, makeRNG(1));
    expect(r.ate).toBe(true);
    expect(r.log.join(' ')).toContain('mange enfin à sa faim');
    expect(isStarving(c)).toBe(false);
    expect(effectiveChar(c, 'F')).toBe(30);
  });

  it('Brouet (LDB 10 l.113) : 1 ration couvre 2 jours, Test de faim tous les 3 jours', () => {
    const c = hero({ rations: 1, brouet: true });
    const d1 = dailyFoodUpkeep(c, 30, 3, makeRNG(1));
    expect(d1.rationConsumed).toBe(true);
    const d2 = dailyFoodUpkeep(c, 30, 3, makeRNG(1)); // jour « gratuit »
    expect(d2.ate).toBe(true);
    expect(d2.rationConsumed).toBe(false);
    // Puis plus rien : Test au 3ᵉ jour de jeûne (pas au 2ᵉ).
    dailyFoodUpkeep(c, 30, 3, fixed(95)); // jeûne j1
    const j2 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // jeûne j2 : pas de Test
    expect(j2.log).toEqual([]);
    const j3 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // jeûne j3 : Test
    expect(j3.log.join(' ')).toContain('Test de Résistance');
  });

  it('isRation : capacité par-OBJET `isRations` lue au catalogue par trappingId (≠ nom — multilangue-safe)', () => {
    expect(isRation(ration('r'))).toBe(true);
    // Objet non-ration (autre trapping) et objet custom (sans trappingId) → false.
    expect(isRation({ uid: 'g', name: 'Grimoire', trappingId: 'grimoire', kind: 'misc', qualities: [], enc: 1, equipped: false })).toBe(false);
    expect(isRation({ uid: 'x', name: 'Caillou', kind: 'misc', qualities: [], enc: 0, equipped: false })).toBe(false);
  });

  it('deferTest (cascade de nuit) : un Test de Faim DÛ est DIFFÉRÉ, pas roulé ici', () => {
    const c = hero({ rations: 0 });
    dailyFoodUpkeep(c, 30, 3, fixed(95)); // jeûne j1 (pas de Test)
    let kind = '';
    let penalty = -1;
    const r = dailyFoodUpkeep(c, 30, 3, fixed(95), (spec) => { kind = spec.kind; penalty = spec.penalty ?? -1; }); // j2 : Test DÛ → différé
    expect(kind).toBe('faim');
    expect(penalty).toBe(0); // 1ᵉʳ Test → pénalité 0
    expect(r.log).toEqual([]); // RIEN de pré-résolu (pas de « ÉCHEC » dans le journal)
    expect(c.hunger?.tests).toBe(0); // le compteur de Test reste à 0 ici (incrémenté seulement à la validation)
    expect(c.hunger?.days).toBe(2); // la faim a bien progressé d'un jour
  });

  it('applyFaimTest : verrouiller un échec compte le Test + applique les pénalités (l.422)', () => {
    const c = hero({ rations: 0, E: 30 });
    c.hunger = { days: 2, tests: 0, failures: 0 };
    const r1 = applyFaimTest(c, false, 3, fixed(95)); // 1ᵉʳ échec → −10 F/E
    expect(c.hunger?.tests).toBe(1);
    expect(c.hunger?.failures).toBe(1);
    expect(r1.damage).toBe(0);
    expect(effectiveChar(c, 'F')).toBe(20);
    const r2 = applyFaimTest(c, false, 3, fixed(95)); // 2ᵉ échec → −10 autres + 1d10 − BE
    expect(c.hunger?.failures).toBe(2);
    expect(r2.damage).toBe(7); // d10 forcé 10 − BE 3
    // Réussite : compte le Test, aucune pénalité.
    const r3 = applyFaimTest(c, true, 3, fixed(1));
    expect(c.hunger?.tests).toBe(3);
    expect(r3.damage).toBe(0);
  });
});

describe('Faim & repos (LDB 18 l.418) : pas de récupération naturelle sans provisions', () => {
  it('affamé : le repos ne rend ni PB ni Exténué (les maladies suivent leur cours)', () => {
    const c = hero({ rations: 0 });
    c.hunger = { days: 2, tests: 1, failures: 0 };
    c.wounds.current = 5;
    addCondition(c, 'extenue', 2);
    const log = restRecovery(c, makeRNG(1));
    expect(c.wounds.current).toBe(5);
    expect(stacks(c, 'extenue')).toBe(2);
    expect(log.join(' ')).toContain('affamé');
  });

  it('nourri : le repos fonctionne normalement', () => {
    const c = hero({ rations: 1 });
    c.wounds.current = 5;
    addCondition(c, 'extenue', 2);
    restRecovery(c, makeRNG(1));
    expect(c.wounds.current).toBeGreaterThan(5);
    expect(stacks(c, 'extenue')).toBe(0);
  });
});

describe('dailyWaterUpkeep — Soif / privation d’eau (LDB 18 l.420)', () => {
  it('avec eau : boit, pas de soif ; la soif installée se dissipe', () => {
    const c = hero();
    c.thirst = { days: 3, tests: 2, failures: 1 };
    const w = dailyWaterUpkeep(c, true, 30, 3, fixed(1));
    expect(w.drank).toBe(true);
    expect(isThirsty(c)).toBe(false);
    expect(w.log.join(' ')).toContain('se désaltère');
  });

  it('sans eau : Test QUOTIDIEN (1ᵉʳ échec → −10 Int/FM/Soc, pas de dégâts)', () => {
    const c = hero();
    const w = dailyWaterUpkeep(c, false, 30, 3, fixed(95)); // jour 1 : Test raté → 1ᵉʳ échec
    expect(c.thirst?.days).toBe(1);
    expect(c.thirst?.failures).toBe(1);
    expect(w.damage).toBe(0);
    expect(effectiveChar(c, 'Int')).toBe(20);
    expect(effectiveChar(c, 'FM')).toBe(20);
    expect(effectiveChar(c, 'Soc')).toBe(20);
    expect(effectiveChar(c, 'F')).toBe(30); // F reste intacte au 1ᵉʳ échec
  });

  it('2ᵉ échec : −10 aux autres Caractéristiques + 1d10 − BE (min 1) Dégâts', () => {
    const c = hero({ E: 30 });
    dailyWaterUpkeep(c, false, 30, 3, fixed(95)); // j1 : 1ᵉʳ échec
    const w2 = dailyWaterUpkeep(c, false, 30, 3, fixed(95)); // j2 : Test plus dur, 2ᵉ échec
    expect(c.thirst?.failures).toBe(2);
    expect(w2.damage).toBe(7); // d10 forcé 10 − BE 3
    expect(effectiveChar(c, 'F')).toBe(20); // « toutes les autres » désormais touchées
    expect(thirstCharPenalties(c, 'CC')).toEqual([-10]);
  });

  it('Tests de plus en plus durs (−10 cumulatif, l.418)', () => {
    const c = hero();
    const w1 = dailyWaterUpkeep(c, false, 30, 3, fixed(1)); // j1 réussi
    expect(w1.log.join(' ')).not.toContain('−'); // 1ᵉʳ Test : pas de malus
    const w2 = dailyWaterUpkeep(c, false, 30, 3, fixed(1)); // j2
    expect(w2.log.join(' ')).toContain('(−10)'); // 2ᵉ Test : −10
  });

  it('deferTest : le Test devient une étape de cascade (rien de roulé ici)', () => {
    const c = hero();
    const seen: { kind: string }[] = [];
    const w = dailyWaterUpkeep(c, false, 30, 3, fixed(95), (spec) => seen.push(spec));
    expect(seen[0]?.kind).toBe('soif');
    expect(c.thirst?.days).toBe(1);
    expect(c.thirst?.tests).toBe(0); // compteur à 0 ici (incrément différé)
    expect(w.log).toEqual([]);
  });

  it('applySoifTest : applique le résultat différé', () => {
    const c = hero({ E: 30 });
    const r1 = applySoifTest(c, false, 3, fixed(95)); // 1ᵉʳ échec
    expect(c.thirst?.failures).toBe(1);
    expect(r1.damage).toBe(0);
    const r2 = applySoifTest(c, false, 3, fixed(95)); // 2ᵉ échec → dégâts
    expect(r2.damage).toBe(7);
  });

  describe('provisioningManifest — manifeste d\'avitaillement au départ (#241)', () => {
    it('suffisant : rations et eau couvrent les jours estimés', () => {
      const party = [hero({ rations: 5 }), hero({ rations: 5 })];
      const m = provisioningManifest(party, 100, 3);
      expect(m.joursEstimes).toBe(3);
      expect(m.rationsDispo).toBe(10);
      expect(m.rationsRequises).toBe(6); // 2 héros × 3 jours
      expect(m.eauRequiseLitres).toBe(18); // 2 héros × 3 jours × 3 L (médiane)
      expect(m.eauDispoLitres).toBe(100);
      expect(m.suffisant).toBe(true);
    });

    it('insuffisant en vivres', () => {
      const party = [hero({ rations: 1 })];
      const m = provisioningManifest(party, 100, 5);
      expect(m.rationsDispo).toBe(1);
      expect(m.rationsRequises).toBe(5);
      expect(m.suffisant).toBe(false);
    });

    it('insuffisant en eau seule (vivres suffisants)', () => {
      const party = [hero({ rations: 10 })];
      const m = provisioningManifest(party, 5, 5); // besoin 15 L, dispo 5
      expect(m.eauRequiseLitres).toBe(15);
      expect(m.suffisant).toBe(false);
    });

    it('waterLitres absent : ravitaillement réputé assuré, ne bloque pas', () => {
      const party = [hero({ rations: 10 })];
      const m = provisioningManifest(party, undefined, 5);
      expect(m.eauDispoLitres).toBeNull();
      expect(m.suffisant).toBe(true);
    });

    it('Brouet : 1 ration couvre 2 jours de voyage', () => {
      const party = [hero({ rations: 2, brouet: true })];
      const m = provisioningManifest(party, 100, 4);
      expect(m.rationsRequises).toBe(2); // ceil(4/2)
      expect(m.suffisant).toBe(true);
    });

    it('héros morts exclus du manifeste', () => {
      const party = [hero({ rations: 0 }), { ...hero({ rations: 0 }), dead: true }];
      const m = provisioningManifest(party, 100, 3);
      expect(m.rationsRequises).toBe(3); // un seul héros vivant compté
    });
  });

  it('isDeprived : affamé OU assoiffé bloque la récupération ; assoiffé seul suffit', () => {
    const c = hero({ rations: 1 }); // pas affamé
    c.thirst = { days: 2, tests: 1, failures: 0 };
    expect(isStarving(c)).toBe(false);
    expect(isThirsty(c)).toBe(true);
    expect(isDeprived(c)).toBe(true);
    expect(needsRecoveryRoll({ ...c, wounds: { current: 5, max: 12 } } as typeof c)).toBe(false);
  });
});
