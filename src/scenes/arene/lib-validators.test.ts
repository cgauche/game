import { describe, it, expect } from 'vitest';
// @ts-expect-error — outil d'auteur .mjs sans types (validateurs id-only branchés dans NPC/scene/poste).
import { NPC, poste, scene } from '../../../scripts/campagne/lib.mjs';

/** Scène MER minimale (eau, 6×6) portant une rencontre terse d'un seul ennemi `ref` — sert à exercer
 *  `creatureId()` (branché dans `normalizeEnemy`) sans dépendre d'un catalogue de créature particulier. */
const sceneWithEnemyRef = (ref: string) =>
  scene({
    id: 'v', nom: 'V', base: 'eau', rows: ['......', '......', '......', '......', '......', '......'],
    entities: [{ id: 'start', kind: 'heroStart', pos: { x: 0, y: 0 } }],
    encounters: [{ id: 'e', enemies: [{ ref, pos: { x: 3, y: 3 } }] }],
  });

// Doctrine « labels interdits » : les helpers d'authoring VALIDENT des ids stables et THROW sur tout
// libellé (plus de normalisation label→id). Cf. CLAUDE.md, encadré « id STABLE ».
describe('lib.mjs — validateurs id-only (id passe, libellé THROW)', () => {
  it('NPC : ids valides (species/tenue/weapon) passent tels quels', () => {
    const e = NPC('t', 0, 0, 'Test', { weapon: 'arc', appearance: { species: 'humains-reiklander', tenue: 'mendiant' } });
    expect(e.weapon).toBe('arc');
    expect(e.appearance.species).toBe('humains-reiklander');
    expect(e.appearance.tenue).toBe('mendiant');
  });

  it('NPC : un LIBELLÉ d’espèce → throw', () => {
    expect(() => NPC('t', 0, 0, 'Test', { appearance: { species: 'Humains (Reiklander)' } })).toThrow(/species/i);
  });

  it('NPC : un LIBELLÉ de tenue → throw', () => {
    expect(() => NPC('t', 0, 0, 'Test', { appearance: { tenue: 'Mendiant' } })).toThrow(/tenue/i);
  });

  it('NPC : un LIBELLÉ d’arme → throw', () => {
    expect(() => NPC('t', 0, 0, 'Test', { weapon: 'Arc' })).toThrow(/weapon/i);
  });

  it('NPC : une tenue par id de CARRIÈRE (sans tenue dédiée) reste valide (résolue par classe)', () => {
    expect(NPC('t', 0, 0, 'Test', { appearance: { tenue: 'archer' } }).appearance.tenue).toBe('archer');
  });
});

// #218 — `creatureId()` accepte une COQUE (`vehicles.json`) comme ref d'entité légitime (naval).
describe('lib.mjs — creatureId : créature ∪ véhicule (coque terse #218)', () => {
  it('un ref de NAVIRE (vehicles.json) dans un enemies[] terse ne lève PAS', () => {
    expect(() => sceneWithEnemyRef('cogue')).not.toThrow();
  });

  it('un ref irrésoluble (ni créature ni véhicule) lève en pointant les DEUX catalogues', () => {
    expect(() => sceneWithEnemyRef('paquebot-transatlantique')).toThrow(/ni créature ni véhicule/i);
  });
});

// #222 — `poste()` émet la forme AUTHORÉE de référence `{ trappingId, uid, side, crewIds }` et valide
// que `trappingId` désigne une pièce POSABLE (art d'affût `siegeRig`).
describe('lib.mjs — poste() : forme référence #222, trappingId à art d’affût', () => {
  it('une pièce d’artillerie valide → { trappingId, uid, side, crewIds }, base NON matérialisée', () => {
    const p = poste('canon-moyen', 'tribord');
    expect(p.trappingId).toBe('canon-moyen');
    expect(p.side).toBe('tribord');
    expect(p.crewIds).toEqual([]);
    expect(typeof p.uid).toBe('string');
    expect(p.item).toBeUndefined(); // hydratée au spawn, jamais copiée en donnée (#222)
    expect(p.damage).toBeUndefined();
  });

  it('crewIds explicites préservés', () => {
    expect(poste('pierrier', 'proue', ['bob']).crewIds).toEqual(['bob']);
  });

  it('un trappingId SANS art d’affût (arme ordinaire) → throw', () => {
    expect(() => poste('arc', 'tribord')).toThrow(/poste/i);
  });

  it('un trappingId inconnu → throw', () => {
    expect(() => poste('canon-imaginaire', 'proue')).toThrow(/poste/i);
  });
});
