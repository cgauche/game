import { describe, it, expect } from 'vitest';
import { classifyEnemy, enemyRigProfile, entityRigProfile } from './enemyProfile';
import { combatantOverlays } from './parts/combatantVisuals';
import { creatures } from '../../data';
import { mutationById } from '../../data/mutations';
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
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon],
    armour: { ...noArmour },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  } as Combatant;
}

describe('classifyEnemy (cosmétique : humanoïde peau-humaine → rig, sinon créature)', () => {
  it('IDs de créatures humanoïdes (record → espèce bipède) → rig', () => {
    // Résolution PAR ID : le record porte son espèce explicite → def bipède. Couvre peaux-humaines,
    // peaux-vertes, hommes-bêtes, morts-vivants humanoïdes, skavens, gros/démons.
    for (const id of [
      'humain', 'nain', 'halfling', 'ogre',
      'orc', 'gobelin', 'snotling', 'squelette', 'zombie', 'goule-de-crypte',
      'gor', 'minotaure', 'troll', 'vampire',
      'skaven', 'guerrier-des-clans', 'rat-ogre',
    ]) {
      expect(classifyEnemy(id), id).toBe('rig');
    }
  });
  it('un NOM générique sans record ni espèce (rôle) → bipède Humain par défaut → rig', () => {
    // Plus de devinette par le nom : un rôle inconnu (sans record/def) tombe sur le bipède Humain (rig).
    for (const n of ['Bandit', 'Cultiste', 'Mutant', "Soldat de l'Empire", 'Rôle inconnu xyz'])
      expect(classifyEnemy(n), n).toBe('rig');
  });
  it('IDs de bêtes / morts-vivants non humanoïdes → créature', () => {
    for (const id of [
      'rat-geant', 'dragon', 'loup', 'ours',
      'araignee-geante', 'spectre', 'bete-des-marais', 'hydre',
    ]) {
      expect(classifyEnemy(id), id).toBe('creature');
    }
  });
});

describe('enemyRigProfile', () => {
  it('null pour une créature non-humanoïde (espèce explicite, comme au spawn)', () => {
    expect(enemyRigProfile(mkEnemy('Rat géant', { species: 'rat-geant' }))).toBeNull();
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

  it('espèce : explicite > record > Humain par défaut (plus de name-match flou)', () => {
    expect(enemyRigProfile(mkEnemy('Truc', { species: 'nain' }))!.appearance.species).toBe('nain'); // explicite gagne
    expect(enemyRigProfile(mkEnemy('Cultiste'))!.appearance.species).toBe('humain'); // ni espèce ni record → Humain
  });

  it('espèce EXPLICITE (donnée) → tête monstrueuse portée par la Race (rendu data-driven)', () => {
    // De-POC P5/5d : l'espèce vient de la DONNÉE (record/combattant) → species pilote race.head
    // (tête monstrueuse via composeRig). Le nom est purement contextuel.
    const cases: [string, string, string | undefined][] = [
      ['Orc noir', 'orc', 'orc'],
      ['Gobelin de la nuit', 'gobelin', 'gobelin'],
      ['Snotling', 'snotling', 'gobelin'],
      ['Gor sauvage', 'gor', 'caprin'], // def dédié → race Homme-bête (tête caprine)
      ['Ungor fourrageur', 'ungor', 'caprin'],
      ['Minotaure', 'minotaure', 'taureau'],
      ['Squelette guerrier', 'squelette', 'crane'],
      ['Zombie', 'zombie', 'pourri'],
      ['Goule de crypte', 'goule', 'goule'],
      ['Troll de pierre', 'troll', 'troll'],
      ['Sanguinaire de Khorne', 'demon', 'demon'],
      ['Vampire', 'vampire', undefined], // humain pâle → pas de tête monstrueuse
    ];
    for (const [name, species, tete] of cases) {
      const p = enemyRigProfile(mkEnemy(name, { species }))!;
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
    // Sans donnée de tenue, un humanoïde retombe sur le défaut HABILLÉ de sa race (Humain → Bourgeois,
    // pas « Nu ») : le nom « Flagellant » ne suffit plus à inférer la tenue Flagellant.
    expect(enemyRigProfile(mkEnemy('Flagellant'))!.tenue).toBe('Bourgeois');
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
    // Le visuel de mutation vient des mutations RÉELLES du combattant (combatantOverlays), résolu PAR ID :
    const mute = mkEnemy('Humain', { mutations: [mutationById('cornes-asymetriques')!] });
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
    expect(p.appearance.species).toBe('humain');
    expect(p.tenue).toBe('Bourgeois'); // défaut HABILLÉ de la race Humain ; la tenue ne se déduit plus du nom (POC retiré)
    // L'ambiance porte sa tenue via `appearance.tenue` (pickBackend → opts.tenue) — honorée telle quelle.
    expect(entityRigProfile('Villageois', 1, { tenue: 'Mendiant' })!.tenue).toBe('Mendiant');
  });
  it('non-humanoïde (id de record) → null (garde le sprite créature)', () => {
    expect(entityRigProfile('rat-geant', 1)).toBeNull();
  });
  it('déterministe sur le seed', () => {
    expect(entityRigProfile('Mutant', 7)!.appearance).toEqual(entityRigProfile('Mutant', 7)!.appearance);
  });

  it('équipement de combat AFFICHÉ en explo (parité avec le combat) : armes + armure dérivées du profil', () => {
    const p = entityRigProfile('Soldat', 1, { traits: [{ id: 'arme', value: 7, arg: 'Hache' }] as never, armour: 2 })!;
    expect(p.equip.weapons.some((w) => /hache/i.test(w.name))).toBe(true); // arme EXPLICITE tenue en main
    expect(p.equip.armour.length).toBeGreaterThan(0);                       // armure dessinée (PA → pièces)
  });

  it('entité SANS arme/armure (villageois, ambiance) → mains libres préservées', () => {
    const p = entityRigProfile('Soldat', 1, { traits: [] as never })!;
    expect(p.equip.weapons).toEqual([]); // pas de repli « Arme » générique (qui serait dessiné en épée)
    expect(p.equip.armour).toEqual([]);
  });

  it('repli record GATÉ par l’enrôlement : enrôlée (combattante) → équipée ; ambiance → mains libres', () => {
    // Sans statbloc, l'équipement par défaut ne vient du record QUE si l'entité est ENRÔLÉE (membre d'une
    // rencontre) — parité avec le spawn `creatureToCombatant`. Non enrôlée = ambiance = mains libres,
    // même si le record porte un trait « Arme »/« Armure » (un villageois ne dégaine pas pour décorer).
    // Cible : un id de créature rig dont le record produit une arme une fois enrôlé (découvert au runtime).
    const target = creatures.find((c) => {
      if (classifyEnemy(c.id) !== 'rig') return false;
      const enrolled = entityRigProfile(c.id, 1, { enrolled: true });
      return !!enrolled && enrolled.equip.weapons.length > 0;
    });
    expect(target, 'au moins une créature rig armée par son record').toBeTruthy();
    const id = target!.id;
    expect(entityRigProfile(id, 1, { enrolled: true })!.equip.weapons.length).toBeGreaterThan(0); // enrôlée → kit
    expect(entityRigProfile(id, 1)!.equip.weapons).toEqual([]); // ambiance (défaut non enrôlée) → mains libres
    expect(entityRigProfile(id, 1)!.equip.armour).toEqual([]);
  });
});
