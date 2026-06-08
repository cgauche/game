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
import { entitySprite, pnjSprite } from './sprites';
import { hashSeed } from './appearance';

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
  /** viewBox (repère 120×150 du corps) cadrant le VISAGE pour un portrait (RigPortrait).
   *  Humanoïde = gros plan tête ; créature = haut-avant (la tête varie selon le gabarit). */
  portraitBox: string;
}

/** Gros plan VISAGE d'un humanoïde (tête centrée ~(60,46) dans la boîte 120×150). */
const FACE_BOX = '42 28 38 38';
/** Cadre PORTRAIT d'une créature non-bipède : haut-avant du corps (générique, raffinable par gabarit). */
const CREATURE_BOX = '22 14 80 80';

/**
 * CLASSIFIEUR UNIQUE : décide quel backend monter (rig humanoïde / plan non-bipède / sprite)
 * et produit le corps prêt à insérer. Source unique remplaçant l'échelle
 * `isHero / enemyRigProfile / entityRigProfile / bodyPlanOf` dupliquée aux 4 sites de dispatch
 * (IsoStage combat + exploration + leader, éditeur via EntityToken).
 *
 * NE porte AUCUNE info de layout (ombre/anneau/dim/échelle de base/walking) : ça reste au site
 * appelant (BodyToken/token/tokenNode). Les deux moteurs d'animation (rig à clips vs plan rAF)
 * restent DEUX backends distincts (asymétrie essentielle : parade/sort/clips d'arme côté rig).
 */
export function pickBackend(subject: TokenSubject): PickedBackend {
  if (subject.kind === 'combatant') {
    const c = subject.combatant;
    // On décide par le PLAN CORPOREL (humanoïde vs créature), PAS par le camp. `kind==='hero'` est
    // surchargé (PJ bipède OU acteur allié — store bascule `side:'ally'` en kind='hero', cheval libre
    // compris) : router sur kind dessinerait un cheval allié comme un humanoïde. Donc : nom humanoïde
    // → rig (héros = son appearance, ennemi = profil dérivé) ; créature → gabarit animé (plan).
    if (classifyEnemy(c.name) === 'rig') {
      const prof = c.kind === 'hero' ? null : enemyRigProfile(c);
      return { backend: 'rig', id: c.id, speciesScale: bipedSpeciesScale(c.name), portraitBox: FACE_BOX, body: <AnimatedRigToken combatant={c} profile={prof ?? undefined} /> };
    }
    return { backend: 'plan', id: c.id, speciesScale: creatureSpeciesScale(c.name), portraitBox: CREATURE_BOX, body: <AnimatedPlanToken id={c.id} name={c.name} colors={c.appearance?.colors} dead={isOutOfAction(c)} /> };
  }

  if (subject.kind === 'partyLeader') {
    const leader = subject.leader;
    if (leader) {
      return { backend: 'rig', id: '__party', speciesScale: 1, portraitBox: FACE_BOX, body: <AnimatedRigToken combatant={leader} /> };
    }
    return { backend: 'sprite', id: '__party', speciesScale: 1, portraitBox: FACE_BOX, body: <g dangerouslySetInnerHTML={{ __html: pnjSprite() }} /> };
  }

  // sceneEntity (exploration + éditeur)
  const ent = subject.ent;
  const id = `e-${ent.id}`;
  const seed = ent.appearance?.seed ?? hashSeed(ent.id);
  const prof =
    ent.kind === 'personnage'
      ? entityRigProfile(ent.ref ?? ent.label ?? 'Villageois', seed, { career: ent.appearance?.career, monster: ent.appearance?.monster, weapon: ent.weapon, colors: ent.appearance?.colors, parts: ent.appearance?.parts, sex: ent.appearance?.sex, build: ent.appearance?.build })
      : null;
  if (prof) {
    return { backend: 'rig', id, speciesScale: bipedSpeciesScale(ent.ref ?? ent.label ?? ''), portraitBox: FACE_BOX, body: <AmbientRigToken profile={prof} anim={ent.anim ?? ''} id={id} facing={ent.facing} /> };
  }
  const refName = ent.ref ?? ent.label ?? '';
  const planId = bodyPlanOf(refName);
  if (planId !== 'biped' && planId !== 'monolithic') {
    return { backend: 'plan', id, speciesScale: creatureSpeciesScale(refName), portraitBox: CREATURE_BOX, body: <AnimatedPlanToken id={id} name={refName} colors={ent.appearance?.colors} facing={ent.facing} /> };
  }
  return { backend: 'sprite', id, speciesScale: 1, portraitBox: FACE_BOX, body: <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} /> };
}
