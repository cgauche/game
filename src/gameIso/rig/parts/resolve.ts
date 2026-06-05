import type { Slot } from '../bones';
import { pickView, type Part, type PartArt } from './types';
import type { View } from '../facing';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { careerTenueFor } from './career';
import { armourPart, weaponPart, shieldPart, isShield, type EquipCtx } from './equipment';

const BODY_SLOTS: Slot[] = ['tete', 'bras', 'torse', 'jambes'];

// --- Profil : silhouettes de CÔTÉ du corps (le pantin est de face ; de profil le
// torse/les jambes doivent être plus étroits et le buste légèrement avancé). On les
// teinte de la couleur dominante de la tenue → cohérent de profil pour TOUTE tenue
// sans art dédié. Une tenue PEUT fournir `profile` sur son torse/jambes pour un
// rendu détaillé (prioritaire). ---
const PROFILE_TORSE = (c: string) =>
  `<path d="M-5 -28 Q3 -31 7 -26 Q8.5 -10 6 4 L5 33 Q-1 37 -6 33 L-5 4 Q-7 -13 -5 -28 Z" fill="${c}" stroke="rgba(0,0,0,0.2)" stroke-width="0.6"/><path d="M-5 -2 Q-7 -13 -5 -28 Q-3 -30 -1 -29 L-1 4 Z" fill="#000" opacity="0.14"/>`;
const PROFILE_JAMBE = (c: string) =>
  `<path d="M-3.2 0 Q-4 24 -2.4 40 L-2.4 49 L3.2 49 Q4 24 3.2 0 Z" fill="${c}" stroke="rgba(0,0,0,0.18)" stroke-width="0.5"/>`;

/** Couleur dominante d'un fragment SVG de tenue (1er hex, sinon palier gradient). */
function dominantFill(svg: string): string {
  const hex = svg.match(/fill="(#[0-9a-fA-F]{3,8})"/);
  if (hex) return hex[1];
  if (/g_steel\b|g_steelD/.test(svg)) return '#7e879a';
  if (/g_cloak/.test(svg)) return '#7a1c20';
  if (/g_robe/.test(svg)) return '#2a2f55';
  return '#6a5a3a';
}
const hasProfileView = (p: PartArt | undefined): boolean => typeof p === 'object' && p != null && !!p.profile;

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

  // Profil : remplace torse/jambes par la silhouette de côté (sauf si la tenue
  // fournit déjà une vue `profile` détaillée). Teintée de la couleur de la tenue.
  if (view === 'profile') {
    if (!hasProfileView(tenue.torse) && out.torse?.svg) out.torse = { svg: PROFILE_TORSE(dominantFill(out.torse.svg)) };
    if (!hasProfileView(tenue.jambes) && out.jambes?.svg) out.jambes = { svg: PROFILE_JAMBE(dominantFill(out.jambes.svg)) };
  }

  // Pieds : botte directionnelle (toujours), au-dessus du bas de jambe.
  out.pied = P(FOOT);

  // Mains : arme (1re arme non-bouclier) + bouclier.
  const mainWeapon = equip.weapons.find((w) => !isShield(w));
  out.arme = P(mainWeapon ? weaponPart(mainWeapon) : '');
  out.bouclier = P(equip.shield ? shieldPart(equip.shield) : '');

  return out;
}
