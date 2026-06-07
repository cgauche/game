import { type Dims } from './iso';
import { BodyToken } from './BodyToken';
import { pickBackend } from './pickBackend';
import type { SceneEntity } from '../state/scene';

/**
 * Rendu d'une ENTITÉ de scène posée sur sa tuile — SOURCE UNIQUE partagée par le jeu (IsoStage)
 * et l'éditeur (WYSIWYG). Le backend (rig humanoïde / plan non-bipède animé + orientation authored /
 * sprite) est choisi par `pickBackend` (même classifieur qu'IsoStage) ; le positionnement par
 * `BodyToken`. Les non-bipèdes (loup/cheval/dragon…) s'animent désormais ici aussi (plus de sprite figé).
 */
export function EntityToken({ ent, dims, scale = 0.55 }: { ent: SceneEntity; dims: Dims; scale?: number }) {
  const r = pickBackend({ kind: 'sceneEntity', ent });
  return (
    <BodyToken x={ent.pos.x} y={ent.pos.y} dims={dims} scale={scale} bakedDeath={r.backend !== 'sprite'}>
      {r.body}
    </BodyToken>
  );
}
