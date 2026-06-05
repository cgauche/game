import React from 'react';
import { BONE_IDS, SLOT_BONES, SLOT_LAYER, type BoneId, type Slot, type RigOverlay } from './bones';
import { baseSkeleton, applyBuild, referenceSkeleton, groundSkeleton, profileNarrow } from './skeletons';
import { worldTransforms, toSvg, type Matrix } from './kinematics';
import { addPose, type Pose } from './poses';
import type { Appearance } from './appearance';
import { resolveParts } from './parts/resolve';
import { pickView } from './parts/types';
import { monsterInjection } from './parts/monstrous';
import type { EquipCtx } from './parts/equipment';
import type { View } from './facing';
import { VIEW_POSE } from './viewPose';

export interface ResolvedBone {
  id: BoneId;
  matrix: Matrix;
  /** échelle de rendu de la part (thickness/réf, length/réf) — morpho + gabarit d'espèce. */
  scale: [number, number];
  z: number;
  parts: { svg: string; layer: number; mirror?: boolean }[];
}

/** (apparence, équipement, pose, carrière?) → os résolus, triés z croissant (peintre). PUR. */
export function resolveRig(
  appearance: Appearance,
  equip: EquipCtx,
  pose: Pose,
  career?: string,
  view: View = 'front',
  overlays: RigOverlay[] = [],
): ResolvedBone[] {
  let sk = groundSkeleton(applyBuild(baseSkeleton(appearance.species, appearance.sex), appearance.build));
  if (view === 'profile') sk = profileNarrow(sk); // corps étroit de profil (membres sur l'axe)
  const world = worldTransforms(sk, addPose(VIEW_POSE[view], pose)); // pose de vue + pose d'anim
  const parts = resolveParts(appearance.species, appearance.sex, career, equip, appearance.parts ?? {}, appearance.seed ?? 1, view);

  // Échelle de rendu par os = (thickness/réf, length/réf). Os de longueur/épaisseur
  // nulle (arme/bouclier) : hérite du parent. N'affecte PAS la FK (positions des joints).
  const REF = referenceSkeleton();
  const scaleOf = {} as Record<BoneId, [number, number]>;
  for (const id of BONE_IDS) {
    const b = sk[id];
    const r = REF[id];
    const par: [number, number] = b.parent ? scaleOf[b.parent] : [1, 1];
    if (r.thickness <= 0.001 && r.length <= 0.001) {
      // os d'attache (arme/bouclier) : échelle UNIFORME du parent → l'arme ne s'étire pas.
      const u = (par[0] + par[1]) / 2;
      scaleOf[id] = [u, u];
    } else {
      const sx = r.thickness > 0.001 ? b.thickness / r.thickness : par[0];
      const sy = r.length > 0.001 ? b.length / r.length : par[1];
      scaleOf[id] = [sx, sy];
    }
  }

  const boneParts: Record<BoneId, ResolvedBone['parts']> = {} as Record<BoneId, ResolvedBone['parts']>;
  for (const id of BONE_IDS) boneParts[id] = [];

  for (const slot of Object.keys(SLOT_BONES) as Slot[]) {
    const part = parts[slot];
    if (!part || !part.svg) continue;
    SLOT_BONES[slot].forEach((bid, idx) => {
      boneParts[bid].push({ svg: part.svg, layer: SLOT_LAYER[slot], mirror: idx === 1 });
    });
  }

  // Parts MONSTRUEUSES (mutant modulaire) : REMPLACENT la part normale de l'os ciblé
  // (tête monstrueuse → efface visage/cheveux ; bras G/D → membre asymétrique). Aucun
  // miroir : on dessine directement dans le repère de l'os gauche/droit concerné.
  if (appearance.monster) {
    const inj = monsterInjection(appearance.monster);
    for (const [bone, part] of Object.entries(inj.replace) as [BoneId, import('./parts/types').PartArt][])
      boneParts[bone] = [{ svg: pickView(part, view), layer: 5 }];
    for (const ov of inj.overlays) boneParts[ov.bone].push({ svg: ov.svg, layer: 98 });
  }

  // Calques cosmétiques (mutations…) par-dessus tout, dans le repère de leur os.
  for (const ov of overlays) {
    if (ov.svg) boneParts[ov.bone].push({ svg: ov.svg, layer: 99 });
  }

  return BONE_IDS
    .map((id) => ({ id, matrix: world[id], scale: scaleOf[id], z: sk[id].z, parts: boneParts[id].sort((a, b) => a.layer - b.layer) }))
    .filter((b) => b.parts.length > 0)
    .sort((a, b) => a.z - b.z);
}

/** Composant : un <g data-bone> par os, transformable individuellement (anim C / postures D). */
export function RigSprite({ appearance, equip, pose = {}, career, view = 'front', overlays }: {
  appearance: Appearance;
  equip: EquipCtx;
  pose?: Pose;
  career?: string;
  view?: View;
  overlays?: RigOverlay[];
}): JSX.Element {
  const bones = resolveRig(appearance, equip, pose, career, view, overlays ?? []);
  return (
    <g className="rig">
      {bones.map((b) => (
        <g key={b.id} data-bone={b.id} transform={toSvg(b.matrix)}>
          <g transform={`scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})`}>
            {b.parts.map((p, i) =>
              p.mirror ? (
                <g key={i} transform="scale(-1,1)" dangerouslySetInnerHTML={{ __html: p.svg }} />
              ) : (
                <g key={i} dangerouslySetInnerHTML={{ __html: p.svg }} />
              ),
            )}
          </g>
        </g>
      ))}
    </g>
  );
}
