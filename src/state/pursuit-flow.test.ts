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
import { skillBaseValue, testValue } from '../engine/skills';
import { intentAllowedFor } from './netOwnership';
import { modalOwnerOf } from './modalArbiter';
import type { GameState } from './store';
import type { PendingCascade, CascadeStep } from './pendings';

function heroes() {
  const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Alix', rng: makeRNG(1) });
  const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brun', rng: makeRNG(2) });
  useGame.setState({ party: [a, b] });
  return [a, b];
}

/** Cascade FIGÉE de manche : la BANDE de la manche, une rangée par coureur ayant roulé son Test de
 *  Mouvement (`sl` imposé) — sert à tester la résolution de manche (`continuePursuitRound`) sans UI. */
function doneRound(party: { id: string }[], sl: number): PendingCascade {
  const participants: CascadeStep[] = [{
    id: 'pursuit-1', kind: 'pursuitMove', label: 'Manche 1 — Athlétisme', interactive: true, aggregate: 'none',
    participants: party.map((h) => ({
      id: h.id, label: 'Athlétisme', base: 40, target: 40, interactive: true,
      result: { roll: 40, target: 40, sl, success: sl >= 0 },
    })),
  }];
  return { title: 't', purpose: 'pursuite', participants, cursor: participants.length, log: [] };
}

describe('Poursuite terrestre (#95)', () => {
  beforeEach(() => useGame.setState({ battle: null, party: [], journal: [], pendingCascade: null, pursuit: null }));

  it('l’Effet startPursuit ouvre la manche en UNE bande — un rang par coureur, jamais une étape par héros (#1246)', () => {
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
    expect(casc?.participants).toHaveLength(1); // UNE fenêtre pour la manche entière
    const bande = casc!.participants[0];
    expect(bande.aggregate).toBe('none'); // jets INDÉPENDANTS
    expect(bande.participants?.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    expect(bande.participants?.every((r) => r.interactive && !r.result)).toBe(true);
  });

  it('la ligne de chaque rangée est montée par le MONTEUR : base NUE + mods NOMMÉS, jamais une valeur fondue (#1246)', () => {
    const [a] = heroes();
    // Un État Sonné (LDB 16) : son malus DOIT apparaître en ligne nommée, pas fondu dans `base`.
    useGame.setState({ party: [{ ...a, conditions: [{ id: 'sonne', value: 2 }] }] });
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'fleeing', distance: 4, skill: 'athletisme', foes: [{ label: 'Bandit', movement: 4, skill: 40 }],
    });
    const row = useGame.getState().pendingCascade!.participants[0].participants![0];
    expect(row.base).toBe(skillBaseValue(a, 'athletisme')); // NIVEAU NU
    expect(row.target).toBe(testValue(useGame.getState().party[0], 'athletisme')); // cible DÉRIVÉE
    expect(row.base + (row.mods ?? []).reduce((n, m) => n + m.value, 0)).toBe(row.target); // tout l'écart est NOMMÉ
    expect(row.mods?.some((m) => m.value < 0)).toBe(true); // le Sonné a sa propre ligne
  });

  it('coureur qu’aucun humain ne pilote (héros conduit par l’IA) : sa rangée est un TÉMOIN déjà roulé (#1246)', () => {
    const [a, b] = heroes();
    useGame.setState({ party: [a, { ...b, aiControlled: true }] });
    useGame.getState().seedRng(21);
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'fleeing', distance: 4, skill: 'athletisme', foes: [{ label: 'Bandit', movement: 4, skill: 40 }],
    });
    const rows = useGame.getState().pendingCascade!.participants[0].participants!;
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ interactive: true, result: null });
    const temoin = rows.find((r) => r.id === b.id)!;
    expect(temoin.interactive).toBe(false);
    expect(temoin.result).not.toBeNull(); // roulé À LA CONSTRUCTION — son DR comptera à la clôture
  });

  it('COOP : le coureur d’un AUTRE siège garde SA rangée à jouer, et la manche est une fenêtre de GROUPE (#1246)', () => {
    const [a, b] = heroes();
    const net0 = useGame.getState().net;
    useGame.setState({ net: { ...net0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { [b.id]: 1 } } as GameState['net'] });
    try {
      useGame.getState().seedRng(7);
      startGroundPursuit(useGame.getState, useGame.setState, {
        partyRole: 'fleeing', distance: 4, skill: 'athletisme', foes: [{ label: 'Bandit', movement: 4, skill: 40 }],
      });
      const band = useGame.getState().pendingCascade!.participants[0];
      // Le jet du héros de l'invité est SURFACÉ (`jetSurfaced`, seat-agnostique) : l'hôte ne le roule pas
      // à sa place — c'est SON joueur qui le tiendra.
      expect(band.participants!.find((r) => r.id === b.id)).toMatchObject({ interactive: true, result: null });
      expect(band.participants!.find((r) => r.id === a.id)).toMatchObject({ interactive: true, result: null });
      // Fenêtre de GROUPE : sans `groupOwner`, l'arbitre rend `undefined` (modale hôte-only) et l'invité
      // ne verrait JAMAIS la manche où se tient son Test.
      expect(band.groupOwner).toBe(true);
      const s = useGame.getState();
      expect(modalOwnerOf(s)).toBe('*');
      expect(intentAllowedFor(s, 1, 'cascadeBatchRoll', [b.id]), 'l’invité roule SA rangée').toBe(true);
      expect(intentAllowedFor(s, 0, 'cascadeBatchRoll', [a.id]), 'l’hôte roule la sienne').toBe(true);
    } finally {
      useGame.setState({ net: net0 });
    }
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

  it('poursuite JOUÉE de bout en bout via les bandes (rangées influençables) atteint une issue terminale', () => {
    useGame.getState().seedRng(11);
    heroes();
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'fleeing', distance: 5, escapeAt: 8, skill: 'athletisme',
      foes: [{ label: 'Bandit', movement: 4, skill: 40 }],
    });
    // Pilote la boucle : rouler CHAQUE RANGÉE de la bande puis avancer, manche après manche.
    const manches: number[] = [];
    for (let guard = 0; guard < 40 && useGame.getState().pendingCascade; guard++) {
      const casc = useGame.getState().pendingCascade!;
      manches.push(casc.participants.length);
      const cur = casc.participants[casc.cursor];
      for (const row of cur?.participants ?? []) if (!row.result) useGame.getState().cascadeBatchRoll(row.id);
      useGame.getState().cascadeNext();
    }
    // Chaque manche est UNE fenêtre (le « 1/8 » du signal utilisateur ne peut plus se produire).
    expect(manches.every((n) => n === 1)).toBe(true);
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(useGame.getState().pursuit).toBeNull(); // poursuite dénouée (semé ou rattrapé)
  });

  it('MANCHE SUIVANTE : une manche indécise rouvre UNE bande neuve, jamais la précédente rejouée', () => {
    useGame.getState().seedRng(5);
    const party = heroes();
    useGame.setState({ pursuit: { partyRole: 'fleeing', distance: 5, escapeAt: 10, skill: 'athletisme', foes: [{ label: 'Bandit', movement: 4, skill: 40 }], round: 1 } });
    continuePursuitRound(useGame.getState, useGame.setState, doneRound(party, 0));
    const casc = useGame.getState().pendingCascade!;
    expect(casc.participants).toHaveLength(1);
    expect(casc.participants[0].participants?.map((r) => r.id).sort()).toEqual(party.map((h) => h.id).sort());
    expect(casc.participants[0].participants?.every((r) => !r.result)).toBe(true);
  });
});
