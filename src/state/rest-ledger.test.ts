import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { makePregens } from '../data/pregens';
import { ledgerRerollable } from '../ui/MultiRollList';
import type { NightEntry, PendingRest } from './restFlow';
import type { RollBreakdown } from '../engine/combat';

/**
 * PROCÈS-VERBAL de repos — la Chance influence APRÈS COUP une ligne de HÉROS ratée à conséquence
 * recalculable (récupération/cauchemars), via le flux `restLedger` (verbes de la fabrique). LDB 17
 * l.21-27 (relance après le jet), LDB 12 l.40 (une relance max par Test).
 */
const get = useGame.getState.bind(useGame);

function d(over: Partial<RollBreakdown>): RollBreakdown {
  return { label: 'Résistance', base: 55, modifier: 0, target: 55, roll: 95, success: false, sl: -4, ...over };
}

function bilanState(results: NightEntry[]) {
  seedBattleRng(7);
  const [a, b] = makePregens();
  useGame.setState({
    party: [{ ...a, id: 'A', fortune: 2, wounds: { current: 5, max: 20 } }, { ...b, id: 'B', kind: 'enemy', fortune: 0 }],
    battle: null,
    pendingRest: { places: { camp: true }, quality: 'normale', days: 3, perHero: {}, phase: 'bilan', results } as PendingRest,
  } as never);
}

describe('ledgerRerollable — seules les lignes de jet ratées, taguées recalculables, encore vierges', () => {
  it('récupération ratée non relancée → true ; réussie / déjà relancée / sans reKind → false', () => {
    expect(ledgerRerollable({ id: 'r', actorId: 'A', label: 'Récup', reKind: 'recovery', d: d({ success: false }) })).toBe(true);
    expect(ledgerRerollable({ id: 'r', actorId: 'A', label: 'Récup', reKind: 'recovery', d: d({ success: true, roll: 8, sl: 3 }) })).toBe(false);
    expect(ledgerRerollable({ id: 'r', actorId: 'A', label: 'Récup', reKind: 'recovery', d: d({ success: false }), rerolled: true })).toBe(false);
    expect(ledgerRerollable({ id: 'x', actorId: 'A', label: 'Exposition', d: d({ success: false }) })).toBe(false); // pas de reKind → lecture seule
    expect(ledgerRerollable({ actorId: 'A', label: 'Note', text: 'jour 3/3' })).toBe(false); // pas de jet
  });
});

describe('restLedgerReroll — la relance consomme la Chance, verrouille (1× max) et met à jour la ligne', () => {
  beforeEach(() => bilanState([
    { id: 'rec-A', actorId: 'A', label: 'Récupération', reKind: 'recovery', d: d({ roll: 95, success: false, sl: -4 }) },
  ]));

  it('relance d’une récupération ratée : −1 Chance, ligne re-résolue, rerolled posé', () => {
    const before = get().party.find((h) => h.id === 'A')!.fortune;
    get().restLedgerReroll('rec-A');
    const st = get();
    const entry = (st.pendingRest!.results ?? []).find((e) => e.id === 'rec-A')!;
    expect(st.party.find((h) => h.id === 'A')!.fortune).toBe((before ?? 0) - 1); // 1 Point de Chance dépensé
    expect(entry.rerolled).toBe(true); // LDB 12 l.40 : une relance max
    expect(entry.d!.roll).not.toBe(95); // le dé a été re-tiré

    // Seconde relance sur la MÊME ligne → NO-OP (déjà relancée).
    const fortAfter = get().party.find((h) => h.id === 'A')!.fortune;
    get().restLedgerReroll('rec-A');
    expect(get().party.find((h) => h.id === 'A')!.fortune).toBe(fortAfter);
  });

  it('un jet de PNJ (ou introuvable) n’est jamais relançable (pas d’acteur héros)', () => {
    bilanState([{ id: 'rec-B', actorId: 'B', label: 'Récupération', reKind: 'recovery', d: d({ success: false }) }]);
    get().restLedgerReroll('rec-B'); // B est un ennemi (fortune 0) → opReroll ne dépense rien
    expect(get().pendingRest!.results!.find((e) => e.id === 'rec-B')!.rerolled).toBeFalsy();
  });
});
