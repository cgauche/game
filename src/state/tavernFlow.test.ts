/**
 * Jeux de taverne (NADJ 16) — câblage store : le jet du challenger est une CASCADE (`openRoll`,
 * `state/tavernFlow.ts`, #370) — une partie se joue de bout en bout via `drain()` (patron
 * `port-sell-cargo.test.ts`) : choix jeu + adversaire → cascade. Test OPPOSÉ RÉEL (#579) : l'adversaire
 * est roulé et FIGÉ dans `meta.opposed.aT` AVANT que le jet du joueur ne s'ouvre — la ré-opposition sous
 * influence (Chance « +1 DR ») est vérifiée directement contre `resolveOpposed`, jamais un second tirage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { toBrass } from '../engine/money';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { seedBattleRng } from './battleRng';
import { resolveOpposed } from '../engine/tests';
import { addCondition, COND } from '../engine/conditions';
import { findTavernGameById } from '../engine/tavernGame';
import { tavernGameValue, tavernGameBaseValue } from './tavernFlow';
import type { Combatant } from '../engine/types';

const get = useGame.getState.bind(useGame);

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
async function drain(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const p = get().pendingCascade;
    if (p) {
      const cur = p.participants[p.cursor];
      if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      get().cascadeNext();
    }
    await tick();
  }
}

function twoHeroes(): [Combatant, Combatant] {
  const all = makePregens();
  return [all[0] as Combatant, all[1] as Combatant];
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null });
  seedBattleRng(3);
});

describe('playTavernGame', () => {
  it('mode OPPOSÉ : la manche s’ouvre par le SOCLE de séquence (étape mintée, jamais un résultat synchrone)', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().openTavernGames();
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id }, stakeBrass: 20 });
    expect(get().tavernGames?.result).toBeNull();
    expect(get().pendingCascade).not.toBeNull();
    const step = get().pendingCascade!.participants[0];
    expect(step.actorId).toBe(a.id);
    expect(step.kind).toBe('tavern-round');
    expect(get().pendingCascade!.purpose).toBe('sequence');
    // L'état de séquence PORTE la partie (persisté avec la sauvegarde), le pot compris.
    expect(get().sequence?.def).toBe('tavern-opposed');
  });

  it('partie entre compagnons : issue stockée après la cascade, gagnant cohérent, bourse inchangée', async () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    creditBourse(get, useGame.setState, a.id, { gold: 5, silver: 0, brass: 0 });
    const purseBefore = toBrass(partyMoneyTotal(get));
    get().openTavernGames();
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id }, stakeBrass: 20 });
    await drain();
    const res = get().tavernGames?.result;
    expect(res).toBeTruthy();
    expect(res!.gameLabel).toBe('Les boules');
    expect(['player', 'opponent', 'tie']).toContain(res!.winner);
    // Mise ignorée entre compagnons (aucune bourse ne bouge).
    expect(res!.stakeBrass).toBe(0);
    expect(res!.netBrass).toBe(0);
    expect(toBrass(partyMoneyTotal(get))).toBe(purseBefore);
  });

  it('bras de fer (Test étendu) : plusieurs manches, premier à 10 DR cumulés', async () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    await drain();
    const res = get().tavernGames!.result!;
    expect(res.rounds).toBeGreaterThanOrEqual(1);
    expect(Math.max(res.playerSL, res.opponentSL)).toBeGreaterThanOrEqual(10); // cible atteinte
  });

  it('mise contre un habitué (Al-zahr) : la bourse suit le résultat (±mise / 0)', async () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a] });
    creditBourse(get, useGame.setState, a.id, { gold: 5, silver: 0, brass: 0 }); // bourse du challenger = 5 CO
    const before = toBrass(partyMoneyTotal(get));
    // Al-zahr porte une mise ; adversaire ABSTRAIT → la mise joue. 10 pistoles = 120 sc.
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'abstract', value: 30 }, stakeBrass: 120 });
    await drain();
    const res = get().tavernGames!.result!;
    expect(res.stakeBrass).toBe(120);
    const expectedNet = res.winner === 'player' ? 120 : res.winner === 'opponent' ? -120 : 0;
    expect(res.netBrass).toBe(expectedNet);
    expect(toBrass(partyMoneyTotal(get))).toBe(before + expectedNet);
  });

  it('mise plafonnée à la bourse', async () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a] });
    creditBourse(get, useGame.setState, a.id, { gold: 0, silver: 0, brass: 50 }); // bourse du challenger = 50 sc
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'abstract', value: 30 }, stakeBrass: 100000 });
    await drain();
    expect(get().tavernGames!.result!.stakeBrass).toBe(50); // borné à la bourse du challenger
  });

  it('Test opposé RÉEL (#579) : le jet adversaire est déjà roulé et FIGÉ dans le meta AVANT que le joueur ne lance', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    const step = get().pendingCascade!.participants[0];
    expect(step.result).toBeNull(); // le joueur n'a pas encore lancé SON jet
    expect(step.meta?.opposed?.aT).toBeTruthy(); // l'adversaire, lui, a DÉJÀ un jet FIGÉ
    expect(step.meta?.opposed?.attackerId).toBe(b.id);
    expect(step.meta?.opposed?.attackerName).toBe(b.label);
  });

  it('adversaire ABSTRAIT (table) : jet figé sans attackerId (aucun Combatant réel)', () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'abstract', value: 30 } });
    const step = get().pendingCascade!.participants[0];
    expect(step.meta?.opposed?.aT).toBeTruthy();
    expect(step.meta?.opposed?.attackerId).toBeUndefined();
    expect(step.meta?.opposed?.attackerName).toBe('un adversaire de la salle');
  });

  it('Chance « +1 DR » RÉ-OPPOSE le jet du joueur contre l’adversaire FIGÉ — jamais un second tirage', () => {
    const [a, b] = twoHeroes();
    a.fortune = 3;
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    const stepId = get().pendingCascade!.participants[0].id;
    get().cascadeRoll(stepId);
    const before = get().pendingCascade!.participants[0];
    const aT = before.meta!.opposed!.aT;
    get().cascadeBonusSL(stepId);
    const after = get().pendingCascade!.participants[0].result!;
    // Le DR propre du défenseur monte de +1 (Chance, LDB 17 l.26) — jamais un nouveau jet de l'adversaire.
    expect(after.sl).toBe(before.result!.sl + 1);
    expect(after.roll).toBe(before.result!.roll); // même dé, la Chance n'en tire pas un autre
    // L'issue exposée (`success`) recalcule l'opposition contre le MÊME `aT` figé (calque `disengage`).
    const recomposed = resolveOpposed(aT, { roll: after.roll, target: after.target, sl: after.sl, success: after.roll <= after.target, isDouble: false });
    expect(after.success).toBe(recomposed.winner !== 'attacker');
  });

  /**
   * #1153 L2 — DÉPARTAGE HOMOGÈNE. `LDB 12 l.160` (verbatim `12 - Tests.md`) : « Si les deux
   * participants obtiennent le même DR, c'est le groupe avec la Compétence ou la Caractéristique la
   * plus élevée qui l'emporte. » Les DEUX camps doivent donc opposer une COMPÉTENCE : le challenger
   * par la porte du seam (`step.base` = `skillBaseValue`), l'adversaire par `tavernGameBaseValue`.
   * L'État (−10 d'Empoisonné, LDB 16) est un modificateur : il vit dans la CIBLE des deux côtés.
   */
  it('DR égal : les DEUX camps opposent leur Compétence NUE — l’État ne vole pas la manche (LDB 12 l.160)', () => {
    const [a, b] = twoHeroes();
    addCondition(a, COND.empoisonne);
    addCondition(b, COND.empoisonne);
    useGame.setState({ party: [a, b] });
    const game = findTavernGameById('boules')!;
    // `b` (Compétence 28) défie `a` (Compétence 33) : `b` est le PLUS FAIBLE des deux — mais sa
    // Compétence NUE dépasse la valeur de Test EMPOISONNÉE de `a` (23). C'est le piège du mixte.
    expect(tavernGameBaseValue(b, game)).toBe(28);
    expect(tavernGameValue(b, game)).toBe(18);
    expect(tavernGameBaseValue(a, game)).toBe(33);
    expect(tavernGameValue(a, game)).toBe(23);
    seedBattleRng(23); // graine où les deux camps tombent au MÊME DR (le départage se voit)
    get().playTavernGame({ gameId: 'boules', challengerId: b.id, opponent: { kind: 'hero', id: a.id } });
    const stepId = get().pendingCascade!.participants[0].id;
    get().cascadeRoll(stepId);
    const st = get().pendingCascade!.participants[0];
    const aT = st.meta!.opposed!.aT;
    expect(st.result!.sl).toBe(aT.sl); // DR ÉGAL : c'est la Compétence qui tranche
    expect(st.base).toBe(28); // Compétence NUE du challenger (posée par la porte du seam)
    expect(aT.base).toBe(33); // …et Compétence NUE de l'adversaire, JAMAIS sa valeur de Test
    expect(aT.target).toBe(23); // l'État de l'adversaire reste dans SA cible (invariante)
    expect(st.result!.success).toBe(false); // 33 > 28 : l'adversaire l'emporte
  });

  it('zéro divergence de maths avec `resolveTavernRound` : le verdict final recompose EXACTEMENT depuis le meta figé', async () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    const step = get().pendingCascade!.participants[0];
    const aT = step.meta!.opposed!.aT;
    await drain();
    const res = get().tavernGames!.result!;
    // Recompose le verdict SEUL depuis le jet adverse figé + le DR final connu du joueur (`res.playerSL`) —
    // même comparaison que `resolveOpposed` côté moteur (`engine/tavernGame.resolveTavernRound`).
    const opp = resolveOpposed({ roll: 0, target: 0, sl: res.playerSL, success: res.playerSL > 0, isDouble: false }, aT);
    const expectedWinner = opp.winner === 'attacker' ? 'player' : opp.winner === 'defender' ? 'opponent' : 'tie';
    expect(res.winner).toBe(expectedWinner);
    expect(res.opponentSL).toBe(Math.min(aT.sl, 6)); // Boules : plafond 6 DR (drCap) sur une réussite
  });
});
