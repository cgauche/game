import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { registerCascadeApplier, type CascadeApplier } from './cascade';
import { setGmSeat } from './netFlow';
import { openRoll, rollTitle, resultLine, type RollRequest, type Consequence } from './rollSeam';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns } from './netOwnership';
import type { Combatant } from '../engine/types';

/**
 * SEAM DE JET UNIQUE — Ronde 0 (#275 substrat). Couvre les 4 classes déclaratives (`RollClass`) ×
 * leurs 3 surfaces (M/V/I, Décision 3) via `openRoll`, sans aucun call-site réel migré (hors périmètre
 * Ronde 0). Chaque test enregistre un applier DÉDIÉ (kind unique, namespacé) et observe : (a) si une
 * modale/cascade s'est ouverte (`pendingCascade`) — surface M/V ; (b) si l'applier a tourné d'office —
 * surface I (`runCascadeImmediate`, `cascade.ts:194`).
 */
describe('rollSeam — openRoll (#275 Ronde 0)', () => {
  const applied: { kind: string; success: boolean; sl: number }[] = [];

  beforeEach(() => {
    applied.length = 0;
    useGame.setState({ battle: null, party: [], pendingCascade: null, journal: [], travelPlan: null } as never);
    setGmSeat(useGame.getState, useGame.setState, null);
    for (const kind of ['seam-hero', 'seam-enemy', 'seam-subi', 'seam-batch']) {
      registerCascadeApplier(kind, (_get, _set, step) => {
        applied.push({ kind: step.kind, success: !!step.result?.success, sl: step.result?.sl ?? 0 });
        return { journal: [`${step.label} → ${step.result?.success ? 'réussi' : 'raté'}`] };
      });
    }
  });

  const hero = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'H', name: 'Héros', kind: 'hero',
      characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 },
      skills: [{ skillId: 'resistance', characteristic: 'E', advances: 20 }],
      conditions: [], talents: [], fortune: 1, resilience: 1,
      ...over,
    }) as unknown as Combatant;

  const enemy = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'E', name: 'Ennemi', kind: 'enemy',
      characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 },
      skills: [{ skillId: 'perception', characteristic: 'I', advances: 20 }],
      conditions: [], talents: [],
      ...over,
    }) as unknown as Combatant;

  it('hero-test, héros piloté-humain, cadence MANUELLE → M (modale influençable)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, test: { skill: 'resistance', char: 'E', label: 'Résistance' }, difficulty: 'intermediaire', klass: 'hero-test' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-hero');
    expect(useGame.getState().pendingCascade).toBeTruthy(); // surfacé, pas résolu d'office
    expect(applied).toHaveLength(0);
  });

  it('enemy, côté ennemi/monde SOUS siège MJ, manuel → V (étape visible-lançable MJ)', () => {
    useGame.setState({ party: [enemy()] });
    setGmSeat(useGame.getState, useGame.setState, 0);
    const req: RollRequest = { side: { actorId: 'E' }, test: { skill: 'perception', char: 'I', label: 'Perception' }, difficulty: 'intermediaire', klass: 'enemy' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-enemy');
    expect(useGame.getState().pendingCascade).toBeTruthy(); // surfacé chez le MJ (V)
    expect(applied).toHaveLength(0);
  });

  it('enemy, SANS siège MJ (IA) → I (inline-PV, résolu d’office)', () => {
    useGame.setState({ party: [enemy()] });
    const req: RollRequest = { side: { actorId: 'E' }, test: { skill: 'perception', char: 'I', label: 'Perception' }, difficulty: 'intermediaire', klass: 'enemy' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-enemy');
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
    expect(applied[0].kind).toBe('seam-enemy');
  });

  it('subi, porté par un héros SANS MJ → I (jamais M — « subi » n’est jamais une décision du sujet)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, test: { skill: 'resistance', char: 'E', label: 'Scorbut' }, difficulty: 'intermediaire', klass: 'subi' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-subi');
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
    expect(applied[0].kind).toBe('seam-subi');
  });

  it('subi, côté SOUS siège MJ → V (read-only : le MJ voit/lance, n’influence pas)', () => {
    useGame.setState({ party: [] });
    setGmSeat(useGame.getState, useGame.setState, 0);
    const req: RollRequest = { side: { worldSide: 'ship', shipId: 'nef' }, test: { label: 'Désertion' }, difficulty: 'intermediaire', klass: 'subi' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-subi');
    expect(useGame.getState().pendingCascade).toBeTruthy();
    expect(applied).toHaveLength(0);
  });

  it('worldSide sans acteur, en COOP avec gmSeat ≠ hôte → l’étape est OWNÉE par le MJ (delta 1)', () => {
    useGame.setState({ party: [] });
    setGmSeat(useGame.getState, useGame.setState, 1); // gmSeat ≠ hôte (0)
    const req: RollRequest = { side: { worldSide: 'ship', shipId: 'nef' }, test: { label: 'Désertion' }, difficulty: 'intermediaire', klass: 'subi' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-subi');
    const owner = modalOwnerOf(useGame.getState());
    expect(seatOwns(useGame.getState(), 1, owner ?? undefined)).toBe(true); // le MJ possède l'étape
    expect(seatOwns(useGame.getState(), 0, owner ?? undefined)).toBe(false); // l'hôte ne la possède plus
  });

  it('batch, voyage COMMANDÉE + kind de ROUTINE → I (immédiat, `runCascadeImmediate`)', () => {
    const crew: Combatant = { id: 'timonier1', name: 'Timonier', kind: 'hero', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, skills: [{ skillId: 'navigation-fluviale', characteristic: 'Int', advances: 30 }], conditions: [], talents: [] } as unknown as Combatant;
    useGame.setState({ party: [crew], travelPlan: { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'sea', hoursPerDay: 8, km: 0, kmDone: 0, interrupted: false, orders: { cadence: 'commande' } } as never });
    const req: RollRequest = {
      side: { participants: [{ id: 'timonier1', roleId: 'timonier', essential: true, result: null }], shipId: 'nef' },
      test: { label: 'Progression' }, difficulty: 'intermediaire', klass: 'batch',
    };
    openRoll(useGame.getState, useGame.setState, req, 'progression');
    // 'progression' ∈ SEA_ROUTINE_KINDS + cadence COMMANDÉE ⇒ autoV ⇒ I : résolu et appliqué d'office.
    expect(useGame.getState().pendingCascade).toBeNull();
    // (l'applier 'progression' réel n'est pas enregistré ici — la porte a tenté `cascadeAppliers['progression']`,
    // absent en Ronde 0 : `commitStep` no-op silencieusement sur un kind non enregistré, cf. `cascade.ts:110`.)
  });

  it('batch, cadence jour-par-jour, sans MJ → M (multi surfacé, agrégat pré-résolu)', () => {
    const crew: Combatant = { id: 'timonier1', name: 'Timonier', kind: 'hero', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, skills: [{ skillId: 'navigation-fluviale', characteristic: 'Int', advances: 30 }], conditions: [], talents: [] } as unknown as Combatant;
    useGame.setState({ party: [crew] });
    const req: RollRequest = {
      side: { participants: [{ id: 'timonier1', roleId: 'timonier', essential: true, result: null }], shipId: 'nef' },
      test: { label: 'Progression' }, difficulty: 'intermediaire', klass: 'batch',
    };
    openRoll(useGame.getState, useGame.setState, req, 'seam-batch');
    expect(useGame.getState().pendingCascade).toBeTruthy();
    expect(useGame.getState().pendingCascade!.participants[0].result).toBeTruthy(); // agrégat déjà résolu (écart 2)
    expect(applied).toHaveLength(0); // I surface a validé son étape ; M surface attend l'action « Continuer » du joueur
  });

  it('rollTitle : dérive le titre depuis les ids (acteur/compétence/difficulté) — un seul composeur', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, test: { skill: 'resistance', char: 'E', label: 'Résistance' }, difficulty: 'intermediaire', klass: 'hero-test' };
    expect(rollTitle(useGame.getState, req)).toBe('Héros — Résistance (Résistance Intermédiaire (+0))');
  });

  it('rollTitle : côté worldSide (aucun acteur) — pas de préfixe d\'acteur', () => {
    useGame.setState({ party: [] });
    const req: RollRequest = { side: { worldSide: 'ship', shipId: 'nef' }, test: { label: 'Désertion' }, difficulty: 'intermediaire', klass: 'subi' };
    expect(rollTitle(useGame.getState, req)).toBe('Désertion');
  });

  it('mono : startCascade pose pending.title = rollTitle(...), pas req.test.label nu', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, test: { skill: 'resistance', char: 'E', label: 'Résistance' }, difficulty: 'intermediaire', klass: 'hero-test' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-hero');
    expect(useGame.getState().pendingCascade!.title).toBe(rollTitle(useGame.getState, req));
    expect(useGame.getState().pendingCascade!.title).not.toBe(req.test.label);
  });
});

describe('resultLine — dénouement sans roll/target/sl/won (#295 Lot 0, Décision 1b)', () => {
  it('cons vide ⇒ chaîne vide (le verdict reste porté par la rangée de jet)', () => {
    expect(resultLine([])).toBe('');
  });

  it('{ops} rend le montant RÉEL depuis le GameOp déjà appliqué', () => {
    const cons: Consequence[] = [{ ops: [{ op: 'wounds', amount: 3 }] }];
    expect(resultLine(cons)).toBe('3 Blessure(s) perdue(s).');
  });

  it('{say} résout la clé i18n out.* (sans placeholder de jet)', () => {
    const cons: Consequence[] = [{ say: 'out.consHeal', vars: { n: 2 } }];
    expect(resultLine(cons)).toBe('2 Blessure(s) récupérée(s).');
  });

  it('type : resultLine ne prend PAS roll/target/sl/won — la duplication d\'outcome est INEXPRIMABLE', () => {
    // @ts-expect-error — Consequence ne porte ni roll ni target ni sl ni won (Décision 1b).
    const bad: Consequence = { roll: 12, target: 40, sl: 2, won: true };
    void bad;
  });

  it('type : un applier migré ne peut plus renvoyer un string[] libre en `consequences`', () => {
    // @ts-expect-error — `consequences` est `Consequence[]`, pas `string[]` (le canal `journal` libre est déprécié).
    const applier: CascadeApplier = (_get, _set, step) => {
      void step;
      return { consequences: ['réussi !'] };
    };
    void applier;
  });
});
