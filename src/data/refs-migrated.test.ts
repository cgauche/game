/**
 * Garde-fou INVARIANT (multilangue) : les champs de référence migrés ne contiennent QUE des refs
 * STRUCTURÉES (par id), jamais de libellé brut, et les ids de catalogue résolvent. Toute régression
 * (un libellé qui se faufile, un id fantôme) casse ici. Cf. [[game-ids-internes-libelles-display-multilangue]].
 */
import { describe, it, expect } from 'vitest';
import {
  trappings, qualities, spells, creatures, classes, careers, careerLevels, species, gods, etats, maladies, weaponGroups,
  traits, stars, talents,
  findSkillById, findTalentById, findTrappingById, findQualityById, findSpellById,
  findCareerById, findClassById, findSpeciesById, findConditionById, findDiseaseById, findWeaponGroupById,
} from './index';
import { itemFromTrappingById } from '../engine/items';
import { COND } from '../engine/conditions';
import { DISEASES } from '../engine/disease';
import pregensJson from './pregens.json';
import interludeEventsJson from './interludeEvents.json';
import { CHAR_KEYS } from '../engine/types';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x != null;

describe('refs migrées — refs structurées par id, zéro libellé résiduel', () => {
  it('trappings.qualities = QualityRef[] {id} qui résout (id stable)', () => {
    for (const t of trappings) for (const q of t.qualities) {
      expect(isObj(q)).toBe(true);
      expect(findQualityById(q.id)).toBeTruthy();
    }
  });

  it('trappings.subType = weaponGroupId qui résout (jamais un libellé brut)', () => {
    const groupIds = new Set(weaponGroups.map((g) => g.id));
    for (const t of trappings) {
      if (t.subType == null) continue;
      expect(groupIds.has(t.subType), `${t.label} → ${t.subType}`).toBe(true);
      expect(findWeaponGroupById(t.subType)).toBeTruthy();
    }
  });

  it('weaponGroups portent un id stable + kind valide', () => {
    const kinds = new Set(['weapon', 'ammo', 'armour', 'inventory']);
    for (const g of weaponGroups) { expect(typeof g.id).toBe('string'); expect(kinds.has(g.kind), g.kind).toBe(true); }
  });

  it('itemFromTrappingById pose un trappingId qui pointe le catalogue', () => {
    for (const id of ['arbalete', 'epee-batarde', 'chemise-de-mailles', 'mains-nues']) {
      const it = itemFromTrappingById(id);
      expect(it, id).toBeTruthy();
      expect(it!.trappingId).toBe(id);
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

  it('careers/classes/species portent un id ; careers.class = classId qui résout', () => {
    for (const c of careers) { expect(typeof c.id).toBe('string'); expect(findClassById(c.class), c.label).toBeTruthy(); }
    for (const cl of classes) expect(typeof cl.id).toBe('string');
    for (const s of species) expect(typeof s.id).toBe('string');
  });

  it('etats portent un id ; la constante moteur COND est synchrone avec etats.json', () => {
    for (const e of etats) expect(typeof e.id).toBe('string');
    const ids = new Set(etats.map((e) => e.id));
    for (const id of Object.values(COND)) expect(ids.has(id), id).toBe(true); // chaque État canonique existe dans le dataset
    expect(Object.values(COND).length).toBe(12); // les 12 États LDB 16
  });

  it('findConditionById résout les ids canoniques', () => {
    for (const id of Object.values(COND)) expect(findConditionById(id), id).toBeTruthy();
  });

  it('maladies portent un id ; la constante moteur DISEASES est synchrone avec maladies.json', () => {
    for (const m of maladies) expect(typeof m.id).toBe('string');
    const ids = new Set(maladies.map((m) => m.id));
    for (const id of Object.values(DISEASES)) { expect(ids.has(id), id).toBe(true); expect(findDiseaseById(id), id).toBeTruthy(); }
    expect(Object.values(DISEASES).length).toBe(9); // les 9 maladies LDB 20 câblées
  });

  it('careerLevels.career = careerId qui résout', () => {
    for (const l of careerLevels) expect(findCareerById(l.career), l.label).toBeTruthy();
  });

  it('pregens.species/career = ids qui résolvent', () => {
    for (const p of pregensJson as { name: string; species: string; career: string }[]) {
      expect(findSpeciesById(p.species), p.name).toBeTruthy();
      expect(findCareerById(p.career), p.name).toBeTruthy();
    }
  });

  it('interludeEvents.fx.revenue(Blocked)Classes = classId qui résout (ou « * »)', () => {
    for (const e of interludeEventsJson as { fx?: { revenueClasses?: string[]; revenueBlockedClasses?: string[] } }[]) {
      for (const c of [...(e.fx?.revenueClasses ?? []), ...(e.fx?.revenueBlockedClasses ?? [])]) {
        if (c === '*') continue;
        expect(findClassById(c), c).toBeTruthy();
      }
    }
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

  // ── Phase F — ops de Flow & champs de talent : qualité/talent par id, jamais un libellé ──
  /** Visite récursive de chaque nœud-objet d'une arborescence de données (Flow/effets imbriqués). */
  const walk = (node: unknown, fn: (o: Record<string, unknown>) => void): void => {
    if (Array.isArray(node)) { node.forEach((x) => walk(x, fn)); return; }
    if (!isObj(node)) return;
    fn(node);
    for (const v of Object.values(node)) walk(v, fn);
  };
  /** Tous les datasets porteurs de `GameOp` (Flow de sorts/traits/etc. + effet de signe). */
  const opDatasets: unknown[] = [...spells, ...traits, ...creatures, ...qualities, ...stars];

  it('ops grantTalent → { talentId } qui résout (jamais un libellé « talent »)', () => {
    walk(opDatasets, (o) => {
      if (o.op !== 'grantTalent') return;
      expect('talent' in o, `grantTalent legacy { talent } résiduel : ${JSON.stringify(o)}`).toBe(false);
      expect(typeof o.talentId, JSON.stringify(o)).toBe('string');
      expect(findTalentById(o.talentId as string), String(o.talentId)).toBeTruthy();
    });
  });

  it('ops addQualities / grantWeapon.qualities = id de Qualité qui résout', () => {
    walk(opDatasets, (o) => {
      const lists: unknown[] = [];
      if (o.op === 'augmentWeapon' && Array.isArray(o.addQualities)) lists.push(o.addQualities);
      if ((o.op === 'grantWeapon' || o.op === 'grantNaturalWeapon') && Array.isArray(o.qualities)) lists.push(o.qualities);
      for (const q of lists.flat()) {
        expect(typeof q, JSON.stringify(o)).toBe('string'); // id de Qualité, pas un objet/libellé brut
        expect(findQualityById(q as string), String(q)).toBeTruthy();
      }
    });
  });

  it('talents.addSkill/addTalent = réf par id qui résout (libellé concret hors donnée)', () => {
    for (const t of talents) {
      if (t.addSkill != null) {
        expect(isObj(t.addSkill), `${t.label}.addSkill`).toBe(true);
        expect(findSkillById((t.addSkill as { id: string }).id), `${t.label}.addSkill`).toBeTruthy();
      }
      if (t.addTalent != null) {
        expect(isObj(t.addTalent), `${t.label}.addTalent`).toBe(true);
        expect(findTalentById((t.addTalent as { id: string }).id), `${t.label}.addTalent`).toBeTruthy();
      }
    }
  });
});
