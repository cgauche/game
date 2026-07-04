/**
 * Parts MONSTRUEUSES du rig — pour « construire son mutant » par slot, comme on
 * choisit la tête/le bras d'un PJ. Dessinées dans le repère LOCAL de l'os porteur
 * (mêmes conventions que cosmetic.ts / generic.ts) :
 *   - tête : repère de l'os `tete`, visage ≈ (0,7) r9 (remplace visage+cheveux).
 *   - bras : repère de l'os `epaule`, le membre descend en +y (~26-30), largeur ~6.
 *            Asymétrie native : on remplace UN seul bras (epauleG ou epauleD).
 *   - cornes/queue : calques (overlay) sur `tete` / `bassin` — FORME déclarée PAR la tête.
 * Aucune arme ici : l'arme reste de l'ÉQUIPEMENT (rendue par le rig si équipée).
 */
import type { BoneId, RigOverlay } from '../bones';
import { pickView, type PartArt } from './types';
import { HEADS, ARMS, LEGS, HEAD_CORNES, HEAD_QUEUE } from './monster';
import { AILES_FRONT, AILES_BACK, AILES_PROFILE, AILES_CUIR_FRONT, AILES_CUIR_BACK, AILES_CUIR_PROFILE } from './wings';
import { dorsalOverlays } from './dorsal';
import {
  OV_CORNES, OV_QUEUE, OV_GRIFFES, OV_PLAIE, OV_VERRUES, OV_CROCS, OV_BRAS_ROUGE, OV_CUISSE_ROUGE, OV_STRIES,
} from './monsterOverlays';

// Calques d'overlay : art PUR déplacé dans `monsterOverlays.ts` (LEAF sans cycle : partagé par les
// head defs qui DÉCLARENT leurs cornes/queue). Ré-exportés ici → les importeurs existants
// (`elements/defs`, `creatures/defs`, `traitVisuals`, `from './monstrous'`) restent valides.
export {
  OV_CORNES, OV_CORNES_CAPRIN, OV_CORNES_GOR, OV_CORNES_VESTIGIALES, OV_CORNES_TAUREAU,
  OV_CORNES_DEMON, OV_QUEUE, OV_QUEUE_RAT, OV_GRIFFES, OV_PLAIE, OV_VERRUES, OV_CROCS,
  OV_BRAS_ROUGE, OV_CUISSE_ROUGE, OV_STRIES,
} from './monsterOverlays';

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
  /** ailes repliées dans le dos — true = emplumées (harpie) ; 'cuir' = membrane (furie, démon). */
  ailes?: boolean | 'cuir';
}

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
  // Un bras monstrueux (pince, tentacule) intègre sa propre extrémité : on EFFACE le poing
  // générique de ce côté (sinon il flotte au milieu de la pince).
  if (armG) { replace.epauleG = armG; replace.mainG = ''; }
  if (armD) { replace.epauleD = armD; replace.mainD = ''; }
  if (legs) { replace.cuisseG = legs; replace.cuisseD = legs; } // 2 jambes (symétrique)
  // Cornes/queue : la FORME est DÉCLARÉE PAR la tête (monster/defs : `cornes`/`queue`) — bovine en V
  // pour taureau, noire de démon, ivoire de chèvre pour caprin/gobelin, rose de rat pour la queue —
  // sinon le calque GÉNÉRIQUE. Plus de name-matcher `m.tete === '…'` : donnée sur la part de tête.
  if (m.cornes) overlays.push({ bone: 'tete', svg: pickView(HEAD_CORNES[m.tete ?? ''] ?? OV_CORNES, view), behind: true });
  if (m.queue) overlays.push({ bone: 'bassin', svg: pickView(HEAD_QUEUE[m.tete ?? ''] ?? OV_QUEUE, view), behind: true });
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
    const set = m.ailes === 'cuir'
      ? { front: AILES_CUIR_FRONT, back: AILES_CUIR_BACK, profile: AILES_CUIR_PROFILE }
      : { front: AILES_FRONT, back: AILES_BACK, profile: AILES_PROFILE };
    overlays.push(...dorsalOverlays('torse', set).filter((o) => !o.view || o.view === view));
  }
  return { replace, overlays };
}

// Catalogues pour l'éditeur — DÉRIVÉS du registre monster/defs/ (1 part = 1 fichier).
export { MONSTER_HEAD_OPTIONS, MONSTER_ARM_OPTIONS, MONSTER_LEG_OPTIONS } from './monster';
