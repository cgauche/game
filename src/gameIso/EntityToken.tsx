import { type Dims } from '../geometry/iso';
import { BodyToken } from './BodyToken';
import { tokenBodyKind } from './tokenBodyKind';
import { sizeTokenScale } from './sizeScale';
import { sizeFootprint, decorFootGeometry } from '../state/footprint';
import { entitySize } from '../state/spawn';
import type { SceneEntity } from '../state/scene';
import { discR as discRPx } from './builders/dynamicMarks';

/**
 * Rendu d'une ENTITÉ de scène posée sur sa tuile — SOURCE UNIQUE partagée par le jeu (IsoStage)
 * et l'éditeur (WYSIWYG). Le backend (rig humanoïde / plan non-bipède animé + orientation authored /
 * sprite) est choisi par `tokenBodyKind(subject, dims.view)` ; le positionnement par `BodyToken`.
 * En vue du dessus (`dims.view==='top'`), un acteur (rig/plan) devient un disque-portrait centré ;
 * le décor (sprite) reste un billboard de face.
 */
export function EntityToken({ ent, dims, scale = 0.55, enrolled }: { ent: SceneEntity; dims: Dims; scale?: number; enrolled?: boolean }) {
  const top = dims.view === 'top';
  const r = tokenBodyKind({ kind: 'sceneEntity', ent, enrolled }, dims.view);
  // Centrée + mise à l'échelle de son empreinte par Taille (LDB 15 l.55) : une grande créature est
  // aussi grande dans l'éditeur qu'en combat. Objets/statiques : Taille indéfinie ⇒ ×1, inchangé.
  // Décor à empreinte rectangulaire (`foot {w,h}` : tente 2×2, tribune 3×1…) : même principe —
  // centré sur son bloc et agrandi au côté max.
  const sz = entitySize(ent);
  const fg = decorFootGeometry(ent.kind === 'prop' ? ent.foot : undefined);
  const off = (sizeFootprint(sz) - 1) / 2;
  const discR = discRPx(Math.max(sizeFootprint(sz), fg.scale));
  return (
    <BodyToken
      z={ent.z ?? 0}
      x={ent.pos.x + off + fg.offX}
      y={ent.pos.y + off + fg.offY}
      dims={dims}
      scale={scale * sizeTokenScale(sz) * fg.scale}
      bakedDeath={r.bodyKind !== 'sprite'}
      flat={top && r.flat}
      portraitBox={r.portraitBox}
      discR={discR}
    >
      {r.body}
    </BodyToken>
  );
}
