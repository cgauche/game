import React from 'react';
import { BONE_IDS, SLOT_BONES, SLOT_LAYER, type BoneId, type Slot } from './bones';
import { baseSkeleton, applyBuild } from './skeletons';
import { worldTransforms, toSvg, type Matrix } from './kinematics';
import type { Pose } from './poses';
import type { Appearance } from './appearance';
import { resolveParts } from './parts/resolve';
import type { EquipCtx } from './parts/equipment';

export interface ResolvedBone {
  id: BoneId;
  matrix: Matrix;
  z: number;
  parts: { svg: string; layer: number; mirror?: boolean }[];
}

/** (apparence, équipement, pose, carrière?) → os résolus, triés z croissant (peintre). PUR. */
export function resolveRig(
  appearance: Appearance,
  equip: EquipCtx,
  pose: Pose,
  career?: string,
): ResolvedBone[] {
  const sk = applyBuild(baseSkeleton(appearance.species, appearance.sex), appearance.build);
  const world = worldTransforms(sk, pose);
  const parts = resolveParts(appearance.species, appearance.sex, career, equip, appearance.parts ?? {}, appearance.seed ?? 1);

  const boneParts: Record<BoneId, ResolvedBone['parts']> = {} as Record<BoneId, ResolvedBone['parts']>;
  for (const id of BONE_IDS) boneParts[id] = [];

  for (const slot of Object.keys(SLOT_BONES) as Slot[]) {
    const part = parts[slot];
    if (!part || !part.svg) continue;
    SLOT_BONES[slot].forEach((bid, idx) => {
      boneParts[bid].push({ svg: part.svg, layer: SLOT_LAYER[slot], mirror: idx === 1 });
    });
  }

  return BONE_IDS
    .map((id) => ({ id, matrix: world[id], z: sk[id].z, parts: boneParts[id].sort((a, b) => a.layer - b.layer) }))
    .filter((b) => b.parts.length > 0)
    .sort((a, b) => a.z - b.z);
}

/** Composant : un <g data-bone> par os, transformable individuellement (anim C / postures D). */
export function RigSprite({ appearance, equip, pose = {}, career }: {
  appearance: Appearance;
  equip: EquipCtx;
  pose?: Pose;
  career?: string;
}): JSX.Element {
  const bones = resolveRig(appearance, equip, pose, career);
  return (
    <g className="rig">
      {bones.map((b) => (
        <g key={b.id} data-bone={b.id} transform={toSvg(b.matrix)}>
          {b.parts.map((p, i) =>
            p.mirror ? (
              <g key={i} transform="scale(-1,1)" dangerouslySetInnerHTML={{ __html: p.svg }} />
            ) : (
              <g key={i} dangerouslySetInnerHTML={{ __html: p.svg }} />
            ),
          )}
        </g>
      ))}
    </g>
  );
}
