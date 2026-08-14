/**
 * VOIE DE RENDU du monde dans l'écran de jeu (#1176) : `webgl` (`gameIso/stage/GameStage3D`) est LE
 * moteur du jeu, en développement comme en production ; `affine` (couches SVG pré-triées de
 * `CulledScene`) est la voie de SECOURS, encore joignable par l'interrupteur de chantier DEV.
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
