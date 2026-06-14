import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import type { SceneEntity } from '../state/scene';
import { isOutOfAction } from '../engine/conditions';
import { AnimatedRigToken } from './AnimatedRigToken';
import { AmbientRigToken } from './AmbientRigToken';
import { AnimatedPlanToken } from './AnimatedPlanToken';
import { enemyRigProfile, entityRigProfile, classifyEnemy } from './rig/enemyProfile';
import { bodyPlanOf } from './rig/bodyPlan';
import { bipedSpeciesScale, creatureSpeciesScale } from './rig/creatures';
import { eyesArtFromKeys } from './rig/parts/eyes';
import { entitySprite, pnjSprite } from './sprites';
import { hashSeed } from './appearance';
import { resolveRig, RigSprite } from './rig/composeRig';
import { defaultAppearance, type Appearance } from './rig/appearance';
import { equipFromCombatant, type EquipCtx } from './rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from './rig/parts/combatantVisuals';
import { groundStateOf } from './groundPose';
import type { RigOverlay } from './rig/bones';

/**
 * Sujet à rendre comme token. Discriminé : combattant (combat), entité de scène
 * (exploration/éditeur) ou leader de groupe (token '__party' en exploration).
 */
export type TokenSubject =
  | { kind: 'combatant'; combatant: Combatant }
  | { kind: 'sceneEntity'; ent: SceneEntity }
  | { kind: 'partyLeader'; leader?: Combatant };

export interface PickedBackend {
  /** Moteur de rendu choisi. `bakedDeath` se dérive : `backend !== 'sprite'`. */
  backend: 'rig' | 'plan' | 'sprite';
  /** Le CORPS (nœud React) à déposer dans BodyToken/tokenNode. */
  body: ReactNode;
  /** Multiplicateur de taille d'espèce (bipède/créature) — la base reste au site appelant. */
  speciesScale: number;
  /** Clé de routage bus/facing, préfixe déjà appliqué (`c.id` / `e-<id>` / `__party`). */
  id: string;
  /** viewBox (repère 120×150 du corps) cadrant le VISAGE pour un portrait (RigPortrait / disque top).
   *  Humanoïde = gros plan tête ; créature = haut-avant (la tête varie selon le gabarit). */
  portraitBox: string;
  /** Vue du dessus : ce sujet doit être rendu en disque-portrait centré (true) ou billboard ancré (false). */
  flat: boolean;
}

/** Gros plan VISAGE d'un humanoïde (tête centrée ~(60,46) dans la boîte 120×150). */
const FACE_BOX = '42 28 38 38';
/** Cadre PORTRAIT d'une créature non-bipède : haut-avant du corps (générique, raffinable par gabarit). */
const CREATURE_BOX = '22 14 80 80';

/**
 * Vue de face cadrée sur le VISAGE (top-mode). Résout le rig en vue `front` et cadre le viewBox sur
 * l'os `tete` RÉSOLU (centré sur LE visage de chaque race — Nain/Ogre/… quelle que soit sa taille).
 * Math PURE, partagée par le pion-portrait de la carte (BodyToken flat) ET la vignette HUD (RigPortrait).
 */
function faceFrame(appearance: Appearance, equip: EquipCtx, tenue: string | undefined, overlays: RigOverlay[]): { body: ReactNode; box: string } {
  const bones = resolveRig(appearance, equip, {}, tenue, 'front', overlays);
  const tete = bones.find((b) => b.id === 'tete');
  const m = tete?.matrix ?? [1, 0, 0, 1, 60, 54];
  const sy = tete?.scale[1] ?? 1;
  const cx = m[4];
  const cy = m[5] + 10 * sy; // le visage est dessiné SOUS l'origine de l'os tete (crâne) → on descend le cadre
  const S = 46 * Math.max(0.9, sy); // cadre proportionnel à la taille de la tête (Ogre > Nain)
  return {
    body: <RigSprite appearance={appearance} equip={equip} career={tenue} view="front" overlays={overlays} />,
    box: `${(cx - S / 2).toFixed(1)} ${(cy - S / 2).toFixed(1)} ${S.toFixed(1)} ${S.toFixed(1)}`,
  };
}

/**
 * CLASSIFIEUR UNIQUE : décide quel backend monter (rig humanoïde / plan non-bipède / sprite)
 * et produit le corps prêt à insérer. Source unique remplaçant l'échelle
 * `isHero / enemyRigProfile / entityRigProfile / bodyPlanOf` dupliquée aux 4 sites de dispatch
 * (IsoStage combat + exploration + leader, éditeur via EntityToken).
 *
 * `view: 'top'` (vue du dessus) → les ACTEURS deviennent un disque-portrait (vue de face cadrée,
 * `flat: true`) ; le décor reste un billboard de face (`flat: false`). En iso, comportement inchangé.
 *
 * NE porte AUCUNE info de layout (ombre/anneau/dim/échelle de base/walking) : ça reste au site
 * appelant (BodyToken/token/tokenNode). Les deux moteurs d'animation (rig à clips vs plan rAF)
 * restent DEUX backends distincts (asymétrie essentielle : parade/sort/clips d'arme côté rig).
 */
export function pickBackend(subject: TokenSubject, view: 'iso' | 'top' = 'iso'): PickedBackend {
  const top = view === 'top';

  if (subject.kind === 'combatant') {
    const c = subject.combatant;
    // On décide par le PLAN CORPOREL (humanoïde vs créature), PAS par le camp. `kind==='hero'` est
    // surchargé (PJ bipède OU acteur allié — cheval libre compris) : router sur kind dessinerait un
    // cheval allié comme un humanoïde. Donc : nom humanoïde → rig ; créature → gabarit animé (plan).
    if (classifyEnemy(c.name) === 'rig') {
      const prof = c.kind === 'hero' ? null : enemyRigProfile(c);
      if (top) {
        const appearance = combatantAppearance(prof?.appearance ?? c.appearance ?? defaultAppearance(c), c);
        const equip = prof?.equip ?? equipFromCombatant(c);
        const tenue = prof?.tenue ?? c.career;
        const f = faceFrame(appearance, equip, tenue, combatantOverlays(c));
        return { backend: 'rig', id: c.id, speciesScale: bipedSpeciesScale(c.name), portraitBox: f.box, flat: true, body: f.body };
      }
      return { backend: 'rig', id: c.id, speciesScale: bipedSpeciesScale(c.name), portraitBox: FACE_BOX, flat: false, body: <AnimatedRigToken combatant={c} profile={prof ?? undefined} pos={c.pos} /> };
    }
    return { backend: 'plan', id: c.id, speciesScale: creatureSpeciesScale(c.name), portraitBox: CREATURE_BOX, flat: top, body: <AnimatedPlanToken id={c.id} name={c.name} colors={c.appearance?.colors} eyes={c.appearance?.eyes} dead={groundStateOf(c) === 'corpse' || isOutOfAction(c)} prone={groundStateOf(c) === 'prone'} pos={c.pos} /> };
  }

  if (subject.kind === 'partyLeader') {
    const leader = subject.leader;
    if (leader) {
      if (top) {
        const f = faceFrame(combatantAppearance(leader.appearance ?? defaultAppearance(leader), leader), equipFromCombatant(leader), leader.career, combatantOverlays(leader));
        return { backend: 'rig', id: '__party', speciesScale: 1, portraitBox: f.box, flat: true, body: f.body };
      }
      return { backend: 'rig', id: '__party', speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <AnimatedRigToken combatant={leader} /> };
    }
    return { backend: 'sprite', id: '__party', speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <g dangerouslySetInnerHTML={{ __html: pnjSprite() }} /> };
  }

  // sceneEntity (exploration + éditeur)
  const ent = subject.ent;
  const id = `e-${ent.id}`;
  const seed = ent.appearance?.seed ?? hashSeed(ent.id);
  const prof =
    ent.kind === 'personnage'
      ? entityRigProfile(ent.ref ?? ent.label ?? 'Villageois', seed, { species: ent.appearance?.species, tenue: ent.appearance?.tenue, monster: ent.appearance?.monster, weapon: ent.weapon, colors: ent.appearance?.colors, parts: ent.appearance?.parts, sex: ent.appearance?.sex, build: ent.appearance?.build, eyes: ent.appearance?.eyes })
      : null;
  if (prof) {
    if (top) {
      const f = faceFrame(prof.appearance, prof.equip, prof.tenue, []);
      return { backend: 'rig', id, speciesScale: bipedSpeciesScale(ent.ref ?? ent.label ?? ''), portraitBox: f.box, flat: true, body: f.body };
    }
    return { backend: 'rig', id, speciesScale: bipedSpeciesScale(ent.ref ?? ent.label ?? ''), portraitBox: FACE_BOX, flat: false, body: <AmbientRigToken profile={prof} anim={ent.anim ?? ''} id={id} facing={ent.facing} pos={ent.pos} /> };
  }
  const refName = ent.ref ?? ent.label ?? '';
  const planId = bodyPlanOf(refName);
  if (planId !== 'biped' && planId !== 'monolithic') {
    // ent.appearance.eyes = CLÉS du catalogue (donnée éditeur) → résolues en arts ici
    // (les combattants passent par riggedAppearance au spawn, qui résout déjà).
    return { backend: 'plan', id, speciesScale: creatureSpeciesScale(refName), portraitBox: CREATURE_BOX, flat: top, body: <AnimatedPlanToken id={id} name={refName} colors={ent.appearance?.colors} eyes={eyesArtFromKeys(ent.appearance?.eyes)} facing={ent.facing} pos={ent.pos} /> };
  }
  return { backend: 'sprite', id, speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} /> };
}
