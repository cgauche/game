import { BACKDROPS } from './backdrops';
import { RuleDivider } from './Ornaments';

/**
 * Slot d'illustration d'ambiance (#371 lot 1) — bande en bord haut d'un panneau (auberge du hub,
 * table de jeu de taverne…). `backdropId` réfère le registre `src/ui/backdrops` ; absent ou id
 * inconnu → repli élégant (dégradé de tokens + fleuron des `Ornaments`), jamais un trou.
 */
export function SceneBackdrop({ backdropId, className }: { backdropId?: string; className?: string }) {
  const def = backdropId ? BACKDROPS[backdropId] : undefined;
  return (
    <div className={`scene-backdrop${className ? ` ${className}` : ''}`}>
      {def ? def.render() : (
        <div className="scene-backdrop-fallback"><RuleDivider /></div>
      )}
    </div>
  );
}
