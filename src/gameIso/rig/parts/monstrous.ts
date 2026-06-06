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
import type { PartArt } from './types';

export type MonsterHead =
  | 'chien' | 'lezard' | 'ogive' | 'minuscule' | 'rat'
  | 'orc' | 'gobelin'
  | 'caprin' | 'taureau'
  | 'crane' | 'pourri' | 'goule'
  | 'troll' | 'ogre' | 'demon' | 'cyclope';
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
  cotes?: boolean; // côtes apparentes (mort-vivant)
  griffes?: boolean; // longues griffes aux mains (goule)
  verrues?: boolean; // peau verruqueuse + ventre pâle (troll) — casse l'aplat « blob »
  plaie?: boolean; // plaie de chair exposée (zombie)
  ventre?: boolean; // énorme ventre à gutplate (ogre)
  cape?: boolean; // col de cape dressé en éventail + crocs (vampire)
  membresRouges?: boolean; // bras/jambes rouge sang + stries au torse (démon bicolore)
}

// --- Têtes (repère os `tete`, vue de face) ---------------------------------
const HEAD_CHIEN = `<g>
  <path d="M-8 2 l-3 -11 l8 5 z" fill="@peauO"/><path d="M8 2 l3 -11 l-8 5 z" fill="@peauO"/>
  <path d="M-8 1 Q0 -3 8 1 L4 12 L0 16 L-4 12 Z" fill="@peau"/>
  <path d="M-4 11 L0 15 L4 11 L2 13 L-2 13 Z" fill="@peauO"/>
  <ellipse cx="-3" cy="4" rx="1.6" ry="2.1" fill="url(#g_eye)"/><circle cx="-3" cy="4" r="0.8" fill="#140a06"/>
  <ellipse cx="3" cy="4" rx="1.6" ry="2.1" fill="url(#g_eye)"/><circle cx="3" cy="4" r="0.8" fill="#140a06"/>
  <ellipse cx="0" cy="15" rx="1.7" ry="1.3" fill="#1a0e06"/>
</g>`;
const HEAD_LEZARD = `<g>
  <path d="M-7 0 l-1 -7 l5 4 z" fill="@peauO"/><path d="M0 -2 l-1 -7 l2 1 z" fill="@peauO"/><path d="M7 0 l1 -7 l-5 4 z" fill="@peauO"/>
  <path d="M-7 2 Q0 -1 7 2 L3 13 L0 16 L-3 13 Z" fill="@peau"/>
  <path d="M-7 2 Q0 0 7 2" stroke="#3a5226" stroke-width="0.8" fill="none" opacity="0.6"/>
  <ellipse cx="-3" cy="5" rx="1.7" ry="2.4" fill="url(#g_eye)"/><circle cx="-3" cy="5" r="0.8" fill="#1a1a08"/>
  <ellipse cx="3" cy="5" rx="1.7" ry="2.4" fill="url(#g_eye)"/><circle cx="3" cy="5" r="0.8" fill="#1a1a08"/>
  <line x1="-3" y1="13" x2="3" y2="13" stroke="#2a3a18" stroke-width="0.8"/>
  <circle cx="-1.4" cy="11" r="0.5" fill="#1a2410"/><circle cx="1.4" cy="11" r="0.5" fill="#1a2410"/>
</g>`;
// Tête en ogive (« tête pointue ») : crâne allongé conique.
const HEAD_OGIVE = `<g>
  <path d="M-7 9 Q-8 -12 0 -17 Q8 -12 7 9 Q0 14 -7 9 Z" fill="@peau"/>
  <path d="M-7 9 Q0 12 7 9" stroke="@peauO" stroke-width="0.6" fill="none" opacity="0.6"/>
  <ellipse cx="-3" cy="6" rx="1.5" ry="2.1" fill="url(#g_eye)"/><circle cx="-3" cy="6" r="0.8" fill="#140a06"/>
  <ellipse cx="3" cy="6" rx="1.5" ry="2.1" fill="url(#g_eye)"/><circle cx="3" cy="6" r="0.8" fill="#140a06"/>
  <path d="M-3 11 q3 2 6 0" stroke="#7a5a3a" stroke-width="1" fill="none"/>
</g>`;
// Tête minuscule (« crétin ») : petite tête perchée sur le cou, mâchoire molle.
const HEAD_MINUSCULE = `<g>
  <circle cx="0" cy="9" r="5" fill="@peau"/>
  <ellipse cx="-1.8" cy="8" rx="1" ry="1.4" fill="url(#g_eye)"/><circle cx="-1.8" cy="8" r="0.5" fill="#140a06"/>
  <ellipse cx="1.8" cy="8" rx="1" ry="1.4" fill="url(#g_eye)"/><circle cx="1.8" cy="8" r="0.5" fill="#140a06"/>
  <path d="M-1.5 11 q1.5 1.5 3 0" stroke="#7a5a3a" stroke-width="0.8" fill="none"/>
</g>`;
// Vues DOS (face cachée) et PROFIL (museau à droite ; le rig miroite pour la gauche)
// → les têtes monstrueuses gèrent le facing 8-dir comme les têtes humaines.
const CHIEN_BACK = `<g>
  <path d="M-8 2 l-3 -11 l8 5 z" fill="@peau"/><path d="M8 2 l3 -11 l-8 5 z" fill="@peau"/>
  <path d="M-8 1 Q0 -3 8 1 L4 13 L0 16 L-4 13 Z" fill="@peauO"/>
  <path d="M-3 4 l1 9 m3 -9 l-1 9 m4 -9 l-1 8" stroke="#4a3018" stroke-width="0.7" opacity="0.5"/>
</g>`;
const CHIEN_PROFILE = `<g>
  <path d="M-6 1 l-3 -10 l7 4 z" fill="@peauO"/>
  <path d="M-7 2 Q-2 -3 5 1 L7 5 Q14 5 16 9 Q14 12 7 11 L3 14 L-1 15 L-6 12 Z" fill="@peau"/>
  <ellipse cx="16" cy="9" rx="1.8" ry="1.4" fill="#1a0e06"/>
  <ellipse cx="2" cy="5" rx="1.5" ry="2" fill="url(#g_eye)"/><circle cx="2" cy="5" r="0.8" fill="#140a06"/>
  <path d="M9 10 q4 1 6 0" stroke="#1a0e06" stroke-width="0.7" fill="none"/>
</g>`;
const LEZARD_BACK = `<g>
  <path d="M-7 0 l-1 -7 l5 4 z" fill="@peauO"/><path d="M0 -2 l-1 -7 l2 1 z" fill="@peauO"/><path d="M7 0 l1 -7 l-5 4 z" fill="@peauO"/>
  <path d="M-7 2 Q0 -1 7 2 L3 13 L0 16 L-3 13 Z" fill="@peauO"/>
  <path d="M0 2 L0 14" stroke="#3a5226" stroke-width="0.8" opacity="0.5"/>
</g>`;
const LEZARD_PROFILE = `<g>
  <path d="M-6 0 l-1 -7 l4 4 z M-1 -2 l0 -6 l3 3 z" fill="@peauO"/>
  <path d="M-6 2 Q-1 -2 4 1 L6 4 Q15 4 18 8 Q15 11 6 10 L2 14 L-2 15 L-6 12 Z" fill="@peau"/>
  <line x1="9" y1="9" x2="17" y2="9" stroke="#2a3a18" stroke-width="0.8"/>
  <ellipse cx="2" cy="5" rx="1.6" ry="2.2" fill="url(#g_eye)"/><circle cx="2" cy="5" r="0.8" fill="#1a1a08"/>
</g>`;
const OGIVE_BACK = `<g>
  <path d="M-7 9 Q-8 -12 0 -17 Q8 -12 7 9 Q0 14 -7 9 Z" fill="@peauO"/>
  <path d="M0 -16 L0 12" stroke="@peauO" stroke-width="0.6" opacity="0.4"/>
</g>`;
const OGIVE_PROFILE = `<g>
  <path d="M-6 9 Q-7 -11 1 -16 Q9 -11 7 9 Q1 13 -6 9 Z" fill="@peau"/>
  <ellipse cx="3" cy="6" rx="1.5" ry="2.1" fill="url(#g_eye)"/><circle cx="3" cy="6" r="0.8" fill="#140a06"/>
  <path d="M4 11 q3 1 4 -1" stroke="#7a5a3a" stroke-width="0.9" fill="none"/>
</g>`;
const MINUSCULE_BACK = `<g><circle cx="0" cy="9" r="5" fill="@peauO"/></g>`;
const MINUSCULE_PROFILE = `<g><circle cx="0" cy="9" r="5" fill="@peau"/><ellipse cx="2" cy="8" rx="1" ry="1.4" fill="url(#g_eye)"/><circle cx="2" cy="8" r="0.5" fill="#140a06"/></g>`;

// Tête de RAT (skaven) — museau pointu, grandes incisives, grosses oreilles rondes, œil
// sombre calme + vibrisses. @peau = pelage (palette espèce Skaven = brun). Repère os `tete`.
// Œil de skaven MAUVAIS : petit, jaune luisant à pupille fendue verticale (canon WHFB) — pas
// le regard doux d'animal. C'est ce qui le rend menaçant plutôt que mignon.
const ratEye = (x: number) => `<ellipse cx="${x}" cy="5" rx="1.7" ry="1.5" fill="#e6a017"/><ellipse cx="${x}" cy="5" rx="0.55" ry="1.5" fill="#180a04"/><circle cx="${x + 0.5}" cy="4.4" r="0.35" fill="#fff" opacity="0.6"/>`;
const HEAD_RAT = `<g>
  <circle cx="-7" cy="-1" r="4.3" fill="@peau" stroke="@peauO" stroke-width="0.6"/><circle cx="-7" cy="-1" r="2.2" fill="#caa597"/>
  <circle cx="7" cy="-1" r="4.3" fill="@peau" stroke="@peauO" stroke-width="0.6"/><circle cx="7" cy="-1" r="2.2" fill="#caa597"/>
  <path d="M-6 3 Q-7 -4 0 -5 Q7 -4 6 3 Q5 12 0 16 Q-5 12 -6 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-6 3 Q0 6 6 3 L5 9 Q0 11 -5 9 Z" fill="@peauO" opacity="0.45"/>
  <path d="M-2 13 q-6 1 -8.5 -1 M2 13 q6 1 8.5 -1 M-2 14.2 q-6 2 -9 1 M2 14.2 q6 2 9 1" stroke="#cfc8b8" stroke-width="0.4" opacity="0.5"/>
  <ellipse cx="0" cy="14.5" rx="2" ry="1.5" fill="#d68a96"/>
  <path d="M-1.3 15.6 l-0.2 2.6 M1.3 15.6 l0.2 2.6" stroke="#efe6cf" stroke-width="1.3" stroke-linecap="round"/>
  ${ratEye(-3.2)}${ratEye(3.2)}
</g>`;
const RAT_BACK = `<g>
  <circle cx="-7" cy="-1" r="4.3" fill="@peauO" stroke="@peauO" stroke-width="0.5"/><circle cx="7" cy="-1" r="4.3" fill="@peauO" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-6 3 Q-7 -4 0 -5 Q7 -4 6 3 Q5 13 0 16 Q-5 13 -6 3 Z" fill="@peauO"/><path d="M0 -4 L0 14" stroke="@peau" stroke-width="0.5" opacity="0.4"/>
</g>`;
const RAT_PROFILE = `<g>
  <circle cx="-2" cy="-2" r="4" fill="@peau" stroke="@peauO" stroke-width="0.5"/><circle cx="-2" cy="-2" r="2" fill="#caa597"/>
  <path d="M-6 1 Q-6 -6 0 -6 Q6 -5 9 -1 Q15 1 18 5 Q15 8 9 7 L4 11 Q-2 12 -6 8 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="18" cy="5" rx="1.6" ry="1.3" fill="#d68a96"/>
  <path d="M16 7 q-3 4 -6 2" stroke="#efe6cf" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M13 8 q5 1 7 -1 M12 9 q5 2 8 1" stroke="#cfc8b8" stroke-width="0.4" opacity="0.5"/>
  <ellipse cx="3" cy="2" rx="1.7" ry="1.4" fill="#e6a017"/><ellipse cx="3" cy="2" rx="0.55" ry="1.4" fill="#180a04"/><circle cx="3.5" cy="1.4" r="0.35" fill="#fff" opacity="0.6"/>
</g>`;

// --- Yeux réutilisables --------------------------------------------------
// Œil de prédateur : iris jaune-orangé luisant, pupille ronde sombre (orc/gobelin/bête).
const beastEye = (x: number, cy = 5, rx = 1.7, ry = 1.9) =>
  `<ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f2a81e"/><circle cx="${x}" cy="${cy}" r="${rx * 0.5}" fill="#160a04"/><circle cx="${x + 0.4}" cy="${cy - 0.5}" r="0.35" fill="#fff" opacity="0.6"/>`;
// Œil rougeoyant (mort-vivant / squelette) — orbite creuse à lueur orange.
const undeadEye = (x: number, cy = 5) =>
  `<circle cx="${x}" cy="${cy}" r="2.3" fill="#1a0e06"/><circle cx="${x}" cy="${cy}" r="1.2" fill="#e8861e"/><circle cx="${x}" cy="${cy}" r="0.5" fill="#ffd07a"/>`;

// === PEAUX-VERTES ===========================================================
// Tête d'ORC : petite tête verte enfoncée, museau plat porcin, front lourd, sous-occlusion
// à défenses inférieures blanches. @peau = vert (palette espèce Orc). Repère os `tete`.
const HEAD_ORC = `<g>
  <path d="M-8 3 Q-9 -8 0 -10 Q9 -8 8 3 Q9 11 4 14 Q0 16 -4 14 Q-9 11 -8 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-8 -2 Q0 -6 8 -2 Q7 0 0 -0.5 Q-7 0 -8 -2 Z" fill="@peauO" opacity="0.55"/>
  <path d="M-2 8 Q0 7 2 8 Q9 9 9 12 Q5 14 0 13.5 Q-5 14 -9 12 Q-9 9 -2 8 Z" fill="@peauH"/>
  <ellipse cx="6.5" cy="10" rx="1.1" ry="0.8" fill="@peauO"/>
  <path d="M-2 12 l-0.3 -2.4 l1.2 0 l0.3 2.4 z M2 12 l0.3 -2.4 l-1.2 0 l-0.3 2.4 z" fill="#e8e0c8"/>
  <path d="M-4 13 q4 1.5 8 0" stroke="#3a2410" stroke-width="0.6" fill="none" opacity="0.5"/>
  ${beastEye(-3, 4, 1.4, 1.5)}${beastEye(3, 4, 1.4, 1.5)}
</g>`;
const ORC_BACK = `<g>
  <path d="M-8 3 Q-9 -8 0 -10 Q9 -8 8 3 Q9 11 4 14 Q0 16 -4 14 Q-9 11 -8 3 Z" fill="@peauO"/>
  <path d="M-3 -6 l1 18 m3 -18 l-1 18 m4 -17 l-1 16" stroke="#2f4a1e" stroke-width="0.6" opacity="0.4"/>
</g>`;
const ORC_PROFILE = `<g>
  <path d="M-7 3 Q-8 -8 1 -10 Q8 -8 8 0 L13 2 Q16 5 13 9 Q10 11 8 9 L7 12 Q3 15 -2 14 Q-7 11 -7 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-7 -2 Q1 -6 8 -1 Q6 1 0 0 Q-6 0 -7 -2 Z" fill="@peauO" opacity="0.5"/>
  <path d="M9 11 q4 1.5 5 -0.5 Q12 12 9 11 Z" fill="@peauH"/>
  <path d="M9.5 11.5 l-0.3 -2 l1 0 l0.3 2 z" fill="#e8e0c8"/>
  ${beastEye(3, 3, 1.3, 1.4)}
</g>`;
// Tête de GOBELIN : grosse boule verte sans cou, énormes oreilles pointues, museau court,
// gueule fendue + crocs inférieurs, un œil orange mi-clos sournois. @peau = vert. Os `tete`.
const HEAD_GOBELIN = `<g>
  <path d="M-9 -2 L-22 -14 Q-20 -2 -12 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M9 -2 L22 -14 Q20 -2 12 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-12 -10 L-18 -13 Q-16 -7 -11 -4 Z" fill="@peauO" opacity="0.5"/>
  <path d="M12 -10 L18 -13 Q16 -7 11 -4 Z" fill="@peauO" opacity="0.5"/>
  <path d="M-10 1 Q-11 -11 0 -12 Q11 -11 10 1 Q9 11 0 15 Q-9 11 -10 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="0" cy="9" rx="6" ry="3.2" fill="@peauO" opacity="0.45"/>
  <path d="M-4 9 q4 2.5 8 0" stroke="#1c0f06" stroke-width="0.9" fill="none"/>
  <path d="M-2 9.6 l-0.4 2.6 l1.2 0 z M2 9.6 l0.4 2.6 l-1.2 0 z" fill="#e8e0c8"/>
  ${beastEye(-3.5, 3, 1.8, 1.9)}
  <path d="M2 2 q3 1 5.5 0" stroke="@peauO" stroke-width="1.3" fill="none" stroke-linecap="round"/>
</g>`;
const GOBELIN_BACK = `<g>
  <path d="M-9 -2 L-22 -14 Q-20 -2 -12 4 Z" fill="@peauO"/><path d="M9 -2 L22 -14 Q20 -2 12 4 Z" fill="@peauO"/>
  <path d="M-10 1 Q-11 -11 0 -12 Q11 -11 10 1 Q9 11 0 15 Q-9 11 -10 1 Z" fill="@peauO"/>
  <path d="M0 -10 L0 13" stroke="@peau" stroke-width="0.5" opacity="0.4"/>
</g>`;
const GOBELIN_PROFILE = `<g>
  <path d="M-2 -2 L-14 -14 Q-14 -2 -6 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-9 1 Q-10 -11 1 -12 Q9 -11 9 -2 L13 0 Q16 3 13 6 Q10 7 8 5 L7 8 Q3 15 -3 13 Q-9 11 -9 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M8 5 q3 1.5 5 0" stroke="#1c0f06" stroke-width="0.8" fill="none"/>
  <path d="M9 5.5 l-0.3 2.2 l1 0 z" fill="#e8e0c8"/>
  ${beastEye(3, 3, 1.6, 1.8)}
</g>`;

// === HOMMES-BÊTES ===========================================================
// Tête CAPRINE (Gor/Ungor/Chamane) : museau long brun, rictus à crocs, yeux jaunes fendus.
// Les CORNES sont un overlay séparé (OV_CORNES). @peau = pelage brun. Os `tete`.
const HEAD_CAPRIN = `<g>
  <path d="M-9 -1 L-13 -7 Q-12 0 -7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M9 -1 L13 -7 Q12 0 7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-7 1 Q-8 -8 0 -9 Q8 -8 7 1 Q6 8 4 11 L2 17 Q0 19 -2 17 L-4 11 Q-6 8 -7 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-4 11 Q0 12 4 11 L3 16 Q0 18 -3 16 Z" fill="@peauO" opacity="0.4"/>
  <ellipse cx="0" cy="16.5" rx="1.6" ry="1.1" fill="#1a0e06"/>
  <path d="M-2.4 13 q2.4 1.3 4.8 0" stroke="#160a04" stroke-width="0.7" fill="none"/>
  <path d="M-1.6 13.4 l-0.3 1.8 l0.9 0 z M1.6 13.4 l0.3 1.8 l-0.9 0 z" fill="#efe6cf"/>
  ${beastEye(-3.2, 4, 1.6, 1.5)}${beastEye(3.2, 4, 1.6, 1.5)}
</g>`;
const CAPRIN_BACK = `<g>
  <path d="M-9 -1 L-13 -7 Q-12 0 -7 2 Z" fill="@peauO"/><path d="M9 -1 L13 -7 Q12 0 7 2 Z" fill="@peauO"/>
  <path d="M-7 1 Q-8 -8 0 -9 Q8 -8 7 1 Q6 8 4 11 L2 17 Q0 19 -2 17 L-4 11 Q-6 8 -7 1 Z" fill="@peauO"/>
  <path d="M0 -8 L0 16" stroke="@peau" stroke-width="0.5" opacity="0.4"/>
</g>`;
const CAPRIN_PROFILE = `<g>
  <path d="M-4 -1 L-9 -7 Q-9 0 -3 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-6 1 Q-7 -8 1 -9 Q8 -8 8 0 L11 4 Q12 9 9 13 L7 17 Q4 19 2 17 L1 12 Q-4 11 -6 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="9" cy="13" rx="1.4" ry="1" fill="#1a0e06"/>
  <path d="M5 13 q3 1.2 4 0" stroke="#160a04" stroke-width="0.7" fill="none"/>
  ${beastEye(2, 3, 1.5, 1.5)}
</g>`;
// Tête de TAUREAU (Minotaure) : museau bovin caramel, gros naseaux, yeux jaunes. Cornes = overlay.
const HEAD_TAUREAU = `<g>
  <path d="M-10 -2 L-15 -7 Q-13 1 -8 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M10 -2 L15 -7 Q13 1 8 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-9 -1 Q-10 -10 0 -11 Q10 -10 9 -1 Q9 8 4 12 L3 17 Q0 19 -3 17 L-4 12 Q-9 8 -9 -1 Z" fill="@peauO" stroke="@peauO" stroke-width="0.4"/>
  <path d="M-6 6 Q0 4 6 6 Q7 12 3 16 Q0 18 -3 16 Q-7 12 -6 6 Z" fill="@peauH"/>
  <ellipse cx="-2.6" cy="15" rx="1.3" ry="1.6" fill="#1a0e06"/><ellipse cx="2.6" cy="15" rx="1.3" ry="1.6" fill="#1a0e06"/>
  ${beastEye(-3.4, 4, 1.7, 1.7)}${beastEye(3.4, 4, 1.7, 1.7)}
</g>`;
const TAUREAU_BACK = `<g>
  <path d="M-10 -2 L-15 -7 Q-13 1 -8 3 Z" fill="@peauO"/><path d="M10 -2 L15 -7 Q13 1 8 3 Z" fill="@peauO"/>
  <path d="M-9 -1 Q-10 -10 0 -11 Q10 -10 9 -1 Q9 8 4 12 L3 17 Q0 19 -3 17 L-4 12 Q-9 8 -9 -1 Z" fill="@peauO"/>
  <path d="M0 -9 L0 16" stroke="@peau" stroke-width="0.5" opacity="0.35"/>
</g>`;
const TAUREAU_PROFILE = `<g>
  <path d="M-4 -2 L-10 -7 Q-9 1 -3 3 Z" fill="@peauO"/>
  <path d="M-7 -1 Q-8 -10 2 -11 Q10 -10 10 -1 L14 3 Q15 10 11 16 L9 18 Q5 20 3 17 L2 12 Q-6 9 -7 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M10 14 Q12 16 11 18 Q9 18 8 16 Z" fill="@peauH"/>
  <ellipse cx="11" cy="15.5" rx="1.2" ry="1.5" fill="#1a0e06"/>
  ${beastEye(3, 3, 1.6, 1.6)}
</g>`;
// === MORTS-VIVANTS ==========================================================
// CRÂNE nu : ivoire (@peau = os), orbites rougeoyantes, dents serrées, museau plat. Os `tete`.
const HEAD_CRANE = `<g>
  <path d="M-7 5 Q-9 -10 0 -12 Q9 -10 7 5 Q6 9 3 9 L3 13 Q0 16 -3 13 L-3 9 Q-6 9 -7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="-3.4" cy="3" rx="2.6" ry="3" fill="#160a06"/><ellipse cx="3.4" cy="3" rx="2.6" ry="3" fill="#160a06"/>
  <circle cx="-3.4" cy="3" r="1.1" fill="#e8861e"/><circle cx="3.4" cy="3" r="1.1" fill="#e8861e"/>
  <path d="M-1.4 7 l-0.6 2.4 l1.2 0 z" fill="#160a06"/>
  <path d="M-3 12 L3 12 M-2.2 9.5 L-2.2 13 M0 9.5 L0 13.5 M2.2 9.5 L2.2 13" stroke="@peauO" stroke-width="0.7"/>
  <rect x="-3" y="9.2" width="6" height="4.4" fill="none" stroke="@peauO" stroke-width="0.5"/>
</g>`;
const CRANE_BACK = `<g>
  <path d="M-7 5 Q-9 -10 0 -12 Q9 -10 7 5 Q6 10 0 13 Q-6 10 -7 5 Z" fill="@peauO"/>
  <path d="M-5 0 Q0 -2 5 0" stroke="@peau" stroke-width="0.5" opacity="0.4" fill="none"/>
</g>`;
const CRANE_PROFILE = `<g>
  <path d="M-6 5 Q-8 -10 2 -12 Q9 -9 8 2 L9 6 Q8 10 4 10 L4 13 Q1 15 -2 13 L-3 9 Q-6 8 -6 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="2.5" cy="3" rx="2.4" ry="2.8" fill="#160a06"/><circle cx="2.5" cy="3" r="1" fill="#e8861e"/>
  <path d="M6 7 l1.5 0.5 l-0.5 1.5 z" fill="#160a06"/>
  <path d="M1 12 L6 11 M2 9.5 L2 12.5 M4 9.2 L4 12" stroke="@peauO" stroke-width="0.6"/>
</g>`;
// Tête POURRIE (zombie) : chair verdâtre, orbites en trous noirs enfoncés, gueule béante.
const HEAD_POURRI = `<g>
  <path d="M-7 3 Q-8 -9 0 -11 Q8 -9 7 3 Q7 9 4 11 L3 14 Q0 16 -3 14 L-4 11 Q-7 9 -7 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-6 -3 Q0 -6 6 -3 Q4 -1 0 -1.5 Q-4 -1 -6 -3 Z" fill="@peauO" opacity="0.5"/>
  <ellipse cx="-3" cy="3" rx="1.8" ry="2.2" fill="#0e0e08"/><ellipse cx="3" cy="3" rx="1.8" ry="2.2" fill="#0e0e08"/>
  <ellipse cx="0" cy="11.5" rx="2.6" ry="2.8" fill="#1c0e08"/>
  <path d="M-2 9.4 l0 4.2 M0 9 l0 4.6 M2 9.4 l0 4.2" stroke="#cabfa8" stroke-width="0.7"/>
  <path d="M-3 8 q3 -1 6 0" stroke="@peauO" stroke-width="0.7" fill="none" opacity="0.6"/>
</g>`;
const POURRI_BACK = `<g>
  <path d="M-7 3 Q-8 -9 0 -11 Q8 -9 7 3 Q7 9 4 11 L3 14 Q0 16 -3 14 L-4 11 Q-7 9 -7 3 Z" fill="@peauO"/>
  <path d="M-3 -2 q3 -1 6 1 M-4 4 q4 0 7 1" stroke="#4a5236" stroke-width="0.6" opacity="0.5" fill="none"/>
</g>`;
const POURRI_PROFILE = `<g>
  <path d="M-6 3 Q-7 -9 1 -11 Q8 -9 8 0 L10 3 Q10 7 7 8 L6 12 Q3 15 0 13 L-1 10 Q-6 9 -6 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="2" cy="3" rx="1.7" ry="2.1" fill="#0e0e08"/>
  <ellipse cx="7" cy="9.5" rx="2.2" ry="2.4" fill="#1c0e08"/>
  <path d="M5.5 7.6 l0 3.8 M7.5 7.6 l0 3.8" stroke="#cabfa8" stroke-width="0.6"/>
</g>`;
// Tête de GOULE de crypte : humanoïde dégénéré décharné (PAS un chien) — crâne chauve gris-vert,
// tempes/joues creusées, orbites enfoncées sombres à petit œil pâle, nez réduit en fentes, large
// gueule lippue pleine de crocs, oreilles pointues. @peau = gris-vert d'espèce. Os `tete`.
const HEAD_GOULE = `<g>
  <path d="M-7 2 Q-8 -10 0 -11 Q8 -10 7 2 Q6 8 3 10 L2 14 Q0 16 -2 14 L-3 10 Q-6 8 -7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-6 4 Q-4.5 7 -3.4 10 M6 4 Q4.5 7 3.4 10" fill="none" stroke="@peauO" stroke-width="1" opacity="0.5"/>
  <ellipse cx="-3.2" cy="3" rx="2.3" ry="2.7" fill="#120e0a"/><ellipse cx="3.2" cy="3" rx="2.3" ry="2.7" fill="#120e0a"/>
  <circle cx="-3.2" cy="3.6" r="0.9" fill="#e8e6cf"/><circle cx="3.2" cy="3.6" r="0.9" fill="#e8e6cf"/>
  <circle cx="-3.1" cy="3.6" r="0.4" fill="#3a1410"/><circle cx="3.3" cy="3.6" r="0.4" fill="#3a1410"/>
  <path d="M-0.8 7 l0 1.8 M0.8 7 l0 1.8" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-5 11 Q0 10.4 5 11 Q4.4 14.6 0 15.4 Q-4.4 14.6 -5 11 Z" fill="#26120e"/>
  <path d="M-3.6 11 l0.8 2.3 l0.8 -2.3 Z M-0.5 11 l0.8 2.6 l0.8 -2.6 Z M2.4 11 l0.7 2.1 l0.7 -2.1 Z" fill="#e6ddc4"/>
  <path d="M-2.6 15 l0.5 -1.6 l0.6 1.6 M1 15 l0.5 -1.6 l0.6 1.6" fill="none" stroke="#e6ddc4" stroke-width="0.6"/>
  <path d="M-7 0 l-3.4 -3 l2.2 4.4 z M7 0 l3.4 -3 l-2.2 4.4 z" fill="@peau" stroke="@peauO" stroke-width="0.4"/>
</g>`;
const GOULE_BACK = `<g>
  <path d="M-7 2 Q-8 -10 0 -11 Q8 -10 7 2 Q6 9 0 12 Q-6 9 -7 2 Z" fill="@peauO"/>
  <path d="M-6 -3 Q0 -5 6 -3" stroke="@peau" stroke-width="0.5" opacity="0.4" fill="none"/>
  <path d="M0 -8 L0 10" stroke="@peau" stroke-width="0.6" opacity="0.35"/>
  <path d="M-7 0 l-3.4 -3 l2.2 4.4 z M7 0 l3.4 -3 l-2.2 4.4 z" fill="@peauO"/>
</g>`;
const GOULE_PROFILE = `<g>
  <path d="M-6 2 Q-7 -10 1 -11 Q8 -10 8 0 L9 4 Q8 8 5 9 L5 13 Q2 15 0 13 L-1 10 Q-6 9 -6 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="2.2" cy="3" rx="2" ry="2.5" fill="#120e0a"/><circle cx="2.4" cy="3.6" r="0.8" fill="#e8e6cf"/><circle cx="2.5" cy="3.6" r="0.35" fill="#3a1410"/>
  <path d="M3 11 Q7 10.4 9 12 Q6.8 14 4 13.4 Z" fill="#26120e"/>
  <path d="M4 11.2 l0.4 1.9 M5.8 11 l0.5 2.1 M7.6 11.4 l0.4 1.7" stroke="#e6ddc4" stroke-width="0.6"/>
  <path d="M-6 -1 l-3.4 -3 l2.2 4.4 z" fill="@peau" stroke="@peauO" stroke-width="0.4"/>
</g>`;
// === GROS / DÉMONS ==========================================================
// Tête de TROLL : petite tête batracienne sans cou, gros yeux globuleux haut placés,
// énorme gueule édentée tordue à crocs. @peau = vert forêt. Os `tete`.
const HEAD_TROLL = `<g>
  <path d="M-8 7 Q-9 -6 0 -8 Q9 -6 8 7 Q8 13 4 15 Q0 17 -4 15 Q-8 13 -8 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <circle cx="-4" cy="-1" r="3.4" fill="#f2c84a"/><circle cx="-4" cy="-1" r="1.4" fill="#160a04"/>
  <circle cx="4" cy="-1" r="3.4" fill="#f2c84a"/><circle cx="4" cy="-1" r="1.4" fill="#160a04"/>
  <path d="M-7 9 Q0 7 7 9 Q6 15 0 16 Q-6 15 -7 9 Z" fill="#1a0e06"/>
  <path d="M-5 9.4 l-0.6 3.4 l1.4 0 z M-1.8 10 l0 4 M1.8 10 l0 4 M5 9.4 l0.6 3.4 l-1.4 0 z" fill="#e6ddc4"/>
  <path d="M-4 13.6 l0 2.2 M4 13.6 l0 2.2" stroke="#e6ddc4" stroke-width="1.4" stroke-linecap="round"/>
</g>`;
const TROLL_BACK = `<g>
  <path d="M-8 7 Q-9 -6 0 -8 Q9 -6 8 7 Q8 13 4 15 Q0 17 -4 15 Q-8 13 -8 7 Z" fill="@peauO"/>
  <path d="M-4 0 q4 -2 8 0" stroke="@peau" stroke-width="0.5" opacity="0.4" fill="none"/>
</g>`;
const TROLL_PROFILE = `<g>
  <path d="M-7 7 Q-8 -6 1 -8 Q9 -6 9 4 L11 7 Q11 13 6 15 Q2 17 -2 15 Q-7 13 -7 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <circle cx="2" cy="-1" r="3.2" fill="#f2c84a"/><circle cx="2" cy="-1" r="1.3" fill="#160a04"/>
  <path d="M1 9 Q6 7 10 9 Q9 15 4 15 Q0 14 1 9 Z" fill="#1a0e06"/>
  <path d="M3 9.4 l0 3.6 M6 9 l0 4 M8.6 9.4 l0.4 3.2" stroke="#e6ddc4" stroke-width="0.8"/>
</g>`;
// Tête d'OGRE : grosse tête bestiale enfoncée, gueule prognathe à défenses inférieures
// remontantes (underbite), gros yeux jaunes, nez large. @peau = tan-cuir. Os `tete`.
const HEAD_OGRE = `<g>
  <path d="M-9 3 Q-10 -8 0 -10 Q10 -8 9 3 Q9 11 5 14 Q0 17 -5 14 Q-9 11 -9 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="0" cy="11.5" rx="6.5" ry="4.2" fill="@peauO" opacity="0.45"/>
  <path d="M-1.6 6.5 q1.6 -1 3.2 0" stroke="@peauO" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="-2.4" cy="8.5" rx="1.1" ry="0.8" fill="@peauO"/><ellipse cx="2.4" cy="8.5" rx="1.1" ry="0.8" fill="@peauO"/>
  <path d="M-5 12 q5 2 10 0" stroke="#3a2410" stroke-width="0.7" fill="none" opacity="0.5"/>
  <path d="M-3.4 12.6 l-0.4 -3 l1.3 0 l0.4 3 z M3.4 12.6 l0.4 -3 l-1.3 0 l-0.4 3 z" fill="#e8e0c8"/>
  ${beastEye(-3.6, 4, 1.6, 1.7)}${beastEye(3.6, 4, 1.6, 1.7)}
</g>`;
const OGRE_BACK = `<g>
  <path d="M-9 3 Q-10 -8 0 -10 Q10 -8 9 3 Q9 11 5 14 Q0 17 -5 14 Q-9 11 -9 3 Z" fill="@peauO"/>
  <path d="M0 -9 L0 15" stroke="@peau" stroke-width="0.5" opacity="0.35"/>
</g>`;
const OGRE_PROFILE = `<g>
  <path d="M-8 3 Q-9 -8 1 -10 Q9 -8 9 0 L13 3 Q14 8 11 12 L9 14 Q4 17 0 14 Q-8 11 -8 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="9" cy="11" rx="3.6" ry="3" fill="@peauO" opacity="0.4"/>
  <ellipse cx="11" cy="9.5" rx="1" ry="0.8" fill="@peauO"/>
  <path d="M7 12.5 l-0.4 -2.6 l1.2 0 l0.4 2.6 z" fill="#e8e0c8"/>
  ${beastEye(3, 3, 1.5, 1.6)}
</g>`;
// Tête de DÉMON (Sanguinaire) : visage tan à énorme gueule de crocs, yeux jaunes, bandeau
// rouge frontal. CORNES = overlay. @peau = tan/chair. Os `tete`.
const HEAD_DEMON = `<g>
  <path d="M-8 1 Q-9 -10 0 -11 Q9 -10 8 1 Q8 7 5 9 L4 14 Q0 18 -4 14 L-5 9 Q-8 7 -8 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-8 -4 Q0 -7 8 -4 Q6 -2 0 -2.5 Q-6 -2 -8 -4 Z" fill="#7a1f1c" opacity="0.85"/>
  <path d="M-6 9 Q0 8 6 9 Q5 16 0 17 Q-5 16 -6 9 Z" fill="#1a0a06"/>
  <path d="M-4.4 9.4 l-0.5 3 l1.2 0 z M-1.5 9.6 l0 3.6 M1.5 9.6 l0 3.6 M4.4 9.4 l0.5 3 l-1.2 0 z" fill="#efe6cf"/>
  <path d="M-3 13.6 l0.4 2.4 M3 13.6 l-0.4 2.4" stroke="#efe6cf" stroke-width="1.2" stroke-linecap="round"/>
  ${beastEye(-3.4, 3, 1.7, 1.7)}${beastEye(3.4, 3, 1.7, 1.7)}
</g>`;
const DEMON_BACK = `<g>
  <path d="M-8 1 Q-9 -10 0 -11 Q9 -10 8 1 Q8 7 5 9 L4 14 Q0 18 -4 14 L-5 9 Q-8 7 -8 1 Z" fill="@peauO"/>
  <path d="M0 -9 L0 14" stroke="@peau" stroke-width="0.5" opacity="0.35"/>
</g>`;
const DEMON_PROFILE = `<g>
  <path d="M-7 1 Q-8 -10 1 -11 Q8 -10 8 -1 L11 1 Q12 6 9 8 L8 13 Q4 18 0 14 L-1 9 Q-7 7 -7 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-7 -4 Q1 -7 8 -3 Q6 -1 0 -2 Q-6 -2 -7 -4 Z" fill="#7a1f1c" opacity="0.85"/>
  <path d="M6 9 Q9 8 11 9 Q10 15 6 15 Q3 14 6 9 Z" fill="#1a0a06"/>
  <path d="M7 9.4 l0 3.4 M9.4 9.2 l0.3 3.2" stroke="#efe6cf" stroke-width="0.8"/>
  ${beastEye(3, 3, 1.6, 1.7)}
</g>`;
// Tête de CYCLOPE (Fimir) : brutale, UN seul gros œil central + lourde arcade, gueule large
// à crocs. @peau = chair gris-vert (Fimir). Os `tete`.
const HEAD_CYCLOPE = `<g>
  <path d="M-8 2 Q-9 -9 0 -11 Q9 -9 8 2 Q9 11 4 14 Q0 16 -4 14 Q-9 11 -8 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-7 -1 Q0 -5 7 -1 Q5 1 0 0.4 Q-5 1 -7 -1 Z" fill="@peauO" opacity="0.6"/>
  <ellipse cx="0" cy="3.6" rx="3.7" ry="3.3" fill="#e8e0c8"/><circle cx="0" cy="4" r="1.9" fill="#b8451c"/><circle cx="0" cy="4" r="0.95" fill="#0a0603"/><circle cx="0.8" cy="3.2" r="0.5" fill="#fff" opacity="0.7"/>
  <path d="M-4 11 Q0 13 4 11 Q3 14.4 0 14.8 Q-3 14.4 -4 11 Z" fill="#1c0f06"/>
  <path d="M-2.6 11.2 l0 2.4 M0 11.6 l0 2.6 M2.6 11.2 l0 2.4" stroke="#e8e0c8" stroke-width="0.6"/>
</g>`;
const CYCLOPE_BACK = `<g>
  <path d="M-8 2 Q-9 -9 0 -11 Q9 -9 8 2 Q8 11 0 14 Q-8 11 -8 2 Z" fill="@peauO"/>
  <path d="M0 -9 L0 13" stroke="@peau" stroke-width="0.5" opacity="0.35"/>
</g>`;
const CYCLOPE_PROFILE = `<g>
  <path d="M-7 2 Q-8 -9 1 -11 Q9 -9 9 0 L12 2 Q13 7 10 10 L8 13 Q4 16 0 13 Q-7 11 -7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="3" cy="3.6" rx="3" ry="3.1" fill="#e8e0c8"/><circle cx="3.4" cy="4" r="1.6" fill="#b8451c"/><circle cx="3.4" cy="4" r="0.8" fill="#0a0603"/>
  <path d="M5 11 Q9 10 11 11 Q9 14 5 14 Q3 13 5 11 Z" fill="#1c0f06"/>
  <path d="M6 11.2 l0 2.4 M8.4 11 l0 2.6" stroke="#e8e0c8" stroke-width="0.6"/>
</g>`;

const HEADS: Record<MonsterHead, PartArt> = {
  chien: { front: HEAD_CHIEN, back: CHIEN_BACK, profile: CHIEN_PROFILE },
  lezard: { front: HEAD_LEZARD, back: LEZARD_BACK, profile: LEZARD_PROFILE },
  ogive: { front: HEAD_OGIVE, back: OGIVE_BACK, profile: OGIVE_PROFILE },
  minuscule: { front: HEAD_MINUSCULE, back: MINUSCULE_BACK, profile: MINUSCULE_PROFILE },
  rat: { front: HEAD_RAT, back: RAT_BACK, profile: RAT_PROFILE },
  orc: { front: HEAD_ORC, back: ORC_BACK, profile: ORC_PROFILE },
  gobelin: { front: HEAD_GOBELIN, back: GOBELIN_BACK, profile: GOBELIN_PROFILE },
  caprin: { front: HEAD_CAPRIN, back: CAPRIN_BACK, profile: CAPRIN_PROFILE },
  taureau: { front: HEAD_TAUREAU, back: TAUREAU_BACK, profile: TAUREAU_PROFILE },
  crane: { front: HEAD_CRANE, back: CRANE_BACK, profile: CRANE_PROFILE },
  pourri: { front: HEAD_POURRI, back: POURRI_BACK, profile: POURRI_PROFILE },
  goule: { front: HEAD_GOULE, back: GOULE_BACK, profile: GOULE_PROFILE },
  troll: { front: HEAD_TROLL, back: TROLL_BACK, profile: TROLL_PROFILE },
  ogre: { front: HEAD_OGRE, back: OGRE_BACK, profile: OGRE_PROFILE },
  demon: { front: HEAD_DEMON, back: DEMON_BACK, profile: DEMON_PROFILE },
  cyclope: { front: HEAD_CYCLOPE, back: CYCLOPE_BACK, profile: CYCLOPE_PROFILE },
};

// --- Jambes (repère os `cuisse`, descend en +y ~50 ; symétrique → pas de miroir) ---
const LEG_CHEVRE = `<g>
  <path d="M-4 0 Q-6 16 -3 26 L3 26 Q6 16 4 0 Z" fill="@peau"/>
  <path d="M-3 6 l1 14 M2 6 l-1 14" stroke="@peauO" stroke-width="0.8" opacity="0.5"/>
  <path d="M-2.4 26 L-3.2 44 L3.2 44 L2.4 26 Z" fill="@peauO"/>
  <path d="M-4 44 L4 44 L5 51 L0 49 L-5 51 Z" fill="@cuir"/>
  <line x1="0" y1="45" x2="0" y2="50" stroke="#0e0805" stroke-width="1"/>
</g>`;
const LEGS: Record<MonsterLeg, string> = { chevre: LEG_CHEVRE };

// --- Bras (repère os `epaule`, descend en +y) ------------------------------
const ARM_TENTACULE = `<g>
  <path d="M-2 -3 Q-10 7 -7 17 Q-5 25 3 26 Q-3 21 -2 13 Q-1 5 0 -2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <circle cx="-5" cy="10" r="1.3" fill="#8a3a1e"/><circle cx="-4" cy="17" r="1.2" fill="#8a3a1e"/><circle cx="-1" cy="23" r="1.1" fill="#8a3a1e"/>
</g>`;
const ARM_GRIFFE = `<g>
  <path d="M0 -2 q-2 14 0 25" stroke="@peau" stroke-width="6.5" fill="none" stroke-linecap="round"/>
  <path d="M-4 25 l-2 7 M-1 27 l0 7 M2 25 l2 6" stroke="@peau" stroke-width="1.7" fill="none" stroke-linecap="round"/>
</g>`;
const ARMS: Record<MonsterArm, string> = { tentacule: ARM_TENTACULE, griffe: ARM_GRIFFE };

// --- Calques (overlays) ----------------------------------------------------
const OV_CORNES = `<path d="M-5 -1 q-2 -9 -8 -12 q2 7 4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/><path d="M5 -1 q2 -9 8 -12 q-2 7 -4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/>`;
// Grandes cornes ivoire de chèvre balayées vers l'arrière (Gor/Ungor/Chamane).
const OV_CORNES_CAPRIN = `<path d="M-6 -4 Q-12 -10 -10 -20 Q-7 -13 -3 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/><path d="M6 -4 Q12 -10 10 -20 Q7 -13 3 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/>`;
// Grandes cornes bovines crème en V (Minotaure/Taureau) — plus écartées.
const OV_CORNES_TAUREAU = `<path d="M-7 -5 Q-16 -10 -16 -22 Q-11 -15 -4 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/><path d="M7 -5 Q16 -10 16 -22 Q11 -15 4 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/>`;
// Longues cornes noires lisses recourbées vers l'arrière (démon de Khorne).
const OV_CORNES_DEMON = `<path d="M-5 -6 Q-13 -12 -10 -26 Q-6 -16 -3 -9 Z" fill="#1a1410" stroke="#000" stroke-width="0.4"/><path d="M5 -6 Q13 -12 10 -26 Q6 -16 3 -9 Z" fill="#1a1410" stroke="#000" stroke-width="0.4"/>`;
const OV_QUEUE = `<path d="M0 2 Q13 9 17 24 Q11 23 7 15 Q3 9 0 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`;
// Queue de RAT (skaven) — longue, NUE, ROSE, en S, traînant au sol : c'est LE tell de
// silhouette du skaven (sans elle il lit comme un nain trapu brun). Repère os `bassin`.
const OV_QUEUE_RAT = `<path d="M0 3 Q16 6 22 18 Q26 28 20 34 Q24 26 17 21 Q9 17 1 14 Z" fill="#d39a8e" stroke="#9a6a60" stroke-width="0.7"/><path d="M2 5 Q15 8 20 18" fill="none" stroke="#b87f74" stroke-width="0.6" opacity="0.6"/><path d="M6 9 q1 1 0 2 M11 12 q1 1 0 2 M16 16 q1 1 0 2" stroke="#9a6a60" stroke-width="0.5" fill="none" opacity="0.6"/>`;
// Côtes apparentes (mort-vivant) — calque sur le torse, repère os `torse` (haut ~ -28..-2).
// Sillons SOMBRES (creux entre les côtes) + fine arête claire au-dessus (relief) + sternum
// sombre : sur un corps en os/chair claire, des nervures @peauH (claires) disparaissaient —
// il faut des CREUX sombres pour que la cage thoracique se lise.
const OV_COTES = `<g><path d="M-7 -22 Q0 -19 7 -22 M-8 -16 Q0 -12 8 -16 M-8 -10 Q0 -6 8 -10 M-7 -4 Q0 0 7 -4" stroke="#2e2a1e" stroke-width="1.3" fill="none" opacity="0.7"/><path d="M-7 -20.6 Q0 -17.6 7 -20.6 M-8 -14.6 Q0 -10.6 8 -14.6 M-8 -8.6 Q0 -4.6 8 -8.6" stroke="@peauH" stroke-width="0.55" fill="none" opacity="0.65"/><path d="M0 -24 L0 -1" stroke="#2e2a1e" stroke-width="1.1" opacity="0.6"/></g>`;
// Longues griffes recourbées aux mains (goule) — calque sur l'os `main` (poignet origine,
// doigts vers +y). Griffes sombres dépassant des doigts.
const OV_GRIFFES = `<path d="M-2.6 3.4 q-1.4 3 -1.2 6 M-0.9 4.4 q-0.5 3.4 -0.2 6.4 M0.9 4.4 q0.5 3.4 0.2 6.4 M2.6 3.4 q1.4 3 1.2 6" stroke="#241a12" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
// Plaie de chair rouge exposée (zombie) — calque torse.
const OV_PLAIE = `<ellipse cx="-2" cy="-10" rx="3" ry="4" fill="#7a1010"/><ellipse cx="-2" cy="-10" rx="1.6" ry="2.6" fill="#b03a2e"/>`;
// Peau verruqueuse + ventre pâle (troll) — calque torse : ventre clair (@peauH) + pustules/lumps
// dépareillés (@peauO ombre + @peauH reflet) → la masse verte uniforme cesse de lire « blob ».
const OV_VERRUES = `<g>`
  + `<ellipse cx="0" cy="6" rx="9" ry="12" fill="@peauH" opacity="0.35"/>`
  + `<circle cx="-7" cy="-14" r="1.7" fill="@peauO"/><circle cx="-6.3" cy="-14.7" r="0.7" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="6" cy="-11" r="1.9" fill="@peauO"/><circle cx="6.7" cy="-11.7" r="0.8" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="-3" cy="-3" r="1.4" fill="@peauO"/><circle cx="-2.5" cy="-3.5" r="0.6" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="8" cy="2" r="1.6" fill="@peauO"/><circle cx="8.6" cy="1.4" r="0.6" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="-8" cy="1" r="1.3" fill="@peauO"/>`
  + `<circle cx="2" cy="-17" r="1.3" fill="@peauO"/><circle cx="2.6" cy="-17.6" r="0.6" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="4" cy="14" r="1.4" fill="@peauO"/>`
  + `</g>`;
// Énorme ventre globulaire à gutplate (ogre) — calque bassin/torse bas. Repère os `torse`.
const OV_VENTRE = `<g><ellipse cx="0" cy="4" rx="20" ry="17" fill="@peau" stroke="@peauO" stroke-width="0.8"/><ellipse cx="0" cy="6" rx="13" ry="11" fill="@metal" stroke="#3a4048" stroke-width="0.8"/><circle cx="0" cy="6" r="3.4" fill="#5a6068" stroke="#3a4048" stroke-width="0.6"/><circle cx="0" cy="6" r="1.4" fill="#2a3036"/></g>`;
// Col de cape dressé en éventail (vampire) — calque DERRIÈRE le torse (col Dracula montant
// derrière la nuque/les épaules). Repère os `torse` (nuque ≈ y -30, épaules ≈ ±14 à y -26).
const OV_COL_CAPE = `<g>`
  + `<path d="M-3 -27 L-23 -43 Q-25 -25 -8 -19 Z" fill="#15060a" stroke="#000" stroke-width="0.6"/>`
  + `<path d="M3 -27 L23 -43 Q25 -25 8 -19 Z" fill="#15060a" stroke="#000" stroke-width="0.6"/>`
  + `<path d="M-4 -26 L-18 -38 Q-19 -25 -8 -20 Z" fill="#6a0e18" opacity="0.9"/>`
  + `<path d="M4 -26 L18 -38 Q19 -25 8 -20 Z" fill="#6a0e18" opacity="0.9"/>`
  + `</g>`;
// Crocs de vampire (calque sur la tête, par-dessus le visage humain).
const OV_CROCS = `<path d="M-2 11 l-0.5 2.4 l1 0 z M2 11 l0.5 2.4 l-1 0 z" fill="#f4ecd8" stroke="#b8a888" stroke-width="0.3"/>`;
// Membres rouge sang (démon de Khorne bicolore) — calques sur épaules/cuisses (repère os).
// Highlight clair (côté lumière) + arête sombre (côté ombre) → volume musculaire, pas un aplat.
const OV_BRAS_ROUGE = `<rect x="-3.4" y="-2" width="6.8" height="36" rx="3.2" fill="#7a1f1c" stroke="#4a1210" stroke-width="0.5"/><path d="M-1.6 1 Q-2.4 18 -1.6 33" stroke="#ad332a" stroke-width="1.5" fill="none" opacity="0.75" stroke-linecap="round"/><path d="M2 3 Q2.6 18 2 31" stroke="#3a0e0c" stroke-width="1.1" fill="none" opacity="0.6" stroke-linecap="round"/>`;
const OV_CUISSE_ROUGE = `<path d="M-4.6 0 Q-5 26 -3 50 L4 50 Q5 26 4.6 0 Z" fill="#7a1f1c" stroke="#4a1210" stroke-width="0.5"/><path d="M-1.8 3 Q-2 26 -1 47" stroke="#ad332a" stroke-width="1.6" fill="none" opacity="0.75" stroke-linecap="round"/><path d="M2.6 3 Q3 26 2.4 47" stroke="#3a0e0c" stroke-width="1.1" fill="none" opacity="0.55" stroke-linecap="round"/>`;
// Trois stries rouge sombre verticales sur le torse (démon) — calque torse, par-dessus la peau.
const OV_STRIES = `<path d="M-3 -22 L-3 4 M0 -24 L0 6 M3 -22 L3 4" stroke="#7a1f1c" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/>`;

export interface MonsterInjection {
  /** part par os (remplace la part normale de l'os) — multi-vues (front/back/profile). */
  replace: Partial<Record<BoneId, PartArt>>;
  /** calques additionnels. */
  overlays: RigOverlay[];
}

/** Traduit une sélection MonsterParts en surcharges par os + calques. Tolère les
 *  clés inconnues (ignorées) pour accepter les libellés libres de la scène.
 *  `view` : certains calques sont propres à une vue (les crocs du vampire = détail de FACE ;
 *  les dessiner de dos/de profil les ferait flotter sur la nuque ou hors du museau). */
export function monsterInjection(m: MonsterParts, view: 'front' | 'back' | 'profile' = 'front'): MonsterInjection {
  const replace: Partial<Record<BoneId, PartArt>> = {};
  const overlays: RigOverlay[] = [];
  const head = m.tete ? HEADS[m.tete as MonsterHead] : undefined;
  const armG = m.brasG ? ARMS[m.brasG as MonsterArm] : undefined;
  const armD = m.brasD ? ARMS[m.brasD as MonsterArm] : undefined;
  const legs = m.jambes ? LEGS[m.jambes as MonsterLeg] : undefined;
  if (head) replace.tete = head;
  if (armG) replace.epauleG = armG;
  if (armD) replace.epauleD = armD;
  if (legs) { replace.cuisseG = legs; replace.cuisseD = legs; } // 2 jambes (symétrique)
  // Cornes : la FORME suit la tête (caprine ivoire / bovine en V / démon noir),
  // sinon les cornes de mutant génériques. Dessinées DERRIÈRE la tête (layer bas).
  if (m.cornes) {
    const cornes = m.tete === 'taureau' ? OV_CORNES_TAUREAU
      : m.tete === 'demon' ? OV_CORNES_DEMON
      : (m.tete === 'caprin' || m.tete === 'gobelin') ? OV_CORNES_CAPRIN
      : OV_CORNES;
    overlays.push({ bone: 'tete', svg: cornes, behind: true });
  }
  // Queue : rose et longue pour un homme-rat (tell skaven), sinon queue générique en pelage.
  if (m.queue) overlays.push({ bone: 'bassin', svg: m.tete === 'rat' ? OV_QUEUE_RAT : OV_QUEUE, behind: true });
  if (m.cotes) overlays.push({ bone: 'torse', svg: OV_COTES });
  if (m.griffes) { overlays.push({ bone: 'mainG', svg: OV_GRIFFES }); overlays.push({ bone: 'mainD', svg: OV_GRIFFES }); }
  if (m.plaie) overlays.push({ bone: 'torse', svg: OV_PLAIE });
  if (m.verrues) overlays.push({ bone: 'torse', svg: OV_VERRUES });
  if (m.ventre) overlays.push({ bone: 'torse', svg: OV_VENTRE, behind: true });
  // Cape : le col haut est désormais dans la TENUE Vampire (réutilisable) ; ici on ne garde que
  // les CROCS, détail de visage propre au vampire, en vue de FACE seulement (sinon ils flottaient
  // sur la nuque de dos / hors du museau de profil).
  if (m.cape && view === 'front') overlays.push({ bone: 'tete', svg: OV_CROCS });
  if (m.membresRouges) {
    overlays.push({ bone: 'epauleG', svg: OV_BRAS_ROUGE });
    overlays.push({ bone: 'epauleD', svg: OV_BRAS_ROUGE });
    overlays.push({ bone: 'cuisseG', svg: OV_CUISSE_ROUGE });
    overlays.push({ bone: 'cuisseD', svg: OV_CUISSE_ROUGE });
    overlays.push({ bone: 'torse', svg: OV_STRIES });
  }
  return { replace, overlays };
}

/** Catalogues pour l'éditeur (libellés FR). '' = humain / aucun. */
export const MONSTER_HEAD_OPTIONS: { key: '' | MonsterHead; label: string }[] = [
  { key: '', label: 'Humaine' }, { key: 'chien', label: 'Chien / loup' }, { key: 'lezard', label: 'Reptilien' },
  { key: 'ogive', label: 'Tête en ogive' }, { key: 'minuscule', label: 'Tête minuscule (crétin)' },
  { key: 'rat', label: 'Rat / skaven' },
  { key: 'orc', label: 'Orc' }, { key: 'gobelin', label: 'Gobelin' },
  { key: 'caprin', label: 'Caprine (homme-bête)' }, { key: 'taureau', label: 'Taureau (minotaure)' },
  { key: 'crane', label: 'Crâne (squelette)' }, { key: 'pourri', label: 'Chair pourrie (zombie)' },
  { key: 'goule', label: 'Goule (décharné, crocs)' },
  { key: 'troll', label: 'Troll (batracien)' }, { key: 'ogre', label: 'Ogre (prognathe)' },
  { key: 'demon', label: 'Démon (cornu, gueule)' }, { key: 'cyclope', label: 'Cyclope (œil unique)' },
];
export const MONSTER_ARM_OPTIONS: { key: '' | MonsterArm; label: string }[] = [
  { key: '', label: 'Humain' }, { key: 'tentacule', label: 'Tentacule' }, { key: 'griffe', label: 'Griffe' },
];
export const MONSTER_LEG_OPTIONS: { key: '' | MonsterLeg; label: string }[] = [
  { key: '', label: 'Humaines' }, { key: 'chevre', label: 'Pattes de chèvre' },
];
