import type { Slot } from '../bones';
import type { Part } from './types';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { careerClass, careerTenue } from './career';
import { armourPart, weaponPart, shieldPart, isShield, type EquipCtx } from './equipment';

const BODY_SLOTS: Slot[] = ['tete', 'bras', 'torse', 'jambes'];

/**
 * Choisit une part par slot, par priorité :
 *   override éditeur > équipement porté > tenue de carrière > générique.
 * visage/cheveux : toujours (cosmétique espèce×sexe), variante via overrides/seed.
 */
export function resolveParts(
  species: string,
  sex: 'M' | 'F',
  career: string | undefined,
  equip: EquipCtx,
  overrides: Partial<Record<Slot, number>>,
  seed: number,
): Record<Slot, Part | null> {
  const cls = career ? careerClass(career) : 'Citadins';
  const tenue = careerTenue(cls);
  const out = {} as Record<Slot, Part | null>;

  // Cosmétique (toujours). overrides priment, sinon variante dérivée du seed.
  out.visage = cosmeticPart('visage', species, sex, overrides.visage ?? seed % 2);
  out.cheveux = cosmeticPart('cheveux', species, sex, overrides.cheveux ?? (seed >> 2) % 3);

  // Corps : override → armure équipée → carrière → générique.
  for (const slot of BODY_SLOTS) {
    const tenuePart = tenue[slot as 'torse' | 'jambes' | 'bras' | 'tete'];
    if (overrides[slot] != null) {
      out[slot] = tenuePart ?? genericPart(slot);
      continue;
    }
    const armed = equip.armour.map((it) => armourPart(it, slot)).find((p) => p != null) ?? null;
    if (armed) { out[slot] = armed; continue; }
    out[slot] = tenuePart ?? (slot === 'tete' ? { svg: '' } : genericPart(slot));
  }

  // Mains : arme (1re arme non-bouclier) + bouclier.
  const mainWeapon = equip.weapons.find((w) => !isShield(w));
  out.arme = mainWeapon ? weaponPart(mainWeapon) : { svg: '' };
  out.bouclier = equip.shield ? shieldPart(equip.shield) : { svg: '' };

  return out;
}
