import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';
import { tome1Auberge } from '../scenes/tome1-auberge';
import { emptyScene } from './scene';
import { makeInteriorScene } from '../scenes/interiors';
import type { BuildingFeature } from './scene';
import type { Combatant, ItemInstance } from '../engine/types';
import { isOutOfAction } from '../engine/conditions';

function reset() {
  useGame.setState({
    screen: 'menu',
    party: [],
    scene: null,
    mode: 'exploration',
    partyPos: { x: 0, y: 0 },
    flags: {},
    journal: [],
    dialogue: null,
    battle: null,
    pendingTest: null,
    pendingAttack: null,
    pendingDefense: null,
    pendingDisengage: null,
    pendingCast: null,
    pendingRoundStart: null,
    document: null,
  });
}

describe('Boucle de jeu (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers(); // purge tout timer fuité d'un test précédent (startCombat arme maybeRunEnemyTurn)
    reset();
  });
  afterEach(() => {
    vi.clearAllTimers(); // les setTimeout d'IA (resumeEnemyTurn, attackThenAdvance) ne fuient pas vers le test suivant
    vi.useRealTimers();
  });

  it('charge une scène et place le groupe au départ', () => {
    useGame.getState().startScene(tome1Intro);
    const st = useGame.getState();
    expect(st.scene?.id).toBe('tome1-intro');
    expect(st.partyPos).toEqual({ x: 6, y: 10 });
    expect(st.mode).toBe('exploration');
  });

  it('un dialogue de PNJ s’ouvre et se parcourt (Gustav, intérieur de l’auberge)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Auberge);
    // Se placer à côté de Gustav (5,2) dans la Grande Salle puis interagir.
    useGame.setState({ partyPos: { x: 5, y: 3 } });
    useGame.getState().interactEntity('gustav');
    expect(useGame.getState().dialogue?.dialogue.id).toBe('dlg-gustav');
    useGame.getState().chooseDialogue(0); // → g2
    expect(useGame.getState().dialogue?.nodeId).toBe('g2');
  });

  it('la porte du bâtiment « La Diligence » ouvre l’intérieur enregistré dans la campagne', () => {
    // tome1-auberge-interieur est enregistré via campaign[] : aucune startScene
    // manuelle de l'intérieur n'est nécessaire, contrairement aux tests de porte
    // ci-dessous qui utilisent une scène ad hoc.
    useGame.getState().startScene(tome1Intro);
    useGame.setState({ partyPos: { x: 6, y: 8 } }); // juste sous la porte (6,7)
    useGame.getState().moveParty({ x: 6, y: 7 }); // marcher sur la porte → intérieur
    expect(useGame.getState().scene?.id).toBe('tome1-auberge-interieur');
  });

  it('le trigger de la route déclenche l’embuscade des mutants', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(2) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    // Entrer dans la zone du trigger (14..19, 11..12).
    useGame.getState().moveParty({ x: 16, y: 11 });
    const st = useGame.getState();
    expect(st.mode).toBe('battle');
    expect(st.battle).toBeTruthy();
    const enemies = st.battle!.combatants.filter((c) => c.kind === 'enemy');
    expect(enemies.length).toBe(3);
    expect(enemies[0].name).toBe('Mutant');
    expect(enemies[0].wounds.max).toBe(12); // profil Mutant LDB
  });

  it('marcher sur une tuile-porte (reveal door) déclenche une transition', () => {
    const interior = emptyScene(5, 5);
    interior.id = 'interieur-test';
    interior.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 1, y: 1 } });
    const exterior = emptyScene(8, 8);
    exterior.id = 'exterieur-test';
    exterior.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    exterior.buildings = [
      {
        id: 'chap',
        type: 'chapelle',
        foot: { x: 2, y: 2, w: 3, h: 3 },
        reveal: 'door',
        door: { x: 3, y: 4 },
        interiorScene: 'interieur-test',
      },
    ];
    useGame.getState().startScene(interior); // enregistre l'intérieur
    useGame.getState().startScene(exterior); // charge l'extérieur (départ 0,0)
    useGame.getState().moveParty({ x: 3, y: 4 }); // sur la porte
    expect(useGame.getState().scene?.id).toBe('interieur-test');
  });

  it('incanter un Projectile magique résout l’incantation et consomme l’action', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Sorcier', name: 'Mage', rng: makeRNG(3) });
    hero.characteristics.Int = 90; // assurer le lancement (NI 0)
    hero.spells = ['Fléchette'];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'cast', selectedSpell: 'Fléchette', acted: false } });
    // Flux par modale : cliquer la cible OUVRE l'incantation (jet différé), n'applique rien.
    useGame.getState().battleClickEntity(enemy.id);
    expect(useGame.getState().pendingCast).not.toBeNull();
    expect(useGame.getState().battle!.acted).toBe(false); // pas encore lancé
    useGame.getState().castRoll(); // « Lancer » : fige le jet
    expect(useGame.getState().pendingCast!.result).not.toBeNull();
    useGame.getState().castConfirm(); // « Appliquer » : résout
    st = useGame.getState();
    // L'action est consommée, l'incantation journalisée, et la modale fermée.
    expect(st.battle!.acted).toBe(true);
    expect(st.battle!.action).toBeNull();
    expect(st.battle!.log.some((l) => l.includes('Fléchette'))).toBe(true);
    expect(st.pendingCast).toBeNull();
  });

  it('une Bénédiction de bonus pose un effet actif temporisé sur la cible', () => {
    const pretre = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Prêtre', name: 'Prêtre', rng: makeRNG(8) });
    pretre.characteristics.Soc = 95; // assurer la réussite de la Prière
    pretre.spells = ['Bénédiction de Bataille'];
    useGame.setState({ party: [pretre] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'cast', selectedSpell: 'Bénédiction de Bataille', acted: false } });
    useGame.getState().battleClickEntity(heroC.id); // se cibler soi-même → ouvre la modale
    useGame.getState().castRoll(); // « Lancer »
    useGame.getState().castConfirm(); // « Appliquer »
    st = useGame.getState();
    const after = st.battle!.combatants.find((c) => c.id === heroC.id)!;
    const failed = st.battle!.log.some((l) => l.includes('échoue'));
    if (!failed) {
      expect(after.activeEffects?.some((e) => e.char === 'CC' && e.bonus === 10)).toBe(true);
    }
    expect(st.battle!.acted).toBe(true);
  });

  it('porte → intérieur → retour (transitionBack) : aller-retour complet', () => {
    const interior = makeInteriorScene({ id: 'int-test', nom: 'Intérieur test', w: 6, h: 6 });
    const exterior = emptyScene(8, 8);
    exterior.id = 'ext-test';
    exterior.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    const chapel: BuildingFeature = {
      id: 'chap',
      type: 'chapelle',
      foot: { x: 2, y: 2, w: 3, h: 3 },
      reveal: 'door',
      facing: 'S',
      door: { x: 3, y: 4 },
      interiorScene: 'int-test',
    };
    exterior.buildings = [chapel];
    useGame.getState().startScene(interior); // enregistre l'intérieur
    useGame.getState().startScene(exterior); // charge l'extérieur
    // on se place SOUS la porte puis on entre (pour mémoriser un retour hors du bâtiment)
    useGame.setState({ partyPos: { x: 3, y: 5 } });
    useGame.getState().moveParty({ x: 3, y: 4 }); // sur la porte → intérieur
    expect(useGame.getState().scene?.id).toBe('int-test');
    // sortie : la porte de l'intérieur est en bas-centre (3,5) ; y marcher → retour
    useGame.getState().moveParty({ x: 3, y: 5 });
    expect(useGame.getState().scene?.id).toBe('ext-test');
    expect(useGame.getState().partyPos).toEqual({ x: 3, y: 5 }); // retour à la case d'entrée
  });

  it('une attaque de héros adjacent retire des Blessures', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.characteristics.CC = 70; // CC élevée + seed fixe → touche déterministe
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2); // RNG de combat contrôlé : seed 2 ⇒ touche avec dégâts (cf. recherche)
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    // Forcer l'adjacence et le tour du héros.
    heroC.pos = { x: enemy.pos!.x - 1, y: enemy.pos!.y };
    const order = st.battle!.order;
    const turn = order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'attack', moved: true, acted: false } });
    const before = enemy.wounds.current;
    useGame.getState().battleClickEntity(enemy.id); // ouvre la modale d'attaque
    useGame.getState().attackRoll(); // lance le jet
    useGame.getState().attackConfirm(); // applique le résultat
    st = useGame.getState();
    const enemyAfter = st.battle!.combatants.find((c) => c.id === enemy.id)!;
    expect(enemyAfter.wounds.current).toBeLessThan(before);
  });

  it('un test de compétence hors combat : Lancer, Chance, puis acquittement', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 2;
    useGame.setState({
      party: [hero],
      flags: {},
      pendingTest: {
        actorId: hero.id,
        actorName: hero.name,
        label: 'Test de Force',
        skillValue: 95,
        difficulty: 'intermediaire',
        requireSL: 0,
        target: 95,
        roll: null, // pas encore lancé
        success: false,
        sl: 0,
        onSuccess: [{ type: 'setFlag', flag: 'reussi', value: true }],
        onFailure: [],
      },
    });
    // Acquittement bloqué tant que le jet n'a pas eu lieu.
    useGame.getState().resolveTest();
    expect(useGame.getState().pendingTest).not.toBeNull();
    // « Lancer » : le jet se fait.
    useGame.getState().testRoll();
    expect(useGame.getState().pendingTest!.roll).not.toBeNull();
    // Forcer un jet propre RATÉ (cible 95) pour exercer la relance (gate « jet raté », LDB ch.12 l.29-31).
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 99, success: false } });
    // Chance : relance et consomme un point.
    useGame.getState().testReroll();
    expect(useGame.getState().party[0].fortune).toBe(1);
    expect(useGame.getState().pendingTest!.roll).not.toBeNull();
    // Acquittement : ferme la modale.
    useGame.getState().resolveTest();
    expect(useGame.getState().pendingTest).toBeNull();
  });

  it('attaquer une cible Sonnée en mêlée donne +1 Avantage à l’attaquant (LDB États l.123)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    enemy.conditions.push({ name: 'Sonné', value: 1 });
    heroC.advantage = 0;
    heroC.pos = { x: enemy.pos!.x - 1, y: enemy.pos!.y }; // adjacent
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'attack', moved: true, acted: false } });
    useGame.getState().battleClickEntity(enemy.id); // ouvre la modale
    useGame.getState().attackRoll(); // le +1 Sonné s'applique AVANT le jet
    st = useGame.getState();
    const heroAfter = st.battle!.combatants.find((c) => c.id === heroC.id)!;
    expect(heroAfter.advantage).toBe(1);
  });

  it('défense réactive : Défendre → résultat ; Chance relance la défense (attaque FIGÉE) ; Appliquer ferme', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(4);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.fortune = 2;
    useGame.setState({
      pendingDefense: {
        attackerId: E.id,
        defenderId: H.id,
        weapon: E.weapons[0],
        location: null,
        atk: { roll: 35, target: 50, success: true, sl: 1, isDouble: false },
        mode: 'parade',
        def: null,
        result: null,
      },
    });
    useGame.getState().defenseRoll(); // « Défendre » : roule la défense + résout
    let pd = useGame.getState().pendingDefense!;
    expect(pd.result).not.toBeNull();
    expect(pd.def).not.toBeNull();
    // Forcer une défense propre RATÉE pour exercer la relance (gate « jet raté », LDB ch.12 l.29-31).
    useGame.setState({ pendingDefense: { ...pd, def: { ...pd.def!, success: false } } });
    const atkRoll = pd.atk.roll;
    useGame.getState().defenseReroll(); // Chance : relance la DÉFENSE
    pd = useGame.getState().pendingDefense!;
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1); // 1 point dépensé
    expect(pd.atk.roll).toBe(atkRoll); // l'attaque (pd.atk) n'est JAMAIS relancée
    useGame.getState().defenseConfirm(); // Appliquer → ferme
    expect(useGame.getState().pendingDefense).toBeNull();
  });

  it('un ennemi qui attaque un héros en mêlée OUVRE la modale de défense (tour de l’IA suspendu)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(5);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers(); // purge le timer d'IA armé par startCombat → on pilote nous-mêmes l'ordre du tour
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y }; // adjacent au héros
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.wounds.current = 0; // un seul ennemi vivant
    useGame.setState({
      battle: { ...st.battle!, order: [H.id, E.id], turn: 0, action: null, moved: false, acted: false },
      pendingDefense: null,
    });
    useGame.getState().battleEndTurn(); // H finit son tour → advanceTurn → E actif → IA
    vi.advanceTimersByTime(2000); // laisse tourner les setTimeout de l'IA (450 + 350)
    st = useGame.getState();
    expect(st.pendingDefense).not.toBeNull();
    expect(st.pendingDefense!.defenderId).toBe(H.id);
    expect(st.pendingDefense!.result).toBeNull(); // figé sur le choix, pas encore défendu
    expect(st.battle!.order[st.battle!.turn]).toBe(E.id); // tour SUSPENDU sur l'attaquant (non avancé)
  });

  it('Sonné : un héros actif ne peut PAS attaquer/incanter, mais peut se déplacer (LDB États l.123)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    H.conditions.push({ name: 'Sonné', value: 1 });
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, moved: false, acted: false } });
    useGame.getState().battleSelectAction('attack');
    expect(useGame.getState().battle!.action).toBeNull(); // Action refusée (Sonné)
    useGame.getState().battleSelectAction('move'); // le déplacement reste permis
    expect(useGame.getState().battle!.action).toBe('move');
  });

  it('Sonné : un ennemi renonce à son Action — pas d’attaque, pas de modale de défense', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(5);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers(); // purge le timer d'IA armé par startCombat → on pilote nous-mêmes l'ordre du tour
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y }; // adjacent
    E.conditions.push({ name: 'Sonné', value: 1 }); // l'ennemi est Sonné
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.wounds.current = 0;
    const woundsBefore = H.wounds.current;
    useGame.setState({
      battle: { ...st.battle!, order: [H.id, E.id], turn: 0, action: null, moved: false, acted: false },
      pendingDefense: null,
    });
    useGame.getState().battleEndTurn(); // H finit → E actif → IA : Sonné → renonce
    vi.advanceTimersByTime(2000);
    st = useGame.getState();
    expect(st.pendingDefense).toBeNull(); // aucune attaque → aucune modale de défense
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(woundsBefore); // héros intact
  });

  // ── Couche tactique : Engagé + Charge + Désengagement (LDB 13-Combat / 15-Déplacement) ──
  const mh = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  it('Engagé : une attaque de mêlée pose le lien des deux côtés (LDB 13-Combat l.174-175)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.characteristics.CC = 70;
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: E.pos!.x - 1, y: E.pos!.y };
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'attack', moved: true, acted: false } });
    useGame.getState().battleClickEntity(E.id);
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E.id);
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.engagedWith).toContain(H.id);
  });

  it('Charge : se ruer au contact depuis 2 cases donne +2 Avantage et impose l’attaque (LDB 15-Dépl l.74-77)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(7);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 6, y: 10 };
    H.advantage = 0;
    E.pos = { x: 8, y: 10 }; // 2 cases à l'est, couloir libre
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.wounds.current = 0;
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, moved: false, acted: false } });
    useGame.getState().battleSelectAction('charge');
    useGame.getState().battleClickEntity(E.id);
    st = useGame.getState();
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ha.advantage).toBe(2); // chargé de 2 cases (M4, seuil 2) → +2
    expect(mh(Ha.pos!, E.pos!)).toBe(1); // arrivé au contact
    expect(st.pendingAttack?.fromCharge).toBe(true);
    expect(st.battle!.action).toBe('attack'); // l'attaque doit suivre (l.75)
  });

  it('Charge interdite si déjà Engagé (LDB 15-Dépl l.74)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 6, y: 10 };
    H.advantage = 0;
    H.engagedWith = [E.id];
    E.pos = { x: 8, y: 10 };
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, moved: false, acted: false } });
    useGame.getState().battleSelectAction('charge');
    useGame.getState().battleClickEntity(E.id);
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0); // pas de charge
    expect(st.pendingAttack).toBeNull();
  });

  it('attackCancel est sans effet après une Charge (attaque obligatoire, LDB 15-Dépl l.75)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    useGame.setState({ pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: null, fromCharge: true } });
    useGame.getState().attackCancel();
    expect(useGame.getState().pendingAttack).not.toBeNull(); // toujours là (charge)
  });

  it('Désengagement A : Avantage supérieur → partir en le sacrifiant, sans consommer l’Action (LDB 15-Dépl l.87)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(3);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    H.advantage = 2;
    E.advantage = 0;
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, moved: false, acted: false } });
    useGame.getState().battleDisengage(); // ouvre le menu de choix
    expect(useGame.getState().pendingDisengage!.phase).toBe('choice');
    expect(useGame.getState().pendingDisengage!.canSacrifice).toBe(true); // Avantage supérieur → option dispo
    useGame.getState().disengageConfirmA(); // « Sacrifier l'Avantage »
    st = useGame.getState();
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ha.advantage).toBe(0); // Avantage sacrifié (l.87)
    expect(Ha.engagedWith).toEqual([]); // libéré de tous
    expect(st.battle!.acted).toBe(false); // « Sacrifier » NE consomme PAS l'Action
    expect(st.battle!.action).toBe('move'); // mouvement libre rouvert
    expect(st.pendingDisengage).toBeNull();
  });

  it('Désengagement B échec : l’adversaire gagne +1 Avantage, fuite impossible, Action consommée (LDB 15-Dépl l.89)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, moved: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 30, target: 40, success: true, sl: 1, isDouble: false },
        def: { roll: 80, target: 40, success: false, sl: -4, isDouble: false },
        result: 'failure',
      },
    });
    useGame.getState().disengageConfirm();
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(1); // adversaire +1 (l.89)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E.id); // toujours Engagé
    expect(st.battle!.acted).toBe(true); // l'Esquive consomme l'Action
    expect(st.pendingDisengage).toBeNull();
  });

  it('Désengagement B succès : +1 Avantage, libéré, Mouvement rouvert, Action consommée (LDB 15-Dépl l.89)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(3);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    H.advantage = 0;
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, moved: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 70, target: 40, success: false, sl: -3, isDouble: false },
        def: { roll: 10, target: 40, success: true, sl: 3, isDouble: false },
        result: 'success',
      },
    });
    useGame.getState().disengageConfirm();
    st = useGame.getState();
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ha.advantage).toBe(1); // +1 Avantage (l.89)
    expect(Ha.engagedWith).not.toContain(E.id); // libéré du foe testé
    expect(st.battle!.acted).toBe(true); // Action consommée
    expect(st.battle!.action).toBe('move'); // Mouvement rouvert
  });

  it('Désengagement B : la Chance relance l’Esquive (le jet du foe reste figé)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(4);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.fortune = 2;
    useGame.setState({
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 35, target: 45, success: true, sl: 1, isDouble: false },
        def: { roll: 90, target: 40, success: false, sl: -5, isDouble: false },
        result: 'failure',
      },
    });
    useGame.getState().disengageReroll();
    const stx = useGame.getState();
    expect(stx.battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1); // 1 point dépensé
    expect(stx.pendingDisengage!.atk!.roll).toBe(35); // jet du foe NON relancé
  });

  it('Engagé : sélectionner « Déplacer » entre dans le Désengagement (LDB 15-Dépl l.84)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(6);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    H.advantage = 0;
    E.advantage = 1; // force l'option B (Avantage non supérieur)
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, moved: false, acted: false } });
    useGame.getState().battleSelectAction('move');
    st = useGame.getState();
    expect(st.pendingDisengage).not.toBeNull(); // routé vers le Désengagement
    expect(st.pendingDisengage!.phase).toBe('choice'); // « Déplacer » Engagé ouvre le menu de désengagement
  });

  it('Désengagement B égalité parfaite : statu quo — ni fuite, ni Avantage à l’adversaire', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, moved: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 40, target: 40, success: true, sl: 0, isDouble: false },
        def: { roll: 40, target: 40, success: true, sl: 0, isDouble: false },
        result: 'tie',
      },
    });
    useGame.getState().disengageConfirm();
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // statu quo : pas de +1 à l'adversaire
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E.id); // reste Engagé
    expect(st.battle!.acted).toBe(true); // l'Esquive tentée consomme l'Action
  });

  it('Désengagement B succès en multi-engagement : libère TOUS les adversaires (cohérent avec A)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(3);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemies = st.battle!.combatants.filter((c) => c.kind === 'enemy');
    const [E1, E2] = enemies;
    H.engagedWith = [E1.id, E2.id];
    E1.engagedWith = [H.id];
    E2.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, moved: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E1.id, // testé contre E1
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 70, target: 40, success: false, sl: -3, isDouble: false },
        def: { roll: 10, target: 40, success: true, sl: 3, isDouble: false },
        result: 'success',
      },
    });
    useGame.getState().disengageConfirm();
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toEqual([]); // libéré de E1 ET E2
  });

  it('Désengagement raté (Action consommée) : re-cliquer « Déplacer » ne relance PAS l’Esquive (anti-boucle)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    // État après une tentative d'Esquive RATÉE : Action consommée (acted), héros toujours Engagé.
    useGame.setState({ battle: { ...st.battle!, turn, action: null, moved: false, acted: true }, pendingDisengage: null });
    useGame.getState().battleSelectAction('move'); // re-clic « Déplacer »
    st = useGame.getState();
    expect(st.pendingDisengage).toBeNull(); // pas de NOUVELLE Esquive (l'Action est déjà dépensée)
    expect(st.battle!.action).toBeNull(); // ni déplacement libre
  });

  it('Désengagement — Fuir : adversaire +1 Avantage + attaque dans le dos, puis libéré et peut courir (LDB 15-Dépl l.98-109)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(5);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const eAdvBefore = E.advantage;
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, moved: false, acted: false },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    useGame.getState().disengageFlee();
    st = useGame.getState();
    const Ea = st.battle!.combatants.find((c) => c.id === E.id)!;
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ea.advantage).toBeGreaterThanOrEqual(eAdvBefore + 1); // +1 immédiat (l.101), +1 de plus si touché
    expect(Ha.engagedWith).toEqual([]); // libéré de tous les Engagements
    expect(st.battle!.action).toBe('move'); // peut courir (Mouvement de Course)
    expect(st.pendingDisengage).toBeNull();
  });

  it('attaque en DIAGONALE : un ennemi diagonalement adjacent est à portée de mêlée (distance Chebyshev)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.characteristics.CC = 70;
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: E.pos!.x - 1, y: E.pos!.y - 1 }; // DIAGONALE : Chebyshev 1, mais manhattan 2
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'attack', moved: true, acted: false } });
    useGame.getState().battleClickEntity(E.id); // doit ouvrir la modale (avant : « hors de portée »)
    st = useGame.getState();
    expect(st.pendingAttack).not.toBeNull(); // attaque en diagonale autorisée
    expect(st.pendingAttack!.targetId).toBe(E.id);
  });
});

describe('Avancement par PX (store) — câblage moteur', () => {
  beforeEach(() => reset());

  const mkHero = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'h',
      name: 'H',
      kind: 'hero',
      species: 'Humains (Reiklander)',
      career: 'Agitateur', // Niveau 1 « Pamphlétaire » : caracs CT/Int/Soc, comp. Charme/Ragot, talent Sociable
      careerLevel: 1,
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 12, max: 12 },
      advantage: 0,
      conditions: [],
      weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [
        { name: 'Charme', characteristic: 'Soc', advances: 0 }, // in-carrière
        { name: 'Esquive', characteristic: 'Ag', advances: 0 }, // hors-carrière
      ],
      talents: [],
      movement: 4,
      xp: 0,
      charAdvances: {},
      ...over,
    }) as unknown as Combatant;

  const set1 = (h: Combatant) => useGame.setState({ party: [h] });
  const h0 = () => useGame.getState().party[0];

  it('grantXp : ajoute des PX au héros', () => {
    set1(mkHero({ xp: 0 }));
    useGame.getState().grantXp('h', 150);
    expect(h0().xp).toBe(150);
  });

  it('buyCharAdvance in-carrière (CT) : +1 valeur, +1 augmentation, coût 25', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buyCharAdvance('h', 'CT');
    expect(h0().characteristics.CT).toBe(31);
    expect(h0().charAdvances!.CT).toBe(1);
    expect(h0().xp).toBe(975);
  });

  it('buyCharAdvance hors-carrière (CC) : coût doublé (50)', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buyCharAdvance('h', 'CC');
    expect(h0().xp).toBe(950);
  });

  it('buyCharAdvance recalcule les Blessures quand le Bonus d’Endurance monte', () => {
    set1(
      mkHero({
        xp: 1000,
        characteristics: { CC: 30, CT: 30, F: 30, E: 39, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
        wounds: { current: 12, max: 12 },
      }),
    );
    useGame.getState().buyCharAdvance('h', 'E'); // 39→40 : BE 3→4, Blessures = BF + 2·BE + BFM = 3 + 8 + 3 = 14
    expect(h0().characteristics.E).toBe(40);
    expect(h0().wounds.max).toBe(14);
    expect(h0().wounds.current).toBe(14);
  });

  it('buySkillAdvance : Compétence connue in-carrière (Charme) +1, coût 10', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buySkillAdvance('h', 'Charme');
    expect(h0().skills.find((s) => s.name === 'Charme')!.advances).toBe(1);
    expect(h0().xp).toBe(990);
  });

  it('buySkillAdvance : acquiert une Compétence de carrière non connue (Ragot) à advances 1', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buySkillAdvance('h', 'Ragot');
    const ragot = h0().skills.find((s) => s.name === 'Ragot');
    expect(ragot).toBeTruthy();
    expect(ragot!.advances).toBe(1);
    expect(h0().xp).toBe(990);
  });

  it('buySkillAdvance : refuse une Compétence hors-carrière non connue', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buySkillAdvance('h', 'Natation'); // ni connue, ni in-carrière
    expect(h0().skills.find((s) => s.name === 'Natation')).toBeUndefined();
    expect(h0().xp).toBe(1000);
  });

  it('buyTalent in-carrière (Sociable) : créé à times 1, coût 100', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buyTalent('h', 'Sociable');
    expect(h0().talents.find((t) => t.name === 'Sociable')!.times).toBe(1);
    expect(h0().xp).toBe(900);
  });

  it('buyTalent hors-carrière : refusé (LDB l.97)', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buyTalent('h', 'Castagneur'); // hors Niveau Agitateur
    expect(h0().talents.find((t) => t.name === 'Castagneur')).toBeUndefined();
    expect(h0().xp).toBe(1000);
  });

  it('changeCareer : change carrière + niveau et déduit 200 (niveau non complété)', () => {
    set1(mkHero({ xp: 250 }));
    useGame.getState().changeCareer('h', 'Érudit', 1);
    expect(h0().career).toBe('Érudit');
    expect(h0().careerLevel).toBe(1);
    expect(h0().xp).toBe(50);
  });

  it('Effet giveXp : octroie les PX à TOUT le groupe (via trigger)', () => {
    const a = mkHero({ id: 'a', xp: 0 });
    const b = mkHero({ id: 'b', xp: 50 });
    const scene = emptyScene(6, 6);
    scene.id = 'xp-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.triggers.push({ id: 't-xp', rect: { x: 2, y: 0, w: 1, h: 1 }, once: true, effects: [{ type: 'giveXp', amount: 100 }] });
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene);
    useGame.getState().moveParty({ x: 2, y: 0 }); // entre dans la zone du trigger
    const st = useGame.getState();
    expect(st.party.find((h) => h.id === 'a')!.xp).toBe(100);
    expect(st.party.find((h) => h.id === 'b')!.xp).toBe(150);
  });
});

describe('Fouille / butin par objet cherchable (store)', () => {
  beforeEach(() => reset());

  const looter = (): Combatant => ({ id: 'a', name: 'A', xp: 0 }) as unknown as Combatant;

  it('fouiller un objet à Effets applique les Effets, laisse le corps en place, et ne se refait pas', () => {
    const scene = emptyScene(6, 6);
    scene.id = 'fouille-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'cadavre',
      kind: 'objet',
      pos: { x: 1, y: 0 },
      label: 'Cadavre du cocher',
      search: [
        { type: 'giveMoney', gold: 2 },
        { type: 'giveXp', amount: 10 },
      ],
    });
    useGame.setState({ party: [looter()] });
    useGame.getState().startScene(scene);
    useGame.setState({ partyPos: { x: 0, y: 0 }, money: { gold: 0, silver: 0, brass: 0 } });

    useGame.getState().interactEntity('cadavre');
    let st = useGame.getState();
    expect(st.money.gold).toBe(2);
    expect(st.party[0].xp).toBe(10);
    expect(st.scene!.entities.find((e) => e.id === 'cadavre')).toBeTruthy(); // le corps RESTE

    // Re-fouille : aucun double octroi
    useGame.getState().interactEntity('cadavre');
    st = useGame.getState();
    expect(st.money.gold).toBe(2);
    expect(st.party[0].xp).toBe(10);
  });

  it('objet legacy à `loot` (noms) : ramassage dans l’inventaire + disparition (compat conservée)', () => {
    const scene = emptyScene(6, 6);
    scene.id = 'loot-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({ id: 'coffre', kind: 'objet', pos: { x: 1, y: 0 }, label: 'Coffre', loot: ['Fiole', 'Lettre'] });
    useGame.setState({ party: [looter()] });
    useGame.getState().startScene(scene);
    useGame.setState({ partyPos: { x: 0, y: 0 } });

    useGame.getState().interactEntity('coffre');
    const st = useGame.getState();
    expect(st.inventory).toEqual(expect.arrayContaining(['Fiole', 'Lettre']));
    expect(st.scene!.entities.find((e) => e.id === 'coffre')).toBeUndefined(); // ramassé → disparaît
  });

  it('Effet giveTrapping : crée un VRAI objet à stats sur le héros (non équipé, depuis trappings.json)', () => {
    const heroWithBag = (): Combatant =>
      ({
        id: 'a',
        name: 'A',
        kind: 'hero',
        characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
        wounds: { current: 12, max: 12 },
        advantage: 0,
        conditions: [],
        weapons: [],
        armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
        items: [],
        skills: [],
        talents: [],
        movement: 4,
      }) as unknown as Combatant;
    const scene = emptyScene(6, 6);
    scene.id = 'gt-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'cadavre',
      kind: 'objet',
      pos: { x: 1, y: 0 },
      label: 'Cadavre du cocher',
      search: [{ type: 'giveTrapping', trapping: 'Dague' }],
    });
    useGame.setState({ party: [heroWithBag()] });
    useGame.getState().startScene(scene);
    useGame.setState({ partyPos: { x: 0, y: 0 } });

    useGame.getState().interactEntity('cadavre');
    const hero = useGame.getState().party[0];
    const dague = (hero.items ?? []).find((i) => i.name === 'Dague');
    expect(dague).toBeTruthy();
    expect(dague!.kind).toBe('melee'); // objet à stats, pas un simple nom
    expect(dague!.equipped).toBe(false); // ramassé, à équiper soi-même
  });
});

describe('Utiliser un consommable en combat (store)', () => {
  beforeEach(() => reset());

  const combatHero = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'h',
      name: 'H',
      kind: 'hero',
      characteristics: { CC: 30, CT: 30, F: 30, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, // BE = 3
      wounds: { current: 5, max: 12 },
      advantage: 0,
      conditions: [],
      weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      items: [],
      skills: [],
      talents: [],
      movement: 4,
      ...over,
    }) as unknown as Combatant;

  const potion = (uid: string, name: string, desc: string) =>
    ({ uid, name, kind: 'misc', qualities: [], enc: 0, equipped: false, desc }) as ItemInstance;

  const mkBattle = (h: Combatant, over = {}): BattleState => ({
    combatants: [h],
    order: [h.id],
    turn: 0,
    round: 1,
    action: 'use',
    selectedSpell: null,
    reachable: new Map(),
    moved: false,
    acted: false,
    log: [],
    over: null,
    ...over,
  });

  it('Potion de guérison : soigne du Bonus d’Endurance, consomme l’objet, coûte l’Action', () => {
    const h = combatHero({
      wounds: { current: 5, max: 12 },
      items: [potion('p1', 'Potion de guérison', "récupérez immédiatement un nombre de Points de Blessure égal à votre Bonus d'Endurance.")],
    });
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleUseItem('p1');
    const b = useGame.getState().battle!;
    expect(b.combatants[0].wounds.current).toBe(8); // 5 + BE(35) = 8
    expect(b.combatants[0].items!.find((i) => i.uid === 'p1')).toBeUndefined();
    expect(b.acted).toBe(true);
  });

  it('Potion de vitalité : retire l’État Exténué (toutes les piles)', () => {
    const h = combatHero({
      conditions: [{ name: 'Exténué', value: 2 }],
      items: [potion('p2', 'Potion de vitalité', 'Boire cette décoction retire instantanément tout État Exténué.')],
    });
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleUseItem('p2');
    const b = useGame.getState().battle!;
    expect(b.combatants[0].conditions.find((c) => c.name === 'Exténué')).toBeUndefined();
    expect(b.acted).toBe(true);
  });

  it('Action déjà consommée : aucune utilisation (objet conservé)', () => {
    const h = combatHero({
      wounds: { current: 5, max: 12 },
      items: [potion('p3', 'Potion de guérison', "récupérez un nombre de Points de Blessure égal à votre Bonus d'Endurance.")],
    });
    useGame.setState({ mode: 'battle', battle: mkBattle(h, { acted: true }) });
    useGame.getState().battleUseItem('p3');
    const b = useGame.getState().battle!;
    expect(b.combatants[0].wounds.current).toBe(5); // inchangé
    expect(b.combatants[0].items!.find((i) => i.uid === 'p3')).toBeTruthy(); // pas consommé
  });
});

describe('Chance : relance 1×/Test et seulement sur jet propre raté (LDB ch.12 l.56 + l.29-31)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    reset();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('testReroll : refusée si le d100 propre est réussi (roll ≤ cible)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 2;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 0, target: 50, roll: 20, success: true, sl: 3, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testReroll();
    expect(useGame.getState().party[0].fortune).toBe(2); // rien dépensé (jet réussi)
    expect(useGame.getState().pendingTest!.roll).toBe(20); // jet inchangé
  });

  it('testReroll : autorisée une seule fois sur un jet raté', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 2;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 5, difficulty: 'intermediaire',
        requireSL: 0, target: 5, roll: 95, success: false, sl: -9, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testReroll(); // 1re relance OK (jet raté)
    expect(useGame.getState().party[0].fortune).toBe(1);
    expect(useGame.getState().pendingTest!.rerolled).toBe(true);
    useGame.getState().testReroll(); // 2e relance refusée (déjà relancé)
    expect(useGame.getState().party[0].fortune).toBe(1); // pas de 2e dépense
  });

  it('testBonusSL : +1 DR fait passer un Test à requireSL, et est cumulable', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 3;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 2, target: 50, roll: 45, success: false, sl: 0, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testBonusSL(); // DR 0 → 1 (< 2)
    expect(useGame.getState().party[0].fortune).toBe(2);
    expect(useGame.getState().pendingTest!.success).toBe(false);
    useGame.getState().testBonusSL(); // DR 1 → 2 (≥ requireSL 2) → succès
    expect(useGame.getState().party[0].fortune).toBe(1);
    expect(useGame.getState().pendingTest!.sl).toBe(2);
    expect(useGame.getState().pendingTest!.success).toBe(true);
  });
});

describe('Détermination (Resolve) — retirer un État (LDB ch.17 l.62-66)', () => {
  beforeEach(() => reset());

  const mkBattle = (h: Combatant, over = {}): BattleState => ({
    combatants: [h], order: [h.id], turn: 0, round: 1, action: null, selectedSpell: null,
    reachable: new Map(), moved: false, acted: false, log: [], over: null, ...over,
  });

  it('retire un État, ne consomme pas l’Action, décrémente la Détermination', () => {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    h.resolve = 2;
    h.conditions = [{ name: 'Aveuglé', value: 1 }];
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleSpendResolve('Aveuglé');
    const b = useGame.getState().battle!;
    expect(b.combatants[0].conditions.find((c) => c.name === 'Aveuglé')).toBeUndefined();
    expect(b.combatants[0].resolve).toBe(1);
    expect(b.acted).toBe(false); // ne coûte pas l'Action
  });

  it('retirer À Terre fait regagner 1 PB (l.66)', () => {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    h.resolve = 1;
    h.conditions = [{ name: 'À Terre', value: 1 }];
    h.wounds = { current: 5, max: 12 };
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleSpendResolve('À Terre');
    const c0 = useGame.getState().battle!.combatants[0];
    expect(c0.conditions.find((c) => c.name === 'À Terre')).toBeUndefined();
    expect(c0.wounds.current).toBe(6); // +1 PB
  });

  it('sans Détermination : aucun effet', () => {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    h.resolve = 0;
    h.conditions = [{ name: 'Aveuglé', value: 1 }];
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleSpendResolve('Aveuglé');
    expect(useGame.getState().battle!.combatants[0].conditions.find((c) => c.name === 'Aveuglé')).toBeTruthy();
  });
});

describe('Ramasser un objet au sol en combat (un à la fois, LDB ch.13 l.115-116)', () => {
  beforeEach(() => reset());

  function setup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.items = hero.items ?? [];
    hero.pos = { x: 0, y: 0 };
    const scene = emptyScene(8, 8);
    scene.id = 'pickup-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'corps', kind: 'objet', pos: { x: 1, y: 0 }, label: 'Cocher',
      search: [
        { type: 'journal', text: 'Son tromblon repose à côté.' }, // index 0
        { type: 'giveTrapping', trapping: 'Dague' }, // index 1
        { type: 'giveTrapping', trapping: 'Tromblon' }, // index 2
      ],
    });
    const bh: Combatant = JSON.parse(JSON.stringify(hero));
    const battle: BattleState = {
      combatants: [bh], order: [bh.id], turn: 0, round: 1, action: 'pickup', selectedSpell: null,
      reachable: new Map(), moved: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [hero], scene, mode: 'battle', battle, flags: {}, inventory: [] });
    return bh;
  }

  it('ramasse UN objet : il arrive dans l’inventaire (battle + party), consomme l’Action, retire du pool', () => {
    const bh = setup();
    useGame.getState().battlePickup('corps', 'trap:2'); // index 2 = Tromblon
    const st = useGame.getState();
    const bH = st.battle!.combatants.find((c) => c.id === bh.id)!;
    expect((bH.items ?? []).some((i) => i.name === 'Tromblon')).toBe(true); // utilisable ce combat
    expect((st.party[0].items ?? []).some((i) => i.name === 'Tromblon')).toBe(true); // persiste
    expect((bH.items ?? []).filter((i) => i.name === 'Tromblon').length).toBe(1); // un SEUL objet ramassé
    expect(st.battle!.acted).toBe(true); // coûte l'Action
    const corps = st.scene!.entities.find((e) => e.id === 'corps')!;
    expect((corps.search ?? []).some((e) => e.type === 'giveTrapping' && e.trapping === 'Tromblon')).toBe(false);
    expect((corps.search ?? []).some((e) => e.type === 'giveTrapping' && e.trapping === 'Dague')).toBe(true);
  });

  it('refusé si l’Action est déjà consommée', () => {
    const bh = setup();
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    useGame.getState().battlePickup('corps', 'trap:2');
    const bH = useGame.getState().battle!.combatants.find((c) => c.id === bh.id)!;
    expect((bH.items ?? []).some((i) => i.name === 'Tromblon')).toBe(false);
  });
});

describe('Chance — 3e usage : pré-emption d’initiative en début de Round (LDB ch.17 l.27)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    reset();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function endOfRoundBattle(heroFortune: number) {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(3) });
    H.fortune = heroFortune;
    H.pos = { x: 0, y: 0 };
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0';
    E.name = 'Gobelin';
    E.kind = 'enemy';
    E.fortune = 0;
    E.pos = { x: 5, y: 5 };
    const battle: BattleState = {
      combatants: [H, E], order: [E.id, H.id], turn: 1, round: 1, action: null, selectedSpell: null,
      reachable: new Map(), moved: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8) });
    return { H, E };
  }

  it('fin du dernier tour du Round : si un héros a de la Chance, on suspend (pendingRoundStart)', () => {
    endOfRoundBattle(1);
    useGame.getState().battleEndTurn(); // H (dernier de l'ordre) finit → bascule au Round 2
    const st = useGame.getState();
    expect(st.pendingRoundStart).not.toBeNull();
    expect(st.pendingRoundStart!.round).toBe(2);
    expect(st.battle!.round).toBe(2);
  });

  it('aucune Chance : pas de suspension', () => {
    endOfRoundBattle(0);
    useGame.getState().battleEndTurn();
    expect(useGame.getState().pendingRoundStart).toBeNull();
  });

  it('roundStartPromote place le héros en tête et dépense 1 Chance', () => {
    const { H } = endOfRoundBattle(2);
    useGame.getState().battleEndTurn();
    useGame.getState().roundStartPromote(H.id);
    const st = useGame.getState();
    expect(st.battle!.order[0]).toBe(H.id);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1);
  });

  it('confirmRoundStart ferme la modale et active le héros promu en premier', () => {
    const { H } = endOfRoundBattle(1);
    useGame.getState().battleEndTurn();
    useGame.getState().roundStartPromote(H.id);
    useGame.getState().confirmRoundStart();
    const st = useGame.getState();
    expect(st.pendingRoundStart).toBeNull();
    expect(st.battle!.order[st.battle!.turn]).toBe(H.id); // H agit en premier ce Round
  });
});

describe('Blessures critiques & mort en combat (LDB 18-Traumatisme)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function combat(heroOver: Partial<Combatant> = {}, enemyOver: Partial<Combatant> = {}) {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(3) });
    H.fortune = 0; // pas de pré-emption d'initiative dans ces tests
    Object.assign(H, heroOver);
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0'; E.name = 'Brigand'; E.kind = 'enemy'; E.fortune = 0; Object.assign(E, enemyOver);
    const battle: BattleState = {
      combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpell: null,
      reachable: new Map(), moved: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8) });
    return { H, E };
  }

  it('overkill sur un HÉROS → Blessure critique (compteur++), tombe à 0 PB', () => {
    const { H, E } = combat({ wounds: { current: 2, max: 12 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } });
    useGame.getState().seedRng(2);
    // L'IA (E) a frappé H en mêlée : jet d'attaque figé (réussi, fort DR) ; H « Subit ».
    useGame.setState({
      pendingDefense: { attackerId: E.id, defenderId: H.id, weapon: E.weapons[0], location: null,
        atk: { roll: 5, target: 80, success: true, sl: 7, isDouble: false }, mode: 'parade', def: null, result: null },
    });
    useGame.getState().defenseCancel(); // « Subir » → applyAttackResult (overkill car 2 PB < dégâts)
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.criticalWounds).toBe(1); // une Blessure critique encaissée
    expect(h.wounds.current).toBe(0); // tombé à 0 (ne passe jamais négatif)
  });

  it('héros Inconscient + 0 PB + critiques > BE → meurt en fin de Round (LDB 18 l.48-49)', () => {
    const { H, E } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4 }); // BE=3
    useGame.setState({ battle: { ...useGame.getState().battle!, order: [E.id, H.id], turn: 1 } }); // H dernier → battleEndTurn franchit le Round
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.dead).toBe(true);
    expect(isOutOfAction(h)).toBe(true);
  });
});
