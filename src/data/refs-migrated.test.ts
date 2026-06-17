/**
 * Garde-fou INVARIANT (multilangue) : les champs de référence migrés ne contiennent QUE des refs
 * STRUCTURÉES (par id), jamais de libellé brut, et les ids de catalogue résolvent. Toute régression
 * (un libellé qui se faufile, un id fantôme) casse ici. Cf. [[game-ids-internes-libelles-display-multilangue]].
 */
import { describe, it, expect } from 'vitest';
import {
  trappings, qualities, spells, creatures, classes, careerLevels, species, gods,
  findSkillById, findTalentById, findTrappingById, findQualityById, findSpellById,
} from './index';
import { CHAR_KEYS } from '../engine/types';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x != null;

describe('refs migrées — refs structurées par id, zéro libellé résiduel', () => {
  it('trappings.qualities = QualityRef[] {id} qui résout (id stable)', () => {
    for (const t of trappings) for (const q of t.qualities) {
      expect(isObj(q)).toBe(true);
      expect(findQualityById(q.id)).toBeTruthy();
    }
  });

  it('classes.trappings + careerLevels.trappings = TrappingRef ({id} résout, ou {text} narratif)', () => {
    const all = [...classes.flatMap((c) => c.trappings), ...careerLevels.flatMap((l) => l.trappings)];
    for (const tr of all) {
      expect(isObj(tr)).toBe(true);
      if ('id' in tr) expect(findTrappingById(tr.id as string)).toBeTruthy();
      else expect(typeof (tr as { text: string }).text).toBe('string');
    }
  });

  it('creatures : spells (Ref) résolvent ; skills/talents/optionals/trappings structurés (zéro chaîne)', () => {
    for (const c of creatures) {
      for (const s of c.spells) { expect(isObj(s)).toBe(true); expect(findSpellById(s.id)).toBeTruthy(); }
      for (const sk of c.skills) expect(isObj(sk) && typeof sk.id === 'string').toBe(true);
      for (const t of c.talents) expect(isObj(t) && typeof t.id === 'string').toBe(true);
      for (const o of c.optionals) expect(isObj(o)).toBe(true); // TraitInstance (clé de registre)
      for (const tr of c.trappings) { expect(isObj(tr)).toBe(true); if ('id' in tr) expect(findTrappingById(tr.id as string)).toBeTruthy(); }
    }
  });

  it('gods.blessings/miracles = Ref[] {id} de sort qui résout', () => {
    for (const g of gods) for (const r of [...g.blessings, ...g.miracles]) expect(findSpellById(r.id)).toBeTruthy();
  });

  it('species/careerLevels skills+talents = AdvancementRef[] structuré ; characteristics = CharKey', () => {
    const advLists = [
      ...species.flatMap((s) => [s.skills, s.talents]),
      ...careerLevels.flatMap((l) => [l.skills, l.talents]),
    ];
    for (const list of advLists) for (const a of list) expect(isObj(a)).toBe(true);
    for (const l of careerLevels) for (const k of l.characteristics) expect(CHAR_KEYS as readonly string[]).toContain(k);
  });

  it('refs d’avancement explicites pointent un id de Compétence/Talent réel', () => {
    const ck = (cat: 'skills' | 'talents', a: unknown): void => {
      if (!isObj(a)) return;
      if ('ref' in a) { const r = a.ref as { id: string }; expect((cat === 'skills' ? findSkillById : findTalentById)(r.id)).toBeTruthy(); }
      if ('choice' in a) for (const o of a.choice as unknown[]) ck(cat, o);
    };
    for (const s of species) { s.skills.forEach((a) => ck('skills', a)); s.talents.forEach((a) => ck('talents', a)); }
    for (const l of careerLevels) { l.skills.forEach((a) => ck('skills', a)); l.talents.forEach((a) => ck('talents', a)); }
  });
});
