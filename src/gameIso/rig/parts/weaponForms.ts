/**
 * FORMES d'arme — DÉRIVÉES du registre auto-chargé `weapons/defs/` (1 arme = 1 fichier,
 * cf. scripts/gen-registry.mjs). Ce module reste le point d'accès « FORME » (métadonnées
 * sans l'art) consommé par le routage d'art (equipment.ts), le maniement (handling.ts) et
 * les scripts QC. L'ART et la métadonnée vivent ensemble dans chaque `WeaponDef`.
 */
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { norm } from '../../../lib/normalize';
export { norm }; // re-export (source unique) — aussi utilisé en interne ci-dessous

/** Vue « forme » d'une arme (les champs de WeaponDef sans l'art). */
export interface WeaponForm { label: string; slug: string; type: 'melee' | 'ranged'; group: string; target: string; }
export interface ShieldForm { label: string; slug: string; target: string; }

/** Source de vérité = registre des armes (`weapons/defs/`). Vue forme (l'`art` reste porté par le def). */
export const WEAPON_FORMS: WeaponForm[] = WEAPON_DEFS;

export const SHIELD_FORMS: ShieldForm[] = [
  { label: 'Bouclier', slug: 'rond', target: 'rondache ronde à umbo central + rivets' },
  { label: 'Bouclier (Grand)', slug: 'grand', target: 'grand écu haut (kite/pavois), pointe vers le bas' },
  { label: 'Bouclier (Targe)', slug: 'targe', target: 'petite targe ronde bombée à umbo' },
];

const BY_LABEL = new Map(WEAPON_FORMS.map((f) => [norm(f.label), f.slug]));
/** slug de forme pour un libellé d'arme catalogué (sinon undefined). */
export const formSlug = (label: string): string | undefined => BY_LABEL.get(norm(label));
