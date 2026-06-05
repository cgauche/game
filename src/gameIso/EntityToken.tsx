import { tileCenter, type Dims } from './iso';
import { hashSeed } from './appearance';
import { entitySprite } from './sprites';
import { entityRigProfile } from './rig/enemyProfile';
import { AmbientRigToken } from './AmbientRigToken';
import type { SceneEntity } from '../state/scene';

/**
 * Rendu d'une ENTITÉ de scène, placé sur sa tuile — SOURCE UNIQUE partagée par le
 * jeu (IsoStage) ET l'éditeur (WYSIWYG). Humanoïde (biped) → rig animé (parts
 * monstrueux + arme équipée) ; sinon sprite monolithique. Pieds au CENTRE de la tuile.
 */
export function EntityToken({ ent, dims, scale = 0.55 }: { ent: SceneEntity; dims: Dims; scale?: number }) {
  const { cx, cy } = tileCenter(ent.pos.x, ent.pos.y, dims);
  const seed = ent.appearance?.seed ?? hashSeed(ent.id);
  const prof =
    ent.kind === 'personnage'
      ? entityRigProfile(ent.ref ?? ent.label ?? 'Villageois', seed, { monster: ent.appearance?.monster, weapon: ent.weapon, colors: ent.appearance?.colors })
      : null;
  return (
    <g style={{ transform: `translate(${cx}px,${cy}px)` }}>
      <ellipse cx={0} cy={0} rx={16 * scale + 5} ry={(16 * scale + 5) / 2} fill="#000" opacity={0.33} />
      <g transform={`translate(${-60 * scale},${-150 * scale}) scale(${scale})`}>
        {prof ? (
          <AmbientRigToken profile={prof} anim={ent.anim ?? ''} id={`ent-${ent.id}`} />
        ) : (
          <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} />
        )}
      </g>
    </g>
  );
}
