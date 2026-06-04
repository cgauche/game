import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';
import { emptyScene } from './scene';

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
  });
}

describe('Boucle de jeu (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reset();
  });

  it('charge une scène et place le groupe au départ', () => {
    useGame.getState().startScene(tome1Intro);
    const st = useGame.getState();
    expect(st.scene?.id).toBe('tome1-intro');
    expect(st.partyPos).toEqual({ x: 6, y: 10 });
    expect(st.mode).toBe('exploration');
  });

  it('un dialogue de PNJ s’ouvre et se parcourt', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    // Se placer à côté de Gustav (6,4) puis interagir.
    useGame.setState({ partyPos: { x: 6, y: 5 } });
    useGame.getState().interactEntity('gustav');
    expect(useGame.getState().dialogue?.dialogue.id).toBe('dlg-gustav');
    useGame.getState().chooseDialogue(0); // → g2
    expect(useGame.getState().dialogue?.nodeId).toBe('g2');
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
    useGame.getState().battleClickEntity(enemy.id);
    st = useGame.getState();
    const enemyAfter = st.battle!.combatants.find((c) => c.id === enemy.id)!;
    expect(enemyAfter.wounds.current).toBeLessThan(before);
  });
});
