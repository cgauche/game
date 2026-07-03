import { CodexRef } from './compendium/CodexRef';
import { Icon } from './Icon';

/**
 * Rendu UNIQUE des Blessures (LOT 5 — composants de donnée unifiés) : icône `resource/wounds` +
 * « courant/max », popover Codex de la caractéristique Blessure. TOUT écran qui affiche des PB
 * passe par ici (CharCard, fiche, inspection) ; TOUJOURS « courant/max » — l'unité EST le
 * composant, plus de « max seul » ni de « N/M PB » divergents.
 */
export function WoundsBadge({ wounds }: { wounds: { current: number; max: number } }) {
  return (
    <CodexRef category="characteristics" label="Blessure" className="wounds-badge">
      <Icon id="resource/wounds" size="sm" />
      <b>{wounds.current}/{wounds.max}</b>
    </CodexRef>
  );
}
