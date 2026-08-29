import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { beginShipwreck } from './shipwreck';
import { buildNightCascade, deferredUpkeepSteps, type PendingRest } from './restFlow';
import { runDailyUpkeep, dayIndex, type DeferredUpkeepTest } from './upkeep';
import { bestActivitySkill } from './interludeFlow';
import { inexplique, soutienDe, jetDe } from './cascadeTestKit';
import { skillBaseValue, testValue, partyAssisted } from '../engine/skills';
import { cascadeAppliers } from './cascade';
import { effectiveChar } from '../engine/characteristics';
import { restResistVal } from '../engine/rest';
import { clampTarget } from '../engine/tests';
import { DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../engine/types';
import { rule } from '../engine/policy';

/**
 * MONTEUR CANONIQUE — les flux HORS COMBAT (#1153 L3). Chaque site migré est jugé sur DEUX grandeurs
 * indissociables :
 *  1. la CIBLE reste celle que `rollTest` jettera — recalculée ICI à la main depuis la valeur du RAW
 *     (`testValue`/`restResistVal` + Difficulté, écrêtée par `clampTarget`), jamais relue du site ;
 *  2. l'écart base→cible est INTÉGRALEMENT nommé (`inexplique === 0`) : plus une chip « autres ».
 * L'acteur porte un ÉTAT (`empoisonne`, −10 par valeur, LDB 16) : sans lui, une base FONDUE se
 * confondrait avec le Niveau de Compétence nu et le test passerait sur un monteur faux.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', label: 'Héros', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 35, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

const scene = { id: 'sc', label: 'Rade', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] };

function fresh(party: Combatant[]) {
  seedBattleRng(1);
  useGame.setState({
    party, battle: null, mode: 'exploration', pendingCascade: null, journal: [],
    scene: scene as never, worldMap: null, vessel: null, medic: null, pendingHeal: null,
  } as never);
}

describe('Naufrage — Natation montée par `rollStep` (#1153 L3)', () => {
  it('héros EMPOISONNÉ : base = Niveau NU, l’État est une chip NOMMÉE, cible = valeur jetée + Difficulté', () => {
    const nageur = hero({
      id: 'nag', label: 'Nageur',
      skills: [{ skillId: 'natation', advances: 25, characteristic: 'force' }] as never,
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
    });
    fresh([nageur]);

    const nue = skillBaseValue(nageur, 'natation', undefined, 'force');
    const jetee = testValue(nageur, 'natation', 'force');
    expect(jetee, 'l’État sépare la nue de la valeur jetée — sinon le test ne prouve rien').toBeLessThan(nue);
    const diff = rule('sea-shipwreck-swim') as Difficulty;

    beginShipwreck(get, set);
    const step = get().pendingCascade!.participants.find((s) => s.kind === 'shipwreckSwim')!;
    expect(step.base, 'Niveau de Compétence NU (LDB 09 l.17)').toBe(nue);
    expect(step.difficulty, 'la ligne DIT sa Difficulté (#1072)').toBe(diff);
    // CIBLE INVARIANTE : exactement ce que roulait l'ancien monteur à la main.
    expect(step.target).toBe(clampTarget(jetee + DIFFICULTY_MODIFIERS[diff]).target);
    expect(inexplique(step), 'aucune chip « autres » : l’État est nommé').toBe(0);
  });
});

describe('Nuit — contagion / cauchemars / entretien différé montés par `rollStep` (#1153 L3)', () => {
  const restPending = (party: Combatant[]): PendingRest => ({
    places: { lodging: [], food: [] }, quality: 'normale', days: 1, phase: 'setup',
    perHero: Object.fromEntries(party.map((h) => [h.id, { lodging: 'auberge', food: 'repas' }])),
  } as never);

  beforeEach(() => seedBattleRng(1));

  it('Contagion + Cauchemars : cible = valeur RAW + Difficulté, et rien d’anonyme', () => {
    const dormeur = hero({
      id: 'dor', label: 'Dormeur', nightmares: true,
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
    } as never);
    fresh([dormeur]);
    const { steps } = buildNightCascade(get, set, restPending([dormeur]), {
      fedDaily: true,
      extraContagion: [{ heroId: dormeur.id, diseaseName: 'courante-galopante', difficulty: 'accessible', resVal: restResistVal(dormeur) }],
    } as never);

    const contagion = jetDe(steps.find((s) => s.kind === 'contagion')!);
    // `restResistVal` (E effective + avances) est la valeur RAW du Test passif : elle ne subit PAS l'État.
    expect(contagion.target).toBe(clampTarget(restResistVal(dormeur) + DIFFICULTY_MODIFIERS.accessible).target);
    expect(contagion.base).toBe(restResistVal(dormeur));
    expect(inexplique(contagion), 'aucune chip « autres » sur la Contagion').toBe(0);

    const cauchemar = jetDe(steps.find((s) => s.kind === 'nightmare')!);
    const calme = effectiveChar(dormeur, 'force-mentale'); // aucune avance de Calme sur la fixture
    expect(cauchemar.target).toBe(clampTarget(calme + DIFFICULTY_MODIFIERS.facile).target);
    expect(inexplique(cauchemar), 'aucune chip « autres » sur les Cauchemars').toBe(0);
  });

  it('Entretien différé (Faim) : base = Niveau NU, l’État ET la pénalité RAW ont chacun leur ligne', () => {
    // RÉÉCRIT depuis la règle (#1153 volet B). Le RAW nomme le Test : « vous devez effectuer un Test
    // de Résistance tous les deux jours » (LDB 18 l.342), de plus en plus dur « −10 % de plus pour
    // chaque Test » (l.338). Le producteur DIT donc ses ids — la base redevient le Niveau de
    // Compétence nu (LDB 09 l.17) et l'État du héros (LDB 16) prend SA chip, à côté de la pénalité
    // cumulative. L'attendu précédent (une seule ligne, −20) mesurait la base FONDUE : il verrouillait
    // l'angle mort au lieu de la règle.
    const affame = hero({
      id: 'aff', label: 'Affamé', conditions: [{ id: 'empoisonne', value: 1 }] as never,
      hunger: { days: 1, tests: 2, failures: 0 },
    } as never);
    fresh([affame]);
    set({ lastUpkeepDay: -1 } as never);
    const deferred: DeferredUpkeepTest[] = [];
    runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });
    const faim = deferred.find((t) => t.kind === 'faim');
    expect(faim, 'un jour sans ration diffère bien le Test de Faim').toBeTruthy();

    const nue = skillBaseValue(affame, 'resistance', undefined, 'endurance');
    const jetee = testValue(affame, 'resistance', 'endurance');
    expect(jetee, 'l’État sépare la nue de la valeur jetée — sinon le test ne prouve rien').toBeLessThan(nue);
    expect(faim!.test, 'le producteur NOMME son Test (LDB 18 l.342)').toEqual({ skill: 'resistance', char: 'endurance' });
    expect(faim!.base, 'Niveau de Compétence NU (LDB 09 l.17), plus la valeur fondue').toBe(nue);

    const mods = faim!.mods ?? [];
    const cumul = mods.filter((m) => m.label === 'Tests déjà subis').reduce((s, m) => s + m.value, 0);
    expect(cumul, 'la pénalité cumulative (LDB 18 l.338) reste une ligne NOMMÉE').toBe(-20);
    const etat = mods.filter((m) => m.label !== 'Tests déjà subis').reduce((s, m) => s + m.value, 0);
    expect(etat, 'l’État Empoisonné a désormais SA chip, il n’est plus fondu dans la base').toBe(jetee - nue);
    expect(etat).toBeLessThan(0);

    // CIBLE INVARIANTE : exactement ce que roulait le wrapper avant la décomposition.
    expect(faim!.target).toBe(clampTarget(jetee + DIFFICULTY_MODIFIERS.intermediaire - 20).target);
    const st = deferredUpkeepSteps(get().party, [faim!])[0];
    expect(inexplique(st), 'aucune chip « autres » sur un Test d’entretien').toBe(0);
  });

  it('TOUTES les étapes d’entretien d’une journée réelle : `inexplique === 0`, héros sous État', () => {
    // Harnais RÉEL (`runDailyUpkeep`) sur un héros cumulant Faim, Soif, ivresse et convalescence de
    // fracture — les 4 producteurs joignables en une journée. Ceux qui NOMMENT leur Test se
    // décomposent, celui qui tire sa valeur de `restResistVal` (convalescence) reste déclaré
    // étranger : dans les DEUX cas l'écart base→cible doit être INTÉGRALEMENT nommé.
    const eprouve = hero({
      id: 'epr', label: 'Éprouvé',
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
      skills: [{ skillId: 'resistance', advances: 15, characteristic: 'endurance' },
        { skillId: 'resistance-a-l-alcool', advances: 10, characteristic: 'endurance' }] as never,
      hunger: { days: 1, tests: 2, failures: 0 },
      thirst: { days: 0, tests: 1, failures: 0 },
      drunk: { failedTests: 2, drunk: true },
      criticalWounds: 1,
      traumas: [{ kind: 'fracture', label: 'Fracture du bras', location: 'brasD', severity: 'mineur', recoveryDays: 1 }],
    } as never);
    fresh([eprouve]);
    // Tonneaux à sec → Test de Soif (LDB 18 l.340) ; `lastMoraleWeek` haute neutralise la paie hebdo.
    set({ lastUpkeepDay: dayIndex(get().gameTime) - 1, vessel: { waterLitres: 0, crew: [], morale: { lastMoraleWeek: 99 } } } as never);
    const deferred: DeferredUpkeepTest[] = [];
    runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });

    const kinds = deferred.map((t) => t.kind).sort();
    expect(kinds, 'la journée doit bien produire les 4 familles visées').toEqual(['dessoulage', 'faim', 'soif', 'traumaFracture']);
    for (const st of deferredUpkeepSteps(get().party, deferred)) {
      expect(inexplique(st), `chip « autres » sur l’étape ${st.kind}`).toBe(0);
    }
    // Les producteurs qui NOMMENT leur Test livrent une base NUE ; celui qui ne le nomme pas garde la sienne.
    const nomme = deferred.filter((t) => t.test).map((t) => t.kind).sort();
    expect(nomme, 'faim/soif/dessoûlage nomment leur Test ; la convalescence tire de `restResistVal`').toEqual(['dessoulage', 'faim', 'soif']);
    const faim = deferred.find((t) => t.kind === 'faim')!;
    expect(faim.base).toBe(skillBaseValue(eprouve, 'resistance', undefined, 'endurance'));
    const conv = deferred.find((t) => t.kind === 'traumaFracture')!;
    expect(conv.base, 'valeur ÉTRANGÈRE assumée (Test passif, aucune pénalité d’État)').toBe(restResistVal(eprouve));
    expect(conv.mods ?? [], 'rien à nommer sur une valeur étrangère').toEqual([]);
  });

  it('Dessoûlage : le libellé de compétence est celui du RAW (« Résistance à l’alcool », LDB 09 l.485)', () => {
    const ivre = hero({
      id: 'ivr', label: 'Ivre', drunk: { failedTests: 2, drunk: true },
      skills: [{ skillId: 'resistance-a-l-alcool', advances: 10, characteristic: 'endurance' }] as never,
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
    } as never);
    fresh([ivre]);
    set({ lastUpkeepDay: -1 } as never);
    const deferred: DeferredUpkeepTest[] = [];
    runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });
    const desso = deferred.find((t) => t.kind === 'dessoulage')!;
    const st = deferredUpkeepSteps(get().party, [desso])[0];
    // RAW verbatim (LDB 09 l.485) : « effectuez un Test de Résistance à l'alcool Intermédiaire (+0) ».
    expect(st.rollLabel, 'plus de « Résistance » générique en position de compétence').toBe("Résistance à l'alcool");
    expect(st.base).toBe(skillBaseValue(ivre, 'resistance-a-l-alcool', undefined, 'endurance'));
    expect(st.target).toBe(clampTarget(testValue(ivre, 'resistance-a-l-alcool', 'endurance') + DIFFICULTY_MODIFIERS.intermediaire).target);
    expect(inexplique(st)).toBe(0);
  });
});

/**
 * VOLET A (#1153) — les 5 lignes que `restFlow` montait HORS monteur : leur cible sortait d'un
 * helper qui intégrait déjà la Difficulté ou la pénalité (`forcedMarchTarget`, `exposureTarget`),
 * donc ni le cliquet lexical ni `inexplique` ne les voyaient. L'abri de fortune était l'angle mort
 * DOUBLE (Soutien de `partyAssisted` fondu dans la base, `target = base`).
 */
describe('Nuit — les 5 étapes de `restFlow` montées par `rollStep` (#1153 volet A)', () => {
  const restPending = (party: Combatant[], lodging: string): PendingRest => ({
    places: { lodging: [], food: [] }, quality: 'normale', days: 1, phase: 'setup',
    perHero: Object.fromEntries(party.map((h) => [h.id, { lodging, food: 'repas' }])),
  } as never);

  const campeur = (p: Partial<Combatant>) => hero({
    conditions: [{ id: 'empoisonne', value: 1 }] as never,
    skills: [{ skillId: 'resistance', advances: 15, characteristic: 'endurance' }] as never,
    ...p,
  } as never);

  beforeEach(() => seedBattleRng(1));

  it('Marche forcée : base NUE, État nommé, cible = valeur JETÉE (Résistance +0, LDB 51 l.195)', () => {
    const marcheur = campeur({ id: 'mar', label: 'Marcheur' });
    fresh([marcheur]);
    const p = { ...restPending([marcheur], 'auberge'), travelMarch: [marcheur.id] } as never as PendingRest;
    const { steps } = buildNightCascade(get, set, p, { fedDaily: true });
    const st = jetDe(steps.find((s) => s.kind === 'forcedMarch')!);
    const nue = skillBaseValue(marcheur, 'resistance', undefined, 'endurance');
    const jetee = testValue(marcheur, 'resistance', 'endurance');
    expect(jetee, 'l’État sépare la nue de la valeur jetée').toBeLessThan(nue);
    expect(st.base, 'la base n’est plus `forcedMarchTarget` (valeur FONDUE)').toBe(nue);
    expect(st.target).toBe(clampTarget(jetee + DIFFICULTY_MODIFIERS.intermediaire).target);
    expect(inexplique(st)).toBe(0);
  });

  it('Récupération : valeur ÉTRANGÈRE assumée, cible = `restResistVal` + Accessible (LDB 18 l.296)', () => {
    // Sans Empoisonné : cet État rend le repos INSTABLE (LDB 16 l.105) — aucun Test de récupération.
    const blesse = campeur({ id: 'ble', label: 'Blessé', wounds: { current: 4, max: 12 }, conditions: [] as never });
    fresh([blesse]);
    const { steps } = buildNightCascade(get, set, restPending([blesse], 'auberge'), { fedDaily: true });
    const st = jetDe(steps.find((s) => s.kind === 'recovery')!);
    // `restResistVal` ≠ `testValue` (Test passif : aucune pénalité d'État) → base = valeur, zéro chip.
    expect(st.base).toBe(restResistVal(blesse));
    expect(st.mods ?? []).toEqual([]);
    // CIBLE INVARIANTE : `restResistVal` + Accessible (+20) — la valeur que le site posait, à l'écrêtage près.
    expect(st.target).toBe(clampTarget(restResistVal(blesse) + DIFFICULTY_MODIFIERS.accessible).target);
    expect(inexplique(st)).toBe(0);
  });

  it('Abri de fortune : le Soutien FONDU (LDB 12) ressort en ligne nommée, la cible ne bouge pas', () => {
    const meneur = campeur({
      id: 'men', label: 'Meneur',
      skills: [{ skillId: 'survie-en-exterieur', advances: 30, characteristic: 'agilite' },
        { skillId: 'resistance', advances: 15, characteristic: 'endurance' }] as never,
    });
    const aide = campeur({
      id: 'aid', label: 'Aide', conditions: [] as never,
      skills: [{ skillId: 'survie-en-exterieur', advances: 5, characteristic: 'agilite' }] as never,
    });
    fresh([meneur, aide]);
    set({ scene: { ...scene, weather: 'neige' } } as never);
    const { steps } = buildNightCascade(get, set, restPending([meneur, aide], 'dehors'), { fedDaily: true });
    const st = jetDe(steps.find((s) => s.kind === 'shelter')!);

    const assiste = partyAssisted(get().party, 'survie-en-exterieur')!;
    expect(assiste.support.bonus, 'l’aide doit réellement soutenir — sinon le test ne prouve rien').toBeGreaterThan(0);
    // CIBLE INVARIANTE : c'est exactement `best.value` que l'ancien montage posait.
    expect(st.target).toBe(clampTarget(assiste.value + DIFFICULTY_MODIFIERS.intermediaire).target);
    expect(soutienDe(st), 'le Soutien a SA ligne, il n’est plus fondu dans la base').toBe(assiste.support.bonus);
    expect(st.base, 'Niveau de Compétence NU du meneur').toBe(skillBaseValue(assiste.actor, 'survie-en-exterieur'));
    expect(inexplique(st)).toBe(0);
  });

  it('Exposition : la pénalité « sans manteau » est SUR LA CIBLE et nommée (tente + tempête)', () => {
    const transi = campeur({
      id: 'tra', label: 'Transi',
      items: [{ uid: 't', label: 'Tente', trappingId: 'tente', kind: 'misc', qualities: [], enc: 2, equipped: false }] as never,
    });
    fresh([transi]);
    set({ scene: { ...scene, weather: 'tempete' } } as never);
    const { steps } = buildNightCascade(get, set, restPending([transi], 'dehors'), { fedDaily: true });
    const expo = steps.filter((s) => s.kind === 'exposure');
    expect(expo.length, 'une nuit extrême SOUS TENTE garde le rythme difficile').toBeGreaterThan(0);
    const st = jetDe(expo[0]);
    const pen = Number(rule('exposure-no-coat-penalty'));
    expect(pen, 'sans pénalité de manteau, ce test ne mesure rien').toBeGreaterThan(0);
    expect(st.base, 'valeur ÉTRANGÈRE (Test passif) : la base EST `restResistVal`').toBe(restResistVal(transi));
    expect((st.mods ?? []).reduce((s, m) => s + m.value, 0)).toBe(-pen);
    // CIBLE INVARIANTE vs l'ancien `exposureTarget` (= max(0, resVal − pénalité)), à l'écrêtage près.
    expect(st.target).toBe(clampTarget(restResistVal(transi) + DIFFICULTY_MODIFIERS.intermediaire - pen).target);
    expect(inexplique(st)).toBe(0);
  });

  it('Gueule de bois : l’étape INSÉRÉE par le dessoûlage porte le Test du RAW (LDB 09 l.485)', () => {
    const ivre = campeur({
      id: 'ivr', label: 'Ivre', drunk: { failedTests: 2, drunk: true },
      skills: [{ skillId: 'resistance-a-l-alcool', advances: 10, characteristic: 'endurance' },
        { skillId: 'resistance', advances: 15, characteristic: 'endurance' }] as never,
    });
    fresh([ivre]);
    set({ lastUpkeepDay: -1 } as never);
    const { steps } = buildNightCascade(get, set, restPending([ivre], 'auberge'), { fedDaily: true });
    const desso = steps.find((s) => s.kind === 'dessoulage')!;
    desso.participants![0].result = { roll: 50, target: desso.participants![0].target, sl: 0, success: true } as never;
    const out = cascadeAppliers.dessoulage!.apply(get, set, desso, get().party[0], { steps, index: 0 } as never);
    const bande = (out!.insert ?? [])[0];
    expect(bande.kind).toBe('dessoulageHangover');
    const st = jetDe(bande);
    expect(st.label).toBe("Résistance à l'alcool");
    expect(st.base, 'base NUE — l’État a sa chip').toBe(skillBaseValue(ivre, 'resistance-a-l-alcool', undefined, 'endurance'));
    expect(st.target).toBe(clampTarget(testValue(ivre, 'resistance-a-l-alcool', 'endurance') + DIFFICULTY_MODIFIERS.intermediaire).target);
    expect(inexplique(st)).toBe(0);
  });
});

describe('Infirmerie / Activité — cibles montées par `rollLine` (#1153 L3)', () => {
  it('Soin : cible = valeur de Guérison JETÉE + Difficulté (soigneur EMPOISONNÉ)', () => {
    const doc = hero({
      id: 'doc', label: 'Doc',
      skills: [{ skillId: 'guerison', advances: 30, characteristic: 'intelligence' }] as never,
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
    });
    const blesse = hero({ id: 'al', label: 'Blessé', wounds: { current: 4, max: 12 } });
    fresh([doc, blesse]);
    get().openMedic({ patientId: 'al' });
    get().medicAct('wounds');
    const ph = get().pendingHeal!;
    // Aucun soutien possible (le patient n'a pas Guérison) → la cible est celle du soigneur seul.
    expect(ph.target).toBe(clampTarget(testValue(doc, 'guerison') + DIFFICULTY_MODIFIERS[ph.difficulty]).target);
    expect(ph.skillValue).toBe(testValue(doc, 'guerison'));
  });

  it('Passe de Rééducation : la cible AFFICHÉE porte l’Accessible +20 que `rollTest` jettera (LDB 18 l.120/179)', () => {
    const doc = hero({ id: 'doc', label: 'Doc', skills: [{ skillId: 'guerison', advances: 30, characteristic: 'intelligence' }] as never });
    const patient = hero({
      id: 'p', label: 'Patient', wounds: { current: 40, max: 40 },
      traumas: [{ label: 'Épaule luxée (bras perdu)', location: 'brasD', restoreDR: 6, ops: [{ op: 'maxWeaponHands', hands: 1 }] }],
    } as never);
    fresh([doc, patient]);
    set({ pendingSurgery: null } as never);
    get().openMedic({ patientId: 'p' });
    get().medicAct('recovery'); // ARME la rééducation (aucun jet)
    const sg = get().medic!.surgery!;
    expect(sg.difficulty).toBe('accessible');
    get().openSurgeryPass();
    const ps = get().pendingSurgery!;
    // La cible ne vaut PLUS la compétence nue : elle porte la Difficulté de l'opération engagée.
    expect(ps.target).toBe(clampTarget(sg.skill + DIFFICULTY_MODIFIERS.accessible).target);
  });

  it('Activité d’interlude : `bestActivitySkill` classe sur la cible ÉCRÊTÉE que le jet subira', () => {
    const h = hero({
      id: 'act', skills: [{ skillId: 'ragot', advances: 20, characteristic: 'sociabilite' }] as never,
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
    });
    const pick = bestActivitySkill(h, { skills: [{ skillId: 'ragot' }] as never, difficulty: 'complexe' })!;
    expect(pick.value).toBe(testValue(h, 'ragot', undefined, undefined));
    expect(pick.target).toBe(clampTarget(pick.value + DIFFICULTY_MODIFIERS.complexe).target);
  });
});
