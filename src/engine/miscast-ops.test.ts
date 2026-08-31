/**
 * Tables d'Imparfaites/Colère pleinement mécaniques (LDB 46 l.61-136, 40 l.58-138) :
 * ops émises par les tables, pénalités/blocages d'incantation temporisés, plafond
 * de DR de Prière, Tests imbriqués à palier (« Purifier la chair »).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { makeRNG } from './dice';
import { rollMiscast } from './miscast';
import { applyOps } from './ops';
import {
  castingValue, castBlockedBy, prayerMaxZeroDR, evaluateCasting, castPenaltyMod,
} from './magic';
import { endOfRound } from './conditions';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 35, sociabilite: 45 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { id: 'priere', advances: 10 }, { id: 'langue', spec: 'magick', advances: 10 },
      { id: 'focalisation', advances: 10 },
    ] as never,
    talents: [],
    ...p,
  } as Combatant;
}

describe('castPenalty — pénalités/blocages temporisés', () => {
  it('Langue maladroite : −10 aux Tests de Langue pendant N Rounds, dissipé par endOfRound', () => {
    const c = hero();
    const base = castingValue(c, 'langue', 'magick');
    applyOps(c, [{ op: 'castPenalty', skill: { id: 'langue' }, mod: -10, rounds: 2 }], { label: 'Langue maladroite' });
    expect(castingValue(c, 'langue', 'magick')).toBe(base - 10);
    expect(castPenaltyMod(c, 'priere')).toBe(0); // ne touche pas la Prière
    endOfRound(c, makeRNG(1));
    expect(castingValue(c, 'langue', 'magick')).toBe(base - 10); // round 1 restant
    const log = endOfRound(c, makeRNG(1));
    expect(castingValue(c, 'langue', 'magick')).toBe(base); // expiré
    expect(log.join('\n')).toMatch(/Langue maladroite se dissipe/);
  });

  it('blocage : « Vous abusez de ma patience » interdit les Tests de Prière', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: { id: 'priere' }, blocked: true, rounds: 3 }], { label: 'Vous abusez de ma patience' });
    expect(castBlockedBy(c, 'priere')).toBe('Vous abusez de ma patience');
    expect(castBlockedBy(c, 'langue')).toBeNull();
  });

  it('durée d\'horloge : untilTime = now + minutes/heures/jours', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: { id: 'langue' }, blocked: true, minutes: 5 }], { label: 'Drain de puissance', now: 1000 });
    expect(c.castPenalties![0].untilTime).toBe(1005);
    const c2 = hero();
    applyOps(c2, [{ op: 'castPenalty', skill: { id: 'priere' }, maxZeroDR: true, days: 7 }], { label: 'Pensez à vos actes', now: 0 });
    expect(c2.castPenalties![0].untilTime).toBe(7 * 24 * 60);
  });

  it('« Pensez à vos actes » : tout Test de Prière RÉUSSI plafonné à 0 DR', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: { id: 'priere' }, maxZeroDR: true, days: 7 }], { label: 'Pensez à vos actes', now: 0 });
    expect(prayerMaxZeroDR(c)).toBe(true);
    const prayer = { label: 'Bénédiction de Guérison', ecole: 'Béni', family: 'beni' as const, cn: null, desc: 'soin' };
    const res = evaluateCasting(c, prayer, { roll: 5, target: 55, success: true, sl: 5, isDouble: false });
    expect(res.cast).toBe(true);
    expect(res.sl).toBe(0); // plafonné
    // Un SORT (Langue) n'est pas plafonné.
    const sort = { label: 'X', ecole: 'Magie mineure', cn: 0, desc: 'x' };
    expect(evaluateCasting(c, sort, { roll: 5, target: 50, success: true, sl: 4, isDouble: false }).sl).toBe(4);
  });
});

// Les Tests imbriqués des tables (« Résistance Accessible ou Sonné », « FM ou Corruption ») ne sont PLUS
// des op `test` (supprimée Lot 4d) : `rollMiscast` les expose en `MiscastResult.testFlow` (nœud Flow
// `{kind:'test'}`), résolu CADENCE-AWARE par `applyMiscast`→`runCombatFlow` (héros manuel = jet
// influençable ; ennemi = inline). On vérifie ici la STRUCTURE produite (skill/carac/difficulté, branche
// d'échec, palier `onFailHard` via Condition `slThreshold ≤ −4`) ; la RÉSOLUTION cadence-aware (étape
// influençable, onCorruption, Inconscient à −4 DR) est testée au niveau store (`state/miscast-test.test`).
describe('Tests imbriqués des tables → nœud Flow `test`', () => {
  /** Premier `rollMiscast(sev, ...)` dont le nom commence par `prefix` (échantillonne les graines). */
  function rowNamed(sev: Parameters<typeof rollMiscast>[0], prefix: string, sin = 0) {
    for (let seed = 0; seed < 600; seed++) {
      const r = rollMiscast(sev, makeRNG(seed), sin);
      if (r.label.startsWith(prefix)) return r;
    }
    throw new Error(`entrée « ${prefix} » introuvable`);
  }

  it('« Murmures mortels » : testFlow = Test de FM Accessible → +1 Corruption sur échec', () => {
    const r = rowNamed('mineure', 'Murmures mortels');
    expect(r.testFlow).toBeTruthy();
    const node = r.testFlow!;
    expect(node.kind).toBe('test');
    if (node.kind !== 'test') return;
    expect(node.test.characteristic).toBe('force-mentale');
    expect(node.test.difficulty).toBe('accessible');
    // Branche d'échec = un `do` ops {corruption +1}.
    expect(node.fail.kind).toBe('do');
    if (node.fail.kind === 'do' && node.fail.effect.type === 'ops') {
      expect(node.fail.effect.ops).toContainEqual({ op: 'corruption', amount: 1 });
    }
  });

  it('« Choc aethyrique » : 1d10 Blessures IMMÉDIATES (ops) + testFlow Résistance → Sonné', () => {
    const r = rowNamed('majeure', 'Choc aethyrique');
    expect(r.ops.some((o) => o.op === 'wounds')).toBe(true); // Dégâts AVANT le Test (ops immédiats)
    const node = r.testFlow!;
    expect(node.kind).toBe('test');
    if (node.kind !== 'test') return;
    expect(node.test.skill).toEqual({ id: 'resistance' });
    expect(node.test.difficulty).toBe('accessible');
  });

  it('« Purifier la chair » : testFlow Résistance Difficile, palier −4 DR → Inconscient (slThreshold)', () => {
    const r = rowNamed('colere', 'Purifier la chair');
    expect(r.ops.some((o) => o.op === 'wounds')).toBe(true); // 2d10 Blessures immédiates
    const node = r.testFlow!;
    expect(node.kind).toBe('test');
    if (node.kind !== 'test') return;
    expect(node.test.skill).toEqual({ id: 'resistance' });
    expect(node.test.difficulty).toBe('difficile');
    // Branche d'échec = seq[ do{Sonné}, if slThreshold(≤ −4) → do{Inconscient} ] (palier onFailHard).
    expect(node.fail.kind).toBe('seq');
    if (node.fail.kind !== 'seq') return;
    const sonne = node.fail.steps[0];
    expect(sonne.kind).toBe('do');
    if (sonne.kind === 'do' && sonne.effect.type === 'ops') expect(sonne.effect.ops.some((o) => o.op === 'condition' && o.id === 'sonne')).toBe(true);
    const hard = node.fail.steps[1];
    expect(hard.kind).toBe('if');
    if (hard.kind === 'if') {
      expect(hard.cond).toEqual({ kind: 'slThreshold', op: '<=', value: -4 });
      expect(hard.then.kind).toBe('do');
      if (hard.then.kind === 'do' && hard.then.effect.type === 'ops') expect(hard.then.effect.ops.some((o) => o.op === 'condition' && o.id === 'inconscient')).toBe(true);
    }
  });
});

describe('tables migrées — sweep d\'application', () => {
  it('toutes les entrées atteignables s\'appliquent sans erreur sur un Combatant', () => {
    for (const sev of ['mineure', 'majeure', 'colere'] as const) {
      for (let seed = 0; seed < 120; seed++) {
        const c = hero();
        const r = rollMiscast(sev, makeRNG(seed), sev === 'colere' ? seed % 6 : 0);
        const lines = applyOps(c, r.ops, { rng: makeRNG(seed + 1), label: r.label, now: 0 });
        expect(Array.isArray(lines)).toBe(true);
      }
    }
  });

  it('« Tenue indisciplinée » (LDB 46) : escapeStrength (1d10×5) SURVIT à expandOp → GameOp résolu', () => {
    // Preuve TDD de la propagation `JsonOp.escapeStrength` → `GameOp.escapeStrength` par `expandOp`
    // (`engine/miscast.ts`) : sans elle, l'Empêtré de cette entrée perd sa Force d'évasion à la
    // résolution (silencieusement, un Test opposé simple au lieu du 1d10×5 RAW).
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      const r = rollMiscast('mineure', makeRNG(seed), 0);
      if (r.label !== 'Tenue indisciplinée') continue;
      found = true;
      const op = r.ops.find((o) => o.op === 'condition' && o.id === 'empetre')!;
      expect(op).toBeTruthy();
      expect((op as { escapeStrength?: unknown }).escapeStrength).toBeTruthy();
      const c = hero();
      applyOps(c, r.ops, { rng: makeRNG(1), label: r.label });
      const inst = c.conditions.find((x) => x.id === 'empetre')!;
      expect(inst.escapeStrength! % 5).toBe(0);
      expect(inst.escapeStrength).toBeGreaterThanOrEqual(5);
      expect(inst.escapeStrength).toBeLessThanOrEqual(50);
    }
    expect(found).toBe(true);
  });

  it('« Tenez compte de mes enseignements » porte la durée 1d10 + Péchés (formule plus)', () => {
    // Force l'entrée 11-15 : on échantillonne jusqu'à la trouver.
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      const r = rollMiscast('colere', makeRNG(seed), 0);
      if (!r.label.startsWith('Tenez compte')) continue;
      found = true;
      const c = hero();
      applyOps(c, r.ops, { rng: makeRNG(1), label: r.label });
      const p = c.castPenalties![0];
      expect(p.skill).toBe('priere');
      expect(p.mod).toBe(-10);
      expect(p.roundsLeft).toBeGreaterThanOrEqual(1);
      expect(p.roundsLeft).toBeLessThanOrEqual(10);
    }
    expect(found).toBe(true);
  });
});

// Mitigation des Blessures : `miscast.json` la DÉCLARE par entrée (`ignoreTB`/`ignoreAP`), `expandOp`
// (`miscast.ts`) la recopie sur le `GameOp` `wounds`, `applyOps` la déduit (`ops.ts`). Trois entrées
// aux trois régimes du RAW — le câblage saute si l'un des trois étages perd les champs.
describe('mitigation déclarée des Blessures — donnée → expandOp → applyOps', () => {
  function woundsOf(sev: Parameters<typeof rollMiscast>[0], prefix: string) {
    for (let seed = 0; seed < 600; seed++) {
      const r = rollMiscast(sev, makeRNG(seed), 3);
      if (!r.label.startsWith(prefix)) continue;
      const w = r.ops.find((o) => o.op === 'wounds');
      if (!w) throw new Error(`« ${prefix} » n'émet pas de \`wounds\``);
      return w as Extract<typeof w, { op: 'wounds' }>;
    }
    throw new Error(`entrée « ${prefix} » introuvable`);
  }

  it('« Choc aethyrique » (LDB 46 l.63) : « qui ignorent le Bonus d\'Endurance et les PA »', () => {
    const w = woundsOf('majeure', 'Choc aethyrique');
    expect(w.ignoreTB).toBe(true);
    expect(w.ignoreAP).toBe(true);
  });

  it('« Poupée de chiffon » (LDB 46 l.69) : « qui ignorent les PA » — le Bonus d\'Endurance, lui, s\'applique', () => {
    const w = woundsOf('majeure', 'Poupée de chiffon');
    expect(w.ignoreTB).toBe(false);
    expect(w.ignoreAP).toBe(true);
  });

  it('« Ressentez ma colère » (LDB 40 l.68) : « vous subissez 1d10 + (Points de Péché) Blessures. » — aucune exception énoncée', () => {
    const w = woundsOf('colere', 'Ressentez ma colère');
    expect(w.ignoreTB).toBe(false);
    expect(w.ignoreAP).toBe(false);
  });

  it('applyOps DÉDUIT la mitigation déclarée : BE 4 + PA 3 absorbent « Ressentez ma colère », pas « Choc aethyrique »', () => {
    const mitige = hero({ armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } });
    applyOps(mitige, [{ ...woundsOf('colere', 'Ressentez ma colère'), amount: 6 }], { rng: makeRNG(1) });
    expect(mitige.wounds.current).toBe(10); // 6 − 4 (BE) − 3 (PA) ≤ 0

    const nu = hero({ armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } });
    applyOps(nu, [{ ...woundsOf('majeure', 'Choc aethyrique'), amount: 6 }], { rng: makeRNG(1) });
    expect(nu.wounds.current).toBe(4); // 6 pleines
  });
});
