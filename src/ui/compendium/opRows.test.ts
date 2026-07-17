import { describe, it, expect } from 'vitest';
import type { GameOp } from '../../engine/ops';
// `newOp`/`OP_LABEL` (générateur d'échantillon + énumération EXHAUSTIVE des kinds `GameOp['op']`,
// `Record` complet forcé par TS) sont importés depuis l'ATELIER — LÉGITIME ici : les fichiers `*.test.*`
// sont hors du scan de `editor-quarantine-guard.test.ts` (la quarantaine porte sur le code applicatif,
// pas les tests qui vérifient le renderer joueur contre le vocabulaire d'atelier).
import { newOp, OP_LABEL } from '../editor/GameOpEditor';
import { opRow, opRows } from './opRows';
import { codexLookupById } from './registry';
import { characteristics, talents, skills, traits, psychologies, etats, trappings, maladies, symptoms, creatures } from '../../data';
import type { CharKey } from '../../engine/types';

const ALL_KINDS = Object.keys(OP_LABEL) as GameOp['op'][];

/** Ancres attendues (minimum imposé par le brief #495) — kind → catégorie Codex. */
const EXPECTED_ANCHOR: Partial<Record<GameOp['op'], string>> = {
  charMod: 'characteristics',
  grantTalent: 'talents',
  condition: 'etats',
  grantCareerSkill: 'skills',
};

/** `newOp('narrative')` échantillonne un texte vide (défaut d'atelier, hors périmètre de ce renderer) —
 *  seule exception à l'échantillon générique, une op `narrative` réelle porte toujours un `text`. */
function sample(kind: GameOp['op']): GameOp {
  const o = newOp(kind);
  return o.op === 'narrative' ? { op: 'narrative', text: 'Un effet non modélisé, RAW verbatim.' } : o;
}

describe('opRows — renderer JOUEUR de GameOp[] (#495)', () => {
  it('couvre TOUS les kinds de GameOp (jamais de ligne vide)', () => {
    for (const kind of ALL_KINDS) {
      const row = opRow(sample(kind));
      expect(row, `kind ${kind} : pas de ligne produite`).toBeTruthy();
      if (row.t === 'ref') {
        expect(row.label, `kind ${kind} : label vide`).not.toBe('');
        expect(row.show, `kind ${kind} : show vide`).not.toBe('');
        expect(row.category, `kind ${kind} : category vide`).not.toBe('');
      } else if (row.t === 'text') {
        expect(row.text, `kind ${kind} : text vide`).not.toBe('');
      } else {
        throw new Error(`kind ${kind} : type de ligne inattendu ${row.t}`);
      }
    }
  });

  it('les kinds à ancre nominative produisent une chip `ref` de la bonne catégorie', () => {
    for (const [kind, category] of Object.entries(EXPECTED_ANCHOR)) {
      const row = opRow(newOp(kind as GameOp['op']));
      expect(row.t, `kind ${kind} : attendu t:'ref'`).toBe('ref');
      if (row.t === 'ref') expect(row.category, `kind ${kind} : mauvaise catégorie`).toBe(category);
    }
  });

  it('opRows(ops) mappe 1:1 et dans l’ordre', () => {
    const ops: GameOp[] = [newOp('charMod'), newOp('grantTalent'), newOp('kill')];
    const rows = opRows(ops);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.t)).toEqual(['ref', 'ref', 'text']);
  });

  /** Spot-check : un `t:'text'` (repli `humanizeOp`, registre JOUEUR déjà résolveur) ne laisse jamais
   *  fuiter un id BRUT (kebab-case) porté par le champ de l'op elle-même — les labels sont résolus. */
  it('aucun repli texte ne laisse fuiter un id brut kebab-case de son propre op', () => {
    const KEBAB_RX = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
    for (const kind of ALL_KINDS) {
      const op = sample(kind);
      const row = opRow(op);
      if (row.t !== 'text') continue;
      for (const v of Object.values(op as Record<string, unknown>)) {
        if (typeof v === 'string' && KEBAB_RX.test(v)) {
          expect(row.text, `kind ${kind} : id brut « ${v} » visible dans le texte`).not.toContain(v);
        }
      }
    }
  });

  /** Résolvabilité des ancres — DATA-DRIVEN (zéro id en dur) : chaque kind à ancre nominative
   *  d'`opRows.ts` produit un `{t:'ref'}` dont l'id RÉSOUT réellement dans le Codex (même lookup
   *  que `CodexRef.tsx:90`, `codexLookupById`). L'id de fixture est le PREMIER item du dataset réel
   *  de la catégorie visée — une dérive id↔catégorie future (mauvais champ, mauvaise catégorie,
   *  dataset renommé) casse ce test au lieu de fuiter en silence sur une chip Codex morte. */
  const ANCHOR_FIXTURES: { kind: GameOp['op']; category: string; build: () => GameOp }[] = [
    { kind: 'charMod', category: 'characteristics', build: () => ({ op: 'charMod', char: characteristics[0].id as CharKey, mod: -10 }) },
    { kind: 'charDRBonus', category: 'characteristics', build: () => ({ op: 'charDRBonus', char: characteristics[0].id as CharKey, bonus: 1 }) },
    // Mouvement/Blessure voyagent par leur propre famille d'ops (hors `CharKey`) mais s'affichent
    // COMME une Caractéristique (arbitrage user 2026-07-17) — même catégorie `characteristics`.
    { kind: 'moveMod', category: 'characteristics', build: () => ({ op: 'moveMod', mod: -1 }) },
    { kind: 'moveScale', category: 'characteristics', build: () => ({ op: 'moveScale', num: 1, den: 2 }) },
    { kind: 'wounds', category: 'characteristics', build: () => ({ op: 'wounds', amount: 1 }) },
    { kind: 'grantTalent', category: 'talents', build: () => ({ op: 'grantTalent', talentId: talents[0].id }) },
    { kind: 'grantCareerTalent', category: 'talents', build: () => ({ op: 'grantCareerTalent', talentId: talents[0].id }) },
    { kind: 'grantCareerSkill', category: 'skills', build: () => ({ op: 'grantCareerSkill', skillId: skills[0].id }) },
    { kind: 'skillMod', category: 'skills', build: () => ({ op: 'skillMod', skill: skills[0].id, mod: -10 }) },
    { kind: 'skillDRBonus', category: 'skills', build: () => ({ op: 'skillDRBonus', skill: skills[0].id, bonus: 1 }) },
    { kind: 'grantTrait', category: 'traits', build: () => ({ op: 'grantTrait', traitId: traits[0].id }) },
    { kind: 'grantPsychTrait', category: 'psychologies', build: () => ({ op: 'grantPsychTrait', psychType: psychologies[0].id }) },
    { kind: 'removePsychTrait', category: 'psychologies', build: () => ({ op: 'removePsychTrait', psychType: psychologies[0].id }) },
    { kind: 'endPsych', category: 'psychologies', build: () => ({ op: 'endPsych', type: psychologies[0].id }) },
    { kind: 'condition', category: 'etats', build: () => ({ op: 'condition', name: etats[0].id }) },
    { kind: 'removeCondition', category: 'etats', build: () => ({ op: 'removeCondition', name: etats[0].id }) },
    { kind: 'giveTrapping', category: 'trappings', build: () => ({ op: 'giveTrapping', trappingId: trappings[0].id }) },
    { kind: 'contractDisease', category: 'maladies', build: () => ({ op: 'contractDisease', disease: maladies[0].id }) },
    { kind: 'exposeDisease', category: 'maladies', build: () => ({ op: 'exposeDisease', disease: maladies[0].id }) },
    { kind: 'reduceDiseaseDays', category: 'maladies', build: () => ({ op: 'reduceDiseaseDays', disease: maladies[0].id, days: 1 }) },
    { kind: 'suppressSymptom', category: 'symptoms', build: () => ({ op: 'suppressSymptom', symptomId: symptoms[0].id }) },
    { kind: 'summon', category: 'creatures', build: () => ({ op: 'summon', ref: creatures[0].id, count: 1 }) },
    { kind: 'scheduleRespawn', category: 'creatures', build: () => ({ op: 'scheduleRespawn', ref: creatures[0].id, delayDays: 1 }) },
    { kind: 'polymorph', category: 'creatures', build: () => ({ op: 'polymorph', ref: creatures[0].id }) },
    { kind: 'transform', category: 'creatures', build: () => ({ op: 'transform', tag: 'x', ops: [], morphRef: creatures[0].id }) },
  ];

  it('couvre chaque kind ancré (10 catégories) et résout réellement dans le Codex', () => {
    const coveredCategories = new Set(ANCHOR_FIXTURES.map((f) => f.category));
    expect(coveredCategories.size, 'attendu 10 catégories Codex couvertes').toBe(10);

    for (const fixture of ANCHOR_FIXTURES) {
      const row = opRow(fixture.build());
      expect(row.t, `kind ${fixture.kind} : attendu t:'ref'`).toBe('ref');
      if (row.t !== 'ref') continue;
      expect(row.category, `kind ${fixture.kind} : mauvaise catégorie`).toBe(fixture.category);
      const resolved = codexLookupById(row.category, row.id);
      expect(resolved, `kind ${fixture.kind} : id « ${row.id} » (catégorie ${row.category}) ne résout à AUCUN item Codex`).toBeTruthy();
    }
  });
});
