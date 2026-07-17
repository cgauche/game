/**
 * Possession pas prévue pour la Taille du porteur (ADE II 2 l.710 : « Un ogre subit une pénalité de
 * −20 à tous les Tests lorsqu'il tente d'utiliser des possessions qui ne sont pas prévues pour sa Taille »).
 * Portée couverte ICI : le maniement d'armes (`attackModifiers`, Corps à corps/Projectiles). Le lot données
 * pose `sizeFor` sur le catalogue ogre ; les Tests hors combat (compétences/UI) restent hors périmètre.
 */
import { describe, it, expect } from 'vitest';
import { attackModifiers } from './combat';
import type { Combatant, Weapon } from './types';

const attacker = (size?: Combatant['size']): Combatant => ({ advantage: 0, conditions: [], size } as unknown as Combatant);
const weapon = (sizeFor?: Weapon['sizeFor']): Weapon => ({ name: 'Massue', type: 'melee', hands: 1, qualities: [], sizeFor }) as unknown as Weapon;

describe('sizeFor — pénalité de Taille (ADE II 2 l.710)', () => {
  it('0 excédent : arme sans `sizeFor` → aucune ligne', () => {
    const mods = attackModifiers(attacker('grande'), null, weapon(), { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Possession pas à sa taille')).toBeUndefined();
  });
  it('0 excédent : `sizeFor` EGAL à la Taille du porteur → aucune ligne', () => {
    const mods = attackModifiers(attacker('grande'), null, weapon('grande'), { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Possession pas à sa taille')).toBeUndefined();
    // Le porteur SANS `size` explicite (Moyenne implicite, effectiveSize) avec une arme `sizeFor:'moyenne'`
    const modsDefault = attackModifiers(attacker(undefined), null, weapon('moyenne'), { kind: 'melee' });
    expect(modsDefault.find((m) => m.label === 'Possession pas à sa taille')).toBeUndefined();
  });
  it("cas nominal : un ogre (Taille Grande) maniant une arme `sizeFor:'moyenne'` (pas taillée pour lui) subit −20", () => {
    const mods = attackModifiers(attacker('grande'), null, weapon('moyenne'), { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Possession pas à sa taille')?.value).toBe(-20);
  });
  it("symétrique : un combattant de Taille Moyenne maniant une arme `sizeFor:'grande'` (taille ogre) subit −20", () => {
    const mods = attackModifiers(attacker('moyenne'), null, weapon('grande'), { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Possession pas à sa taille')?.value).toBe(-20);
  });
});
