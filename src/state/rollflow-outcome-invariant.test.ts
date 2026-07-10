import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { FLOW_VERBS } from './rollFlowSpecs';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

/**
 * GARDE BEHAVIORAL de l'ISSUE CANONIQUE (`spec.outcome`) — VERROUILLE la classe de bugs « le prédicat
 * `failed` DIVERGE de l'issue réelle du flux » (bug historique `activity` : la narration lisait
 * `combinedLevel`, l'ancien `failed` lisait skill-1 → Chance/Résilience mal gatées).
 *
 * Depuis le refactor, la fabrique DÉRIVE le gating de la Chance/Pacte/Résistance de l'issue unique :
 * `failed = !outcome(slot).won`. Ce test PILOTE, flux par flux (catalogue-dérivé de `FLOW_VERBS`), le
 * verbe RÉELLEMENT gaté par ce `failed` — la RELANCE de Chance (`<prefix>Reroll`) — et prouve qu'il :
 *   (a) est DISPONIBLE sur un résultat PERDANT (dépense 1 Point de Chance) ;
 *   (b) est un NO-OP sur un résultat GAGNANT (aucune dépense).
 * Un flux dont l'`outcome.won` NE reflète PAS son issue réelle fait donc échouer (a) ou (b).
 *
 * Observable = le Point de Chance : `opReroll` ne le dépense QUE si `rolled && !outcome.won` (via
 * `canReroll`) ET que la re-résolution aboutit. Le cas GAGNANT court-circuite AVANT toute re-résolution
 * (donc toujours sûr) ; le cas PERDANT exige une re-résolution valide (d'où les fixtures minimales mais
 * complètes ci-dessous, calquées sur `resilience-die-choice.test.ts`).
 */

const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'X', name: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 35, endurance: 35, initiative: 35, agilite: 35, dexterite: 35, intelligence: 35, 'force-mentale': 35, sociabilite: 35 },
    wounds: { current: 14, max: 14 }, advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

/** Héros « A » avec 1 Point de Chance (l'observable) ; l'ennemi « B » adjacent. */
const hero = (over: Partial<Combatant> = {}): Combatant => C({ id: 'A', name: 'A', kind: 'hero', fortune: 1, resilience: 1, ...over });
const foe = (over: Partial<Combatant> = {}): Combatant => C({ id: 'B', name: 'B', kind: 'enemy', fortune: 0, resilience: 0, pos: { x: 1, y: 0 }, ...over });
const arena = (extra: Combatant[] = []) => ({ combatants: [hero(), foe(), ...extra], log: [] });

/** Jets propres PERDANT / GAGNANT réutilisés partout (roll ≤ cible = réussite). */
const LOSE = { roll: 95, target: 40, success: false, sl: -5, isDouble: false };
const WIN = { roll: 8, target: 40, success: true, sl: 3, isDouble: false };

/** Détail d'attaquant/défenseur (attaque/défense/piétinement). */
const atkDetail = (win: boolean) => ({ label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: win ? 20 : 88, success: win, sl: win ? 2 : -4 });

const fortuneOfA = (): number | undefined => {
  const s = useGame.getState();
  return (s.battle?.combatants ?? s.party).find((c) => c.id === 'A')?.fortune;
};

type Fix = { pid?: string; make: (win: boolean) => Record<string, unknown> };

/**
 * Fixtures par flux (préfixe de `FLOW_VERBS`). `make(win)` pose une arène fraîche (A = 1 Chance) + le
 * pending avec un jet PERDANT (win=false) ou GAGNANT (win=true). L'`outcome` du flux DOIT lire le champ
 * qui bascule ci-dessous. Les flux absents sont documentés dans `SKIP` (fixture trop lourde/hors-jet).
 */
const FIXTURES: Record<string, Fix> = {
  // ── Attaque / défense / piétinement (issue = `attackerDetail.success` / `def.success`) ──
  attack: { make: (win) => ({
    battle: arena(), scene: testScene, // resolveAttack (re-résolution) lit la scène (LdV/couvert) sans garde
    pendingAttack: { attackerId: 'A', targetId: 'B', location: null, result: { hit: win, attackerRoll: win ? 20 : 88, netSL: win ? 2 : -4, critical: false, advantageTo: win ? 'attacker' : 'defender', defenderDefeated: false, log: '', attackerDetail: atkDetail(win) } },
  }) },
  defense: { make: (win) => ({
    battle: { combatants: [hero({ pos: { x: 1, y: 0 } }), foe({ pos: { x: 0, y: 0 } })], log: [] },
    pendingDefense: {
      attackerId: 'B', defenderId: 'A', weapon: { name: 'Gourdin', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] },
      location: null, atk: { roll: 30, target: 45, success: true, sl: 1, isDouble: false }, mode: 'esquive',
      def: win ? WIN : LOSE,
      result: { hit: !win, attackerRoll: 30, netSL: win ? -1 : 5, critical: false, advantageTo: win ? 'defender' : 'attacker', defenderDefeated: false, log: '', attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 30, success: true, sl: 1 }, defenderDetail: { label: 'Esquive', base: 40, modifier: 0, target: 40, roll: win ? 8 : 95, success: win, sl: win ? 3 : -5 } },
    },
  }) },
  trample: { make: (win) => ({
    battle: arena(),
    pendingTrample: { attackerId: 'A', targetId: 'B', result: { hit: win, attackerRoll: win ? 20 : 90, netSL: win ? 2 : -5, critical: false, advantageTo: win ? 'attacker' : 'defender', defenderDefeated: false, log: '', attackerDetail: atkDetail(win) } },
  }) },
  // ── Incantation / Focalisation / dissipation (jet propre / DR) ──
  cast: { make: (win) => ({
    battle: arena(),
    pendingCast: { casterId: 'A', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: { cast: win, roll: win ? 8 : 88, target: 45, sl: win ? 3 : -4, isCritical: false, isFumble: false, log: '' } },
  }) },
  focus: { make: (win) => ({
    battle: arena(),
    pendingFocus: { casterId: 'A', spellId: 'drain', result: { dr: win ? 2 : 0, isCritical: false, isFumble: false, roll: win ? 8 : 95, target: 40, sl: win ? 2 : -5, log: '' } },
  }) },
  dispel: { make: (win) => ({ battle: arena(), pendingDispel: { casterId: 'A', value: 40, result: win ? WIN : LOSE } }) },
  // ── Opposés BINAIRES (issue = jet de l'ACTEUR, foe figé) ──
  disengage: { make: (win) => ({ battle: arena(), pendingDisengage: { moverId: 'A', atk: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, def: win ? WIN : LOSE, result: win ? 'success' : 'fail' } }) },
  auContact: { make: (win) => ({ battle: arena(), pendingAuContact: { moverId: 'A', atk: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, def: win ? WIN : LOSE, result: win ? 'success' : 'fail' } }) },
  grapple: { make: (win) => ({ battle: arena(), pendingGrapple: { actorId: 'A', atk: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, def: win ? WIN : LOSE, result: win ? 'success' : 'fail' } }) },
  distraire: { make: (win) => ({ battle: arena(), pendingDistraire: { moverId: 'A', defRoll: { roll: 40, target: 45, success: true, sl: 1, isDouble: false }, atk: win ? WIN : LOSE, result: win ? 'success' : 'fail' } }) },
  // ── Fuir (Calme du fuyard, nested `fuir.calme`) ──
  flee: { make: (win) => ({ battle: arena(), pendingDisengage: { moverId: 'A', fuir: { calme: win ? WIN : LOSE } } }) },
  // ── Manœuvres d'attaquant NON opposées (issue = `result.success`) ──
  battement: { make: (win) => ({ battle: arena(), pendingBattement: { attackerId: 'A', result: win ? WIN : LOSE } }) },
  maneuver: { make: (win) => ({ battle: arena(), pendingManeuver: { attackerId: 'A', kind: 'souffle', result: win ? WIN : LOSE } }) },
  // ── Course / Frénésie / Approche / Bénédiction (Test binaire) ──
  run: { make: (win) => ({ battle: arena(), pendingRun: { combatantId: 'A', result: { success: win, roll: win ? 8 : 95, target: 40, dr: win ? 3 : 0, bonusCases: win ? 1 : 0 } } }) },
  frenzy: { make: (win) => ({ battle: arena(), pendingFrenzy: { combatantId: 'A', result: win ? WIN : LOSE } }) },
  approach: { make: (win) => ({ battle: arena(), pendingApproach: { combatantId: 'A', result: win ? WIN : LOSE } }) },
  ward: { make: (win) => ({ battle: arena(), pendingWard: { attackerId: 'A', result: win ? WIN : LOSE } }) },
  // ── Tests numériques « jet propre » (soin/rechargement/évaluation/corruption/activité/test) ──
  reload: { make: (win) => ({ battle: arena(), pendingReload: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  handGate: { make: (win) => ({ battle: arena(), pendingHandGate: { attackerId: 'A', actorName: 'A', hand: 'main', skillValue: 40, difficulty: 'accessible', roll: win ? 8 : 95, target: 60, sl: win ? 3 : -5, success: win, pa: { attackerId: 'A', targetId: 'B', location: null, result: null }, title: 'Attaque', icon: 'action/attack' } }) },
  heal: { make: (win) => ({ battle: arena(), pendingHeal: { healerId: 'A', mode: 'first-aid', skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  surgery: { make: (win) => ({ battle: arena(), pendingSurgery: { healerId: 'A', skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  appraise: { make: (win) => ({ battle: arena(), pendingAppraise: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  corruption: { make: (win) => ({ battle: arena(), pendingCorruption: { heroId: 'A', skill: 'calme', roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  test: { make: (win) => ({ battle: arena(), pendingTest: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', target: 40, requireSL: 0, roll: win ? 8 : 95, sl: win ? 3 : -5, success: win } }) },
  steamSave: { make: (win) => ({ battle: arena(), pendingSteamSave: { actorId: 'A', actorName: 'A', skillValue: 40, difficulty: 'intermediaire', target: 40, scaldOps: [{ op: 'wounds', amount: 1, ignoreAP: true }], roll: win ? 8 : 95, sl: win ? 3 : -5, success: win } }) },
  activity: { make: (win) => ({ battle: arena(), pendingActivity: { heroId: 'A', kind: 'catalog', label: 'x', skillLabel: 'x', skillValue: 40, difficulty: 'intermediaire', mod: 0, roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }) },
  shanty: { make: (win) => ({ battle: arena(), pendingShanty: { singerId: 'A', shantyId: 'x', result: win ? WIN : LOSE } }) },
  // ── Opposés « joueur vs figé » avec re-résolution dédiée (récupération / marchandage) ──
  recover: { make: (win) => ({ battle: arena(), pendingStateRecovery: { actorId: 'A', skillValue: 40, difficulty: 'intermediaire', opposed: false, roll: win ? WIN : LOSE, netSL: win ? 3 : 0, success: win } }) },
  bargain: { make: (win) => ({ battle: arena(), pendingBargain: { playerId: 'A', playerSkill: 40, merchantValue: 40, roll: win ? WIN : LOSE, merchantRoll: { roll: 50, target: 40, success: false, sl: -1, isDouble: false }, result: { winner: win ? 'attacker' : 'defender', attackerWins: win, netSL: win ? 2 : -2 } } }) },
  // ── MULTI (participant/round/étape « A ») ──
  counterspell: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingCast: { casterId: 'B', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: { cast: true, roll: 20, target: 45, sl: 2, isCritical: false, isFumble: false, log: '' } },
    pendingCounterspell: { participants: [{ id: 'A', interactive: true, result: { counter: win ? WIN : LOSE, dispelled: win, margin: win ? 1 : -1 } }] },
  }) },
  opposition: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingCast: { casterId: 'B', targetId: 'A', spellId: 'drain', missile: false, focused: false, result: { cast: true, roll: 20, target: 45, sl: 2, isCritical: false, isFumble: false, log: '' } },
    pendingCastOpposition: { kind: 'resist', char: 'force-mentale', participants: [{ id: 'A', interactive: true, result: { oppose: win ? WIN : LOSE, resisted: win, margin: win ? 0 : 2 } }] },
  }) },
  cascade: { pid: 'st1', make: (win) => ({
    battle: arena(),
    pendingCascade: { purpose: 'combat', cursor: 0, participants: [{ id: 'st1', actorId: 'A', target: 40, result: { roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, success: win } }] },
  }) },
  extendedTest: { pid: 'r1', make: (win) => ({
    battle: arena(),
    pendingExtendedTest: { actorId: 'A', label: 'x', skillLabel: 'x', target: 40, targetDR: 5, total: 0, rounds: [{ id: 'r1', result: { roll: win ? 8 : 95, sl: win ? 3 : -5, success: win } }] },
  }) },
  forceDoor: { pid: 'A', make: (win) => ({
    battle: arena(),
    pendingForceDoor: { label: 'Porte', doorBE: 2, doorB: 6, doorBmax: 6, participants: [{ id: 'A', result: { roll: win ? 8 : 95, target: 40, sl: win ? 3 : -5, damage: win ? 4 : 0 } }] },
  }) },
  // PV de repos : une ligne de récupération de HÉROS ratée est relançable (Chance) ; réussie = no-op.
  restLedger: { pid: 'rec-A', make: (win) => ({
    battle: null, party: [hero(), foe()],
    pendingRest: { places: { camp: true }, quality: 'normale', days: 3, perHero: {}, phase: 'bilan',
      results: [{ id: 'rec-A', actorId: 'A', label: 'Récupération', reKind: 'recovery',
        d: { label: 'Résistance', base: 55, modifier: 0, target: 55, roll: win ? 8 : 95, success: win, sl: win ? 3 : -5 } }] },
  }) },
};

/** Flux NON couverts par une fixture minimale — justifiés (leur `outcome` est trivial + partagé). */
const SKIP: Record<string, string> = {
  shipManeuver: 'Test d’équipage par rôle (MDG ch.14) — fixture de rôle valide lourde ; `outcome` = `cleanRollOutcome` partagé (crewRoleFlowSpec), déjà exercé par la logique numérique de forceDoor',
  shipBattery: 'idem shipManeuver (MÊME crewRoleFlowSpec)',
  crewTest: 'idem shipManeuver (MÊME crewRoleFlowSpec)',
  cascadeCrew: 'idem shipManeuver — mêmes ingrédients (`rollCrewRole`/`cleanRollOutcome`), seule la localisation des slots diverge (étape de cascade, seam #275 Décision 4 cran 1)',
};

beforeEach(() => {
  useGame.setState({ battle: null, scene: null } as never);
});

describe('Issue canonique (outcome) — la Chance est gatée par l’issue RÉELLE (failed dérivé == won)', () => {
  // Les 11 flux « à risque » (issues multi-valeurs : combiné/opposé/DR/jet-propre-vs-issue) DOIVENT être couverts.
  const REQUIRED = ['activity', 'attack', 'defense', 'cast', 'counterspell', 'opposition', 'recover', 'bargain', 'disengage', 'flee', 'focus'];
  it('couvre tous les flux à risque (multi-valeurs)', () => {
    const missing = REQUIRED.filter((p) => !(p in FIXTURES));
    expect(missing, 'flux à risque sans fixture').toEqual([]);
  });

  it('chaque flux de FLOW_VERBS est couvert par une fixture OU justifié dans SKIP', () => {
    const uncovered = Object.keys(FLOW_VERBS).filter((p) => !(p in FIXTURES) && !(p in SKIP));
    expect(uncovered, 'flux ni couvert ni justifié').toEqual([]);
  });

  for (const prefix of Object.keys(FLOW_VERBS)) {
    const fx = FIXTURES[prefix];
    if (!fx) {
      it.skip(`${prefix} — non piloté (${SKIP[prefix] ?? 'à couvrir'})`, () => {});
      continue;
    }
    const rerollFn = `${prefix}Reroll`;
    it(`${prefix} : reroll DISPONIBLE sur un perdant, NO-OP sur un gagnant`, () => {
      // (a) PERDANT → outcome.won=false → failed=true → la Chance se dépense.
      seedBattleRng(9);
      useGame.setState({ battle: null } as never);
      useGame.setState(fx.make(false) as never);
      (useGame.getState() as unknown as Record<string, (pid?: string) => void>)[rerollFn](fx.pid);
      expect(fortuneOfA(), `${prefix} perdant : la relance de Chance doit être DISPONIBLE (1 Point dépensé)`).toBe(0);

      // (b) GAGNANT → outcome.won=true → failed=false → aucune relance possible (no-op).
      seedBattleRng(9);
      useGame.setState({ battle: null } as never);
      useGame.setState(fx.make(true) as never);
      (useGame.getState() as unknown as Record<string, (pid?: string) => void>)[rerollFn](fx.pid);
      expect(fortuneOfA(), `${prefix} gagnant : la relance de Chance doit être un NO-OP (Point conservé)`).toBe(1);
    });
  }
});
