/**
 * LOT 5 — DOCTRINES TACTIQUES data-driven (déterministe, sans dé). Deux volets :
 *  (a) `pickDoctrine` CLASSE correctement à partir de signaux DATA (traits/Intelligence/groups/sorts) et
 *      HONORE l'override `aiDoctrine` en PRIORITÉ ;
 *  (b) chaque doctrine produit un COMPORTEMENT DISTINCT vérifiable vs `standard` (le défaut neutre), prouvant
 *      que les poids effectifs changent réellement le choix de l'IA — SANS toucher une garde RAW.
 *
 * « Un loup ≠ une bande de brigands ≠ une compagnie d'élite ». Pur : `chooseEnemyAction`/`pickDoctrine` sont
 * déterministes ; on donne des Caractéristiques RÉELLES pour que les espérances de dégâts soient chiffrables.
 */
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, pickDoctrine, type EnemyAction, type EnemyTurnInput } from './ai';
import { emptyScene } from './scene';
import type { Combatant, Weapon } from '../engine/types';
import type { SpellLike } from '../engine/magic';

const MELEE: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const RANGED: Weapon = { name: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };

const CHARS = { CC: 45, CT: 45, F: 35, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 40, Soc: 30 };
const ARMOUR = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, name: id, kind, pos,
    wounds: { current: 12, max: 12 }, weapons: [MELEE],
    characteristics: { ...CHARS }, advantage: 0, conditions: [], armour: { ...ARMOUR },
    skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}

const scene = emptyScene(24, 24);

function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, ...extra };
}

const tidOf = (a: EnemyAction): string | undefined =>
  (a as { targetId?: string }).targetId ?? (a as { thenTargetId?: string }).thenTargetId;

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (a) CLASSIFICATION par signaux + OVERRIDE prioritaire
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('pickDoctrine — classification par signaux DATA (pas de nom en dur)', () => {
  it('un LOUP (Bestial, Int animale, mêlée seule) → meute', () => {
    const loup = mk('loup', 'enemy', { x: 0, y: 0 }, {
      traits: [{ id: 'bestial' } as never], characteristics: { ...CHARS, Int: 14 }, weapons: [MELEE],
    });
    expect(pickDoctrine(loup, [])).toBe('meute');
  });

  it('un SOLDAT (groupe militaire, ni Bestial ni Stupide) → soldats', () => {
    const soldat = mk('soldat', 'enemy', { x: 0, y: 0 }, { groups: ['Soldats'], weapons: [MELEE] });
    expect(pickDoctrine(soldat, [])).toBe('soldats');
  });

  it('un MAGE (possède des sorts, Int vive) → artillerie', () => {
    const mage = mk('mage', 'enemy', { x: 0, y: 0 }, { spells: ['carreau'], weapons: [], characteristics: { ...CHARS, Int: 40 } });
    expect(pickDoctrine(mage, [])).toBe('artillerie');
  });

  it('un ZOMBIE (Fabriqué → mindless) → horde', () => {
    const zombie = mk('zombie', 'enemy', { x: 0, y: 0 }, { traits: [{ id: 'fabrique' } as never], weapons: [MELEE] });
    expect(pickDoctrine(zombie, [])).toBe('horde');
  });

  it('une créature STUPIDE → horde (avance droit, immunité psy)', () => {
    const troll = mk('troll', 'enemy', { x: 0, y: 0 }, { traits: [{ id: 'stupide' } as never], weapons: [MELEE] });
    expect(pickDoctrine(troll, [])).toBe('horde');
  });

  it('un TIRAILLEUR (arme à distance + Agilité haute) → tirailleurs', () => {
    const skirm = mk('skirm', 'enemy', { x: 0, y: 0 }, { weapons: [RANGED], characteristics: { ...CHARS, Ag: 45 } });
    expect(pickDoctrine(skirm, [])).toBe('tirailleurs');
  });

  it('une RACAILLE (groupe criminel, sans signal militaire/magique) → racaille', () => {
    const brigand = mk('brigand', 'enemy', { x: 0, y: 0 }, { groups: ['Criminel'], weapons: [MELEE] });
    expect(pickDoctrine(brigand, [])).toBe('racaille');
  });

  it('une fixture GÉNÉRIQUE (sans groups/trait/sort, Caractéristiques moyennes) → standard (défaut neutre)', () => {
    const plain = mk('plain', 'enemy', { x: 0, y: 0 }, { weapons: [MELEE] });
    expect(pickDoctrine(plain, [])).toBe('standard');
  });

  it('Caractéristiques ABSENTES (combattant de test minimal) → standard (aucun signal chiffrable)', () => {
    const bare = { id: 'b', name: 'b', kind: 'enemy', pos: { x: 0, y: 0 }, wounds: { current: 10, max: 10 }, weapons: [MELEE], characteristics: {} as never, conditions: [], advantage: 0, armour: {} as never, skills: [], talents: [], movement: 4 } as Combatant;
    expect(pickDoctrine(bare, [])).toBe('standard');
  });

  it('OVERRIDE `aiDoctrine` HONORÉ en PRIORITÉ (court-circuite la sélection auto)', () => {
    // Un loup (signaux → meute) FORCÉ en embuscade par la donnée : l'override gagne.
    const loup = mk('loup', 'enemy', { x: 0, y: 0 }, {
      traits: [{ id: 'bestial' } as never], characteristics: { ...CHARS, Int: 14 }, weapons: [MELEE], aiDoctrine: 'embuscade',
    });
    expect(pickDoctrine(loup, [])).toBe('embuscade');
    // EMBUSCADE n'a PAS de signal auto : SEUL l'override la rend sélectionnable.
    const sansOverride = mk('x', 'enemy', { x: 0, y: 0 }, { weapons: [MELEE] });
    expect(pickDoctrine(sansOverride, [])).not.toBe('embuscade');
  });

  it('OVERRIDE invalide ignoré → retombe sur la sélection auto', () => {
    const mage = mk('mage', 'enemy', { x: 0, y: 0 }, { spells: ['carreau'], weapons: [], characteristics: { ...CHARS, Int: 40 }, aiDoctrine: 'inexistant' });
    expect(pickDoctrine(mage, [])).toBe('artillerie');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (b) COMPORTEMENTS DISTINCTS vs standard (les poids changent réellement le choix)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('Doctrines — comportements distincts vs standard', () => {
  it('TIRAILLEUR garde la distance : en portée de tir, il TIRE (ne charge pas au contact)', () => {
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [RANGED], characteristics: { ...CHARS, Ag: 45 }, movement: 4 });
    const h = mk('h', 'hero', { x: 10, y: 14 }); // à portée, LdV dégagée
    expect(pickDoctrine(e, [])).toBe('tirailleurs');
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('shoot');
  });

  it('ARTILLERIE pose une ZdE sur un paquet là où STANDARD tirerait mono-cible', () => {
    // Deux héros COLLÉS (un centre couvre les 2), MENAÇANTS (arme de mêlée) → le missile mono-cible a une
    // utilité franche (menace + dégâts > la ZdE modeste à aoePerExtraHero=6). Sort de zone ET missile jouables.
    const h1 = mk('h1', 'hero', { x: 10, y: 16 }, { weapons: [MELEE] });
    const h2 = mk('h2', 'hero', { x: 11, y: 16 }, { weapons: [MELEE] });
    const area = { spell: 'vortex-d-ames', radius: 1, range: 30, cn: 8 };
    const spellData: SpellLike = { label: 'Carreau', type: 'sort', cn: 4, desc: '', missile: true, damage: 8 } as SpellLike;
    const common: Partial<EnemyTurnInput> = { areaSpell: area, offensiveSpell: 'carreau', spellRange: 30, offensiveSpellData: spellData };
    // STANDARD : un lanceur à l'esprit médiocre (Int 20 < 30 → PAS artillerie, aucun autre signal) → standard.
    // À aoePerExtraHero=6, la ZdE (×1 héros en plus = 6) ne bat PAS le missile mono sur cible menaçante.
    const plain = mk('plain', 'enemy', { x: 10, y: 10 }, { weapons: [], spells: ['carreau'], characteristics: { ...CHARS, Int: 20 } });
    expect(pickDoctrine(plain, [])).toBe('standard');
    const aStd = chooseEnemyAction(input(plain, [h1, h2], common));
    expect(aStd.kind).toBe('cast'); // standard : missile mono-cible
    // ARTILLERIE : aoePerExtraHero=14 → la couverture du paquet l'emporte → castArea.
    const arty = mk('arty', 'enemy', { x: 10, y: 10 }, { weapons: [], spells: ['carreau'], characteristics: { ...CHARS, Int: 40 } });
    expect(pickDoctrine(arty, [])).toBe('artillerie');
    const aArty = chooseEnemyAction(input(arty, [h1, h2], common));
    expect(aArty.kind).toBe('castArea');
  });

  it('MEUTE prend la proie au FLANC/DOS (flankRear renforcé)', () => {
    // Héros orienté au NORD ; l'ennemi vient du sud. Au contact, la case de DOS (sud) est gratuite.
    const e = mk('e', 'enemy', { x: 10, y: 14 }, {
      traits: [{ id: 'bestial' } as never], characteristics: { ...CHARS, Int: 14 }, weapons: [MELEE], movement: 6,
    });
    const h = mk('h', 'hero', { x: 10, y: 10 });
    expect(pickDoctrine(e, [])).toBe('meute');
    const a = chooseEnemyAction(input(e, [h], { facing: { h: 'N' } }));
    expect(a.kind).toBe('move');
    if (a.kind === 'move') {
      expect(Math.max(Math.abs(a.to.x - 10), Math.abs(a.to.y - 10))).toBe(1); // au contact
      expect(`${a.to.x},${a.to.y}`).not.toBe('10,9'); // pas plein front (nord)
    }
  });

  it('HORDE avance DROIT sans éviter le danger, là où STANDARD contourne la case exposée', () => {
    // L'ennemi (mêlée) ne peut atteindre QUE `prey` ce tour ; il l'aborde par l'une de deux cases de contact
    // équidistantes. La case EST est plus exposée à un archer ; STANDARD préfère l'OUEST (danger-map),
    // mais la HORDE (dangerAvoid=0) est indifférente → elle prend la case par défaut (la plus directe).
    const prey = mk('prey', 'hero', { x: 10, y: 15 }, { weapons: [] });
    const archer = mk('archer', 'hero', { x: 13, y: 16 }, { weapons: [{ name: 'Fronde', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 6, qualities: [] }] });
    // STANDARD (fixture générique) : contourne par l'ouest (case éloignée de l'archer).
    const plain = mk('plain', 'enemy', { x: 10, y: 10 }, { weapons: [MELEE], movement: 5 });
    expect(pickDoctrine(plain, [])).toBe('standard');
    const aStd = chooseEnemyAction(input(plain, [prey, archer]));
    expect(aStd.kind).toBe('move');
    if (aStd.kind === 'move') expect(aStd.to.x).toBeLessThan(prey.pos!.x); // ouest, à l'abri
    // HORDE (Stupide) : indifférente au danger → ne préfère PAS l'ouest (prend l'est, la case par défaut).
    const horde = mk('horde', 'enemy', { x: 10, y: 10 }, { traits: [{ id: 'stupide' } as never], weapons: [MELEE], movement: 5 });
    expect(pickDoctrine(horde, [])).toBe('horde');
    const aH = chooseEnemyAction(input(horde, [prey, archer]));
    expect(aH.kind).toBe('move');
    if (aH.kind === 'move') expect(aH.to.x).toBeGreaterThanOrEqual(prey.pos!.x); // PAS le contournement prudent
  });

  it('SOLDATS tiennent la formation : cohésion renforcée → préfèrent la case qui NE les isole PAS de l’escouade', () => {
    // L'ennemi peut aborder `prey` par deux cases de contact équidistantes : l'une PROCHE de l'allié
    // (en formation), l'autre LOIN (isolée > 3 cases de tout allié). La cohésion renforcée des soldats
    // fait pencher pour la case en formation, là où le standard (cohésion faible) prend la case par défaut.
    const prey = mk('prey', 'hero', { x: 10, y: 15 }, { weapons: [] });
    const ally = mk('ally', 'enemy', { x: 6, y: 15 }); // à l'OUEST de la proie → la case de contact ouest reste près de l'allié
    const soldat = mk('soldat', 'enemy', { x: 10, y: 10 }, { groups: ['Soldats'], weapons: [MELEE], movement: 5 });
    expect(pickDoctrine(soldat, [soldat])).toBe('soldats');
    const a = chooseEnemyAction(input(soldat, [prey], { squad: [ally] }));
    expect(a.kind).toBe('move');
    if (a.kind === 'move') {
      // la case d'approche reste à portée de soutien de l'allié (chebyshev ≤ ~5, pas la case isolée à l'est)
      expect(a.to.x).toBeLessThanOrEqual(prey.pos!.x);
    }
  });
});
