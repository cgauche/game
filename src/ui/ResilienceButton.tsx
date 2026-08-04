import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';

/**
 * Bouton « Je ne faillirai pas ! » (Résilience, LDB 17 l.68) : sacrifie un Point de Résilience
 * pour une réussite garantie (Test opposé : l'emporte avec DR +1). Affiché uniquement quand il
 * reste de la Résilience ET que l'issue est défavorable (`show`).
 *
 * MÊME forme que ses sœurs de pool (Chance, Détermination) : « ressource ×N restants » + affordance
 * Codex ouvrant la RÈGLE dépensée (`regles`/`je-ne-faillirai-pas`), pas la caractéristique.
 */
export function ResilienceButton({ resilience, show, onForce }: { resilience: number; show: boolean; onForce: () => void }) {
  if (resilience <= 0 || !show) return null;
  const label = <><Icon id="fire/flame" size="sm" /> Résilience ×{resilience}</>;
  return (
    <>
      <button
        className="btn btn-resource"
        onClick={onForce}
        title="« Je ne faillirai pas ! » : sacrifie un Point de Résilience pour une réussite garantie (avant le jet ou après un échec)"
      >
        {label}
      </button>
      <CodexRef category="regles" id="je-ne-faillirai-pas" label="Je ne faillirai pas !" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
    </>
  );
}
