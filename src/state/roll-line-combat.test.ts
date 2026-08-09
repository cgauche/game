import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { inexplique } from './cascadeTestKit';
import { rollLine, type RollLineCombat } from './rollSeam';
import { openCombatEndCascade, openContractionCascade, openAttackCascade } from './combatFlow';
import { resolveActGates } from './combat/turnHooks';
import { forceCrewRole } from './shipManeuver';
import { combatBaseValue, combatValue, combatValueMods, combineMods, type ModLine } from '../engine/combat';
import { combatTestPenalty, testStatePenalty, testStatePenaltyParts } from '../engine/conditions';
import { testValue, testValueParts, skillBaseValue, rawCombatTestBase } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { crewRoleValue } from '../engine/crewMorale';
import { clampTarget } from '../engine/tests';
import { rule } from '../engine/policy';
import { findCrewRoleById } from '../data';
import { RULE_REF } from '../engine/ruleRefs';
import { DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../engine/types';

/**
 * MONTEUR CANONIQUE — les sites de COMBAT (#1153 L1b). Chaque site migré est jugé sur DEUX grandeurs
 * indissociables, jamais relues du site :
 *  1. la CIBLE reste celle que `rollTest` jettera — RECALCULÉE ICI à la main depuis les jumelles du
 *     moteur (`combatValue`/`rawCombatTestBase` + `combatTestPenalty` + Difficulté, écrêtée par
 *     `clampTarget`) ;
 *  2. l'écart base→cible est INTÉGRALEMENT nommé (`inexplique === 0`) : plus une chip « autres ».
 * Chaque acteur PORTE un État (LDB 16) : sans lui, une base FONDUE se confondrait avec la valeur nue
 * et le test passerait sur un monteur faux.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', label: 'Héros', kind: 'hero',
    characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 40, force: 35, endurance: 40, initiative: 30, agilite: 30, dexterite: 32, intelligence: 40, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

/** État PORTÉ par toute fixture (LDB 16 : −10 par valeur) — c'est lui qui sépare la valeur NUE de la
 *  valeur jetée ; un acteur sain ne prouverait rien du canal. */
const ETAT = [{ id: 'empoisonne', value: 1 }] as never;

/** Effet ACTIF à `testMod` char-QUALIFIÉ : il vit DANS la valeur de combat (`combatValueModParts`) et
 *  PAS dans la pénalité d'États — c'est la composante qui distingue les deux canaux. */
const effetCT = [{ id: 'fx1', label: 'Mystracine', testModChar: 'capacite-de-tir', testMod: -10 }] as never;

const epee = { uid: 'w2', label: 'Épée', type: 'melee', damage: 4, qualities: [] } as never;

const arbalete = {
  uid: 'w1', label: 'Arbalète', type: 'ranged', damage: 4, qualities: [], reload: 1, range: 60,
} as never;

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle', party: combatants.filter((c) => c.kind === 'hero'),
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false,
      log: [], over: null,
    },
    pendingHeal: null, pendingReload: null, pendingHandGate: null, pendingCascade: null,
  } as never);
}

beforeEach(() => { seedBattleRng(1); });

describe('Rechargement (combatSlice) — canal COMBAT du monteur', () => {
  it('base = valeur de combat NUE, l’effet char-qualifié est une chip NOMMÉE, cible INCHANGÉE', () => {
    const tireur = hero({
      id: 'tir', label: 'Tireur', conditions: ETAT, activeEffects: effetCT,
      skills: [{ skillId: 'projectiles', advances: 20, characteristic: 'capacite-de-tir' }] as never,
      weapons: [arbalete],
    });
    setBattle([tireur], 'tir');

    // ORACLE recalculé à la main depuis les jumelles du moteur (jamais relu du site).
    const nue = combatBaseValue(tireur, 'ranged', tireur.weapons[0]);
    const jetee = combatValue(tireur, 'ranged', tireur.weapons[0]);
    expect(jetee, 'l’effet char-qualifié sépare la nue de la valeur jetée — sinon le test ne prouve rien').toBeLessThan(nue);
    expect(jetee, 'la valeur de COMBAT n’est pas la valeur hors combat : le canal a un sens')
      .not.toBe(testValue(tireur, 'projectiles', 'capacite-de-tir'));

    get().battleReload();
    const pr = get().pendingReload!;
    expect(pr.target).toBe(clampTarget(jetee + DIFFICULTY_MODIFIERS.intermediaire).target);

    const ligne = rollLine({ actor: tireur, difficulty: 'intermediaire', valeur: pr.skillValue, combat: { kind: 'ranged', weapon: tireur.weapons[0] } });
    expect(ligne.base, 'Niveau de combat NU (LDB 09 l.17 sur CC/CT + Spé du Groupe)').toBe(nue);
    expect(ligne.mods.reduce((s, m) => s + m.value, 0)).toBe(combatValueMods(tireur, 'ranged', tireur.weapons[0]));
    expect(inexplique({ ...ligne, difficulty: pr.difficulty }), 'aucune chip « autres »').toBe(0);
  });
});

describe('Main ensanglantée (combatFlow/combatSlice) — cible INCHANGÉE par le monteur', () => {
  it('le gate de Dextérité garde SA valeur (Dextérité effective), cible = valeur + Accessible', () => {
    const brute = hero({ id: 'br', label: 'Brute', conditions: ETAT, handGates: ['main'] as never, weapons: [] });
    setBattle([brute], 'br');
    const dex = effectiveChar(brute, 'dexterite');

    openAttackCascade(get, set, { attackerId: 'br', targetId: 'br', location: null, result: null } as never, 'Attaquer', 'action/attack');
    const pg = get().pendingHandGate!;
    expect(pg.skillValue).toBe(dex);
    expect(pg.target).toBe(clampTarget(dex + DIFFICULTY_MODIFIERS.accessible).target);
    expect(inexplique({ base: pg.skillValue, target: pg.target, difficulty: pg.difficulty }), 'aucun écart muet').toBe(0);
  });
});

describe('Guérison en combat (combatSlice) — canal HORS COMBAT (`testValue`), inchangé', () => {
  it('cible = testValue + Difficulté, et le changement de mode la re-monte à l’identique', () => {
    const doc = hero({
      id: 'doc', label: 'Doc', conditions: ETAT,
      skills: [{ skillId: 'guerison', advances: 30, characteristic: 'intelligence' }] as never,
    });
    const blesse = hero({ id: 'bl', label: 'Blessé', wounds: { current: 3, max: 12 }, conditions: [{ id: 'hemorragique', value: 2 }] as never, pos: { x: 2, y: 1 } });
    setBattle([doc, blesse], 'doc');

    const v = testValue(doc, 'guerison');
    const nue = skillBaseValue(doc, 'guerison');
    expect(v, 'l’État sépare la nue de la valeur jetée').toBeLessThan(nue);

    get().battleHeal('bl', 'wounds');
    const ph = get().pendingHeal!;
    expect(ph.target).toBe(clampTarget(v + DIFFICULTY_MODIFIERS[ph.difficulty]).target);

    get().healSetMode('bleed');
    const ph2 = get().pendingHeal!;
    expect(ph2.target).toBe(clampTarget(v + DIFFICULTY_MODIFIERS[ph2.difficulty]).target);

    const ligne = rollLine({ actor: doc, test: { skill: 'guerison' }, difficulty: ph2.difficulty, valeur: ph2.skillValue });
    expect(ligne.base).toBe(nue);
    expect(inexplique({ ...ligne, difficulty: ph2.difficulty })).toBe(0);
  });
});

describe('Fin de rencontre (combatFlow) — Contraction et Corruption', () => {
  it('Contraction hors combat (`openContractionCascade`) : base NUE, cible = Résistance + Difficulté', () => {
    const patient = hero({
      id: 'pa', label: 'Patient', conditions: ETAT,
      skills: [{ skillId: 'resistance', advances: 10, characteristic: 'endurance' }] as never,
    });
    useGame.setState({ party: [patient], battle: null, pendingCascade: null } as never);
    const resVal = effectiveChar(patient, 'endurance') + 10; // `combatEndResistVal` : E effective + avances
    const diff: Difficulty = 'tresFacile';

    openContractionCascade(get, set, patient, 'courante-galopante', diff, 'Infection');
    const step = get().pendingCascade!.participants[0];
    expect(step.base).toBe(resVal);
    expect(step.target).toBe(clampTarget(resVal + DIFFICULTY_MODIFIERS[diff]).target);
    expect(inexplique(step), 'aucune chip « autres »').toBe(0);
  });

  it('Cascade de fin de combat : Contraction ET Corruption portent la pénalité de COMBAT en chips NOMMÉES', () => {
    const survivant = hero({
      id: 'sv', label: 'Survivant', conditions: ETAT, tookCriticalThisFight: true,
      skills: [{ skillId: 'resistance', advances: 10, characteristic: 'endurance' }] as never,
    } as never);
    const bete = hero({ id: 'be', label: 'Bête', kind: 'enemy', dead: true, traits: [{ id: 'corruption', arg: 'Mineure' }] } as never);
    setBattle([survivant, bete], 'sv');
    survivant.diseaseExposure = [{ disease: 'courante-galopante', difficulty: 'intermediaire' }] as never;

    openCombatEndCascade(get, set);
    const steps = get().pendingCascade?.participants ?? [];
    const penalite = combatTestPenalty(survivant);
    expect(penalite, 'l’État doit peser sur les Tests de COMBAT — sinon la fixture ne prouve rien').toBeLessThan(0);

    const maladie = steps.find((s) => s.kind === 'combatEndDisease');
    if (maladie) {
      const resVal = effectiveChar(survivant, 'endurance') + 10;
      expect(maladie.base).toBe(resVal);
      expect(maladie.target).toBe(clampTarget(resVal + DIFFICULTY_MODIFIERS[maladie.difficulty!] + penalite).target);
      expect(inexplique(maladie), 'la pénalité de combat est NOMMÉE, pas « autres »').toBe(0);
    }
    const corruption = steps.find((s) => s.kind === 'combatEndCorruption');
    if (corruption) {
      const res = testValue(survivant, 'resistance');
      expect(corruption.base, 'base = Niveau de Compétence NU (l’État sort en chip)').toBe(skillBaseValue(survivant, 'resistance'));
      // ⚠ CIBLE = la formule de HEAD, DOUBLE-COMPTE CONNU : l'État pèse une fois DANS `testValue`
      // (pénalité hors combat) et une fois de plus via `combatTestPenalty`. Ce lot est à INVARIANCE
      // STRICTE : il rend le double-compte VISIBLE (deux chips nommées au lieu d'un écart muet) sans
      // le corriger. Correction et choix du canal → L3, dossier au ticket #1153.
      expect(corruption.target).toBe(clampTarget(res + DIFFICULTY_MODIFIERS.intermediaire + penalite).target);
      expect(inexplique(corruption)).toBe(0);
    }
    expect([maladie, corruption].map((s) => s?.kind), 'les DEUX familles d’étape doivent être produites').toEqual(['combatEndDisease', 'combatEndCorruption']);
  });
});

describe('Gate d’Action par Round (combat/turnHooks) — canal COMBAT « Test »', () => {
  it('base = valeur de Test de combat BRUTE, la pénalité d’États est comptée UNE fois et nommée', () => {
    const porteur = hero({
      id: 'po', label: 'Porteur', conditions: ETAT,
      activeEffects: [{ id: 'racine', label: 'Racine de mandragore', actGate: { char: 'force-mentale' } }] as never,
    });
    setBattle([porteur], 'po');

    const brut = rawCombatTestBase(porteur, undefined, 'force-mentale');
    const penalite = combatTestPenalty(porteur);
    expect(penalite).toBeLessThan(0);
    expect(brut, 'la valeur BRUTE ne contient PAS la pénalité hors combat (sinon double compte)')
      .toBe(testValue(porteur, undefined, 'force-mentale') - testStatePenalty(porteur, undefined));

    resolveActGates(get, set, porteur);
    const step = (get().pendingCascade?.participants ?? []).find((s) => s.kind === 'actGate')!;
    expect(step.target).toBe(clampTarget(brut + DIFFICULTY_MODIFIERS.intermediaire + penalite).target);
    expect(step.base, 'base = Caractéristique NUE, tout le reste est en chips').toBe(effectiveChar(porteur, 'force-mentale'));
    expect(inexplique(step), 'aucune chip « autres »').toBe(0);
  });
});

describe('Résilience d’un contributeur d’équipage (shipManeuver) — cible INCHANGÉE', () => {
  it('cible = valeur du rôle + Difficulté (cumul : 2 crans plus dur), écrêtée comme `rollTest`', () => {
    const marin = hero({
      id: 'ma', label: 'Marin', conditions: ETAT,
      skills: [{ skillId: 'voile', advances: 15, characteristic: 'agilite' }] as never,
    });
    const role = findCrewRoleById('timonier')!;
    const v = crewRoleValue(marin, role).value;

    expect(forceCrewRole(marin, 'timonier')!.target).toBe(clampTarget(v + DIFFICULTY_MODIFIERS.intermediaire).target);
    const cumule = forceCrewRole(marin, 'timonier', true)!;
    expect(cumule.target).toBeLessThan(v);
    expect(inexplique({ base: v, target: cumule.target, mods: [{ label: 'Manque de bras', value: cumule.target - v, famille: 'jet' }] })).toBe(0);
  });

  it('ÉCRÊTAGE aux bornes : une valeur de rôle à 110 force un DR 9 (cible 99)', () => {
    // Un jet FORCÉ par la Résilience vise la MÊME cible qu'un jet roulé : `clampTarget`
    // (`engine/tests.ts`) la borne à `targetMax`, et le DR se compte sur cette cible (LDB 12 l.92).
    // `targetMax` vaut 99 tant que la règle optionnelle « Tests supérieurs à 100 % » (LDB 12
    // l.73-77, `test-over-100`) est inactive — c'est le régime par défaut mesuré ici.
    const barreur = hero({
      id: 'ba', label: 'Barreur', conditions: ETAT,
      characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 40, force: 35, endurance: 40, initiative: 30, agilite: 105, dexterite: 32, intelligence: 40, 'force-mentale': 35, sociabilite: 30 },
      skills: [{ skillId: 'voile', advances: 15, characteristic: 'agilite' }] as never,
    });
    const role = findCrewRoleById('timonier')!;
    expect(crewRoleValue(barreur, role).value, 'la fixture doit VRAIMENT franchir le plafond').toBe(110);

    const forcee = forceCrewRole(barreur, 'timonier')!;
    expect(forcee.target, 'plafond 99 — la même cible que celle du jet roulé').toBe(99);
    expect(forcee.sl, 'DR 9 : les dizaines de la cible ÉCRÊTÉE (99) moins celles du dé forcé').toBe(9);
  });
});

describe('ORACLE du canal combat — balayage EXHAUSTIF (#1153 L1b, sonde promue)', () => {
  /** Les composantes d'États sortent EN TÊTE de `testValueParts` — invariant POSITIONNEL dont dépend
   *  le `.slice()` de `partsHorsEtats` (`rollSeam.ts`). S'il tombait, le canal « Test de combat »
   *  retirerait les mauvaises lignes et l'oracle THROW ; ce test le dit AVANT, à l'endroit du fait. */
  it('les parts d’ÉTAT sont EN TÊTE de `testValueParts` (le découpage positionnel en dépend)', () => {
    const charge = hero({
      id: 'ch', label: 'Chargé', conditions: [{ id: 'empoisonne', value: 2 }] as never,
      skills: [{ skillId: 'natation', advances: 20, characteristic: 'force' }] as never,
      activeEffects: [{ id: 'malchance', label: 'Malédiction de malchance', testMod: -10 },
        // Part NON-État (mod de Test char-qualifié) : sans elle, l'ordre ne serait pas OBSERVABLE.
        { id: 'vigueur', label: 'Vigueur', testModChar: 'force', testMod: 10 }] as never,
    });
    const etats = testStatePenaltyParts(charge, 'natation').filter((p) => p.value !== 0);
    const toutes = testValueParts(charge, 'natation', undefined, undefined, undefined);
    expect(etats.length, 'la fixture doit produire des parts d’État').toBeGreaterThan(0);
    expect(toutes.length).toBeGreaterThanOrEqual(etats.length);
    expect(toutes.slice(0, etats.length).map((p) => [p.label, p.value]))
      .toEqual(etats.map((p) => [p.label, p.value]));
  });

  it('224 combinaisons (canal × État × effet × profil) : ZÉRO reconstruction en échec', () => {
    const CANAUX: { combat: RollLineCombat; test?: { skill?: string; char?: never | 'force-mentale' | 'dexterite' } }[] = [
      { combat: { kind: 'melee' } },
      { combat: { kind: 'melee', weapon: epee } },
      { combat: { kind: 'ranged' } },
      { combat: { kind: 'ranged', weapon: arbalete } },
      { combat: { kind: 'test' }, test: { char: 'force-mentale' } },
      { combat: { kind: 'test' }, test: { char: 'dexterite' } },
      { combat: { kind: 'test' }, test: { skill: 'resistance' } },
    ];
    const ETATS = [[], [{ id: 'empoisonne', value: 1 }], [{ id: 'empoisonne', value: 2 }], [{ id: 'sonne', value: 1 }]];
    const EFFETS = [
      [],
      [{ id: 'e1', label: 'Mystracine', testModChar: 'capacite-de-tir', testMod: -10 }],
      // Couple char-QUALIFIÉ : une ligne pour la mêlée, une pour le canal « Test de combat » (FM) — c'est
      // le seul jeu qui produit une part NON-État à côté d'une part d'État (le découpage positionnel s'y joue).
      [{ id: 'e2', label: 'Bénédiction', testModChar: 'capacite-de-combat', testMod: 10 },
        { id: 'e2b', label: 'Ferveur', testModChar: 'force-mentale', testMod: -10 }],
      [{ id: 'e3', label: 'Malédiction de malchance', testMod: -20 }],
    ];
    const PROFILS = [
      [],
      [{ skillId: 'projectiles', advances: 20, characteristic: 'capacite-de-tir' },
        { skillId: 'corps-a-corps', advances: 15, characteristic: 'capacite-de-combat' },
        { skillId: 'resistance', advances: 10, characteristic: 'endurance' }],
    ];

    const ko: string[] = [];
    let cas = 0;
    for (const c of CANAUX) {
      for (const [ie, etat] of ETATS.entries()) {
        for (const [ix, fx] of EFFETS.entries()) {
          for (const [ip, sk] of PROFILS.entries()) {
            cas += 1;
            const a = hero({ id: 'x', label: 'X', conditions: etat as never, activeEffects: fx as never, skills: sk as never, weapons: [arbalete, epee] });
            const nom = `${c.combat.kind}${'weapon' in c.combat && c.combat.weapon ? '+arme' : ''}/état${ie}/fx${ix}/profil${ip}`;
            try {
              // (1) valeur DÉRIVÉE par le canal, (2) MÊME valeur FOURNIE par l'appelant : les deux
              // passent par l'oracle, et doivent donner la MÊME ligne.
              const derive = rollLine({ actor: a, ...(c.test ? { test: c.test } : {}), difficulty: 'intermediaire', combat: c.combat });
              const valeur = derive.base + derive.mods.reduce((s, m) => s + m.value, 0);
              const fournie = rollLine({ actor: a, ...(c.test ? { test: c.test } : {}), difficulty: 'intermediaire', combat: c.combat, valeur });
              if (fournie.base !== derive.base) ko.push(`${nom} : base fournie ${fournie.base} ≠ dérivée ${derive.base}`);
              if (fournie.target !== derive.target) ko.push(`${nom} : cible fournie ${fournie.target} ≠ dérivée ${derive.target}`);
              // ORACLE : la ligne se réduit EXACTEMENT à la formule moteur du canal.
              const attendu = c.combat.kind === 'test'
                ? rawCombatTestBase(a, c.test?.skill, c.test?.char, undefined) + combatTestPenalty(a)
                : combatValue(a, c.combat.kind, c.combat.weapon);
              if (valeur !== attendu) ko.push(`${nom} : ${valeur} ≠ formule moteur ${attendu}`);
              const nue = c.combat.kind === 'test'
                ? skillBaseValue(a, c.test?.skill, undefined, c.test?.char)
                : combatBaseValue(a, c.combat.kind, c.combat.weapon);
              if (derive.base !== nue) ko.push(`${nom} : base ${derive.base} ≠ valeur NUE ${nue}`);
              if (inexplique({ ...derive, difficulty: 'intermediaire' }) !== 0) ko.push(`${nom} : écart muet`);
            } catch (e) {
              ko.push(`${nom} : THROW ${(e as Error).message.slice(0, 80)}`);
            }
          }
        }
      }
    }
    expect(cas, 'le balayage doit couvrir les 224 combinaisons annoncées').toBe(224);
    expect(ko, `Reconstructions en échec :\n${ko.join('\n')}`).toEqual([]);
  });

  it('`sense` transite des DEUX côtés du canal « Test de combat » — aucun THROW, ligne exacte', () => {
    // Le canal dérive sa valeur d'un côté et ses composantes de l'autre : si `sense` n'entrait que
    // dans l'un des deux, un Test sense-scopé (Surdité, LDB 18) ferait diverger les deux et l'oracle
    // refuserait un site pourtant juste.
    const sourd = hero({
      id: 'so', label: 'Sourd', conditions: ETAT,
      skills: [{ skillId: 'perception', advances: 20, characteristic: 'initiative' }] as never,
    });
    const ligne = rollLine({ actor: sourd, test: { skill: 'perception', sense: 'ouie' }, difficulty: 'intermediaire', combat: { kind: 'test' } });
    expect(ligne.base).toBe(skillBaseValue(sourd, 'perception'));
    expect(inexplique({ ...ligne, difficulty: 'intermediaire' })).toBe(0);
  });
});

describe('SONDES PROMUES (#1153 L1b) — ce que le monteur NE fait PAS encore', () => {
  it('l’oracle du monteur REFUSE le canal hors combat sur une valeur de COMBAT', () => {
    const tireur = hero({
      id: 'tir', label: 'Tireur', conditions: ETAT, activeEffects: effetCT,
      skills: [{ skillId: 'projectiles', advances: 20, characteristic: 'capacite-de-tir' }] as never,
      weapons: [arbalete],
    });
    const valeur = combatValue(tireur, 'ranged', tireur.weapons[0]);
    // Canal HORS COMBAT sur une valeur de combat : la reconstruction rate — en DEV, elle THROW.
    expect(() => rollLine({ actor: tireur, test: { char: 'capacite-de-tir' }, difficulty: 'intermediaire', valeur }))
      .toThrow(/ne se reconstruit pas/);
    // MÊME valeur par son canal : la ligne se monte et s'explique intégralement.
    const ligne = rollLine({ actor: tireur, difficulty: 'intermediaire', valeur, combat: { kind: 'ranged', weapon: tireur.weapons[0] } });
    expect(ligne.base).toBe(combatBaseValue(tireur, 'ranged', tireur.weapons[0]));
    expect(inexplique({ ...ligne, difficulty: 'intermediaire' })).toBe(0);
  });

  /**
   * MATRICE du mode plafonné (`LDB 14 l.91-96`) — les six régimes de la règle, jugés sur les DEUX
   * grandeurs : la cible que le combat applique, et l'écart base→cible intégralement nommé. Les
   * plafonds sont lus de la POLICY (`combat-diff-cap-bonus`/`-malus`, règles optionnelles), jamais
   * écrits en dur : un jeu de valeurs maison doit faire bouger l'attendu avec le moteur.
   */
  const capB = rule('combat-diff-cap-bonus') as number;
  const capM = rule('combat-diff-cap-malus') as number;
  const MATRICE: { nom: string; mods: ModLine[]; attendu: number; mord: boolean }[] = [
    { nom: 'aucun plafond ne mord (un malus, un bonus)', mods: [{ label: 'Sonné', value: -10, famille: 'jet' }, { label: 'À Terre', value: 20, famille: 'circonstance' }], attendu: 10, mord: false },
    { nom: 'MALUS mordant (Σ −50)', mods: [{ label: 'Sonné', value: -10, famille: 'jet' }, { label: 'Aveuglé', value: -20, famille: 'jet' }, { label: 'Empêtré', value: -20, famille: 'jet' }], attendu: -capM, mord: true },
    { nom: 'BONUS mordant (Σ +80)', mods: [{ label: 'Viser', value: 40, famille: 'circonstance' }, { label: 'À Terre', value: 40, famille: 'circonstance' }], attendu: capB, mord: true },
    { nom: 'BONUS ET MALUS mordants (les deux sommes plafonnent, puis s’ajoutent)', mods: [{ label: 'Viser', value: 40, famille: 'circonstance' }, { label: 'À Terre', value: 40, famille: 'circonstance' }, { label: 'Aveuglé', value: -20, famille: 'jet' }, { label: 'Empêtré', value: -20, famille: 'jet' }, { label: 'Sonné', value: -20, famille: 'jet' }], attendu: capB - capM, mord: true },
    { nom: 'AVANTAGE `uncapped` hors plafond, malus mordant à côté', mods: [{ label: 'Avantage', value: 70, famille: 'jet', uncapped: true }, { label: 'Aveuglé', value: -40, famille: 'jet' }], attendu: 70 - capM, mord: true },
    { nom: 'AVANTAGE `uncapped` SEUL : rien à plafonner malgré une somme > +60', mods: [{ label: 'Avantage', value: 70, famille: 'jet', uncapped: true }], attendu: 70, mord: false },
  ];

  it.each(MATRICE)('MODE PLAFONNÉ — $nom', ({ mods, attendu, mord }) => {
    const somme = mods.reduce((s, m) => s + m.value, 0);
    expect(combineMods(mods), 'la matrice doit décrire la combinaison RÉELLE du moteur').toBe(attendu);
    expect(attendu !== somme, 'le régime annoncé (mordant ou non) doit être celui que le moteur produit').toBe(mord);

    const l = rollLine({ difficulty: 'intermediaire', valeur: 60, surLaCible: mods, plafond: 'difficultes' });
    expect(l.target).toBe(clampTarget(60 + attendu).target);
    const chip = l.mods.find((m) => m.label === 'plafond Difficultés');
    if (mord) expect(chip).toMatchObject({ value: attendu - somme, ref: RULE_REF['combiner-les-difficultes'] });
    else expect(chip, 'aucune chip décorative quand rien n’est amputé').toBeUndefined();
    expect(inexplique({ ...l, difficulty: 'intermediaire' }), 'aucune chip « autres »').toBe(0);

    // HORS mode : la somme reste BRUTE — le plafond est un régime de COMBAT, pas un défaut du monteur.
    const brut = rollLine({ difficulty: 'intermediaire', valeur: 60, surLaCible: mods });
    expect(brut.target).toBe(clampTarget(60 + somme).target);
    expect(brut.mods.some((m) => m.label === 'plafond Difficultés')).toBe(false);
    expect(inexplique({ ...brut, difficulty: 'intermediaire' })).toBe(0);
  });
});
