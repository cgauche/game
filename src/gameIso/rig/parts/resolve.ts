import type { Slot } from '../bones';
import { pickView, type Part, type PartArt } from './types';
import type { View } from '../facing';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { careerTenueFor } from './career';
import { armourPart, weaponPart, shieldPart, isShield, type EquipCtx } from './equipment';

const BODY_SLOTS: Slot[] = ['tete', 'bras', 'torse', 'jambes'];

/**
 * Choisit une part par slot, par priorité :
 *   override éditeur > équipement porté > tenue de carrière > générique.
 * visage/cheveux : toujours (cosmétique espèce×sexe), variante via overrides/seed.
 * `view` choisit la vue (front/back/profile) de chaque part, avec fallback front.
 */
export function resolveParts(
  species: string,
  sex: 'M' | 'F',
  career: string | undefined,
  equip: EquipCtx,
  overrides: Partial<Record<Slot, number>>,
  seed: number,
  view: View = 'front',
): Record<Slot, Part | null> {
  const tenue = careerTenueFor(career);
  const out = {} as Record<Slot, Part | null>;
  const P = (art: PartArt | null | undefined): Part => ({ svg: pickView(art, view) });

  // Cosmétique (toujours). overrides priment, sinon variante dérivée du seed.
  out.visage = P(cosmeticPart('visage', species, sex, overrides.visage ?? seed % 2));
  out.cheveux = P(cosmeticPart('cheveux', species, sex, overrides.cheveux ?? (seed >> 2) % 3));

  // Corps : override → armure équipée → carrière → générique.
  for (const slot of BODY_SLOTS) {
    const tenuePart = tenue[slot as 'torse' | 'jambes' | 'bras' | 'tete'];
    if (overrides[slot] != null) {
      out[slot] = P(tenuePart ?? genericPart(slot));
      continue;
    }
    const armed = equip.armour.map((it) => armourPart(it, slot)).find((p) => p != null);
    if (armed != null) { out[slot] = P(armed); continue; }
    out[slot] = P(tenuePart ?? (slot === 'tete' ? '' : genericPart(slot)));
  }

  // Mains : arme (1re arme non-bouclier) + bouclier.
  const mainWeapon = equip.weapons.find((w) => !isShield(w));
  out.arme = P(mainWeapon ? weaponPart(mainWeapon) : '');
  out.bouclier = P(equip.shield ? shieldPart(equip.shield) : '');

  return out;
}
