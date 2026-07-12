import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { type CascadeApplier } from './cascade';
import { spyApplier } from './cascadeTestKit';
import { setGmSeat } from './netFlow';
import { openRoll, rollTitle, composeRollLabel, testSkillLabel, resultLine, freeCons, type RollRequest, type Consequence } from './rollSeam';
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
      spyApplier(kind, applied, (step) => ({ kind: step.kind, success: !!step.result?.success, sl: step.result?.sl ?? 0 }),
        (step) => ({ consequences: freeCons([`${step.label} → ${step.result?.success ? 'réussi' : 'raté'}`]) }));
    }
  });

  const hero = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'H', name: 'Héros', kind: 'hero',
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
      skills: [{ skillId: 'resistance', characteristic: 'endurance', advances: 20 }],
      conditions: [], talents: [], fortune: 1, resilience: 1,
      ...over,
    }) as unknown as Combatant;

  const enemy = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'E', name: 'Ennemi', kind: 'enemy',
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
      skills: [{ skillId: 'perception', characteristic: 'initiative', advances: 20 }],
      conditions: [], talents: [],
      ...over,
    }) as unknown as Combatant;

  it('hero-test, héros piloté-humain, cadence MANUELLE → M (modale influençable)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Résistance', test: { skill: 'resistance', char: 'endurance' }, difficulty: 'intermediaire', klass: 'hero-test' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-hero');
    expect(useGame.getState().pendingCascade).toBeTruthy(); // surfacé, pas résolu d'office
    expect(applied).toHaveLength(0);
  });

  it('enemy, côté ennemi/monde SOUS siège MJ, manuel → V (étape visible-lançable MJ)', () => {
    useGame.setState({ party: [enemy()] });
    setGmSeat(useGame.getState, useGame.setState, 0);
    const req: RollRequest = { side: { actorId: 'E' }, actionLabel: 'Perception', test: { skill: 'perception', char: 'initiative' }, difficulty: 'intermediaire', klass: 'enemy' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-enemy');
    expect(useGame.getState().pendingCascade).toBeTruthy(); // surfacé chez le MJ (V)
    expect(applied).toHaveLength(0);
  });

  it('enemy, SANS siège MJ (IA) → I (inline-PV, résolu d’office)', () => {
    useGame.setState({ party: [enemy()] });
    const req: RollRequest = { side: { actorId: 'E' }, actionLabel: 'Perception', test: { skill: 'perception', char: 'initiative' }, difficulty: 'intermediaire', klass: 'enemy' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-enemy');
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
    expect(applied[0].kind).toBe('seam-enemy');
  });

  it('subi, porté par un héros SANS MJ → I (jamais M — « subi » n’est jamais une décision du sujet)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Scorbut', test: { skill: 'resistance', char: 'endurance' }, difficulty: 'intermediaire', klass: 'subi' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-subi');
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
    expect(applied[0].kind).toBe('seam-subi');
  });

  it('subi, côté SOUS siège MJ → V (read-only : le MJ voit/lance, n’influence pas)', () => {
    useGame.setState({ party: [] });
    setGmSeat(useGame.getState, useGame.setState, 0);
    const req: RollRequest = { side: { worldSide: 'world', ownerId: 'nef' }, actionLabel: 'Désertion', test: {}, difficulty: 'intermediaire', klass: 'subi' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-subi');
    expect(useGame.getState().pendingCascade).toBeTruthy();
    expect(applied).toHaveLength(0);
  });

  it('worldSide sans acteur, en COOP avec gmSeat ≠ hôte → l’étape est OWNÉE par le MJ (delta 1)', () => {
    useGame.setState({ party: [] });
    setGmSeat(useGame.getState, useGame.setState, 1); // gmSeat ≠ hôte (0)
    const req: RollRequest = { side: { worldSide: 'world', ownerId: 'nef' }, actionLabel: 'Désertion', test: {}, difficulty: 'intermediaire', klass: 'subi' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-subi');
    const owner = modalOwnerOf(useGame.getState());
    expect(seatOwns(useGame.getState(), 1, owner ?? undefined)).toBe(true); // le MJ possède l'étape
    expect(seatOwns(useGame.getState(), 0, owner ?? undefined)).toBe(false); // l'hôte ne la possède plus
  });

  it('batch, voyage COMMANDÉE + kind de ROUTINE → I (immédiat, `runCascadeImmediate`)', () => {
    const crew: Combatant = { id: 'timonier1', name: 'Timonier', kind: 'hero', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, skills: [{ skillId: 'navigation-fluviale', characteristic: 'intelligence', advances: 30 }], conditions: [], talents: [] } as unknown as Combatant;
    useGame.setState({ party: [crew], travelPlan: { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'sea', hoursPerDay: 8, km: 0, kmDone: 0, interrupted: false, orders: { cadence: 'commande' } } as never });
    const req: RollRequest = {
      side: { participants: [{ id: 'timonier1', essential: true, base: 30, target: 30, result: null }], ownerId: 'nef' },
      actionLabel: 'Progression', test: {}, difficulty: 'intermediaire', klass: 'batch',
    };
    // `cascadeAppliers['progression']` est désormais le VRAI applier de mer (#275 Décision 4 cran 2, `seaVoyageFlow.ts`)
    // — il lit `travelPlan.sea`, absent de ce plan SYNTHÉTIQUE ; ce test isole la POLICY de la porte (surface I),
    // pas la conséquence métier réelle → double localement le kind pour ne pas dépendre de `seaVoyageFlow`.
    spyApplier('progression', applied, (step) => ({ kind: step.kind, success: !!step.result?.success, sl: step.result?.sl ?? 0 }));
    openRoll(useGame.getState, useGame.setState, req, 'progression');
    // 'progression' ∈ SEA_ROUTINE_KINDS + cadence COMMANDÉE ⇒ autoV ⇒ I : résolu et appliqué d'office
    // (`cascade.rollBatchParticipants` auto-roule le contributeur, `aggregateBatchStep` agrège au commit).
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(applied).toHaveLength(1);
  });

  it('batch, cadence jour-par-jour, sans MJ → M (multi surfacé, étape À PARTICIPANTS non résolue — #275 Décision 4 cran 2)', () => {
    const crew: Combatant = { id: 'timonier1', name: 'Timonier', kind: 'hero', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, skills: [{ skillId: 'navigation-fluviale', characteristic: 'intelligence', advances: 30 }], conditions: [], talents: [] } as unknown as Combatant;
    useGame.setState({ party: [crew] });
    const req: RollRequest = {
      side: { participants: [{ id: 'timonier1', essential: true, base: 30, target: 30, result: null }], ownerId: 'nef' },
      actionLabel: 'Progression', test: {}, difficulty: 'intermediaire', klass: 'batch',
    };
    openRoll(useGame.getState, useGame.setState, req, 'seam-batch');
    expect(useGame.getState().pendingCascade).toBeTruthy();
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.result).toBeFalsy(); // pas d'agrégat pré-résolu — UNE rangée par contributeur, à lancer
    expect(step.participants).toHaveLength(1);
    expect(step.participants![0].result).toBeNull(); // le contributeur n'a pas encore lancé (flux `cascadeBatch`)
    expect(applied).toHaveLength(0); // rien appliqué tant que l'étape n'est pas validée
  });

  it('rollTitle : le NOM DE L\'ACTION seul — jamais recomposé avec acteur/compétence/difficulté (#352)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Résistance', test: { skill: 'resistance', char: 'endurance' }, difficulty: 'intermediaire', klass: 'hero-test' };
    expect(rollTitle(useGame.getState, req)).toBe('Résistance');
  });

  it('rollTitle : côté worldSide (aucun acteur) — actionLabel nu', () => {
    useGame.setState({ party: [] });
    const req: RollRequest = { side: { worldSide: 'world', ownerId: 'nef' }, actionLabel: 'Désertion', test: {}, difficulty: 'intermediaire', klass: 'subi' };
    expect(rollTitle(useGame.getState, req)).toBe('Désertion');
  });

  it('mono : startCascade pose pending.title = rollTitle(...) = actionLabel — DISTINCT de step.label composé (#352, régression double-rendu)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Recueillir des informations', test: { skill: 'ragot' }, difficulty: 'intermediaire', klass: 'hero-test' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-hero');
    const p = useGame.getState().pendingCascade!;
    expect(p.title).toBe('Recueillir des informations');
    expect(p.title).toBe(rollTitle(useGame.getState, req));
    const step = p.participants[0];
    // step.label (sous-titre) porte le détail COMPOSÉ — ne duplique PAS le titre (#352 : la modale
    // montrait la MÊME ligne « Berta Kaufmann — Recueillir des informations (Ragot Intermédiaire) » deux fois).
    expect(step.label).not.toBe(p.title);
    expect(step.label).toBe('Héros — Recueillir des informations (Ragot Intermédiaire (+0))');
  });

  it('compétence de rangée : DÉRIVÉE du catalogue skills (id→label) — insurchargeable par la spec (#352 extension)', () => {
    useGame.setState({ party: [hero()] });
    const req: RollRequest = { side: { actorId: 'H' }, actionLabel: 'Recueillir des informations', test: { skill: 'ragot' }, difficulty: 'intermediaire', klass: 'hero-test' };
    openRoll(useGame.getState, useGame.setState, req, 'seam-hero');
    const step = useGame.getState().pendingCascade!.participants[0];
    // La compétence affichée en position de rangée est « Ragot » (catalogue), JAMAIS l'action
    // ("Recueillir des informations") — `testSkillLabel` est la SEULE source, dérivée du skillId.
    expect(step.rollLabel).toBe('Ragot');
    expect(step.rollLabel).toBe(testSkillLabel(req.test));
    expect(step.rollLabel).not.toBe(req.actionLabel);
  });

  it('type : `RollRequest.test` ne porte plus aucun champ texte — impossible d\'y injecter un libellé de compétence (#352 extension)', () => {
    // @ts-expect-error — `test` n'a QUE des ids (skill/char/spec/sense/menace) : `label` n'existe plus sur ce type.
    const bad: RollRequest = { side: { actorId: 'H' }, actionLabel: 'x', test: { skill: 'ragot', label: 'Ragot custom' }, difficulty: 'intermediaire', klass: 'hero-test' };
    void bad;
  });

  it('composeRollLabel : compose actor/action/skill/difficulté — UN seul composeur, jamais réassemblé au call-site', () => {
    useGame.setState({ party: [hero()] });
    const h = useGame.getState().party[0];
    expect(composeRollLabel(h, 'Rumeur commerciale', { skill: 'ragot' }, 'intermediaire')).toBe('Héros — Rumeur commerciale (Ragot Intermédiaire (+0))');
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
