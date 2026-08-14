/**
 * VOIE DE RENDU SVG EN SURSIS (#1176). L'écran de JEU n'en dépend PLUS : son monde est volumique
 * (`gameIso/stage/GameStage3D`) quoi que dise cet interrupteur — la voie de jeu affine est morte au
 * commit C5a du lot P3-4, avec `CulledScene` et les voiles d'ambiance. Ce qui reste sous cet
 * interrupteur, jusqu'au lot C5b : la voie POV SVG (`gameIso/pov/PovStage`) et l'aperçu d'authoring
 * (`ui/editor/EditorCanvas`). Seul écrivain côté produit : le devtool `__wfrp.stage3d`
 * (`state/devtools.ts`) — plus aucun bouton d'écran ne le bascule.
 *
 * Il ne vit PAS dans le store Zustand : `snapshotSave` (`state/saves.ts`) copie TOUTE clé de données de
 * l'état initial dans la sauvegarde — un champ de store est donc, par construction, sérialisé (mesuré
 * sur les goldens : `camRot`, `zoom`, `debugLabels` y figurent tous). La voie de rendu décrit
 * l'avancement d'une migration, pas le monde : store externe minimal, même patron que `state/viewLevel.ts`
 * (le devtool le PILOTE, le rendu le LIT).
 */
export type StageBackend = 'affine' | 'webgl';

let _backend: StageBackend = 'webgl';
const subs = new Set<() => void>();

export const getStageBackend = (): StageBackend => _backend;

export function setStageBackend(backend: StageBackend): void {
  if (_backend === backend) return;
  _backend = backend;
  subs.forEach((f) => f());
}

export function toggleStageBackend(): StageBackend {
  setStageBackend(_backend === 'affine' ? 'webgl' : 'affine');
  return _backend;
}

export function subscribeStageBackend(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}
