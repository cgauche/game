import { describe, it, expect } from 'vitest';
import { classifyEnemy, enemyRigProfile, entityRigProfile } from './enemyProfile';
import { combatantOverlays } from './parts/combatantVisuals';
import { raceById } from './races';
import { bipedDef } from './creatures';
import { baseSpeciesOf } from './skeletons';
import type { Combatant, Weapon, ItemInstance, ArmourPoints } from '../../engine/types';

const noArmour: ArmourPoints = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

function mkEnemy(name: string, over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'e1',
    name,
    kind: 'enemy',
    characteristics: {} as Combatant['characteristics'],
    wounds: { current: 10, max: 10 },
    advantage: 0,
    conditions: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] } as Weapon],
    armour: { ...noArmour },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  } as Combatant;
}

describe('classifyEnemy (cosmétique : humanoïde peau-humaine → rig, sinon créature)', () => {
  it('humanoïdes à équiper → rig', () => {
    for (const n of [
      'Bandit', 'Cultiste', 'Mutant', "Soldat de l'Empire", 'Guerrier du Chaos',
      'Humain', 'Nain', 'Flagellant', 'Noble', 'Sorcier', 'Répurgateur', 'Mercenaire',
      'Garde de la ville', 'Voleur', 'Sectateur', 'Halfling', 'Ogre',
      // Phase B : skavens rapatriés dans le rig bipède (tête de rat + queue auto).
      'Guerrier des clans', 'Rat ogre', 'Vermine de choc',
      // Phase B : peaux-vertes, hommes-bêtes, morts-vivants humanoïdes, gros/démons → rig.
      'Orc', 'Gobelin', 'Snotling', 'Squelette', 'Zombie', 'Goule de crypte',
      'Gor', 'Ungor', 'Minotaure', 'Chamane-Brey',
      'Troll', 'Vampire', 'Sanguinaire de Khorne',
      'Liche', // mort-vivant humanoïde squelettique → rig bipède (jalon 3)
    ]) {
      expect(classifyEnemy(n), n).toBe('rig');
    }
  });
  it('bêtes / morts-vivants non humanoïdes / démons exotiques → créature', () => {
    for (const n of [
      'Rat géant', 'Dragon', 'Loup', 'Ours',
      'Araignée géante', 'Spectre', 'Bête des marais', 'Hydre',
    ]) {
      expect(classifyEnemy(n), n).toBe('creature');
    }
  });
});

describe('enemyRigProfile', () => {
  it('null pour une créature non-humanoïde', () => {
    expect(enemyRigProfile(mkEnemy('Rat géant'))).toBeNull();
  });

  it('non-null pour un humanoïde, et reprend les armes du combattant', () => {
    const c = mkEnemy('Bandit');
    const p = enemyRigProfile(c)!;
    expect(p).not.toBeNull();
    expect(p.equip.weapons).toBe(c.weapons);
  });

  it('déterministe : même id ⇒ même apparence', () => {
    const a = enemyRigProfile(mkEnemy('Bandit', { id: 'abc' }))!;
    const b = enemyRigProfile(mkEnemy('Bandit', { id: 'abc' }))!;
    expect(a.appearance).toEqual(b.appearance);
  });

  it('espèce détectée du nom', () => {
    expect(enemyRigProfile(mkEnemy('Nain mercenaire'))!.appearance.species).toBe('Nain');
    expect(enemyRigProfile(mkEnemy('Cultiste'))!.appearance.species).toBe('Humain');
    expect(enemyRigProfile(mkEnemy('Ogre brise-fer'))!.appearance.species).toBe('Ogre');
  });

  it('espèces monstrueuses Phase B détectées + tête monstrueuse portée par la Race', () => {
    // Depuis la migration race.monster → race.head/legs/features (iso-rendu), la tête
    // monstrueuse est portée par race.head (rendu via composeRig), plus par appearance.monster.
    const cases: [string, string, string | undefined][] = [
      ['Orc noir', 'Orc', 'orc'],
      ['Gobelin de la nuit', 'Gobelin', 'gobelin'],
      ['Snotling', 'Snotling', 'gobelin'],
      ['Gor sauvage', 'Gor', 'caprin'], // def dédié → race Homme-bête (tête caprine)
      ['Ungor fourrageur', 'Ungor', 'caprin'],
      ['Minotaure', 'Minotaure', 'taureau'],
      ['Squelette guerrier', 'Squelette', 'crane'],
      ['Zombie', 'Zombie', 'pourri'],
      ['Goule de crypte', 'Goule', 'goule'],
      ['Troll de pierre', 'Troll', 'troll'],
      ['Sanguinaire de Khorne', 'Démon', 'demon'],
      ['Vampire', 'Vampire', undefined], // humain pâle → pas de tête monstrueuse
    ];
    for (const [name, species, tete] of cases) {
      const p = enemyRigProfile(mkEnemy(name))!;
      expect(p.appearance.species, name).toBe(species);
      // Résolution de race du RENDU : le def peut imposer sa race (Gor → Homme-bête).
      const race = raceById(bipedDef(p.appearance.species)?.race ?? baseSpeciesOf(p.appearance.species));
      expect(race.head, name).toBe(tete);
    }
  });

  it('tenue DATA-DRIVEN : carrière explicite du combattant (plus d’inférence du nom)', () => {
    // La tenue vient de la DONNÉE — la carrière du combattant (alimentée par `appearance.tenue`
    // au spawn, cf. spawnEnemy), PAS d'une regex sur le nom (POC ROLE_CAREERS retiré, 47ec0b6).
    expect(enemyRigProfile(mkEnemy('Cultiste', { career: 'Flagellant' }))!.tenue).toBe('Flagellant');
    expect(enemyRigProfile(mkEnemy('Voyou', { career: 'Voleur' }))!.tenue).toBe('Voleur');
    // Sans donnée de tenue, un humanoïde quelconque retombe sur le défaut (Nu = corps nu) : le nom
    // « Flagellant » ne suffit plus à inférer la tenue.
    expect(enemyRigProfile(mkEnemy('Flagellant'))!.tenue).toBe('Nu');
  });

  it('armure synthétisée depuis les PA quand pas d’inventaire', () => {
    const c = mkEnemy('Soldat', { armour: { ...noArmour, corps: 4, tete: 2 } });
    const p = enemyRigProfile(c)!;
    const torse = p.equip.armour.find((i) => (i.locs ?? []).includes('corps'));
    expect(torse).toBeTruthy();
    expect(torse!.pa).toBe(4);
    expect(p.equip.armour.some((i) => (i.locs ?? []).includes('tete'))).toBe(true);
  });

  it('utilise l’inventaire du combattant s’il en a un', () => {
    const item: ItemInstance = {
      uid: 'a1', name: 'Brigandine', kind: 'armor', qualities: [], pa: 2,
      locs: ['corps'], enc: 1, equipped: true,
    };
    const c = mkEnemy('Bandit', { items: [item], armour: { ...noArmour, corps: 9 } });
    const p = enemyRigProfile(c)!;
    expect(p.equip.armour).toContain(item); // l'inventaire prime sur la synthèse
  });

  it('mutation visuelle = DONNÉE (c.mutations), plus jamais le nom (POC isMutant retiré)', () => {
    // enemyRigProfile ne fabrique plus AUCUN calque depuis le nom : un combattant nommé « Mutant »
    // SANS mutations dans sa donnée n'a pas de calque (le profil ne porte plus de champ overlays).
    expect(enemyRigProfile(mkEnemy('Mutant'))).not.toHaveProperty('overlays');
    // Le visuel de mutation vient des mutations RÉELLES du combattant (combatantOverlays), donnée pure :
    const mute = mkEnemy('Humain', { mutations: [{ label: 'Cornes asymétriques', kind: 'physique', roll: 81 }] });
    expect(combatantOverlays(mute).some((o) => o.svg.includes('data-mut="cornes-asymetriques"'))).toBe(true);
    // Sans mutation dans la donnée → aucun calque (Guerrier du Chaos tient son identité de sa RACE).
    expect(combatantOverlays(mkEnemy('Guerrier du Chaos')).length).toBe(0);
    expect(combatantOverlays(mkEnemy('Bandit')).length).toBe(0);
  });
});

describe('entityRigProfile (entité de scène, ambiance hors combat)', () => {
  it('humanoïde → profil sans équipement de combat (et plus d’overlays dérivés du nom)', () => {
    const p = entityRigProfile('Mutant', 42)!;
    expect(p).not.toBeNull();
    expect(p.equip.weapons).toEqual([]);
    // Le profil ne porte plus de calques dérivés du nom (POC isMutant retiré) : l'ambiance mutée
    // déclare ses parts dans sa donnée d'apparence (monster), pas via une regex.
    expect(p).not.toHaveProperty('overlays');
  });
  it('villageois → Humain ; tenue portée en DONNÉE (plus d’inférence du nom)', () => {
    const p = entityRigProfile('Villageois', 1)!;
    expect(p.appearance.species).toBe('Humain');
    expect(p.tenue).toBe('Nu'); // défaut neutre = corps nu ; la tenue ne se déduit plus du nom (POC retiré)
    // L'ambiance porte sa tenue via `appearance.tenue` (pickBackend → opts.tenue) — honorée telle quelle.
    expect(entityRigProfile('Villageois', 1, { tenue: 'Mendiant' })!.tenue).toBe('Mendiant');
  });
  it('non-humanoïde → null (garde le sprite créature)', () => {
    expect(entityRigProfile('Rat géant', 1)).toBeNull();
  });
  it('déterministe sur le seed', () => {
    expect(entityRigProfile('Mutant', 7)!.appearance).toEqual(entityRigProfile('Mutant', 7)!.appearance);
  });
});
