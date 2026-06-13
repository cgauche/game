import { describe, it, expect } from 'vitest';
import { buildEncounter, buildEncounters } from './encounterAuthoring';

describe('buildEncounter — authoring terse → entités + members canoniques', () => {
  it("un ennemi devient une entité 'personnage' + un membre qui la référence (profil porté par l'entité)", () => {
    const { entities, encounter } = buildEncounter({
      id: 'enc-1',
      enemies: [{ ref: 'Mutant', pos: { x: 2, y: 3 }, weapon: 'Hache', optionals: ['Peur 1'], spells: ['Fléchette'], randomChars: true }],
    });
    expect(encounter.members![0].entityId).toBe('enemy-enc-1-0');
    const ent = entities[0];
    expect(ent.kind).toBe('personnage');
    expect(ent.pos).toEqual({ x: 2, y: 3 });
    expect(ent.ref).toBe('Mutant');
    expect(ent.weapon).toBe('Hache');
    // VISIBLE par défaut : pas de hiddenUntilCombat
    expect(ent.combat).toEqual({ optionals: ['Peur 1'], spells: ['Fléchette'], randomChars: true });
  });

  it("hidden (rencontre) → toutes les entités cachées jusqu'au combat (embuscade)", () => {
    const { entities } = buildEncounter({ id: 'amb', hidden: true, surprise: 'party', enemies: [{ ref: 'Gor', pos: { x: 1, y: 1 } }] });
    expect(entities[0].combat).toEqual({ hiddenUntilCombat: true });
  });

  it('hidden par ennemi surcharge le réglage de la rencontre', () => {
    const { entities } = buildEncounter({ id: 'mix', hidden: true, enemies: [
      { ref: 'Gor', pos: { x: 1, y: 1 } },
      { ref: 'Ungor', pos: { x: 2, y: 2 }, hidden: false },
    ] });
    expect(entities[0].combat?.hiddenUntilCombat).toBe(true);
    expect(entities[1].combat).toBeUndefined(); // visible, aucun autre champ combat
  });

  it('camp/monture préservés ; rides (index) → ridesEntityId (réf stable)', () => {
    const { encounter } = buildEncounter({ id: 'e', enemies: [
      { ref: 'Cheval', pos: { x: 0, y: 0 }, mount: true, side: 'ally' },
      { ref: 'Bandit', pos: { x: 0, y: 0 }, rides: 0 },
    ] });
    const [cheval, bandit] = encounter.members!;
    expect(cheval).toEqual({ entityId: 'enemy-e-0', side: 'ally', mount: true });
    expect(bandit).toEqual({ entityId: 'enemy-e-1', ridesEntityId: 'enemy-e-0' });
  });

  it('surprise + onVictory passent sur la rencontre', () => {
    const onV = [{ type: 'giveXp', amount: 10 } as const];
    const { encounter } = buildEncounter({ id: 'e', surprise: 'enemies', onVictory: [...onV], enemies: [{ ref: 'Orc', pos: { x: 1, y: 1 } }] });
    expect(encounter.surprise).toBe('enemies');
    expect(encounter.onVictory).toEqual(onV);
  });

  it('buildEncounters agrège entités et rencontres de plusieurs rencontres', () => {
    const { entities, encounters } = buildEncounters([
      { id: 'a', enemies: [{ ref: 'Gobelin', pos: { x: 1, y: 1 } }] },
      { id: 'b', enemies: [{ ref: 'Orc', pos: { x: 2, y: 2 } }, { ref: 'Orc', pos: { x: 3, y: 3 } }] },
    ]);
    expect(entities.map((e) => e.id)).toEqual(['enemy-a-0', 'enemy-b-0', 'enemy-b-1']);
    expect(encounters.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
