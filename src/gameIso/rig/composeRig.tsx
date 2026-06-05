import React from 'react';
import { BONE_IDS, SLOT_BONES, SLOT_LAYER, type BoneId, type Slot, type RigOverlay } from './bones';
import { baseSkeleton, applyBuild, referenceSkeleton, groundSkeleton, profileNarrow, baseSpeciesOf } from './skeletons';
import { worldTransforms, toSvg, type Matrix } from './kinematics';
import { addPose, type Pose } from './poses';
import type { Appearance } from './appearance';
import { resolveParts } from './parts/resolve';
import { pickView } from './parts/types';
import { monsterInjection } from './parts/monstrous';
import { buildTokenMap, applyTokenMap, type Palette } from './palette';
import { CAREER_PALETTES } from './parts/generated/careerPalettes';
import { SPECIES_PALETTES } from './parts/generated/speciesPalettes';
import type { EquipCtx } from './parts/equipment';
import type { View } from './facing';
import { VIEW_POSE } from './viewPose';

export interface ResolvedBone {
  id: string; // BoneId (bipède) OU os d'un autre gabarit (quadrupède…) — forme partagée cross-plan
  matrix: Matrix;
  /** échelle de rendu de la part (thickness/réf, length/réf) — morpho + gabarit d'espèce. */
  scale: [number, number];
  z: number;
  parts: { svg: string; layer: number; mirror?: boolean }[];
}

/** Posture de repos par espèce (deltas d'angle). Skaven = voûté : torse penché en avant,
 *  nuque/tête basses, épaules rentrées. Sans flexion de jambe (pieds ancrés au sol). */
const SPECIES_POSE: Record<string, Pose> = {
  // Voûté : torse penché + nuque/tête basses + LÉGER arrondi d'épaules (pas de swing d'avant-
  // bras, qui faisait flotter la main libre loin du corps).
  Skaven: { torse: 15, cou: 11, tete: -9, epauleG: 4, epauleD: 4 },
  // Peaux-vertes/hommes-bêtes/troll voûtés : dos courbé en avant, nuque rentrée.
  Orc: { torse: 16, cou: 13, tete: -10, epauleG: 5, epauleD: 5 },
  Gobelin: { torse: 14, cou: 12, tete: -10, epauleG: 4, epauleD: 4 },
  'Homme-bête': { torse: 14, cou: 12, tete: -9, epauleG: 5, epauleD: 5 },
  Troll: { torse: 18, cou: 16, tete: -12, epauleG: 6, epauleD: 6 },
  // Goule = posture semi-quadrupède (dos très arqué, nuque basse en avant).
  Goule: { torse: 24, cou: 18, tete: -14, epauleG: 8, epauleD: 8 },
  // Zombie titubant : léger penché raide.
  Zombie: { torse: 8, cou: 6, tete: -4 },
};

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
  // De profil, le swing du bras DROIT (porteur de l'arme) éloigne la main → l'arme barre le
  // torse. Quand une arme de MÊLÉE est tenue, on annule ce swing pour que le bras pende au
  // côté (l'arme tombe à la verticale). Mêlée seulement : le distance garde sa pose de visée.
  let viewPose = VIEW_POSE[view];
  if (view === 'profile' && equip.weapons?.some((w) => w.type === 'melee')) {
    viewPose = addPose(viewPose, { epauleD: 8, avantBrasD: 6 }); // bras porteur LÉGÈREMENT en avant → arme visible au côté (base profil = -4)
  }
  // Posture de repos PAR ESPÈCE (ex. skaven voûté : torse penché + tête basse). UNIQUEMENT
  // en PROFIL : une rotation du torse en 2D = penché EN AVANT de profil (correct), mais de
  // FACE/DOS elle tilterait tout le corps DE CÔTÉ (« penche à droite »). De face/dos on reste
  // droit (un dos voûté ne se montre pas pile de face en 2D).
  const speciesPose = view === 'profile' ? SPECIES_POSE[baseSpeciesOf(appearance.species)] ?? {} : {};
  const world = worldTransforms(sk, addPose(speciesPose, addPose(viewPose, pose)));
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

  // Un vampire (monster.cape) garde la robe de carrière mais PAS le couvre-chef de cour
  // (le chapeau de Noble faisait une « couronne » rouge) : on saute le slot `tete` (le
  // visage + les cheveux lissés restent, via leurs propres slots).
  const dropHeadgear = !!appearance.monster?.cape;
  for (const slot of Object.keys(SLOT_BONES) as Slot[]) {
    if (slot === 'tete' && dropHeadgear) continue;
    const part = parts[slot];
    if (!part || !part.svg) continue;
    SLOT_BONES[slot].forEach((bid, idx) => {
      // Le 2e os d'une paire est miroité POUR LA SYMÉTRIE DE FACE/DOS. En PROFIL c'est
      // faux : les deux pieds/jambes/bras regardent dans la même direction (pas en miroir)
      // — sinon le pied arrière pointe à l'envers (« chaussures vers l'intérieur »).
      boneParts[bid].push({ svg: part.svg, layer: SLOT_LAYER[slot], mirror: idx === 1 && view !== 'profile' });
    });
  }

  // Parts MONSTRUEUSES (mutant modulaire) : REMPLACENT la part normale de l'os ciblé
  // (tête monstrueuse → efface visage/cheveux ; bras G/D → membre asymétrique). Aucun
  // miroir : on dessine directement dans le repère de l'os gauche/droit concerné.
  if (appearance.monster) {
    const inj = monsterInjection(appearance.monster);
    for (const [bone, part] of Object.entries(inj.replace) as [BoneId, import('./parts/types').PartArt][])
      boneParts[bone] = [{ svg: pickView(part, view), layer: 5 }];
    // `behind` → calque SOUS la part de l'os (cornes derrière la tête, queue/ventre derrière le
    // corps) ; sinon par-dessus (côtes, plaies).
    for (const ov of inj.overlays) boneParts[ov.bone].push({ svg: ov.svg, layer: ov.behind ? -2 : 98 });
  }

  // Calques cosmétiques (mutations…) par-dessus tout, dans le repère de leur os.
  for (const ov of overlays) {
    if (ov.svg) boneParts[ov.bone].push({ svg: ov.svg, layer: 99 });
  }

  // PALETTE : résout les tokens @peau/@cheveux/@vet1/@vet2/@cuir/@metal de chaque part.
  // Couches (priorité croissante) : défaut carrière (ombres exactes d'origine) → peau de
  // la tête monstrueuse (lézard=vert, chien=fauve, accorde la chair du corps) → surcharges
  // utilisateur (appearance.colors). Surcharger un slot dérive toute sa famille (recolor).
  // SKIN_FROM_HEAD n'accorde la peau du corps QUE pour une espèce SANS palette dédiée (ex.
  // un Humain à qui on greffe une tête de lézard) : si l'espèce a sa propre palette de peau
  // (Skaven, Orc, Goule…), celle-ci prime — sinon la peau de la tête écraserait la teinte
  // d'espèce (ex. la Goule grise deviendrait fauve à cause de sa tête « chien »).
  const SKIN_FROM_HEAD: Record<string, string> = {
    lezard: '#5d7a42', chien: '#6e4a2c', rat: '#6e4a2e',
  };
  const speciesKey = `${baseSpeciesOf(appearance.species)}:${appearance.sex}`;
  const speciesHasSkin = SPECIES_PALETTES[speciesKey]?.peau != null;
  const headSkin = !speciesHasSkin && appearance.monster?.tete ? SKIN_FROM_HEAD[appearance.monster.tete] : undefined;
  const overrides: Palette = { ...(headSkin ? { peau: headSkin } : {}), ...appearance.colors };
  // Défauts empilés : ESPÈCE (peau/cheveux/yeux par espèce:sexe) → CARRIÈRE (tenue) → surcharges.
  const stored = { ...(SPECIES_PALETTES[speciesKey] ?? {}), ...(CAREER_PALETTES[career ?? ''] ?? {}) };
  const tmap = buildTokenMap(stored, overrides);
  for (const id of BONE_IDS) boneParts[id] = boneParts[id].map((p) => ({ ...p, svg: applyTokenMap(p.svg, tmap) }));

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
