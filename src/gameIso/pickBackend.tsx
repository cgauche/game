import type { ReactNode } from 'react';
import type { ViewMode } from '../geometry/iso';
import type { Combatant } from '../engine/types';
import type { SceneEntity } from '../state/scene';
import { isOutOfAction } from '../engine/conditions';
import { AnimatedRigToken } from './AnimatedRigToken';
import { RigToken } from './RigToken';
import { AnimatedPlanToken } from './AnimatedPlanToken';
import { enemyRigProfile, entityRigProfileFor, rendersFromOwnInventory } from './rig/enemyProfile';
import { resolveRender, planById } from './rig/bodyPlan';
import { structureAppearance } from './catalog/structures';
import { isStructure } from '../engine/structures';
import { findCreatureById, findCareerById, findTrappingById } from '../data';
import { eyesArtFromKeys } from './rig/parts/eyes';
import { entitySprite } from './sprites';
import { hashSeed } from '../engine/dice';
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
  | { kind: 'sceneEntity'; ent: SceneEntity; enrolled?: boolean }
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
/** Cadre PORTRAIT d'un gabarit : sa propre boîte (`plan.portraitBox`) ou le défaut créature haut-avant.
 *  Un engin de siège (ancré au sol) cadre son bloc BAS, là où le défaut haut-avant ne montrerait que du vide. */
const planPortraitBox = (planId: string): string => planById(planId)?.portraitBox ?? CREATURE_BOX;
/** Cadre PORTRAIT d'une structure de siège (centré sur le bloc crénelé ci-dessous). */
const STRUCT_BOX = '26 38 68 68';
/** Corps d'une STRUCTURE de siège (porte/rempart) : bloc de pierre crénelé ferré aux couleurs de
 *  l'apparence partagée (`mur-en-pierre`, palette pierre unifiée du JSON) — JAMAIS un bipède. Sert au
 *  portrait d'inspection / VsHeader de la modale d'attaque (le jeton de CASE, lui, est supprimé : la
 *  fortification se rend sur son arête, cf. IsoStage). */
const STRUCT_APP = structureAppearance('mur-en-pierre');
const STRUCT_BODY = (
  <g>
    <rect x={34} y={50} width={52} height={64} fill={STRUCT_APP.face} stroke={STRUCT_APP.band ?? STRUCT_APP.face} strokeWidth={2} />
    <rect x={34} y={66} width={52} height={5} fill={STRUCT_APP.band ?? STRUCT_APP.face} />
    <rect x={34} y={90} width={52} height={5} fill={STRUCT_APP.band ?? STRUCT_APP.face} />
    <rect x={34} y={44} width={12} height={8} fill={STRUCT_APP.cap ?? STRUCT_APP.face} />
    <rect x={54} y={44} width={12} height={8} fill={STRUCT_APP.cap ?? STRUCT_APP.face} />
    <rect x={74} y={44} width={12} height={8} fill={STRUCT_APP.cap ?? STRUCT_APP.face} />
  </g>
);

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
 * `isHero / enemyRigProfile / entityRigProfile / bodyPlanById` dupliquée aux 4 sites de dispatch
 * (IsoStage combat + exploration + leader, éditeur via EntityToken).
 *
 * `view: 'top'` (vue du dessus) → les ACTEURS deviennent un disque-portrait (vue de face cadrée,
 * `flat: true`) ; le décor reste un billboard de face (`flat: false`). En iso, comportement inchangé.
 *
 * NE porte AUCUNE info de layout (ombre/anneau/dim/échelle de base/walking) : ça reste au site
 * appelant (BodyToken/token/tokenNode). Les deux moteurs d'animation (rig à clips vs plan rAF)
 * restent DEUX backends distincts (asymétrie essentielle : parade/sort/clips d'arme côté rig).
 */
export function pickBackend(subject: TokenSubject, view: ViewMode = 'iso'): PickedBackend {
  const top = view === 'top';

  if (subject.kind === 'combatant') {
    const c = subject.combatant;
    // Structure de siège (`bodyShape:'structure'`) : fortification inerte → bloc de pierre crénelé, JAMAIS
    // un bipède Humain (`resolveRender` retomberait là-dessus, faute d'espèce). Invariant du classifieur.
    if (isStructure(c)) return { backend: 'plan', id: c.id, speciesScale: 1, portraitBox: STRUCT_BOX, flat: top, body: STRUCT_BODY };
    // Résolution de rendu UNIQUE par la DONNÉE (espèce explicite + trait Nuée), repli nom : classe
    // (rig humanoïde vs gabarit créature), plan, espèce canonique, échelle. `kind==='hero'` est
    // surchargé (PJ bipède OU acteur allié — cheval libre compris) → on route par le PLAN CORPOREL.
    const r = resolveRender(c.species, c.traits, c.name);
    if (r.kind === 'rig') {
      const prof = rendersFromOwnInventory(c) ? null : enemyRigProfile(c);
      if (top) {
        const appearance = combatantAppearance(prof?.appearance ?? c.appearance ?? defaultAppearance(c), c);
        const equip = prof?.equip ?? equipFromCombatant(c);
        const tenue = prof?.tenue ?? findCareerById(c.career)?.label ?? c.career; // careerId → libellé de tenue (rig)
        const f = faceFrame(appearance, equip, tenue, combatantOverlays(c));
        return { backend: 'rig', id: c.id, speciesScale: r.scale, portraitBox: f.box, flat: true, body: f.body };
      }
      return { backend: 'rig', id: c.id, speciesScale: r.scale, portraitBox: FACE_BOX, flat: false, body: <AnimatedRigToken combatant={c} profile={prof ?? undefined} pos={c.pos} /> };
    }
    return { backend: 'plan', id: c.id, speciesScale: r.scale, portraitBox: planPortraitBox(r.plan), flat: top, body: <AnimatedPlanToken id={c.id} planId={r.plan} species={r.species} colors={c.appearanceOverride?.colors} eyes={eyesArtFromKeys(c.appearanceOverride?.eyes)} dead={groundStateOf(c) === 'corpse' || isOutOfAction(c)} prone={groundStateOf(c) === 'prone'} pos={c.pos} /> };
  }

  if (subject.kind === 'partyLeader') {
    const leader = subject.leader;
    if (leader) {
      if (top) {
        const f = faceFrame(combatantAppearance(leader.appearance ?? defaultAppearance(leader), leader), equipFromCombatant(leader), findCareerById(leader.career)?.label ?? leader.career, combatantOverlays(leader));
        return { backend: 'rig', id: '__party', speciesScale: 1, portraitBox: f.box, flat: true, body: f.body };
      }
      return { backend: 'rig', id: '__party', speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <AnimatedRigToken combatant={leader} /> };
    }
    // Groupe VIDE (aucun meneur) — cas défensif inatteignable en exploration (party.find ?? party[0]
    // renvoie toujours un membre tant que le groupe existe) : jeton vide, plus de sprite « villageois ».
    return { backend: 'rig', id: '__party', speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <g /> };
  }

  // sceneEntity (exploration + éditeur)
  const ent = subject.ent;
  const id = `e-${ent.id}`;
  const seed = ent.appearance?.seed ?? hashSeed(ent.id);
  const refName = ent.ref ?? ent.label ?? 'villageois';
  // Résolution UNIQUE par la donnée (espèce explicite de l'entité + trait Nuée du record), par id.
  const r = resolveRender(ent.appearance?.species, findCreatureById(refName)?.traits, refName);
  // Garde DEV : un personnage dont la `ref` n'est PAS un id de créature valide ET sans espèce explicite
  // tombe silencieusement en bipède Humain (plus de devinette par le nom). Signale l'apparence perdue.
  // Un engin de siège (ref = trapping à art d'affût `siegeRig`) est résolu via la ref → pas un défaut perdu.
  if (import.meta.env.DEV && ent.kind === 'personnage' && ent.ref && !ent.appearance?.species && !findCreatureById(ent.ref) && !findTrappingById(ent.ref)?.siegeRig)
    console.warn(`[pickBackend] entité « ${ent.id} » : ref « ${ent.ref} » non résolue (pas un id de créature) et sans Espèce (rig) → bipède Humain par défaut. Choisis une Espèce (rig) ou une réf de créature valide.`);
  const prof = ent.kind === 'personnage' ? entityRigProfileFor(ent, subject.enrolled) : null;
  if (prof) {
    if (top) {
      const f = faceFrame(prof.appearance, prof.equip, prof.tenue, []);
      return { backend: 'rig', id, speciesScale: r.scale, portraitBox: f.box, flat: true, body: f.body };
    }
    return { backend: 'rig', id, speciesScale: r.scale, portraitBox: FACE_BOX, flat: false, body: <RigToken id={id} appearance={prof.appearance} equip={prof.equip} career={prof.tenue} ambientAnim={ent.anim ?? ''} facing={ent.facing} pos={ent.pos} /> };
  }
  if (r.kind === 'plan') {
    // ent.appearance.eyes = CLÉS du catalogue (donnée éditeur) → résolues en arts ici — comme le
    // combattant non-humanoïde plus haut (`c.appearanceOverride.eyes`, même `eyesArtFromKeys`).
    return { backend: 'plan', id, speciesScale: r.scale, portraitBox: planPortraitBox(r.plan), flat: top, body: <AnimatedPlanToken id={id} planId={r.plan} species={r.species} colors={ent.appearance?.colors} eyes={eyesArtFromKeys(ent.appearance?.eyes)} facing={ent.facing} pos={ent.pos} /> };
  }
  return { backend: 'sprite', id, speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} /> };
}
