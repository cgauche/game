import type { Slot } from '../bones';
import { pickView, type Part, type PartArt } from './types';
import type { View } from '../facing';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { careerTenueFor } from './career';
import { armourPart, weaponPart, shieldPart, isShield, type EquipCtx } from './equipment';

const BODY_SLOTS: Slot[] = ['tete', 'bras', 'torse', 'jambes'];

// Pied DIRECTIONNEL (repère os `pied`, origine = cheville, +y descend). Dessiné
// par-dessus le bas de jambe → un pied de profil pointe vers l'avant (botte de côté),
// de face un bout arrondi, de dos un talon. Botte de cuir neutre (couvre la plupart
// des tenues). C'est ce qui manquait : les pieds changent enfin selon la direction.
const FOOT: PartArt = {
  front: `<path d="M-3.4 -1 Q-4.4 7 0 8 Q4.4 7 3.4 -1 Z" fill="#3a2614" stroke="#1f1408" stroke-width="0.6"/><path d="M-3.6 6.5 Q0 8.6 3.6 6.5 L3.4 8 Q0 9.4 -3.4 8 Z" fill="#241608"/>`,
  back: `<path d="M-3.2 -1 Q-3.8 6 0 6.5 Q3.8 6 3.2 -1 Z" fill="#2e1f10" stroke="#1a1208" stroke-width="0.5"/>`,
  profile: `<path d="M-3 -1 L-3 5 Q-3 7.4 0 7.4 L8.6 7.4 Q10.6 7.4 9.4 4 L5.4 1 Z" fill="#3a2614" stroke="#1f1408" stroke-width="0.6"/><path d="M-3 6.4 L9.6 6.4 L9.8 8 Q4 9 -3 8 Z" fill="#241608"/>`,
};

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

  // Pieds : botte directionnelle (toujours), au-dessus du bas de jambe.
  out.pied = P(FOOT);

  // Mains : arme (1re arme non-bouclier) + bouclier.
  const mainWeapon = equip.weapons.find((w) => !isShield(w));
  out.arme = P(mainWeapon ? weaponPart(mainWeapon) : '');
  out.bouclier = P(equip.shield ? shieldPart(equip.shield) : '');

  return out;
}
