import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import type { IconId } from './icons';
import { CharFrame } from './CharFrame';
import { Icon } from './Icon';

/**
 * En-tête A → B partagé des modales (« A attaque B », « A fait peur à B », « A lance un sort
 * sur B »…) : badge du protagoniste, flèche annotée (arme/sort/verbe), badge de la cible.
 * Source unique du bloc `rm-vs` jusqu'ici copié-collé (Attaque, Défense, Critique…).
 */
export function VsHeader({
  actor,
  target,
  label,
  verb,
  targetVariant = 'vital',
}: {
  actor?: Combatant | null;
  target?: Combatant | null;
  /** Annotation au-dessus de la flèche : arme (« Épée · Dégâts 6 + DR »), sort, nature du jet. */
  label?: ReactNode;
  /** Verbe de la flèche, VOCABULAIRE FERMÉ (décision utilisateur 2026-08-04, #1078) : un id du
   *  registre d'icônes, rendu par `<Icon>`. Absent → glyphe « → ». Le type interdit le texte libre :
   *  la direction A→B dit déjà qui agit, un mot y ajoutait une redite propre à chaque modale. */
  verb?: IconId;
  /** Cadre du CIBLÉ : `vital` (défaut, jauge seule) ou `full` — qui ajoute les pastilles d'ÉTATS. Une
   *  fenêtre dont le jet AGIT sur ces États (soins : suivre l'Hémorragie passe par passe) a besoin de
   *  les voir ; ailleurs, la vitalité suffit. Le défaut laisse les consommateurs existants inchangés. */
  targetVariant?: 'vital' | 'full';
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
          {verb ? <Icon id={verb} size="sm" /> : '→'}
        </span>
      )}
      {target && <CharFrame c={target} variant={targetVariant} size="md" />}
    </div>
  );
}
