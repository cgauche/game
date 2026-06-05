/**
 * Parts MONSTRUEUSES du rig — pour « construire son mutant » par slot, comme on
 * choisit la tête/le bras d'un PJ. Dessinées dans le repère LOCAL de l'os porteur
 * (mêmes conventions que cosmetic.ts / generic.ts) :
 *   - tête : repère de l'os `tete`, visage ≈ (0,7) r9 (remplace visage+cheveux).
 *   - bras : repère de l'os `epaule`, le membre descend en +y (~26-30), largeur ~6.
 *            Asymétrie native : on remplace UN seul bras (epauleG ou epauleD).
 *   - cornes/queue : calques (overlay) sur `tete` / `bassin`.
 * Aucune arme ici : l'arme reste de l'ÉQUIPEMENT (rendue par le rig si équipée).
 */
import type { BoneId, RigOverlay } from '../bones';

export type MonsterHead = 'chien' | 'lezard' | 'ogive' | 'minuscule';
export type MonsterArm = 'tentacule' | 'griffe';
export type MonsterLeg = 'chevre';

/** Sélection monstrueuse par slot (sur Appearance.monster). Tout est optionnel.
 *  Champs en `string` (libellés libres venant de la scène/éditeur) ; les lookups
 *  ci-dessous tolèrent une clé inconnue (→ ignorée). */
export interface MonsterParts {
  tete?: string;
  brasG?: string;
  brasD?: string;
  jambes?: string;
  cornes?: boolean;
  queue?: boolean;
}

// --- Têtes (repère os `tete`, vue de face) ---------------------------------
const HEAD_CHIEN = `<g>
  <path d="M-8 2 l-3 -11 l8 5 z" fill="#5e3f24"/><path d="M8 2 l3 -11 l-8 5 z" fill="#5e3f24"/>
  <path d="M-8 1 Q0 -3 8 1 L4 12 L0 16 L-4 12 Z" fill="#6e4a2c"/>
  <path d="M-4 11 L0 15 L4 11 L2 13 L-2 13 Z" fill="#5e3f24"/>
  <ellipse cx="-3" cy="4" rx="1.6" ry="2.1" fill="url(#g_eye)"/><circle cx="-3" cy="4" r="0.8" fill="#140a06"/>
  <ellipse cx="3" cy="4" rx="1.6" ry="2.1" fill="url(#g_eye)"/><circle cx="3" cy="4" r="0.8" fill="#140a06"/>
  <ellipse cx="0" cy="15" rx="1.7" ry="1.3" fill="#1a0e06"/>
</g>`;
const HEAD_LEZARD = `<g>
  <path d="M-7 0 l-1 -7 l5 4 z" fill="#445a30"/><path d="M0 -2 l-1 -7 l2 1 z" fill="#445a30"/><path d="M7 0 l1 -7 l-5 4 z" fill="#445a30"/>
  <path d="M-7 2 Q0 -1 7 2 L3 13 L0 16 L-3 13 Z" fill="#5d7a42"/>
  <path d="M-7 2 Q0 0 7 2" stroke="#3a5226" stroke-width="0.8" fill="none" opacity="0.6"/>
  <ellipse cx="-3" cy="5" rx="1.7" ry="2.4" fill="url(#g_eye)"/><circle cx="-3" cy="5" r="0.8" fill="#1a1a08"/>
  <ellipse cx="3" cy="5" rx="1.7" ry="2.4" fill="url(#g_eye)"/><circle cx="3" cy="5" r="0.8" fill="#1a1a08"/>
  <line x1="-3" y1="13" x2="3" y2="13" stroke="#2a3a18" stroke-width="0.8"/>
  <circle cx="-1.4" cy="11" r="0.5" fill="#1a2410"/><circle cx="1.4" cy="11" r="0.5" fill="#1a2410"/>
</g>`;
// Tête en ogive (« tête pointue ») : crâne allongé conique.
const HEAD_OGIVE = `<g>
  <path d="M-7 9 Q-8 -12 0 -17 Q8 -12 7 9 Q0 14 -7 9 Z" fill="#caa885"/>
  <path d="M-7 9 Q0 12 7 9" stroke="#9a7a52" stroke-width="0.6" fill="none" opacity="0.6"/>
  <ellipse cx="-3" cy="6" rx="1.5" ry="2.1" fill="url(#g_eye)"/><circle cx="-3" cy="6" r="0.8" fill="#140a06"/>
  <ellipse cx="3" cy="6" rx="1.5" ry="2.1" fill="url(#g_eye)"/><circle cx="3" cy="6" r="0.8" fill="#140a06"/>
  <path d="M-3 11 q3 2 6 0" stroke="#7a5a3a" stroke-width="1" fill="none"/>
</g>`;
// Tête minuscule (« crétin ») : petite tête perchée sur le cou, mâchoire molle.
const HEAD_MINUSCULE = `<g>
  <circle cx="0" cy="9" r="5" fill="#caa885"/>
  <ellipse cx="-1.8" cy="8" rx="1" ry="1.4" fill="url(#g_eye)"/><circle cx="-1.8" cy="8" r="0.5" fill="#140a06"/>
  <ellipse cx="1.8" cy="8" rx="1" ry="1.4" fill="url(#g_eye)"/><circle cx="1.8" cy="8" r="0.5" fill="#140a06"/>
  <path d="M-1.5 11 q1.5 1.5 3 0" stroke="#7a5a3a" stroke-width="0.8" fill="none"/>
</g>`;
const HEADS: Record<MonsterHead, string> = { chien: HEAD_CHIEN, lezard: HEAD_LEZARD, ogive: HEAD_OGIVE, minuscule: HEAD_MINUSCULE };

// --- Jambes (repère os `cuisse`, descend en +y ~50 ; symétrique → pas de miroir) ---
const LEG_CHEVRE = `<g>
  <path d="M-4 0 Q-6 16 -3 26 L3 26 Q6 16 4 0 Z" fill="#6e5a3a"/>
  <path d="M-3 6 l1 14 M2 6 l-1 14" stroke="#4a3a22" stroke-width="0.8" opacity="0.5"/>
  <path d="M-2.4 26 L-3.2 44 L3.2 44 L2.4 26 Z" fill="#4a3a22"/>
  <path d="M-4 44 L4 44 L5 51 L0 49 L-5 51 Z" fill="#241814"/>
  <line x1="0" y1="45" x2="0" y2="50" stroke="#0e0805" stroke-width="1"/>
</g>`;
const LEGS: Record<MonsterLeg, string> = { chevre: LEG_CHEVRE };

// --- Bras (repère os `epaule`, descend en +y) ------------------------------
const ARM_TENTACULE = `<g>
  <path d="M-2 -3 Q-10 7 -7 17 Q-5 25 3 26 Q-3 21 -2 13 Q-1 5 0 -2 Z" fill="url(#g_flesh)" stroke="#9a6a44" stroke-width="0.6"/>
  <circle cx="-5" cy="10" r="1.3" fill="#8a3a1e"/><circle cx="-4" cy="17" r="1.2" fill="#8a3a1e"/><circle cx="-1" cy="23" r="1.1" fill="#8a3a1e"/>
</g>`;
const ARM_GRIFFE = `<g>
  <path d="M0 -2 q-2 14 0 25" stroke="url(#g_flesh)" stroke-width="6.5" fill="none" stroke-linecap="round"/>
  <path d="M-4 25 l-2 7 M-1 27 l0 7 M2 25 l2 6" stroke="#caa885" stroke-width="1.7" fill="none" stroke-linecap="round"/>
</g>`;
const ARMS: Record<MonsterArm, string> = { tentacule: ARM_TENTACULE, griffe: ARM_GRIFFE };

// --- Calques (overlays) ----------------------------------------------------
const OV_CORNES = `<path d="M-5 -1 q-2 -9 -8 -12 q2 7 4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/><path d="M5 -1 q2 -9 8 -12 q-2 7 -4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/>`;
const OV_QUEUE = `<path d="M0 2 Q13 9 17 24 Q11 23 7 15 Q3 9 0 7 Z" fill="url(#g_flesh)" stroke="#9a6a44" stroke-width="0.6"/>`;

export interface MonsterInjection {
  /** part SVG par os (remplace la part normale de l'os). */
  replace: Partial<Record<BoneId, string>>;
  /** calques additionnels. */
  overlays: RigOverlay[];
}

/** Traduit une sélection MonsterParts en surcharges par os + calques. Tolère les
 *  clés inconnues (ignorées) pour accepter les libellés libres de la scène. */
export function monsterInjection(m: MonsterParts): MonsterInjection {
  const replace: Partial<Record<BoneId, string>> = {};
  const overlays: RigOverlay[] = [];
  const head = m.tete ? HEADS[m.tete as MonsterHead] : undefined;
  const armG = m.brasG ? ARMS[m.brasG as MonsterArm] : undefined;
  const armD = m.brasD ? ARMS[m.brasD as MonsterArm] : undefined;
  const legs = m.jambes ? LEGS[m.jambes as MonsterLeg] : undefined;
  if (head) replace.tete = head;
  if (armG) replace.epauleG = armG;
  if (armD) replace.epauleD = armD;
  if (legs) { replace.cuisseG = legs; replace.cuisseD = legs; } // 2 jambes (symétrique)
  if (m.cornes) overlays.push({ bone: 'tete', svg: OV_CORNES });
  if (m.queue) overlays.push({ bone: 'bassin', svg: OV_QUEUE });
  return { replace, overlays };
}

/** Catalogues pour l'éditeur (libellés FR). '' = humain / aucun. */
export const MONSTER_HEAD_OPTIONS: { key: '' | MonsterHead; label: string }[] = [
  { key: '', label: 'Humaine' }, { key: 'chien', label: 'Chien / loup' }, { key: 'lezard', label: 'Reptilien' },
  { key: 'ogive', label: 'Tête en ogive' }, { key: 'minuscule', label: 'Tête minuscule (crétin)' },
];
export const MONSTER_ARM_OPTIONS: { key: '' | MonsterArm; label: string }[] = [
  { key: '', label: 'Humain' }, { key: 'tentacule', label: 'Tentacule' }, { key: 'griffe', label: 'Griffe' },
];
export const MONSTER_LEG_OPTIONS: { key: '' | MonsterLeg; label: string }[] = [
  { key: '', label: 'Humaines' }, { key: 'chevre', label: 'Pattes de chèvre' },
];
