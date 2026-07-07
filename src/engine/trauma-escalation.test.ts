import { describe, it, expect } from 'vitest';
import { receiveMedicalAid, tickFingerLossEscalation, tickTraumaRecovery, stampCriticalEscalation,
  recoverableTraumas, hasRecoverableTrauma, hasLimbAwaitingAid, recoverDisabledLimb, cannotWieldTwoHanded,
  traumaMovementHalved } from './trauma';
import { addCondition, removeCondition, hasCondition } from './conditions';
import { applyOps } from './ops';
import { resolveAACritical } from './aaCritical';
import type { Combatant, Trauma, HitLocation } from './types';
import type { Condition } from './flowCore';
import type { RNG } from './dice';
import aaJson from '../data/aa-criticals.json';
import criticalsJson from '../data/criticals.json';

const UNTIL_AID: Condition = { kind: 'flag', expr: '!awaitingMedicalAid' };

const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'c', name: 'C', kind: 'hero', conditions: [], skills: [],
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as Combatant);

/** Plaie chirurgicale (« Amputation ») telle que la posent rollCritical/resolveAACritical. */
const plaie = (loc: HitLocation, extra: Partial<Trauma> = {}): Trauma =>
  ({ label: 'Amputation', location: loc, needsSurgery: true, desc: 'x', ...extra });

/** RNG qui débite une séquence fixe (int() ignore min/max — tests ciblés). */
const seq = (vals: number[]): RNG => { let i = 0; return { int: () => vals[i++ % vals.length] }; };

describe('#166/#167 — Aide Médicale reçue (LDB 18 l.307-312) : flag partagé', () => {
  it('receiveMedicalAid lève awaitingMedicalAid sur TOUTES les séquelles en attente', () => {
    const c = C({ traumas: [plaie('brasD', { awaitingMedicalAid: true, fingerLossPerRound: true }), plaie('corps')] });
    const log = receiveMedicalAid(c);
    expect(c.traumas!.every((t) => !t.awaitingMedicalAid)).toBe(true);
    expect(log.join(' ')).toMatch(/Aide Médicale/);
  });
  it('receiveMedicalAid : no-op (aucune ligne) si rien en attente', () => {
    const c = C({ traumas: [plaie('brasD')] });
    expect(receiveMedicalAid(c)).toEqual([]);
  });
  it('les formes op (sort/prière = heal ; bandage/cataplasme = preventInfection) lèvent le flag via applyOps', () => {
    const gate = (): Trauma => plaie('brasD', { awaitingMedicalAid: true, fingerLossPerRound: true });
    const cHeal = C({ wounds: { current: 3, max: 10 }, traumas: [gate()] });
    applyOps(cHeal, [{ op: 'heal', amount: 2 }], {});
    expect(cHeal.traumas!.every((t) => !t.awaitingMedicalAid)).toBe(true);
    const cBandage = C({ traumas: [gate()] });
    applyOps(cBandage, [{ op: 'preventInfection' }], {});
    expect(cBandage.traumas!.every((t) => !t.awaitingMedicalAid)).toBe(true);
  });
});

describe('#167 — « Main ouverte » : 1 doigt de plus par Round sans Aide Médicale (AA l.2571 / LDB)', () => {
  it('chaque tick perd un doigt ; 4 doigts → main tranchée ; l’escalade se coupe alors', () => {
    const c = C({ traumas: [plaie('brasD', { awaitingMedicalAid: true, fingerLossPerRound: true })] });
    for (let r = 0; r < 3; r++) tickFingerLossEscalation(c);
    const fingers = c.traumas!.find((t) => t.traumaId === 'doigt-ampute');
    expect(fingers?.count).toBe(3);
    expect(c.traumas!.some((t) => t.traumaId === 'main-bras-ampute')).toBe(false);
    tickFingerLossEscalation(c); // 4e doigt → main tranchée
    expect(c.traumas!.some((t) => t.traumaId === 'main-bras-ampute')).toBe(true);
    expect(c.traumas!.some((t) => t.traumaId === 'doigt-ampute')).toBe(false);
    const stump = c.traumas!.find((t) => t.label === 'Amputation');
    expect(stump?.fingerLossPerRound).toBeFalsy();
    expect(stump?.awaitingMedicalAid).toBeFalsy();
  });
  it('Aide Médicale reçue AVANT le 4e Round stoppe l’escalade (le membre est sauvé)', () => {
    const c = C({ traumas: [plaie('brasD', { awaitingMedicalAid: true, fingerLossPerRound: true })] });
    tickFingerLossEscalation(c); // 1 doigt
    receiveMedicalAid(c); // soin
    tickFingerLossEscalation(c); // plus rien
    tickFingerLossEscalation(c);
    expect(c.traumas!.find((t) => t.traumaId === 'doigt-ampute')?.count).toBe(1);
    expect(c.traumas!.some((t) => t.traumaId === 'main-bras-ampute')).toBe(false);
  });
  it('une main déjà amputée sur l’AUTRE bras ne coupe PAS une escalade « Main ouverte » fraîche', () => {
    // brasD : ancienne amputation de main (crit antérieur). brasG : escalade « Main ouverte » fraîche.
    const c = C({ traumas: [
      { label: 'Main tranchée (brasD)', traumaId: 'main-bras-ampute', location: 'brasD', desc: 'x', ops: [{ op: 'maxWeaponHands', hands: 1 }] },
      plaie('brasG', { awaitingMedicalAid: true, fingerLossPerRound: true }),
    ] });
    for (let r = 0; r < 3; r++) tickFingerLossEscalation(c);
    // L'escalade de brasG doit avoir progressé malgré la main amputée de brasD.
    expect(c.traumas!.find((t) => t.traumaId === 'doigt-ampute' && t.location === 'brasG')?.count).toBe(3);
    const stumpG = c.traumas!.find((t) => t.label === 'Amputation' && t.location === 'brasG');
    expect(stumpG?.fingerLossPerRound).toBe(true); // toujours en escalade (pas coupée par brasD)
    expect(stumpG?.awaitingMedicalAid).toBe(true);
    tickFingerLossEscalation(c); // 4e doigt sur brasG → main tranchée sur brasG
    expect(c.traumas!.some((t) => t.traumaId === 'main-bras-ampute' && t.location === 'brasG')).toBe(true);
    expect(c.traumas!.find((t) => t.label === 'Amputation' && t.location === 'brasG')?.fingerLossPerRound).toBeFalsy();
  });
});

describe('#167 — « Pied écrasé » : perte du pied si pas de Chirurgie sous 1d10 jours (AA l.2624 / LDB)', () => {
  it('le décompte expire sans Chirurgie → séquelle permanente du membre inférieur posée', () => {
    const c = C({ traumas: [plaie('jambeD', { amputateAfterDays: 3, amputateSequel: 'membre-inferieur-ampute' })] });
    tickTraumaRecovery(c, 1);
    expect(c.traumas!.find((t) => t.label === 'Amputation')?.amputateAfterDays).toBe(2);
    const log = tickTraumaRecovery(c, 2); // échéance atteinte
    expect(log.join(' ')).toMatch(/membre est perdu/);
    const seqT = c.traumas!.find((t) => t.traumaId === 'membre-inferieur-ampute');
    expect(seqT).toBeTruthy();
    expect(seqT!.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    // La plaie subsiste (moignon à opérer) mais sans décompte d’escalade.
    expect(c.traumas!.find((t) => t.label === 'Amputation')?.amputateAfterDays).toBeUndefined();
  });
  it('Chirurgie AVANT l’échéance (plaie retirée) → pas d’amputation du pied', () => {
    const c = C({ traumas: [plaie('jambeD', { amputateAfterDays: 3, amputateSequel: 'membre-inferieur-ampute' })] });
    c.traumas = []; // simule removeSurgicalTrauma (l’opération a retiré la plaie chirurgicale)
    const log = tickTraumaRecovery(c, 5);
    expect(log.join(' ')).not.toMatch(/membre est perdu/);
    expect(c.traumas!.some((t) => t.traumaId === 'membre-inferieur-ampute')).toBe(false);
  });
});

describe('#166/#167 — câblage DONNÉE→plaie (stampCriticalEscalation) + entrées de tables', () => {
  it('stamp « Main ouverte » pose fingerLossPerRound + awaitingMedicalAid sur la plaie', () => {
    const traumas = [plaie('brasD')];
    stampCriticalEscalation(traumas, { fingerLossPerRound: true }, 'brasD');
    expect(traumas[0].fingerLossPerRound).toBe(true);
    expect(traumas[0].awaitingMedicalAid).toBe(true);
  });
  it('stamp « Pied écrasé » pose amputateAfterDays (1d10) + amputateSequel', () => {
    const traumas = [plaie('jambeD')];
    stampCriticalEscalation(traumas, { amputateAfter1d10Days: true, amputateSequel: 'membre-inferieur-ampute' }, 'jambeD', seq([7]));
    expect(traumas[0].amputateAfterDays).toBe(7);
    expect(traumas[0].amputateSequel).toBe('membre-inferieur-ampute');
  });
  it('les 4 entrées d’escalade doigt/pied portent l’escalade attendue', () => {
    const find = (arr: { id: string; escalation?: unknown }[], id: string) => arr.find((e) => e.id === id)!.escalation as Record<string, unknown>;
    expect(find(aaJson.bras, 'aa-bras-116')).toEqual({ fingerLossPerRound: true });
    expect(find(aaJson.jambe, 'aa-jambe-106')).toEqual({ amputateAfter1d10Days: true, amputateSequel: 'membre-inferieur-ampute' });
    expect(find(criticalsJson.bras, 'main-ouverte')).toEqual({ fingerLossPerRound: true });
    expect(find(criticalsJson.jambe, 'pied-ecrase')).toEqual({ amputateAfter1d10Days: true, amputateSequel: 'membre-inferieur-ampute' });
  });
  it('resolveAACritical(« Pied écrasé ») stampe l’escalade sur la plaie (overkill place le jet en 106-115)', () => {
    // roll = d100 + 10×overkill ; d100=100, overkill=1 → 110 (aa-jambe-106). Puis Test de Résistance
    // d’amputation (d100 haut = échec sans conséquence de flag), puis d10=5 pour amputateAfterDays.
    const c = C({ skills: [{ skillId: 'resistance', characteristic: 'E', advances: 0 }] });
    const res = resolveAACritical(c, 'jambeD', seq([100, 1, 5]), 1);
    const p = res.traumas.find((t) => t.label === 'Amputation');
    expect(p?.amputateAfterDays).toBe(5);
    expect(p?.amputateSequel).toBe('membre-inferieur-ampute');
  });
});

describe('#166 — « Épaule luxée »/« Genou démis » : membre désactivé → Test étendu de Guérison (AA l.125/179 / LDB)', () => {
  it('stamp `medicalAidGate` POUSSE une séquelle « membre désactivé » (pas de plaie chirurgicale) à la localisation', () => {
    const traumas: Trauma[] = []; // Épaule luxée n’engendre PAS d’amputation → aucune plaie chirurgicale préalable
    stampCriticalEscalation(traumas, {
      medicalAidGate: { label: 'Épaule luxée (bras perdu)', disable: [{ op: 'maxWeaponHands', hands: 1 }], restoreDR: 6, recoveryPenalty: [{ op: 'charMod', char: 'CC', mod: -10 }] },
    }, 'brasD');
    expect(traumas).toHaveLength(1);
    const t = traumas[0];
    expect(t.location).toBe('brasD');
    expect(t.restoreDR).toBe(6);
    expect(t.awaitingMedicalAid).toBe(true);
    expect(t.ops).toEqual([{ op: 'maxWeaponHands', hands: 1 }]);
    expect(t.recoveryPenalty).toEqual([{ op: 'charMod', char: 'CC', mod: -10 }]);
  });

  it('le membre désactivé grève passivement (bras → 2 mains impossibles ; jambe → Mouvement ÷2)', () => {
    const arm = C({ traumas: [{ label: 'x', location: 'brasD', awaitingMedicalAid: true, restoreDR: 6, ops: [{ op: 'maxWeaponHands', hands: 1 }] }] });
    expect(cannotWieldTwoHanded(arm)).toBe(true);
    const leg = C({ traumas: [{ label: 'x', location: 'jambeD', awaitingMedicalAid: true, restoreDR: 6, ops: [{ op: 'moveScale', num: 1, den: 2 }] }] });
    expect(traumaMovementHalved(leg)).toBe(true);
  });

  it('récupération BLOQUÉE tant que l’Aide Médicale n’est pas reçue, puis débloquée (LDB l.120/179)', () => {
    const c = C({ traumas: [{ label: 'x', location: 'brasD', awaitingMedicalAid: true, restoreDR: 6, recoveryPenalty: [{ op: 'charMod', char: 'CC', mod: -10 }] }] });
    expect(hasLimbAwaitingAid(c)).toBe(true);
    expect(hasRecoverableTrauma(c)).toBe(false); // le Test étendu demeure indisponible avant l’Aide Médicale
    receiveMedicalAid(c);
    expect(hasLimbAwaitingAid(c)).toBe(false);
    expect(recoverableTraumas(c)).toHaveLength(1);
  });

  it('`recoverDisabledLimb` retire la séquelle et rend sa `recoveryPenalty` (posée par l’appelant, 1d10 j)', () => {
    const c = C({ traumas: [
      { label: 'Genou démis (jambe perdue)', location: 'jambeD', restoreDR: 6, ops: [{ op: 'moveScale', num: 1, den: 2 }], recoveryPenalty: [{ op: 'charMod', char: 'Ag', mod: -10 }, { op: 'moveScale', num: 1, den: 2 }] },
    ] });
    const { penalty, log } = recoverDisabledLimb(c, 0);
    expect(c.traumas).toHaveLength(0); // le membre désactivé est retiré (usage récupéré)
    expect(penalty).toEqual([{ op: 'charMod', char: 'Ag', mod: -10 }, { op: 'moveScale', num: 1, den: 2 }]);
    expect(log.join(' ')).toMatch(/usage du membre récupéré/);
  });

  it('Sonné « jusqu’à Aide Médicale » : `lockedUntil` (flag) le retient tant qu’une séquelle attend l’Aide', () => {
    const c = C({ traumas: [{ label: 'x', location: 'brasD', awaitingMedicalAid: true, restoreDR: 6 }] });
    addCondition(c, 'sonne', 1, undefined, UNTIL_AID);
    removeCondition(c, 'sonne'); // récupération d’État normale : INERTE (verrouillé)
    expect(hasCondition(c, 'sonne')).toBe(true);
    receiveMedicalAid(c); // Aide reçue → le verrou tombe
    removeCondition(c, 'sonne');
    expect(hasCondition(c, 'sonne')).toBe(false);
  });

  it('resolveAACritical(« Épaule luxée » 96-109) stampe le membre désactivé (usage à récupérer)', () => {
    const c = C({});
    const res = resolveAACritical(c, 'brasD', seq([100]), 0); // d100=100 → aa-bras-96 (96-109)
    const t = res.traumas.find((x) => x.restoreDR != null);
    expect(t?.restoreDR).toBe(6);
    expect(t?.awaitingMedicalAid).toBe(true);
    expect(t?.location).toBe('brasD');
    expect(t?.ops).toEqual([{ op: 'maxWeaponHands', hands: 1 }]);
  });

  it('les 4 entrées « Épaule luxée »/« Genou démis » portent `medicalAidGate` (DR 6)', () => {
    const gate = (arr: { id: string; escalation?: { medicalAidGate?: { restoreDR: number } } }[], id: string) =>
      arr.find((e) => e.id === id)!.escalation!.medicalAidGate!;
    expect(gate(aaJson.bras, 'aa-bras-96').restoreDR).toBe(6);
    expect(gate(aaJson.jambe, 'aa-jambe-96').restoreDR).toBe(6);
    expect(gate(criticalsJson.bras, 'epaule-luxee').restoreDR).toBe(6);
    expect(gate(criticalsJson.jambe, 'genou-demis').restoreDR).toBe(6);
  });
});
