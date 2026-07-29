import { describe, it, expect } from 'vitest';
import { FLOW_VERBS, buildRollFlowActions } from './rollFlowSpecs';
import { COMBAT_INTENTS, MANUAL_COMBAT_INTENTS } from '../net/intents';
import type { Get, Set as SetFn } from './flowTypes';

/**
 * Garde de la SOURCE UNIQUE `FLOW_VERBS` (axe B) : prouve que les 3 miroirs d'un flux de jet — le TYPE
 * (`RollFlowActionsMap`, vérifié par `tsc` via `GameState extends`), le RUNTIME (`buildRollFlowActions`)
 * et les INTENTS coop (`net/intents.ts`) — restent alignés sur la table. Le type est garanti par la
 * compilation ; ce test couvre le runtime et la surface invité, dans les DEUX sens : tout verbe coop
 * (≠ `resist`, auto-succès jamais délégué) est un intent, aucun verbe non-coop ne l'est, et aucun nom
 * DÉRIVABLE ne dort dans la part manuelle `MANUAL_COMBAT_INTENTS` (une entrée recopiée = une 2ᵉ source).
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

  it('intents : la part MANUELLE ne recopie aucun nom dérivable de FLOW_VERBS (source unique)', () => {
    const derivable = new Set<string>();
    for (const [prefix, w] of ENTRIES) for (const v of w.verbs) derivable.add(`${prefix}${cap(v)}`);
    const recopies = MANUAL_COMBAT_INTENTS.filter((n) => derivable.has(n));
    expect(recopies, 'intent dérivable recopié à la main — le retirer de MANUAL_COMBAT_INTENTS').toEqual([]);
  });

  it('intents : la part MANUELLE ne porte aucun doublon (une entrée = un choix, une fois)', () => {
    const vus = new Set<string>();
    const doublons = MANUAL_COMBAT_INTENTS.filter((n) => (vus.has(n) ? true : (vus.add(n), false)));
    expect(doublons).toEqual([]);
  });

  it('resist n’est jamais un intent (auto-succès Résistance jamais délégué à l’invité)', () => {
    for (const [prefix, w] of ENTRIES) {
      if (w.verbs.includes('resist')) expect(COMBAT_INTENTS.has(`${prefix}Resist`)).toBe(false);
    }
  });

  /**
   * INVARIANT RAW — LDB 17 l.68, « Je ne faillirai pas ! » : « au lieu de lancer les dés pour un Test,
   * vous choisissez le résultat ». Le choix du résultat EST la mécanique de la dépense de Résilience,
   * pas une option qui l'accompagne : un flux qui offre `forceSuccess` DOIT offrir `setForcedRoll`.
   * Aucune liste d'exception : la Résilience est GLOBALE (LDB 17 l.65, « réussir là où vous auriez
   * certainement échoué »), donc tout flux qui porte un Test la porte.
   */
  it('Résilience : tout flux à forceSuccess offre le choix du dé (setForcedRoll)', () => {
    const sans = ENTRIES
      .filter(([, w]) => w.verbs.includes('forceSuccess') && !w.verbs.includes('setForcedRoll'))
      .map(([prefix]) => prefix);
    expect(sans, 'flux à Résilience SANS choix du dé — déclarer son accesseur `die` puis le verbe').toEqual([]);
  });
});
