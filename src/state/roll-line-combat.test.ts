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
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

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
   * MATRICE du mode plafonné (`LDB 14 l.91-96`) — les six régimes de la règle, jugés sur TROIS
   * grandeurs : la cible que le combat applique, le PALIER que la ligne annonce, et l'écart
   * base→cible intégralement nommé. Les plafonds sont lus de la POLICY
   * (`combat-diff-cap-bonus`/`-malus`, règles optionnelles), jamais écrits en dur : un jeu de
   * valeurs maison doit faire bouger l'attendu avec le moteur.
   *
   * `palier` = la Difficulté que les CIRCONSTANCES composent (RAW : « le Test devient simplement
   * Très Difficile (-30) ») ; absent = aucune n'en compose d'exacte, la ligne garde sa Difficulté
   * déclarée et TOUT reste en chips, plafond compris.
   */
  const capB = rule('combat-diff-cap-bonus') as number;
  const capM = rule('combat-diff-cap-malus') as number;
  const MATRICE: { nom: string; mods: ModLine[]; attendu: number; mord: boolean; palier?: Difficulty }[] = [
    { nom: 'aucun plafond ne mord (un mod au jet, une circonstance)', mods: [{ label: 'Sonné', value: -10, famille: 'jet' }, { label: 'À Terre', value: 20, famille: 'circonstance' }], attendu: 10, mord: false, palier: 'accessible' },
    { nom: 'MALUS de CIRCONSTANCES mordant (Σ −60)', mods: [{ label: 'Brouillard', value: -20, famille: 'circonstance' }, { label: 'Localisation visée', value: -20, famille: 'circonstance' }, { label: 'Main secondaire', value: -20, famille: 'circonstance' }], attendu: -capM, mord: true, palier: 'tresDifficile' },
    { nom: 'ÉTATS du JETEUR : la somme est SÈCHE, aucun plafond (Σ −50, `LDB 16 l.11`)', mods: [{ label: 'Sonné', value: -10, famille: 'jet' }, { label: 'Aveuglé', value: -20, famille: 'jet' }, { label: 'Empêtré', value: -20, famille: 'jet' }], attendu: -50, mord: false },
    { nom: 'BONUS mordant (Σ +80)', mods: [{ label: 'Viser', value: 40, famille: 'circonstance' }, { label: 'À Terre', value: 40, famille: 'circonstance' }], attendu: capB, mord: true, palier: 'tresFacile' },
    { nom: 'BONUS ET MALUS de circonstances mordants (les deux sommes plafonnent, puis s’ajoutent)', mods: [{ label: 'Viser', value: 40, famille: 'circonstance' }, { label: 'À Terre', value: 40, famille: 'circonstance' }, { label: 'Brouillard', value: -20, famille: 'circonstance' }, { label: 'Main secondaire', value: -20, famille: 'circonstance' }, { label: 'Obscurité', value: -20, famille: 'circonstance' }], attendu: capB - capM, mord: true },
    { nom: 'AVANTAGE hors plafond, circonstances mordantes à côté', mods: [{ label: 'Avantage', value: 70, famille: 'jet' }, { label: 'Brouillard', value: -20, famille: 'circonstance' }, { label: 'Obscurité', value: -20, famille: 'circonstance' }], attendu: 70 - capM, mord: true, palier: 'tresDifficile' },
    { nom: 'AVANTAGE SEUL : rien à plafonner malgré une somme > +60', mods: [{ label: 'Avantage', value: 70, famille: 'jet' }], attendu: 70, mord: false },
  ];

  it.each(MATRICE)('MODE PLAFONNÉ — $nom', ({ mods, attendu, mord, palier }) => {
    const somme = mods.reduce((s, m) => s + m.value, 0);
    expect(combineMods(mods), 'la matrice doit décrire la combinaison RÉELLE du moteur').toBe(attendu);
    expect(attendu !== somme, 'le régime annoncé (mordant ou non) doit être celui que le moteur produit').toBe(mord);

    const l = rollLine({ difficulty: 'intermediaire', valeur: 60, surLaCible: mods, plafond: 'difficultes' });
    expect(l.target).toBe(clampTarget(60 + attendu).target);
    expect(l.difficulty, 'le PALIER annoncé par la ligne').toBe(palier ?? 'intermediaire');
    if (palier) {
      // Palier DÉRIVÉ : les circonstances (et l'écart du plafond) COMPOSENT la Difficulté — elles
      // quittent les chips, et leur somme EST la valeur du palier affiché.
      const parts = l.difficultyParts ?? [];
      expect(parts.reduce((s, m) => s + m.value, 0)).toBe(DIFFICULTY_MODIFIERS[palier]);
      expect(parts.map((m) => m.label)).toEqual(expect.arrayContaining(mods.filter((m) => m.famille === 'circonstance').map((m) => m.label)));
      expect(l.mods.some((m) => m.famille === 'circonstance'), 'aucune circonstance restée en chip').toBe(false);
      expect(l.mods.map((m) => m.label)).toEqual(mods.filter((m) => m.famille !== 'circonstance').map((m) => m.label));
      if (mord) expect(parts.find((m) => m.label === 'plafond Difficultés')).toMatchObject({ value: attendu - somme, ref: RULE_REF['combiner-les-difficultes'] });
    } else {
      // Aucun palier exact à composer : la ligne garde sa Difficulté et TOUT se lit en chips —
      // l'amputation du plafond comprise, sans quoi elle retomberait en « autres ».
      expect(l.difficultyParts).toBeUndefined();
      const chip = l.mods.find((m) => m.label === 'plafond Difficultés');
      if (mord) expect(chip).toMatchObject({ value: attendu - somme, ref: RULE_REF['combiner-les-difficultes'] });
      else expect(chip, 'aucune chip décorative quand rien n’est amputé').toBeUndefined();
    }
    expect(inexplique({ ...l }), 'aucune chip « autres »').toBe(0);

    // HORS mode : la somme reste BRUTE et AUCUN palier ne se dérive — le plafond (et le palier qu'il
    // compose) est un régime de COMBAT, pas un défaut du monteur.
    const brut = rollLine({ difficulty: 'intermediaire', valeur: 60, surLaCible: mods });
    expect(brut.target).toBe(clampTarget(60 + somme).target);
    expect(brut.mods.some((m) => m.label === 'plafond Difficultés')).toBe(false);
    expect(brut.difficulty).toBe('intermediaire');
    expect(brut.difficultyParts).toBeUndefined();
    expect(inexplique({ ...brut })).toBe(0);
  });

  /**
   * REPLI EXACT-OU-RIEN (garde-fou du juge de design) : `difficultyFromModifier` est un PLUS PROCHE
   * VOISIN — un −15 y trouve « Complexe (−10) » (MESURÉ), un palier MENTEUR de 5 points. Le monteur
   * exige donc l'exactitude : à défaut, la circonstance reste une chip. Le −15 est celui que le
   * combat produit RÉELLEMENT : bande de portée Extrême (−30) halvée par le Talent Tireur embusqué
   * (`sniperRangeAdjust`, appelé par `attackModifiers` — la ligne reste une circonstance de la table).
   */
  it('MODE PLAFONNÉ — une circonstance qui ne compose AUCUN palier exact (−15) reste en chip', () => {
    const mods: ModLine[] = [{ label: 'Distance extrême', value: -15, famille: 'circonstance', ref: RULE_REF['portee-d-une-arme'] }];
    const l = rollLine({ difficulty: 'intermediaire', valeur: 60, surLaCible: mods, plafond: 'difficultes' });
    expect(l.difficulty, 'aucun palier ne vaut −15 : la Difficulté déclarée tient').toBe('intermediaire');
    expect(l.difficultyParts).toBeUndefined();
    expect(l.mods).toEqual(mods);
    expect(l.target).toBe(45);
    expect(inexplique({ ...l })).toBe(0);
  });

  /**
   * GARDE DE LA TRAPPE `rollStep` — l'étaleur d'étape ne relaie NI `difficulty` NI `difficultyParts`
   * (ses 42 appelants posent la Difficulté eux-mêmes après l'étalement). C'est SANS effet tant
   * qu'aucun d'eux n'ouvre le mode plafonné : lui seul dérive un palier. Le jour où un site
   * l'ouvrira, ses chips seraient amputées de leurs circonstances SANS le palier qui les porte →
   * écart « autres » à l'écran. La garde rougit à ce site-là, pas avant. STRUCTURELLE : elle lit le
   * SOURCE (l'appel et son objet-spec), jamais une liste tenue à la main.
   */
  it('TRAPPE — aucun appelant de `rollStep` n’ouvre le mode plafonné (sinon : relayer le palier)', () => {
    const root = resolve(__dirname, '..');
    const fichiers: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) fichiers.push(p);
      }
    };
    walk(root);
    const sites: string[] = [];
    let vus = 0;
    for (const f of fichiers) {
      const src = readFileSync(f, 'utf8');
      // L'appel + son objet-spec (jusqu'à la parenthèse fermante de premier niveau, sur N lignes).
      for (const m of src.matchAll(/rollStep\(([\s\S]{0,600}?)\)\s*[,;)\]}]/g)) {
        vus++;
        if (/plafond\s*:/.test(m[1])) sites.push(`${relative(root, f)} — ${m[1].slice(0, 80).replace(/\s+/g, ' ')}`);
      }
    }
    expect(vus, 'le scan doit VOIR des appels — un scan cassé rendrait la garde vide et verte').toBeGreaterThan(20);
    expect(sites, 'un appelant plafonné doit relayer `difficulty`/`difficultyParts` depuis `rollLine`').toEqual([]);
  });
});

/**
 * CONTRAT DU PALIER DÉRIVÉ — sonde EXHAUSTIVE promue en garde (sonde du juge de design : 7840
 * combinaisons, 0 échec). Elle ne juge AUCUN cas particulier : elle balaie le produit cartésien des
 * régimes (5 Difficultés déclarées × mode plafonné ou non × crans de modificateur × familles ×
 * Avantage hors table × valeur de base écrêtante) et exige de CHAQUE ligne montée les cinq
 * invariants du lot :
 *
 *  1. la CIBLE est celle que le moteur applique — l'affichage ne déplace pas un point ;
 *  2. la ligne s'EXPLIQUE : `base + Σ chips + modificateur du palier AFFICHÉ + écrêtage === cible`
 *     (l'arithmétique exacte de `reconciled` : reste ≠ 0 ⇒ chip « autres » à l'écran) ;
 *  3. un palier dérivé ne MENT jamais : sa composition SOMME à son modificateur ;
 *  4. en mode dérivé, plus AUCUNE circonstance ne reste en chip — le palier les porte ;
 *  5. aucun palier hors mode plafonné, ni sans circonstance à composer.
 *
 * La matrice ci-dessus vaut pour ses six régimes ; ce balayage vaut pour la RÈGLE — une régression
 * d'une condition de dérivation y rougit sans qu'on ait à deviner la fixture qui la révèle.
 */
describe('PALIER DÉRIVÉ — contrat balayé sur tout le produit cartésien des régimes (#1153)', () => {
  /** Crans de la table (`LDB 14`), des deux signes. */
  const VALEURS = [-40, -30, -20, -10, 10, 20, 40, 60];
  const FAMILLES = ['circonstance', 'jet'] as const;
  /** Difficultés DÉCLARÉES : Intermédiaire (le combat, `LDB 13 l.118`) et quatre autres — un site
   *  qui déclare la sienne doit la GARDER, le palier ne peut pas l'avaler. */
  const DIFFICULTES: Difficulty[] = ['intermediaire', 'accessible', 'difficile', 'tresDifficile', 'facile'];
  /** 45 = cible confortable ; 95 = régime où `clampTarget` mord (l'écrêtage doit rester nommable). */
  const BASES = [45, 95];
  const total = (mods: ModLine[]): number => mods.reduce((s, m) => s + m.value, 0);

  it('cinq invariants, sur des milliers de combinaisons : aucune ligne ne ment ni ne cache', () => {
    const echecs: string[] = [];
    let cas = 0;
    let derives = 0;

    const juge = (difficulty: Difficulty, valeur: number, mods: ModLine[], plafond: boolean) => {
      cas++;
      const l = rollLine({ difficulty, valeur, surLaCible: mods, ...(plafond ? { plafond: 'difficultes' as const } : {}) });
      const ou = `${difficulty}/${valeur}/${plafond ? 'plafonné' : 'brut'}/${JSON.stringify(mods.map((m) => `${m.value} ${m.famille}`))}`;

      // 1. CIBLE : la combinaison du moteur, écrêtée par la primitive du jet.
      const combine = plafond ? combineMods(mods) : total(mods);
      const attendue = clampTarget(valeur + DIFFICULTY_MODIFIERS[difficulty] + combine).target;
      if (l.target !== attendue) echecs.push(`CIBLE ${ou} → ${l.target} ≠ ${attendue}`);

      // 2. La ligne s'EXPLIQUE intégralement (`inexplique` juge la MÊME arithmétique que l'écran).
      if (inexplique({ ...l }) !== 0) echecs.push(`INEXPLIQUÉ ${ou} → reste ${inexplique({ ...l })}`);

      if (!l.difficultyParts) return;
      derives++;
      // 3. Le palier ne ment pas : sa composition somme à son modificateur.
      if (total(l.difficultyParts) !== DIFFICULTY_MODIFIERS[l.difficulty]) {
        echecs.push(`PALIER MENTEUR ${ou} → composition ${total(l.difficultyParts)} ≠ ${DIFFICULTY_MODIFIERS[l.difficulty]} (${l.difficulty})`);
      }
      // 4. Aucune circonstance laissée en chip quand le palier les porte.
      if (l.mods.some((m) => m.famille === 'circonstance')) echecs.push(`CIRCONSTANCE EN CHIP ${ou}`);
      // 5. Jamais de palier hors mode plafonné, ni sans circonstance à composer.
      if (!plafond) echecs.push(`PALIER HORS MODE PLAFONNÉ ${ou}`);
      if (!l.difficultyParts.some((m) => m.famille === 'circonstance')) echecs.push(`PALIER SANS CIRCONSTANCE ${ou}`);
    };

    for (const d of DIFFICULTES) {
      for (const plafond of [true, false]) {
        for (const a of VALEURS) {
          for (const fa of FAMILLES) {
            juge(d, 45, [{ label: 'A', value: a, famille: fa }], plafond);
            for (const b of VALEURS) {
              for (const fb of FAMILLES) {
                const paire: ModLine[] = [{ label: 'A', value: a, famille: fa }, { label: 'B', value: b, famille: fb }];
                for (const base of BASES) juge(d, base, paire, plafond);
                // Avantage : hors table de Difficulté (`LDB 14 l.48`), donc `famille: 'jet'`.
                juge(d, 45, [...paire, { label: 'Avantage', value: 60, famille: 'jet' }], plafond);
              }
            }
          }
        }
      }
    }

    expect(cas, 'le balayage doit couvrir des milliers de cas — un produit tronqué ne prouve rien').toBeGreaterThan(7000);
    expect(derives, 'il doit VRAIMENT produire des paliers dérivés, sinon il ne juge que le repli').toBeGreaterThan(100);
    expect(echecs.slice(0, 20)).toEqual([]);
  });
});
