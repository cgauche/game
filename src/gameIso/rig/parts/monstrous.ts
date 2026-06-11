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
import { HEADS, ARMS, LEGS } from './monster';
import { AILES_FRONT, AILES_BACK, AILES_PROFILE } from './wings';
import { dorsalOverlays } from './dorsal';

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
  griffes?: boolean; // longues griffes aux mains (goule)
  verrues?: boolean; // peau verruqueuse + ventre pâle (troll) — casse l'aplat « blob »
  plaie?: boolean; // plaie de chair exposée (zombie)
  cape?: boolean; // col de cape dressé en éventail + crocs (vampire)
  membresRouges?: boolean; // bras/jambes rouge sang + stries au torse (démon bicolore)
  ailes?: boolean; // ailes emplumées repliées dans le dos (plan dédié — harpie, démon ailé)
}

// --- Calques (overlays) ----------------------------------------------------
export const OV_CORNES = `<path d="M-5 -1 q-2 -9 -8 -12 q2 7 4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/><path d="M5 -1 q2 -9 8 -12 q-2 7 -4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/>`;
// Grandes cornes ivoire de chèvre balayées vers l'arrière (Gor/Ungor/Chamane).
export const OV_CORNES_CAPRIN = `<path d="M-6 -4 Q-12 -10 -10 -20 Q-7 -13 -3 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/><path d="M6 -4 Q12 -10 10 -20 Q7 -13 3 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/>`;
// Grandes cornes bovines crème en V (Minotaure/Taureau) — plus écartées.
export const OV_CORNES_TAUREAU = `<path d="M-7 -5 Q-16 -10 -16 -22 Q-11 -15 -4 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/><path d="M7 -5 Q16 -10 16 -22 Q11 -15 4 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/>`;
// Longues cornes noires lisses recourbées vers l'arrière (démon de Khorne).
export const OV_CORNES_DEMON = `<path d="M-5 -6 Q-13 -12 -10 -26 Q-6 -16 -3 -9 Z" fill="#1a1410" stroke="#000" stroke-width="0.4"/><path d="M5 -6 Q13 -12 10 -26 Q6 -16 3 -9 Z" fill="#1a1410" stroke="#000" stroke-width="0.4"/>`;
export const OV_QUEUE = `<path d="M0 2 Q13 9 17 24 Q11 23 7 15 Q3 9 0 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`;
// Queue de RAT (skaven) — longue, NUE, ROSE, en S, traînant au sol : c'est LE tell de
// silhouette du skaven (sans elle il lit comme un nain trapu brun). Repère os `bassin`.
export const OV_QUEUE_RAT = `<path d="M0 3 Q16 6 22 18 Q26 28 20 34 Q24 26 17 21 Q9 17 1 14 Z" fill="#d39a8e" stroke="#9a6a60" stroke-width="0.7"/><path d="M2 5 Q15 8 20 18" fill="none" stroke="#b87f74" stroke-width="0.6" opacity="0.6"/><path d="M6 9 q1 1 0 2 M11 12 q1 1 0 2 M16 16 q1 1 0 2" stroke="#9a6a60" stroke-width="0.5" fill="none" opacity="0.6"/>`;
// Longues griffes recourbées aux mains (goule) — calque sur l'os `main` (poignet origine,
// doigts vers +y). Griffes sombres dépassant des doigts.
export const OV_GRIFFES = `<path d="M-2.6 3.4 q-1.4 3 -1.2 6 M-0.9 4.4 q-0.5 3.4 -0.2 6.4 M0.9 4.4 q0.5 3.4 0.2 6.4 M2.6 3.4 q1.4 3 1.2 6" stroke="#241a12" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
// Plaie de chair rouge exposée (zombie) — calque torse.
export const OV_PLAIE = `<ellipse cx="-2" cy="-10" rx="3" ry="4" fill="#7a1010"/><ellipse cx="-2" cy="-10" rx="1.6" ry="2.6" fill="#b03a2e"/>`;
// Peau verruqueuse + ventre pâle (troll) — calque torse : ventre clair (@peauH) + pustules/lumps
// dépareillés (@peauO ombre + @peauH reflet) → la masse verte uniforme cesse de lire « blob ».
export const OV_VERRUES = `<g>`
  + `<ellipse cx="0" cy="6" rx="9" ry="12" fill="@peauH" opacity="0.35"/>`
  + `<circle cx="-7" cy="-14" r="1.7" fill="@peauO"/><circle cx="-6.3" cy="-14.7" r="0.7" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="6" cy="-11" r="1.9" fill="@peauO"/><circle cx="6.7" cy="-11.7" r="0.8" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="-3" cy="-3" r="1.4" fill="@peauO"/><circle cx="-2.5" cy="-3.5" r="0.6" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="8" cy="2" r="1.6" fill="@peauO"/><circle cx="8.6" cy="1.4" r="0.6" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="-8" cy="1" r="1.3" fill="@peauO"/>`
  + `<circle cx="2" cy="-17" r="1.3" fill="@peauO"/><circle cx="2.6" cy="-17.6" r="0.6" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="4" cy="14" r="1.4" fill="@peauO"/>`
  + `</g>`;
// Crocs de vampire (calque sur la tête, par-dessus le visage humain).
export const OV_CROCS = `<path d="M-2 11 l-0.5 2.4 l1 0 z M2 11 l0.5 2.4 l-1 0 z" fill="#f4ecd8" stroke="#b8a888" stroke-width="0.3"/>`;
// Membres rouge sang (démon de Khorne bicolore) — calques sur épaules/cuisses (repère os).
// Highlight clair (côté lumière) + arête sombre (côté ombre) → volume musculaire, pas un aplat.
export const OV_BRAS_ROUGE = `<rect x="-3.4" y="-2" width="6.8" height="36" rx="3.2" fill="#7a1f1c" stroke="#4a1210" stroke-width="0.5"/><path d="M-1.6 1 Q-2.4 18 -1.6 33" stroke="#ad332a" stroke-width="1.5" fill="none" opacity="0.75" stroke-linecap="round"/><path d="M2 3 Q2.6 18 2 31" stroke="#3a0e0c" stroke-width="1.1" fill="none" opacity="0.6" stroke-linecap="round"/>`;
export const OV_CUISSE_ROUGE = `<path d="M-4.6 0 Q-5 26 -3 50 L4 50 Q5 26 4.6 0 Z" fill="#7a1f1c" stroke="#4a1210" stroke-width="0.5"/><path d="M-1.8 3 Q-2 26 -1 47" stroke="#ad332a" stroke-width="1.6" fill="none" opacity="0.75" stroke-linecap="round"/><path d="M2.6 3 Q3 26 2.4 47" stroke="#3a0e0c" stroke-width="1.1" fill="none" opacity="0.55" stroke-linecap="round"/>`;
// Trois stries rouge sombre verticales sur le torse (démon) — calque torse, par-dessus la peau.
export const OV_STRIES = `<path d="M-3 -22 L-3 4 M0 -24 L0 6 M3 -22 L3 4" stroke="#7a1f1c" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/>`;

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
  const head = m.tete ? HEADS[m.tete] : undefined;
  const armG = m.brasG ? ARMS[m.brasG] : undefined;
  const armD = m.brasD ? ARMS[m.brasD] : undefined;
  const legs = m.jambes ? LEGS[m.jambes] : undefined;
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
  if (m.griffes) { overlays.push({ bone: 'mainG', svg: OV_GRIFFES }); overlays.push({ bone: 'mainD', svg: OV_GRIFFES }); }
  if (m.plaie) overlays.push({ bone: 'torse', svg: OV_PLAIE });
  if (m.verrues) overlays.push({ bone: 'torse', svg: OV_VERRUES });
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
  // Ailes : appendice DORSAL (règles de vue/profondeur codifiées par dorsalOverlays) —
  // monsterInjection composant PAR vue, on ne garde que le calque de la vue courante.
  if (m.ailes) {
    overlays.push(...dorsalOverlays('torse', { front: AILES_FRONT, back: AILES_BACK, profile: AILES_PROFILE }).filter((o) => !o.view || o.view === view));
  }
  return { replace, overlays };
}

// Catalogues pour l'éditeur — DÉRIVÉS du registre monster/defs/ (1 part = 1 fichier).
export { MONSTER_HEAD_OPTIONS, MONSTER_ARM_OPTIONS, MONSTER_LEG_OPTIONS } from './monster';
