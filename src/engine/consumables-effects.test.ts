/**
 * Effets mécaniques des consommables — suite comportementale.
 * Couvre les items nouvellement câblés (LDB p.306-307 + T2C ch.2 herbes).
 *
 * Les tests d'ingestion exécutent `useConsumable` sur un Combatant fictif.
 * Les poisons-enduits (lotus-noir/racine-des-tombes) posent un onHitEffects (patron Venin) :
 * on en vérifie la STRUCTURE (Test de Résistance + branche d'échec + gate), pas le flow de combat.
 */
import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { useConsumable } from './consumables';
import { itemFromTrappingById } from './items';
import { MINUTES_PER_DAY } from './clock';
import type { Disease } from './disease';

/** Combatant minimal suffisant pour applyOps (blessures, états, maladies). */
const makeTarget = (over: Partial<Combatant> = {}): Combatant =>
  ({
    name: 'X',
    characteristics: { CC: 30, CT: 30, F: 30, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 20, base: 20 },
    conditions: [],
    activeEffects: [],
    diseases: [],
    ...over,
  }) as unknown as Combatant;

/** Maladie active synthétique (phase active, durée N jours). */
const activeDisease = (id: string, durationDays: number): Disease => ({
  name: id,
  symptoms: [],
  phase: 'active',
  minutesLeft: durationDays * MINUTES_PER_DAY,
  durationMinutes: durationDays * MINUTES_PER_DAY,
});

/** Branche `then` du Flow onHit (patron Venin) d'un poison-enduit : `if[…] → test → fail`. */
type VeninThen = {
  test: { skill?: string; difficulty?: string; unlessImmune?: string; onlyGroups?: string[] };
  fail: { effect: { ops: { op: string; name?: string; value?: number }[] } };
};
const onHitVeninThen = (id: string): VeninThen => {
  const itm = itemFromTrappingById(id)!;
  const aug = itm.consumable?.find((o) => o.op === 'augmentWeapon') as
    | { op: 'augmentWeapon'; onHitEffects?: { flow: { then: VeninThen } }[] }
    | undefined;
  return aug!.onHitEffects![0].flow.then;
};

// ── Poisons LDB p.306 ─────────────────────────────────────────────────────────

describe('brise-coeur (LDB p.306) — poison ingéré', () => {
  it("inflige 4 états Empoisonné : « la mixture mortelle inflige 4 États Empoisonné »", () => {
    const c = makeTarget();
    const itm = itemFromTrappingById('brise-coeur')!;
    expect(itm.consumable?.length).toBeGreaterThan(0);
    useConsumable(c, itm);
    expect(c.conditions.find((x) => x.name === 'empoisonne')?.value).toBe(4);
  });
});

describe('lotus-noir (LDB p.306) — enduit arme, pas ingéré', () => {
  it("a un consumable de type augmentWeapon : « utilisée pour empoisonner les lames »", () => {
    const itm = itemFromTrappingById('lotus-noir')!;
    expect(itm.consumable?.some((o) => o.op === 'augmentWeapon')).toBe(true);
  });
  it("onHit = Test de Résistance Complexe (-10) : « Combattu avec un Test de Résistance Complexe (-10) »", () => {
    const then = onHitVeninThen('lotus-noir');
    expect(then.test.skill).toBe('resistance');
    expect(then.test.difficulty).toBe('complexe');
    expect(then.test.unlessImmune).toBe('poison');
  });
  it("échec du Test → 2 états Empoisonné : « subissent immédiatement 2 États Empoisonnés »", () => {
    const then = onHitVeninThen('lotus-noir');
    const condOp = then.fail.effect.ops.find((o) => o.op === 'condition');
    expect(condOp?.name).toBe('empoisonne');
    expect(condOp?.value).toBe(2);
  });
});

// ── Herbes LDB p.307 ──────────────────────────────────────────────────────────

describe('cataplasme-de-guerison (LDB p.307) — prévention infection', () => {
  it("pose woundDressed : « Vous ne subissez aucune Infection mineure issue d'une Blessure Critique »", () => {
    const c = makeTarget();
    const itm = itemFromTrappingById('cataplasme-de-guerison')!;
    expect(itm.consumable?.length).toBeGreaterThan(0);
    useConsumable(c, itm);
    expect(c.woundDressed).toBe(true);
  });
});

// ── Herbes T2C ch.2 ───────────────────────────────────────────────────────────

describe('gesundheit (T2C p.13) — cataplasme Blessure Purulente', () => {
  it("réduit la durée d'une maladie active de 1 jour : « réduire la durée d'un jour par DR obtenu »", () => {
    const dz = activeDisease('blessure-purulente', 5);
    const c = makeTarget({ diseases: [dz] as Combatant['diseases'] });
    const itm = itemFromTrappingById('gesundheit')!;
    expect(itm.consumable?.length).toBeGreaterThan(0);
    useConsumable(c, itm);
    expect(c.diseases![0].minutesLeft).toBe(4 * MINUTES_PER_DAY);
  });

  it('ne descend pas en dessous de 1 jour (plancher moteur)', () => {
    const dz = activeDisease('blessure-purulente', 1);
    const c = makeTarget({ diseases: [dz] as Combatant['diseases'] });
    useConsumable(c, itemFromTrappingById('gesundheit')!);
    expect(c.diseases![0].minutesLeft).toBe(MINUTES_PER_DAY);
  });

  it('sans maladie active → inerte, pas d\'erreur', () => {
    const c = makeTarget();
    expect(() => useConsumable(c, itemFromTrappingById('gesundheit')!)).not.toThrow();
  });
});

describe('racine-des-tombes (T2C p.14) — enduit anti-mort-vivant', () => {
  it("a un consumable augmentWeapon : « Étalée sur une arme, la sève est nocive pour les Mort-vivants »", () => {
    const itm = itemFromTrappingById('racine-des-tombes')!;
    expect(itm.consumable?.some((o) => o.op === 'augmentWeapon')).toBe(true);
  });

  it("onHit = Test de Résistance Complexe (-10) gatté Mort-vivant : « inflige un État Empoisonné si elles ne réussissent pas un Test de Résistance Complexe (-10) »", () => {
    const then = onHitVeninThen('racine-des-tombes');
    expect(then.test.skill).toBe('resistance');
    expect(then.test.difficulty).toBe('complexe');
    expect(then.test.onlyGroups).toContain('Mort-vivant');
  });

  it("échec du Test → 1 état Empoisonné (op aussi gatté Mort-vivant, défense en profondeur)", () => {
    const then = onHitVeninThen('racine-des-tombes');
    const condOp = then.fail.effect.ops.find((o) => o.op === 'condition') as
      | { op: string; name?: string; value?: number; onlyGroups?: string[] }
      | undefined;
    expect(condOp?.name).toBe('empoisonne');
    expect(condOp?.value).toBe(1);
    expect(condOp?.onlyGroups).toContain('Mort-vivant');
  });
});

describe('rouille-mouchetee (T2C p.14) — pas de consumable', () => {
  it("n'a PAS de consumable : « Chaque dose réduit la durée de 1d10 jours » — Formula dé non supportée par reduceDiseaseDays", () => {
    const itm = itemFromTrappingById('rouille-mouchetee')!;
    expect(itm.consumable ?? []).toHaveLength(0);
  });
});
