import { describe, it, expect } from 'vitest';
import { weaponFromTrait, creatureToCombatant, statblockToCombatant, skillsFromBook, spawnEnemy } from './spawn';
import { enemyRigProfile } from '../gameIso/rig/enemyProfile';
import { weaponFamily } from '../gameIso/rig/parts/equipment';
import { findCreature, findCreatureById, talentConcrete } from '../data';
import { CHAR_KEYS } from '../engine/types';
import { knowsCastingSkill, castingValue } from '../engine/magic';

/** Traits d'arme FR vérifiés dans L'ennemi dans l'Ombre ch.2 (Knud Cratinx & co). */
describe('weaponFromTrait — armement des monstres dans les Traits (FR)', () => {
  it('Arme +7 (sans type) → mêlée générique', () => {
    expect(weaponFromTrait({ id: 'arme', value: 7 })).toMatchObject({ name: 'Arme', type: 'melee', damage: { plusBF: false, flat: 7 } });
  });
  it('Arme (Épée) +7 → arme tenue « Épée »', () => {
    const w = weaponFromTrait({ id: 'arme', value: 7, arg: 'Épée' })!;
    expect(w).toMatchObject({ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 7 } });
    expect(weaponFamily(w)).toBe('epee'); // le rig tient une épée
  });
  it('Arme (Dague) +4 → dague', () => {
    expect(weaponFamily(weaponFromTrait({ id: 'arme', value: 4, arg: 'dague' })!)).toBe('dague');
  });
  it('À distance (Arbalète) +9 (60) → arbalète à distance, portée 60', () => {
    const w = weaponFromTrait({ id: 'a-distance', value: 9, arg: 'arbalete', range: 60 })!;
    expect(w).toMatchObject({ name: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60 });
    expect(weaponFamily(w)).toBe('arbalete');
  });
  it('À distance +8 (50) (sans type) → distance générique', () => {
    expect(weaponFromTrait({ id: 'a-distance', value: 8, range: 50 })).toMatchObject({ type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 50 });
  });
  it('Arme (griffes) marquée natural (donnée) → attaque NATURELLE, aucune arme dessinée', () => {
    // La détection naturelle vit dans la DONNÉE (flag `natural`), pas dans une regex au runtime →
    // le trait porte `natural: true`.
    const w = weaponFromTrait({ id: 'arme', arg: 'griffes', natural: true })!;
    expect(w.type).toBe('melee');
    expect(w.natural).toBe(true);
    expect(weaponFamily(w)).toBe(''); // pas d'arme tenue
  });
  it('Morsure +9 → attaque naturelle (pas d’arme tenue)', () => {
    const w = weaponFromTrait({ id: 'morsure', value: 9 })!;
    expect(w).toMatchObject({ name: 'Morsure', type: 'melee', damage: { plusBF: false, flat: 9 } });
    expect(weaponFamily(w)).toBe('');
  });
  it('un trait non-arme → null', () => {
    expect(weaponFromTrait({ id: 'corruption', arg: 'Mineure' })).toBeNull();
    expect(weaponFromTrait({ id: 'mutation', arg: 'Écailles épineuses' })).toBeNull();
  });
  it('« 8 Tentacules +9 » (Pieuvre) → UNE arme naturelle Tentacules +9 (pas d’« Arme +BF »)', () => {
    const w = weaponFromTrait({ id: 'tentacules', count: 8, value: 9 })!;
    expect(w).toMatchObject({ name: 'Tentacules', type: 'melee', damage: { plusBF: false, flat: 9 } });
    expect(weaponFamily(w)).toBe(''); // attaque naturelle : rien en main
  });
});

describe('spawnEnemy — arme d’AUTHORING (weapon:) vs arme de TRAIT : pas de doublon (#145 / #126)', () => {
  it('statbloc À distance (arbalète) + weapon:"Arbalète" → UNE seule arme à distance, avec Recharge', () => {
    // Régression #145 : l'arme de RENDU (weaponFromLabel, sans reload) était PRÉPENDÉE devant celle du
    // Trait (avec Recharge), et l'IA prenait la 1re → Recharge ennemie (#126) inerte. `weapon:` ne doit
    // plus s'ajouter quand un Trait produit déjà une arme du même type.
    const sb = { name: 'Tireur', char: { M: 4, CC: 36, CT: 43, F: 39, E: 32, B: 12 }, traits: [
      { id: 'a-distance', value: 9, arg: 'arbalete', range: 60 }, { id: 'arme', value: 7, arg: 'arme-simple' },
    ] } as any;
    const c = spawnEnemy(undefined, sb, 'e-tireur', { x: 0, y: 0 }, { weapon: 'Arbalète' });
    const ranged = c.weapons.filter((w) => w.type === 'ranged');
    expect(ranged).toHaveLength(1); // plus de doublon rendu/jeu
    expect(ranged[0].reload).toBeGreaterThan(0); // arme de JEU : Recharge dérivée de l'arbalète (LDB 62 l.333) → l'IA suit son cycle (#126)
  });
});

describe('creatureToCombatant — fidélité du profil du bestiaire (LDB 76/78)', () => {
  const at = { x: 0, y: 0 };

  it('« – » du livre = caractéristique INEXISTANTE → 0, pas 30 (Loup : CT –)', () => {
    const c = creatureToCombatant(findCreature('Loup')!, 'e1', at);
    expect(c.characteristics.CT).toBe(0);
  });

  it('Pieuvre des tourbières : arme Tentacules +9 dérivée du trait compté', () => {
    const c = creatureToCombatant(findCreature('Pieuvre des tourbières')!, 'e1', at);
    expect(c.weapons[0]).toMatchObject({ name: 'Tentacules', damage: { plusBF: false, flat: 9 } });
  });

  it('traits FACULTATIFS (LDB 76) fusionnés : Armure, psychologie ciblée, arme à distance', () => {
    const c = creatureToCombatant(findCreature('Loup')!, 'e1', at, {
      optionals: [{ id: 'haine', arg: 'Sigmarites' }, { id: 'a-distance', value: 8, range: 50 }],
    });
    expect(c.traits).toContainEqual({ id: 'haine', arg: 'Sigmarites' }); // traits STRUCTURÉS au spawn (de-POC)
    expect(c.weapons.some((w) => w.type === 'ranged' && w.damage && 'flat' in w.damage && !w.damage.plusBF && w.damage.flat === 8)).toBe(true);
    expect(c.psychTraits?.some((p) => p.type === 'haine')).toBe(true);
  });

  it('Taille facultative PRIME et applique « Utiliser les Tailles » (±10 F/E, ∓5 Ag) + PB par formule', () => {
    const wolf = findCreature('Loup')!; // Taille de base : Moyenne (aucun trait), F 35 E 35
    const base = creatureToCombatant(wolf, 'e1', at);
    const big = creatureToCombatant(wolf, 'e1', at, { optionals: [{ id: 'taille', arg: 'Grande' }] });
    expect(big.size).toBe('grande');
    expect(big.characteristics.F).toBe(base.characteristics.F + 10);
    expect(big.characteristics.E).toBe(base.characteristics.E + 10);
    expect(big.characteristics.Ag).toBe(base.characteristics.Ag - 5);
    // Blessures recalculées par la formule de Taille (le B imprimé valait pour la taille de base)
    const bf = Math.floor(big.characteristics.F / 10), be = Math.floor(big.characteristics.E / 10), bfm = Math.floor(big.characteristics.FM / 10);
    expect(big.wounds.max).toBe((bf + 2 * be + bfm) * 2); // Grande = ×2 (LDB 85)
  });

  it('sorts d’auteur posés sur le Combattant (la donnée bestiaire n’en liste pas)', () => {
    const c = creatureToCombatant(findCreature('Mutant')!, 'e1', at, { spells: ['flechette'] });
    expect(c.spells).toEqual(['flechette']); // SpawnExtras.spells = ids de sort (runtime)
  });

  describe('Caractéristiques aléatoires (LDB 78 : « soustrayez -10 et ajoutez 2d10 »)', () => {
    const mutant = findCreature('Mutant')!;
    it('chaque caractéristique tirée reste dans [v−8, v+10] ; déterministe par id ; ids ≠ → profils ≠', () => {
      const a = creatureToCombatant(mutant, 'enemy-0', at, { randomChars: true });
      const b = creatureToCombatant(mutant, 'enemy-0', at, { randomChars: true });
      const c = creatureToCombatant(mutant, 'enemy-1', at, { randomChars: true });
      for (const k of CHAR_KEYS) {
        const v = mutant.char[k];
        if (typeof v !== 'number' || v === 0) continue;
        expect(a.characteristics[k]).toBeGreaterThanOrEqual(v - 8); // −10 + 2×1
        expect(a.characteristics[k]).toBeLessThanOrEqual(v + 10); // −10 + 2×10
      }
      expect(a.characteristics).toEqual(b.characteristics); // graine stable par id (rejouable)
      expect(CHAR_KEYS.some((k) => a.characteristics[k] !== c.characteristics[k])).toBe(true);
    });
    it('« Si une Caractéristique vaut 5, lancez juste 1d10 » (Pieuvre : Int 5) ; « – » reste 0', () => {
      const p = creatureToCombatant(findCreature('Pieuvre des tourbières')!, 'enemy-0', at, { randomChars: true });
      expect(p.characteristics.Int).toBeGreaterThanOrEqual(1);
      expect(p.characteristics.Int).toBeLessThanOrEqual(10);
      expect(p.characteristics.CT).toBe(0); // inexistante : pas tirée
    });
    it('Blessures recalculées par la formule (le B imprimé valait pour le profil rond)', () => {
      const c = creatureToCombatant(mutant, 'enemy-0', at, { randomChars: true });
      const bf = Math.floor(c.characteristics.F / 10), be = Math.floor(c.characteristics.E / 10), bfm = Math.floor(c.characteristics.FM / 10);
      expect(c.wounds.max).toBe(bf + 2 * be + bfm); // Mutant : Taille Moyenne
    });
  });
});

// #152 (suite #143) : `CreatureData.followsCharacterRules` — bestiaire humain rétro-flagué (Cultiste,
// Brigand, Voleur…) — un ennemi spawné depuis une réf (`creatureToCombatant`, pas un statbloc d'éditeur)
// doit porter le MÊME flag que `statblockToCombatant` (#143) pour suivre les règles de Personnage
// (Corruption LDB 19, composant LDB 46, maladie/Corruption de fin de combat LDB 18/20).
describe('creatureToCombatant — #152 : CreatureData.followsCharacterRules propagé au Combatant', () => {
  const at = { x: 0, y: 0 };
  it('créature du bestiaire FLAGUÉE (Cultiste, humain) → Combatant.followsCharacterRules', () => {
    const c = creatureToCombatant(findCreatureById('cultiste')!, 'e1', at);
    expect(c.followsCharacterRules).toBe(true);
  });
  it('créature GÉNÉRIQUE du bestiaire non flaguée (Orc) → pas de followsCharacterRules', () => {
    const c = creatureToCombatant(findCreatureById('orc')!, 'e1', at);
    expect(c.followsCharacterRules).toBeUndefined();
  });
});

describe('PNJ de campagne — compétences/talents/sorts de la donnée (Eusapia Balacañon, MSR Compagnon p.48)', () => {
  const at = { x: 0, y: 0 };
  const eusapia = findCreature('Eusapia Balacañon')!;

  it('est dans creatures.json (livres de campagne admis au bestiaire)', () => {
    expect(eusapia).toBeTruthy();
    expect(eusapia.source.book).toBe('mort-sur-le-reik');
  });

  it('compétences au format livre → avances dérivées (Test FINAL = Caractéristique + avances, LDB 09)', () => {
    const c = creatureToCombatant(eusapia, 'e1', at);
    const langue = c.skills.find((s) => s.skillId === 'langue' && s.spec === 'magick')!;
    expect(langue.advances).toBe(63 - 48); // « Langue (Magick) 63 », Int 48
    expect(c.characteristics.Int + langue.advances).toBe(63);
    const foc = c.skills.find((s) => s.skillId === 'focalisation' && s.spec === 'bete')!; // id domaine, AFFICHE « Ghur »
    expect(c.characteristics.FM + foc.advances).toBe(68); // « Focalisation (Ghur) 68 », FM 53
  });

  it('talents portés (Magie des Arcanes (Bête), Magie mineure…) et 12 sorts de la donnée', () => {
    const c = creatureToCombatant(eusapia, 'e1', at);
    // spec = id domaine `bete` ; Magie des Arcanes AFFICHE le Lore (« Bête ») — la donnée « Ghur » (un Vent,
    // pas un Lore d'Arcane) était une faute d'auteur, résolue en `bete` par le résolveur Vent→id.
    expect(c.talents.map((t) => talentConcrete(t))).toContain('Magie des Arcanes (Bête)');
    expect(c.talents.map((t) => talentConcrete(t))).toContain('Magie mineure');
    expect(c.spells).toHaveLength(12);
    expect(c.spells).toContain('flechette'); // runtime = id de sort
  });

  it('incante par la voie NORMALE (Langue (Magick) 63, sans le Trait Lanceur de Sorts)', () => {
    const c = creatureToCombatant(eusapia, 'e1', at);
    expect(knowsCastingSkill(c, 'langue', 'magick')).toBe(true);
    expect(castingValue(c, 'langue', 'magick')).toBe(63);
  });

  it('arme du trait : « Arme (Bâton de combat) +7 » → arme tenue', () => {
    const c = creatureToCombatant(eusapia, 'e1', at);
    expect(c.weapons[0]).toMatchObject({ name: 'Bâton de combat', damage: { plusBF: false, flat: 7 } });
  });

  it('statbloc personnalisé : skills/talents portés par CustomStatblock (mêmes règles)', () => {
    const c = statblockToCombatant(
      { name: 'Sorcier custom', char: { Int: 48, FM: 53 }, skills: [{ id: 'langue', spec: 'magick', value: 63 }, { id: 'esquive', value: 48 }], talents: [{ id: 'menacant' }] },
      'e1', at,
    );
    expect(c.skills.find((s) => s.skillId === 'langue')!.advances).toBe(15);
    expect(c.talents[0]).toEqual({ talentId: 'menacant', times: 1 });
  });

  it('skillsFromBook : ref structurée (id + value) → SkillInstance ; id inconnu du catalogue → ignoré', () => {
    const chars = { CC: 45 } as any;
    const [cc] = skillsFromBook([{ id: 'corps-a-corps', spec: 'bagarre', value: 50 }], chars);
    expect(cc).toMatchObject({ skillId: 'corps-a-corps', characteristic: 'CC', advances: 5 });
    expect(skillsFromBook([{ id: 'competence-inexistante', value: 50 }], chars)).toEqual([]); // rien d'inventé
  });
});

/** L'apparence ÉDITÉE d'un ennemi (seed re-tiré, sexe, carrière…) doit survivre au spawn comme override
 *  BRUT (`appearanceOverride`) : le rig la fige PARESSEUSEMENT au rendu (#187), plus au spawn/state. */
describe('spawnEnemy — transport de l’apparence/carrière éditée vers le Combatant (parité explo↔combat)', () => {
  const at = { x: 0, y: 0 };

  it('seed + sexe + carrure édités → portés BRUTS par Combatant.appearanceOverride', () => {
    const c = spawnEnemy('Mutant', undefined, 'e1', at, { appearance: { seed: 12345, sex: 'F', build: 0.7 } });
    expect(c.appearanceOverride).toMatchObject({ seed: 12345, sex: 'F', build: 0.7 });
    expect(c.appearance).toBeUndefined(); // rien de figé dans state — la résolution rig est différée
  });

  it('tenue éditée → portée par Combatant.career', () => {
    const c = spawnEnemy('Mutant', undefined, 'e1', at, { appearance: { tenue: 'Soldat' } });
    expect(c.career).toBe('Soldat');
  });

  it('sans aucun override → appearanceOverride reste indéfini (rendu dérivé du nom inchangé)', () => {
    const c = spawnEnemy('Mutant', undefined, 'e1', at);
    expect(c.appearanceOverride).toBeUndefined();
  });

  it('override PARTIEL (seed seul) → enemyRigProfile conserve les défauts de race (coiffure/couleurs)', () => {
    const plain = enemyRigProfile(spawnEnemy('Mutant', undefined, 'e1', at))!;
    const seeded = enemyRigProfile(spawnEnemy('Mutant', undefined, 'e1', at, { appearance: { seed: 999 } }))!;
    expect(seeded.appearance.seed).toBe(999);
    // Les champs NON édités (parts/colors canoniques de la race) restent ceux du défaut.
    expect(seeded.appearance.parts).toEqual(plain.appearance.parts);
    expect(seeded.appearance.colors).toEqual(plain.appearance.colors);
  });
});
