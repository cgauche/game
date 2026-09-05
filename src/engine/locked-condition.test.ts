import { describe, it, expect } from 'vitest';
import type { Combatant, ConditionUnlock } from './types';
import type { Condition } from './flowCore';
import { addCondition, removeCondition, hasCondition, stacks, isConditionLocked, releaseConditionLocks, hasSurgeryLockedCondition } from './conditions';
import { applyOps } from './ops';
import { CRITIQUE_DOCS } from '../data/criticals';
import { spellOps } from './flowCore';
import miscastJson from '../data/miscast.json';

/** Toutes les rangées de Blessure critique, les 8 documents-tables confondus (LDB + Aux Armes) —
 *  la lecture ne nomme aucune famille : un 9ᵉ tableau y entre sans une ligne. */
const rangees = () => CRITIQUE_DOCS.flatMap((d) => d.entries);

function mk(): Combatant {
  return {
    id: 'x', name: 'X', kind: 'hero', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    conditions: [], activeEffects: [], skills: [], talents: [], traits: [], weapons: [], armour: [],
    wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
  } as unknown as Combatant;
}

const noHemo: Condition = { kind: 'compare', subject: { who: 'target', condition: 'hemorragique' }, op: '==', value: 0 };

describe('Verrou d’État de Critique — lockedUntil (LDB 18)', () => {
  it('Aveuglé verrouillé tant qu’un Hémorragique subsiste : removeCondition inerte', () => {
    const c = mk();
    addCondition(c, 'hemorragique', 2);
    addCondition(c, 'aveugle', 1, undefined, undefined, undefined, undefined, { lockedUntil: noHemo });
    expect(isConditionLocked(c.conditions.find((x) => x.id === 'aveugle')!, c)).toBe(true);
    removeCondition(c, 'aveugle'); // auto-dissipation / soin : bloqué
    expect(hasCondition(c, 'aveugle')).toBe(true);
  });

  it('une fois les Hémorragique éliminés, l’Aveuglé se déverrouille et part', () => {
    const c = mk();
    addCondition(c, 'hemorragique', 1);
    addCondition(c, 'aveugle', 1, undefined, undefined, undefined, undefined, { lockedUntil: noHemo });
    removeCondition(c, 'hemorragique'); // Hémorragique = 0
    expect(isConditionLocked(c.conditions.find((x) => x.id === 'aveugle')!, c)).toBe(false);
    removeCondition(c, 'aveugle');
    expect(hasCondition(c, 'aveugle')).toBe(false);
  });

  it('sans lockedUntil : aucun verrou (comportement inchangé)', () => {
    const c = mk();
    addCondition(c, 'sonne', 2);
    removeCondition(c, 'sonne');
    expect(stacks(c, 'sonne')).toBe(1);
  });
});

describe('Verrou d’acte de soin — unlockBy (LDB 18 : medicalAid / surgery / magic)', () => {
  const withLock = (cond: string, unlockBy: ConditionUnlock): Combatant => {
    const c = mk();
    addCondition(c, cond, 1, undefined, undefined, undefined, undefined, { unlockBy });
    return c;
  };

  it('unlockBy verrouille l’État : removeCondition (récupération naturelle) inerte tant qu’il tient', () => {
    const c = withLock('sonne', 'medicalAid');
    expect(isConditionLocked(c.conditions[0], c)).toBe(true);
    removeCondition(c, 'sonne'); // auto-dissipation / récupération par Round : bloquée
    expect(hasCondition(c, 'sonne')).toBe(true);
  });

  // Matrice croisée : chaque verrou n’est levé QUE par le bon acte (et magie ⊇ Aide Médicale).
  const ACTS: ConditionUnlock[] = ['medicalAid', 'surgery', 'magic'];
  const lifts: Record<ConditionUnlock, ConditionUnlock[]> = {
    medicalAid: ['medicalAid', 'magic'], // magie compte comme Aide Médicale (LDB 18 l.311)
    surgery: ['surgery'],
    magic: ['magic'],
  };
  for (const lock of ACTS) {
    for (const act of ACTS) {
      const shouldLift = lifts[lock].includes(act);
      it(`verrou ${lock} ${shouldLift ? 'LEVÉ' : 'INTACT'} par l’acte ${act}`, () => {
        const c = withLock('aveugle', lock);
        const log = releaseConditionLocks(c, act);
        expect(hasCondition(c, 'aveugle')).toBe(!shouldLift);
        expect(log.length > 0).toBe(shouldLift);
        if (!shouldLift) expect(isConditionLocked(c.conditions[0], c)).toBe(true); // toujours verrouillé
      });
    }
  }

  it('hasSurgeryLockedCondition : vrai ssi un État porte unlockBy surgery', () => {
    expect(hasSurgeryLockedCondition(withLock('hemorragique', 'surgery'))).toBe(true);
    expect(hasSurgeryLockedCondition(withLock('sonne', 'medicalAid'))).toBe(false);
  });

  it('op condition { unlockBy } : figée sur l’instance par applyOps ; un soin de sort (magie) la lève', () => {
    const c = mk();
    applyOps(c, [{ op: 'condition', id: 'inconscient', value: 1, unlockBy: 'medicalAid' }], { label: 'Critique' });
    expect(c.conditions.find((x) => x.id === 'inconscient')!.unlockBy).toBe('medicalAid');
    // Soin d’un SORT (ctx.sourceSpellId) = magie ⊇ Aide Médicale → l’op heal lève le verrou medicalAid.
    applyOps(c, [{ op: 'heal', amount: 1 }], { label: 'Bénédiction', sourceSpellId: 'benediction-soin' });
    expect(hasCondition(c, 'inconscient')).toBe(false);
  });

  it('op heal SANS sort (potion/objet) = Aide Médicale : lève medicalAid mais PAS un verrou surgery', () => {
    const c = mk();
    addCondition(c, 'hemorragique', 1, undefined, undefined, undefined, undefined, { unlockBy: 'surgery' });
    addCondition(c, 'sonne', 1, undefined, undefined, undefined, undefined, { unlockBy: 'medicalAid' });
    applyOps(c, [{ op: 'heal', amount: 1 }], { label: 'Potion' }); // pas de sourceSpellId → medicalAid
    expect(hasCondition(c, 'sonne')).toBe(false); // verrou medicalAid levé
    expect(hasCondition(c, 'hemorragique')).toBe(true); // verrou surgery INTACT
    expect(isConditionLocked(c.conditions.find((x) => x.id === 'hemorragique')!, c)).toBe(true);
  });
});

describe('Données — verrous & escapeStrength câblés (RAW)', () => {
  it('Critique Tête « En plein front » (46-50) : l’op Aveuglé porte lockedUntil == 0 Hémorragique', () => {
    const entry = rangees().find((e) => e.id === 'en-plein-front')! as { ops?: { op: string; id?: string; lockedUntil?: unknown }[] };
    const aveugleOp = entry.ops!.find((o) => o.op === 'condition' && o.id === 'aveugle')!;
    expect(aveugleOp.lockedUntil).toEqual(noHemo);
  });

  it('Critique Corps « Hémorragie interne » (97-99) : l’op Hémorragique porte unlockBy surgery', () => {
    const entry = rangees().find((e) => e.id === 'hemorragie-interne')! as { ops?: { op: string; id?: string; unlockBy?: string }[] };
    const op = entry.ops!.find((o) => o.op === 'condition' && o.id === 'hemorragique')!;
    expect(op.unlockBy).toBe('surgery');
  });

  it('Critiques « Aide Médicale » (œil/thorax/clavicule/épaule/genou) : unlockBy medicalAid (LDB + jumeaux AA)', () => {
    type Op = { op: string; id?: string; unlockBy?: string };
    const opsOf = (id: string, cond: string): Op | undefined => {
      const e = rangees().find((x) => x.id === id)!;
      // L'effet peut vivre dans l'effet IMMÉDIAT ou dans la branche `fail` du nœud `test` de la rangée.
      return [...((e.ops ?? []) as Op[]), ...(spellOps(e.test?.fail, 'target') as unknown as Op[])]
        .find((o) => o.op === 'condition' && o.id === cond);
    };
    // œil (Aveuglé), thorax (Sonné), clavicule (Inconscient) — LDB + jumeaux AA aa-tete-41/aa-corps-91/aa-corps-96.
    expect(opsOf('blessure-majeure-a-l-il', 'aveugle')!.unlockBy).toBe('medicalAid');
    expect(opsOf('cage-thoracique-perforee', 'sonne')!.unlockBy).toBe('medicalAid');
    expect(opsOf('clavicule-cassee', 'inconscient')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-tete-41', 'aveugle')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-corps-91', 'sonne')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-corps-96', 'inconscient')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-corps-111', 'hemorragique')!.unlockBy).toBe('surgery');
    // Épaule luxée / Genou démis (Sonné « jusqu’à Aide Médicale ») — LDB + jumeaux AA.
    expect(opsOf('epaule-luxee', 'sonne')!.unlockBy).toBe('medicalAid');
    expect(opsOf('genou-demis', 'sonne')!.unlockBy).toBe('medicalAid'); // dans resist.onFail
    expect(opsOf('aa-bras-96', 'sonne')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-jambe-96', 'sonne')!.unlockBy).toBe('medicalAid');
  });

  it('Imparfaite « Tenue indisciplinée » (LDB 46) : Empêtré avec Force d’évasion 1d10×5', () => {
    // Adressée PAR ID stable (le libellé est de l'affichage — et il est HOMONYME entre les jeux LDB et VDM).
    type Ligne = { id: string; label: string; ops?: { op: string; id?: string; escapeStrength?: unknown }[] };
    const docs = miscastJson as unknown as { id: string; entries: Ligne[] }[];
    const mineure = docs.find((d) => d.id === 'miscast-mineure');
    if (!mineure) throw new Error('tableau « miscast-mineure » absent de miscast.json');
    const entry = mineure.entries.find((e) => e.id === 'mineure-tenue-indisciplinee')!;
    const op = entry.ops!.find((o) => o.op === 'condition')!;
    expect(op.id).toBe('empetre');
    // Résolution du 1d10×5 (multiple de 5, borné 5..50) via applyOps.
    for (let i = 0; i < 20; i++) {
      const c = mk();
      applyOps(c, entry.ops as import('./ops').GameOp[], { label: 'Tenue indisciplinée' });
      const inst = c.conditions.find((x) => x.id === 'empetre')!;
      expect(inst.escapeStrength! % 5).toBe(0);
      expect(inst.escapeStrength).toBeGreaterThanOrEqual(5);
      expect(inst.escapeStrength).toBeLessThanOrEqual(50);
    }
  });
});
