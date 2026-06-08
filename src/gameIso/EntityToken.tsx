import { type Dims } from './iso';
import { BodyToken } from './BodyToken';
import { pickBackend } from './pickBackend';
import { sizeTokenScale } from './sizeScale';
import { sizeFootprint } from '../state/footprint';
import { entitySize } from '../state/spawn';
import type { SceneEntity } from '../state/scene';

/**
 * Rendu d'une ENTITÉ de scène posée sur sa tuile — SOURCE UNIQUE partagée par le jeu (IsoStage)
 * et l'éditeur (WYSIWYG). Le backend (rig humanoïde / plan non-bipède animé + orientation authored /
 * sprite) est choisi par `pickBackend` (même classifieur qu'IsoStage) ; le positionnement par
 * `BodyToken`. Les non-bipèdes (loup/cheval/dragon…) s'animent désormais ici aussi (plus de sprite figé).
 */
export function EntityToken({ ent, dims, scale = 0.55 }: { ent: SceneEntity; dims: Dims; scale?: number }) {
  const r = pickBackend({ kind: 'sceneEntity', ent });
  // Centrée + mise à l'échelle de son empreinte par Taille (LDB 15 l.55) : une grande créature est
  // aussi grande dans l'éditeur qu'en combat. Objets/statiques : Taille indéfinie ⇒ ×1, inchangé.
  const sz = entitySize(ent);
  const off = (sizeFootprint(sz) - 1) / 2;
  return (
    <BodyToken x={ent.pos.x + off} y={ent.pos.y + off} dims={dims} scale={scale * sizeTokenScale(sz)} bakedDeath={r.backend !== 'sprite'}>
      {r.body}
    </BodyToken>
  );
}
