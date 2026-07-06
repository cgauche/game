import { describe, it, expect, afterEach } from 'vitest';
import { resolveAACritical, aaCriticalOffset, aaCriticalIsTrivial, aaDeathByCriticalCount } from './aaCritical';
import { rollCritical } from './critical';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';
import type { RNG } from './dice';

const seq = (...vals: number[]): RNG => {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
};

const CHARS = { CC: 40, CT: 40, F: 40, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
const target = (): Combatant =>
  ({ id: 't', name: 'Cible', kind: 'enemy', characteristics: CHARS, wounds: { current: 10, max: 10 }, conditions: [], skills: [], bodyShape: 'humanoide' } as unknown as Combatant);

describe('#38 — Système ALTERNATIF de Blessures Critiques (Aux Armes)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  it('décalage +10 par Blessure au-delà de 0 (l.2480)', () => {
    expect(aaCriticalOffset(0)).toBe(0);
    expect(aaCriticalOffset(8)).toBe(80); // exemple l.2498
  });

  it('résout via la table AA, applique les Blessures (colonne) + les États immédiats', () => {
    // Torse, d100 15 → « Rien qu'une égratignure ! » (11-20) : Blessures 1 + 1 État Hémorragique.
    const r = resolveAACritical(target(), 'corps', seq(15), 0);
    expect(r.name).toBe("Rien qu'une égratignure !");
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1 }, { op: 'condition', name: 'hemorragique', value: 1 }]);
    expect(r.lethal).toBe(false);
  });

  it('Test de Résistance de ligne auto-résolu : échec → États onFail ajoutés (l.2584)', () => {
    // Torse 21-25 « Coup au ventre » : 1 Sonné + Résistance Facile (+40) sous peine À Terre.
    // E 30 → cible 70 ; jet de résistance 90 > 70 → échec → À Terre.
    const r = resolveAACritical(target(), 'corps', seq(22, 90), 0);
    expect(r.name).toBe('Coup au ventre');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1 }, { op: 'condition', name: 'sonne', value: 1 }, { op: 'condition', name: 'a-terre', value: 1 }]);
  });

  it('décalage +10/Blessure pousse vers la ligne LÉTALE plafond « 00 ou plus » (l.2601)', () => {
    // Torse, d100 40 + overkill 8 (+80) = 120 ≥ 116 → « Éventré » (Mort).
    const r = resolveAACritical(target(), 'corps', seq(40), 8);
    expect(r.roll).toBe(120);
    expect(r.name).toBe('Éventré');
    expect(r.lethal).toBe(true);
  });

  it('lignes triviales « T » (l.2521) détectées pour ne pas compter dans la mort', () => {
    expect(aaCriticalIsTrivial('brasD', 5)).toBe(true);   // 01-10 « Choc au poignet » = T
    expect(aaCriticalIsTrivial('brasD', 25)).toBe(false); // 21-25 « Coupure mineure » = 1
  });

  it('mort par accumulation de Blessures Critiques (l.2517)', () => {
    expect(aaDeathByCriticalCount(true, 0, 3, 2)).toBe(true);   // Inconscient + 0 PB + 3 > BE 2
    expect(aaDeathByCriticalCount(false, 0, 3, 2)).toBe(false); // pas Inconscient
    expect(aaDeathByCriticalCount(true, 4, 3, 2)).toBe(false);  // PB > 0
    expect(aaDeathByCriticalCount(true, 0, 2, 2)).toBe(false);  // 2 n'est pas > 2
  });

  // #125 — sous-effets RÉCURRENTS/chiffrés désormais STRUCTURÉS (GameOp à durée), plus un texte arbitré.
  it('« Choc au bras » (AA bras 11-20, l.2557) : main inutilisable 1d10−BE Rounds (min 1) — STRUCTURÉ', () => {
    const r = resolveAACritical(target(), 'brasG', seq(15), 0);
    expect(r.name).toBe('Choc au bras');
    expect(r.ops).toEqual([{
      op: 'maxWeaponHands', hands: 1,
      durationRounds: { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'E' }, factor: -1 } }] },
    }]);
  });

  it('« Clef de bras » (AA bras 51-55, l.2562) : bras inutilisable 1d10 Rounds — STRUCTURÉ', () => {
    const r = resolveAACritical(target(), 'brasG', seq(53), 0);
    expect(r.name).toBe('Clef de bras');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2 }, { op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Clavicule tordue » (AA corps 41-45, l.2588) : bras (au hasard) inutilisable 1d10 Rounds — STRUCTURÉ', () => {
    const r = resolveAACritical(target(), 'corps', seq(43), 0);
    expect(r.name).toBe('Clavicule tordue');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2 }, { op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Cheville tordue » (AA jambe 21-25, l.2610) : -10 Ag pendant 1d10 Rounds — STRUCTURÉ (charMod)', () => {
    const r = resolveAACritical(target(), 'jambeG', seq(23), 0);
    expect(r.name).toBe('Cheville tordue');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1 }, { op: 'charMod', char: 'Ag', mod: -10, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Genou tordu » (AA jambe 51-55, l.2614) : -20 Ag pendant 1d10 Rounds — STRUCTURÉ (charMod)', () => {
    const r = resolveAACritical(target(), 'jambeG', seq(53), 0);
    expect(r.name).toBe('Genou tordu');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2 }, { op: 'charMod', char: 'Ag', mod: -20, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it("« Orteil contusionné » (AA jambe 01-10, l.2608) : Résistance échouée → -10 Ag 1 Round (« jusqu'à la fin du prochain Round », convention drunkIgnore) — STRUCTURÉ", () => {
    const r = resolveAACritical(target(), 'jambeG', seq(5, 90), 0); // loc 5 → ligne ; test 90 > cible 50 (E30+20) → échec
    expect(r.name).toBe('Orteil contusionné');
    expect(r.ops).toEqual([{ op: 'charMod', char: 'Ag', mod: -10, durationRounds: 1 }]);
  });

  it("« Perte d'équilibre » (AA jambe 11-20, l.2609) : Test d'ATHLÉTISME (pas Résistance) — resist.skill", () => {
    const r = resolveAACritical(target(), 'jambeG', seq(15, 90), 0); // loc 15 → ligne ; Athlétisme (Ag30+0) 90 > 30 → échec
    expect(r.name).toBe("Perte d'équilibre");
    expect(r.ops).toEqual([{ op: 'condition', name: 'a-terre', value: 1 }]);
  });

  it('le toggle bifurque rollCritical : ldb (défaut) ≠ aa', () => {
    const aa = (() => { setRule('combat-aa-blessures', 'aa'); return rollCritical(target(), 'corps', seq(15), 0); })();
    expect(aa.name).toBe("Rien qu'une égratignure !"); // table AA
    resetRule('combat-aa-blessures');
    const ldb = rollCritical(target(), 'corps', seq(15), 0);
    expect(ldb.name).not.toBe("Rien qu'une égratignure !"); // table LDB (nom différent)
  });
});
