/**
 * Poursuite TERRESTRE jouable (#95, LDB 15 l.87-109) : l'Effet `startPursuit` ouvre la boucle de manches
 * (cascade influençable `purpose:'pursuite'`) ; chaque manche compare le DR le plus bas des poursuivis au
 * DR le plus haut des poursuivants et fait varier la Distance ; issue par `pursuitOutcome` (semé/rattrapé).
 * Réutilise les primitives PARTAGÉES `engine/pursuit` et la CASCADE (state/cascade), pas un flux parallèle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { startGroundPursuit, continuePursuitRound, pursuitAbandon } from './pursuitFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { PendingCascade, CascadeStep } from './pendings';

function heroes() {
  const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Alix', rng: makeRNG(1) });
  const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brun', rng: makeRNG(2) });
  useGame.setState({ party: [a, b] });
  return [a, b];
}

/** Cascade FIGÉE de manche : chaque héros a roulé son Test de Mouvement (`sl` imposé) — sert à tester la
 *  résolution de manche (`continuePursuitRound`) sans passer par l'UI. */
function doneRound(party: { id: string }[], sl: number): PendingCascade {
  const participants: CascadeStep[] = party.map((h) => ({
    id: `pursuit-1-${h.id}`, kind: 'pursuitMove', actorId: h.id, rollLabel: 'Athlétisme', base: 40, target: 40,
    result: { roll: 40, target: 40, sl, success: sl >= 0 }, interactive: true,
  }));
  return { title: 't', purpose: 'pursuite', participants, cursor: participants.length, log: [] };
}

describe('Poursuite terrestre (#95)', () => {
  beforeEach(() => useGame.setState({ battle: null, party: [], journal: [], pendingCascade: null, pursuit: null }));

  it('l’Effet startPursuit ouvre la boucle de manches (cascade purpose:pursuite, une étape par héros)', () => {
    const [a, b] = heroes();
    applyEffects(useGame.getState, useGame.setState, [{
      type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: 'athletisme',
      foes: [{ label: 'Bandit', movement: 4, skill: 40 }],
    }]);
    const p = useGame.getState().pursuit;
    expect(p?.partyRole).toBe('fleeing');
    expect(p?.distance).toBe(4);
    expect(p?.round).toBe(1);
    const casc = useGame.getState().pendingCascade;
    expect(casc?.purpose).toBe('pursuite');
    expect(casc?.participants.map((s) => s.actorId).sort()).toEqual([a.id, b.id].sort());
  });

  it('manche gagnée par les poursuivis (poursuivants médiocres) → Distance grimpe jusqu’à l’évasion', () => {
    useGame.getState().seedRng(3);
    const party = heroes();
    useGame.setState({ pursuit: { partyRole: 'fleeing', distance: 8, escapeAt: 10, skill: 'athletisme', foes: [{ label: 'Bandit', movement: 4, skill: 1 }], round: 1 } });
    continuePursuitRound(useGame.getState, useGame.setState, doneRound(party, 6));
    expect(useGame.getState().pursuit).toBeNull(); // dénoué
    expect(useGame.getState().journal.some((l) => l.includes('semé'))).toBe(true);
  });

  it('manche gagnée par les poursuivants (proie lente) → Distance ≤ 0 = rattrapés', () => {
    useGame.getState().seedRng(4);
    const party = heroes();
    useGame.setState({ pursuit: { partyRole: 'fleeing', distance: 2, escapeAt: 10, skill: 'athletisme', foes: [{ label: 'Cavalier', movement: 4, skill: 95 }], round: 1 } });
    continuePursuitRound(useGame.getState, useGame.setState, doneRound(party, -6));
    expect(useGame.getState().pursuit).toBeNull();
    expect(useGame.getState().journal.some((l) => l.includes('Rattrapés'))).toBe(true);
  });

  it('manche indécise → une nouvelle manche s’ouvre (la poursuite continue)', () => {
    useGame.getState().seedRng(5);
    const party = heroes();
    useGame.setState({ pursuit: { partyRole: 'fleeing', distance: 5, escapeAt: 10, skill: 'athletisme', foes: [{ label: 'Bandit', movement: 4, skill: 40 }], round: 1 } });
    continuePursuitRound(useGame.getState, useGame.setState, doneRound(party, 0));
    // Distance reste dans ]0, escapeAt[ → la poursuite n’est pas dénouée, une manche rouvre.
    expect(useGame.getState().pursuit).not.toBeNull();
    expect(useGame.getState().pendingCascade?.purpose).toBe('pursuite');
    expect(useGame.getState().pursuit?.round).toBe(2);
  });

  it('abandon : le groupe renonce et la poursuite se ferme', () => {
    heroes();
    useGame.setState({ pursuit: { partyRole: 'pursuing', distance: 5, escapeAt: 10, skill: 'athletisme', foes: [{ label: 'Voleur', movement: 4, skill: 40 }], round: 1 } });
    pursuitAbandon(useGame.getState, useGame.setState);
    expect(useGame.getState().pursuit).toBeNull();
    expect(useGame.getState().journal.some((l) => l.includes('abandonne'))).toBe(true);
  });

  it('poursuite JOUÉE de bout en bout via la cascade (rôles influençables) atteint une issue terminale', () => {
    useGame.getState().seedRng(11);
    heroes();
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'fleeing', distance: 5, escapeAt: 8, skill: 'athletisme',
      foes: [{ label: 'Bandit', movement: 4, skill: 40 }],
    });
    // Pilote la boucle : rouler chaque étape puis avancer, manche après manche, jusqu’au dénouement.
    for (let guard = 0; guard < 40 && useGame.getState().pendingCascade; guard++) {
      const casc = useGame.getState().pendingCascade!;
      const cur = casc.participants[casc.cursor];
      if (cur && !cur.result) useGame.getState().cascadeRoll(cur.id);
      useGame.getState().cascadeNext();
    }
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(useGame.getState().pursuit).toBeNull(); // poursuite dénouée (semé ou rattrapé)
  });
});
