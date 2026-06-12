import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { CharFrame } from './CharFrame';

/**
 * En-tête A → B partagé des modales (« A attaque B », « A fait peur à B », « A lance un sort
 * sur B »…) : badge du protagoniste, flèche annotée (arme/sort/verbe), badge de la cible.
 * Source unique du bloc `rm-vs` jusqu'ici copié-collé (Attaque, Défense, Critique…).
 */
export function VsHeader({
  actor,
  target,
  label,
  verb = '→',
}: {
  actor?: Combatant | null;
  target?: Combatant | null;
  /** Annotation au-dessus de la flèche : arme (« Épée · Dégâts 6 + DR »), sort, nature du jet. */
  label?: ReactNode;
  /** Texte de la flèche (déf. « → ») : « attaque → », « ▸ »… */
  verb?: ReactNode;
}) {
  if (!actor && !target) return null;
  return (
    <div className="rm-vs">
      {actor && <CharFrame c={actor} variant="vital" size="md" />}
      {target && actor && (
        <span className="rm-vs-arrow">
          {label && (
            <>
              <span className="rm-weapon">{label}</span>
              <br />
            </>
          )}
          {verb}
        </span>
      )}
      {target && <CharFrame c={target} variant="vital" size="md" />}
    </div>
  );
}
