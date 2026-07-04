import { describe, it, expect } from 'vitest';
import { FLOW_VERBS, buildRollFlowActions } from './rollFlowSpecs';
import { COMBAT_INTENTS } from '../net/intents';
import type { Get, Set as SetFn } from './flowTypes';

/**
 * Garde de la SOURCE UNIQUE `FLOW_VERBS` (axe B) : prouve que les 3 miroirs d'un flux de jet — le TYPE
 * (`RollFlowActionsMap`, vérifié par `tsc` via `GameState extends`), le RUNTIME (`buildRollFlowActions`)
 * et les INTENTS coop (`net/intents.ts`) — restent alignés sur la table. Le type est garanti par la
 * compilation ; ce test couvre le runtime et les intents (recopie explicite VOLONTAIRE côté allowlist —
 * surface sécurité — mais tenue en phase ici : ajouter/retirer un verbe coop casse ce test tant que
 * `COMBAT_INTENTS` n'est pas mis à jour). `resist` n'est JAMAIS un intent (auto-succès jamais délégué à l'invité).
 */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const noopGet = (() => ({})) as unknown as Get;
const noopSet = (() => {}) as unknown as SetFn;
// `as const` narrowit chaque entrée (verbes = tuple littéral, `coop` absent des entrées non-coop) →
// on relit via une vue élargie pour itérer génériquement (le contenu réel est garanti par le satisfies).
const ENTRIES = Object.entries(FLOW_VERBS) as [string, { kind: 'mono' | 'multi'; verbs: readonly string[]; coop?: boolean }][];

describe('câblage des flux de jet — source unique FLOW_VERBS', () => {
  it('runtime : buildRollFlowActions expose EXACTEMENT les délégués <prefix><Verbe> de FLOW_VERBS', () => {
    const expected = new Set<string>();
    for (const [prefix, w] of ENTRIES) for (const v of w.verbs) expected.add(`${prefix}${cap(v)}`);
    const actual = new Set(Object.keys(buildRollFlowActions(noopGet, noopSet)));
    expect(actual).toEqual(expected);
  });

  it('intents coop : chaque verbe (≠ resist) d’un flux coop EST dans COMBAT_INTENTS (anti-dérive de surface invité)', () => {
    const missing: string[] = [];
    for (const [prefix, w] of ENTRIES) {
      if (!w.coop) continue;
      for (const v of w.verbs) {
        if (v === 'resist') continue;
        const intent = `${prefix}${cap(v)}`;
        if (!COMBAT_INTENTS.has(intent)) missing.push(intent);
      }
    }
    expect(missing, 'verbes coop sans intent — ajouter à COMBAT_INTENTS (ou retirer `coop`)').toEqual([]);
  });

  it('intents : aucun intent générique orphelin (verbe d’un flux NON-coop exposé par erreur à l’invité)', () => {
    const orphan: string[] = [];
    for (const [prefix, w] of ENTRIES) {
      if (w.coop) continue;
      for (const v of w.verbs) {
        if (v === 'resist') continue;
        const intent = `${prefix}${cap(v)}`;
        if (COMBAT_INTENTS.has(intent)) orphan.push(intent);
      }
    }
    expect(orphan, 'intent générique d’un flux NON-coop — retirer de COMBAT_INTENTS (ou marquer `coop`)').toEqual([]);
  });

  it('resist n’est jamais un intent (auto-succès Résistance jamais délégué à l’invité)', () => {
    for (const [prefix, w] of ENTRIES) {
      if (w.verbs.includes('resist')) expect(COMBAT_INTENTS.has(`${prefix}Resist`)).toBe(false);
    }
  });
});
