import { describe, it, expect } from 'vitest';
import { traumaById, dechirureFractureFicheId, traumaRecoveryDays, tickTraumaRecovery, applyFractureEnd, treatTrauma, hasTreatableTrauma, traumaSkillPenalty, hasSurgeryTrauma, removeSurgicalTrauma, AMPUTATION_WOUND_DESC } from './trauma';
import type { HitLocation } from './types';
const tk = (k: 'dechirure' | 'fracture', sv: 'mineur' | 'majeur', loc: HitLocation, opts?: { be?: number; d10?: number }) => traumaById(dechirureFractureFicheId(k, sv, loc), opts, loc);
import { testValue } from './skills';
import type { Combatant } from './types';
import type { RNG } from './dice';

const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'c', label: 'C', kind: 'hero', conditions: [], skills: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as Combatant);

describe('Convalescence des Blessures critiques (LDB 18)', () => {
  it('traumaRecoveryDays : déchirure mineure 30−BE, majeure ×2, fracture 30+1d10 (+10 majeure)', () => {
    expect(traumaRecoveryDays('dechirure', 'mineur', 4)).toBe(26);
    expect(traumaRecoveryDays('dechirure', 'majeur', 4)).toBe(52);
    expect(traumaRecoveryDays('fracture', 'mineur', 4, 7)).toBe(37);
    expect(traumaRecoveryDays('fracture', 'majeur', 4, 7)).toBe(47);
    expect(traumaRecoveryDays('dechirure', 'mineur', 50)).toBe(1); // plancher
  });

  it('traumaFromKind pose recoveryDays/recoveryTotal/kind/severity quand BE fourni', () => {
    const t = tk('dechirure', 'mineur', 'jambeD', { be: 4 });
    expect(t.recoveryDays).toBe(26);
    expect(t.recoveryTotal).toBe(26);
    expect(t.kind).toBe('dechirure');
    expect(tk('dechirure', 'mineur', 'jambeD').recoveryDays).toBeUndefined();
  });

  it('tickTraumaRecovery : guérit une déchirure à 0 (retire trauma + pénalités, décrémente criticalWounds)', () => {
    const c = C({ traumas: [tk('dechirure', 'mineur', 'jambeD', { be: 28 })], criticalWounds: 1 }); // 2 jours
    tickTraumaRecovery(c, 1);
    expect(c.traumas![0].recoveryDays).toBe(1);
    const log = tickTraumaRecovery(c, 1);
    expect(c.traumas!.length).toBe(0);
    expect(c.criticalWounds).toBe(0);
    expect(log.join(' ')).toMatch(/guérit/);
  });

  it('déchirure MAJEURE de jambe : rémission partielle (−20 → −10) à la mi-durée (l.326)', () => {
    const t = tk('dechirure', 'majeur', 'jambeD', { be: 20 }); // total 2×(30−20)=20, mi = 10
    const c = C({ traumas: [t] });
    const esquiveMod = (tr: typeof t) => tr.ops?.flatMap((o) => (o.op === 'skillMod' && o.skill === 'esquive' ? [o.mod] : []))[0];
    expect(esquiveMod(c.traumas![0])).toBe(-20);
    tickTraumaRecovery(c, 9); // reste 11 > 10 → toujours −20
    expect(esquiveMod(c.traumas![0])).toBe(-20);
    tickTraumaRecovery(c, 1); // reste 10 ≤ 10 → −10
    expect(esquiveMod(c.traumas![0])).toBe(-10);
    tickTraumaRecovery(c, 10); // reste 0 → guéri
    expect(c.traumas!.length).toBe(0);
  });

  it('tickTraumaRecovery(defer) : DIFFÈRE le Test de fin de fracture ; applyFractureEnd applique la séquelle', () => {
    const t = tk('fracture', 'mineur', 'jambeD', { be: 28 });
    t.recoveryDays = 1; // résolution au prochain tick
    const c = C({ traumas: [t], criticalWounds: 1 });
    const collected: { kind: string; meta?: Record<string, unknown> }[] = [];
    tickTraumaRecovery(c, 1, undefined, 30, (spec) => collected.push(spec));
    expect(collected[0]?.kind).toBe('traumaFracture'); // Test de fin DIFFÉRÉ en étape
    expect(c.traumas!.length).toBe(0); // la fracture est retirée (résolution déférée)
    expect(c.criticalWounds).toBe(0);
    // Échec à la validation → séquelle permanente ajoutée.
    const log = applyFractureEnd(c, false, String(collected[0].meta!.severity), String(collected[0].meta!.location), String(collected[0].meta!.traumaLabel));
    expect(c.traumas!.length).toBe(1);
    expect(log.join(' ')).toMatch(/mal ressoudée/);
  });

  it('fracture : Test de Résistance de fin RATÉ → séquelle permanente (−5 Ag) (l.300)', () => {
    const t = tk('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 }); // 35 jours
    const c = C({ traumas: [t], criticalWounds: 1 });
    const fail: RNG = { int: () => 95 }; // resistVal 0 → cible 20 ; 95 > 20 → échec
    tickTraumaRecovery(c, 40, fail, 0);
    expect(c.traumas!.length).toBe(1); // la fracture part, mais une séquelle reste
    expect(c.traumas![0].label).toMatch(/mal ressoudée/);
    expect(c.traumas![0].ops).toContainEqual({ op: 'charMod', char: 'agilite', mod: -5 });
    expect(c.traumas![0].recoveryDays).toBeUndefined(); // permanente
  });

  it('fracture : Test de fin RÉUSSI → guérison propre (aucune séquelle)', () => {
    const t = tk('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 });
    const c = C({ traumas: [t] });
    const ok: RNG = { int: () => 10 }; // resistVal 60 → cible 80 ; 10 ≤ 80 → réussite
    tickTraumaRecovery(c, 40, ok, 60);
    expect(c.traumas!.length).toBe(0);
  });

  it('fracture « réduite » par la Guérison (treatTrauma dans la semaine) → pas de Test de fin (l.302)', () => {
    const t = tk('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 }); // 35 j ; fenêtre = >28
    const c = C({ traumas: [t] });
    expect(hasTreatableTrauma(c)).toBe(true); // dans la semaine
    treatTrauma(c, 2);
    expect(c.traumas![0].fractureSet).toBe(true);
    const fail: RNG = { int: () => 99 };
    tickTraumaRecovery(c, 40, fail, 0); // fractureSet → aucun Test → guérison propre malgré le mauvais jet
    expect(c.traumas!.length).toBe(0);
  });

  it('treatTrauma : déchirure mineure raccourcie −1 j −1/DR, une fois ; majeure non accélérée (l.326)', () => {
    const mineure = C({ traumas: [tk('dechirure', 'mineur', 'jambeD', { be: 4 })] }); // 26 j
    treatTrauma(mineure, 3);
    expect(mineure.traumas![0].recoveryDays).toBe(22); // −(1+3)
    treatTrauma(mineure, 5);
    expect(mineure.traumas![0].recoveryDays).toBe(22); // déjà traité

    const majeure = C({ traumas: [tk('dechirure', 'majeur', 'jambeD', { be: 4 })] }); // 52 j
    const before = majeure.traumas![0].recoveryDays;
    treatTrauma(majeure, 5);
    expect(majeure.traumas![0].recoveryDays).toBe(before); // pas d'accélération
  });

  it('fracture à la TÊTE mal ressoudée → séquelle de Langue permanente (l.300/309)', () => {
    const t = tk('fracture', 'majeur', 'tete', { be: 4, d10: 5 });
    const c = C({ traumas: [t], skills: [{ skillId: 'langue', spec: 'reikspiel', advances: 20, characteristic: 'intelligence' } as never] });
    const fail: RNG = { int: () => 95 };
    tickTraumaRecovery(c, 50, fail, 0); // fin de convalescence, Test raté
    const seq = c.traumas![0];
    expect(seq.ops).toContainEqual({ op: 'skillMod', skill: 'langue', mod: -10 }); // majeure
    expect(traumaSkillPenalty(c, 'langue')).toBe(-10); // séquelle de Langue (par id stable)
    expect(traumaSkillPenalty(c, 'charme')).toBe(0);
    // testValue intègre la séquelle : Int 30 + 20 avances − 10 = 40.
    expect(testValue(c, 'langue')).toBe(40);
  });

  it('Chirurgie : une fracture MAJEURE exige la chirurgie ; removeSurgicalTrauma la retire (criticalWounds--)', () => {
    const fm = tk('fracture', 'majeur', 'jambeG', { be: 4, d10: 5 });
    expect(fm.needsSurgery).toBe(true);
    const fmin = tk('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 });
    expect(fmin.needsSurgery).toBeUndefined(); // mineure : pas de chirurgie
    const c = C({ traumas: [fm], criticalWounds: 1 });
    expect(hasSurgeryTrauma(c)).toBe(true);
    const log = removeSurgicalTrauma(c);
    expect(c.traumas!.length).toBe(0);
    expect(c.criticalWounds).toBe(0);
    expect(log.join(' ')).toMatch(/chirurgie/i);
    expect(hasSurgeryTrauma(c)).toBe(false);
  });

  it('parité #365 : prose migrée en donnée (traumas.json), byte-identique à l’ancien code en dur', () => {
    // Séquelle de fracture mal ressoudée (ex-`fractureSequela`, LDB 18 l.202) — desc lue depuis la fiche.
    const membre = C({});
    applyFractureEnd(membre, false, 'mineur', 'jambeG', 'Fracture');
    expect(membre.traumas![0].desc).toBe('Sur un échec, vous subirez une pénalité permanente à tous vos Tests d’Agilité pour une blessure au Bras, à la Jambe ou au Torse.');
    const tete = C({});
    applyFractureEnd(tete, false, 'majeur', 'tete', 'Fracture');
    expect(tete.traumas![0].desc).toBe('Sur un échec, vous subirez une pénalité permanente à tous vos Tests de Langue s’il s’agit d’une blessure à la tête mal guérie.');
    // Plaie chirurgicale d'amputation (ex-`AMPUTATION_WOUND_DESC`, LDB 18 l.239).
    expect(AMPUTATION_WOUND_DESC).toBe('Toutes les amputations nécessitent d’être traitées par la chirurgie, ce qui signifie qu’une Blessure ne peut pas être soignée tant que vous n’êtes pas passé entre les mains d’un chirurgien.');
  });

  it('hasTreatableTrauma : faux pour une fracture hors fenêtre d’une semaine', () => {
    const t = tk('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 }); // 35 ; fenêtre >28
    const c = C({ traumas: [{ ...t, recoveryDays: 20 }] }); // 20 ≤ 28 → fenêtre fermée
    expect(hasTreatableTrauma(c)).toBe(false);
  });
});
