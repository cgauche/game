import { type Dims } from './iso';
import { hashSeed } from './appearance';
import { entitySprite } from './sprites';
import { entityRigProfile } from './rig/enemyProfile';
import { AmbientRigToken } from './AmbientRigToken';
import { BodyToken } from './BodyToken';
import type { SceneEntity } from '../state/scene';

/**
 * Rendu d'une ENTITÉ de scène, placé sur sa tuile — SOURCE UNIQUE partagée par le
 * jeu (IsoStage) ET l'éditeur (WYSIWYG). Humanoïde (biped) → rig animé (parts
 * monstrueux + arme équipée + orientation authored) ; sinon sprite. Le positionnement
 * (ombre + ancrage pieds-au-centre + échelle) est délégué à la coquille partagée BodyToken.
 */
export function EntityToken({ ent, dims, scale = 0.55 }: { ent: SceneEntity; dims: Dims; scale?: number }) {
  const seed = ent.appearance?.seed ?? hashSeed(ent.id);
  const prof =
    ent.kind === 'personnage'
      ? entityRigProfile(ent.ref ?? ent.label ?? 'Villageois', seed, { career: ent.appearance?.career, monster: ent.appearance?.monster, weapon: ent.weapon, colors: ent.appearance?.colors, parts: ent.appearance?.parts, sex: ent.appearance?.sex, build: ent.appearance?.build })
      : null;
  return (
    <BodyToken x={ent.pos.x} y={ent.pos.y} dims={dims} scale={scale}>
      {prof ? (
        <AmbientRigToken profile={prof} anim={ent.anim ?? ''} id={`ent-${ent.id}`} facing={ent.facing} />
      ) : (
        <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} />
      )}
    </BodyToken>
  );
}
